import { spawn } from 'node:child_process';
import treeKill from 'tree-kill';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const treeKillAsync = promisify(treeKill);

class ProcessManager {
  #processes = new Set();
  #cleanup;
  #isExiting = false;

  constructor() {
    this.#cleanup = async (signal) => {
      // Prevent multiple cleanup calls
      if (this.#isExiting) {
        // If already exiting, just return - the existing cleanup will handle it
        return;
      }

      this.#isExiting = true;

      // Remove signal handlers to prevent recursive calls
      this.removeSignalHandlers();

      // console.log(`Received ${signal || 'exit'} signal. Cleaning up processes...`);

      try {
        // Terminate all processes and wait for completion
        await this.terminateAll(1500); // Give processes more time to terminate gracefully

        // Small delay to ensure all logs are flushed
        await new Promise(resolve => setTimeout(resolve, 100));

        // If this was triggered by a signal, send the same signal to the process
        // This allows the parent process to handle the exit properly
        if (signal) {
          // Set a timeout to force exit if the signal doesn't terminate the process
          setTimeout(() => {
            // console.log('Forcing exit after timeout...');
            process.exit(signal === 'SIGINT' ? 130 : 143); // 130 for SIGINT, 143 for SIGTERM
          }, 500);

          process.kill(process.pid, signal);
        }
      } catch (error) {
        // console.error('Error during cleanup:', error);
        // Force exit in case of error
        process.exit(1);
      }
    };

    // Add signal handlers
    this.addSignalHandlers();

    // Handle uncaught exceptions and unhandled promise rejections
    process.on('uncaughtException', async (_err) => {
      // console.error('Uncaught exception:', _err);
      await this.#cleanup('SIGTERM');
    });

    process.on('unhandledRejection', async (_reason) => {
      // console.error('Unhandled promise rejection:', _reason);
      await this.#cleanup('SIGTERM');
    });
  }

  addSignalHandlers() {
    process.on('SIGINT', () => this.#cleanup('SIGINT'));
    process.on('SIGTERM', () => this.#cleanup('SIGTERM'));
    process.on('exit', this.#cleanup);
  }

  removeSignalHandlers() {
    process.off('SIGINT', () => this.#cleanup('SIGINT'));
    process.off('SIGTERM', () => this.#cleanup('SIGTERM'));
    process.off('exit', this.#cleanup);
    process.off('uncaughtException', () => this.#cleanup('SIGTERM'));
    process.off('unhandledRejection', () => this.#cleanup('SIGTERM'));
  }

  track(process) {
    this.#processes.add(process);
    process.once('exit', () => {
      this.#processes.delete(process);
      if (this.#processes.size === 0) {
        this.dispose();
      }
    });
  }

  dispose() {
    this.removeSignalHandlers();
    // Ensure all processes are terminated when dispose is called
    return this.terminateAll(500);
  }

  async terminateAll(timeout = 500) { // timeout in ms
    const processes = Array.from(this.#processes);
    if (processes.length === 0) return;

    // console.log(`Terminating ${processes.length} process(es)...`);

    // First try SIGTERM for graceful shutdown
    const termPromises = processes.map(proc => {
      proc.removeAllListeners();
      return treeKillAsync(proc.pid, 'SIGTERM').catch(() => {
        // Ignore errors from SIGTERM - we'll try SIGKILL next if needed
      });
    });

    try {
      await Promise.all(termPromises);
    } catch (err) {
      // Some processes might already be gone
    }

    // Give processes some time to terminate gracefully
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout / 2, 250)));

    // Check if any processes are still running and use SIGKILL as a last resort
    const remainingProcesses = Array.from(this.#processes);
    if (remainingProcesses.length > 0) {
      // console.log(`Forcefully killing ${remainingProcesses.length} remaining process(es)...`);

      const killPromises = remainingProcesses.map(proc => {
        return treeKillAsync(proc.pid, 'SIGKILL').catch(() => {
          // Ignore errors - process might already be gone
        });
      });

      try {
        await Promise.all(killPromises);
      } catch (err) {
        // Some processes might already be gone
      }
    }

    // Final wait to ensure processes have time to exit
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout / 2, 250)));
    this.#processes.clear();
  }
}

/**
 * Resolves template variables in a string using context
 * @param {string} str - String with templates
 * @param {Object} context - Context object
 * @returns {string} Processed string
 */
function resolveTemplates(str, context) {
  if (typeof str !== 'string' || !context) return str;

  return str.replace(/\{\{([^}|]+?)(!)?(?:\s*\?\s*([^}|]+?))?(?:\s*\|\|\s*([^}|]*))?\s*\}\}/g, (_, path, modifier, conditionalValue, defaultValue) => {
    // Handle strict mode with default value error
    if (modifier === '!' && defaultValue !== undefined) {
      throw new Error(`Cannot use strict mode (!) with default value for template variable: ${path.trim()}`);
    }

    const trimmedPath = path.trim();

    // Template resolution logic
    const value = trimmedPath
      .replace(/\[(['"]?\w+['"]?)\]/g, '.$1')
      .split('.')
      .reduce((obj, key) => {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) {
          return undefined;
        }
        return /^\d+$/.test(key) ? obj[parseInt(key, 10)] : obj[key];
      }, context);

    // Handle conditional value
    if (conditionalValue !== undefined) {
      return value !== undefined ? conditionalValue.trim() : '';
    }

    if (value !== undefined) return String(value);
    if (defaultValue !== undefined) return defaultValue.trim() || '';
    if (modifier === '!') {
      throw new Error(`Required template variable not found: ${trimmedPath}`);
    }
    return '';
  });
}

/**
 * Processes templates in an object or array recursively
 * @param {*} input - Input to process
 * @param {Object} context - Context object
 * @returns {*} Processed input
 */
function processTemplates(input, context) {
  if (!input) return input;

  if (typeof input === 'string') return resolveTemplates(input, context);
  if (Array.isArray(input)) return input.map(item => processTemplates(item, input.context ? input.context : context));
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, processTemplates(v, input.context ? input.context : context)])
    );
  }
  return input;
}

/**
 * @typedef {Object} RetryConfig
 * @property {number} [attempts=3] - Maximum number of retry attempts
 * @property {number} [delay=1000] - Initial delay between retries in milliseconds
 * @property {number} [factor=2] - Exponential backoff factor
 * @property {number} [maxDelay=30000] - Maximum delay between retries in milliseconds
 * @property {number[]} [codes=[1]] - Exit codes to retry on
 */

/**
 * @typedef {Object} CommandGroup
 * @property {string[]} [steps] - Array of sequential commands
 * @property {string[]} [parallel] - Array of parallel commands
 * @property {string[]} [fork] - Array of background commands
 * @property {string|Object} [filemap] - Filemap configuration (path to config file or inline config)
 * @property {string} [onError="stop"] - Error handling policy: "stop", "continue", "log", or "throw"
 * @property {Object} [env] - Environment variables for the commands
 * @property {string} [wdir] - Working directory for the commands
 * @property {string} [captureName] - Name to capture command output
 * @property {boolean} [useScript=false] - Whether to execute commands in a script file
 * @property {boolean|RetryConfig} [retry=false] - Retry configuration
 */

/**
 * @typedef {Object} Input
 * @property {(string|string[]|CommandGroup)[]} [commands] - Sequential commands to execute
 * @property {(string|CommandGroup)[]} [parallel] - Commands to execute in parallel
 * @property {(string|CommandGroup)[]} [fork] - Commands to execute in background
 * @property {string} [onError="stop"] - Global error handling policy
 * @property {Object} [env] - Global environment variables
 * @property {string} [wdir=process.cwd()] - Global working directory
 * @property {Object} [context] - Template context object
 * @property {boolean|RetryConfig} [retry=false] - Global retry configuration
 */

/**
 * @typedef {Object} CaptureResult
 * @property {string} stdout - Command's standard output
 * @property {string} stderr - Command's standard error
 * @property {number} code - Exit code
 */

/**
 * @typedef {Object} Output
 * @property {Object.<string, CaptureResult>} [captures] - Captured outputs by captureName
 * @property {Object} [error] - Last error details if any occurred
 * @property {Object[]} [errors] - Array of all errors that occurred
 */

/**
 * Executes shell commands with flexible execution modes and error handling.
 * @param {Input} args - The configuration object
 * @returns {Promise<Output|undefined>} Command execution results if any output was captured
 * @throws {Error} When command execution fails and onError is "throw"
 */
export default async function ({
  commands,
  fork,
  parallel,
  env,
  wdir,
  onError = "stop",
  context = {},
  retry = false
}) {
  wdir = wdir || process.cwd();
  // Process templates in all inputs
  const processedCommands = processTemplates(commands, context);
  const processedFork = processTemplates(fork, context);
  const processedParallel = processTemplates(parallel, context);
  const processedEnv = processTemplates(env, context);
  const processedWdir = processTemplates(wdir, context);

  const processManager = new ProcessManager();
  const capture = {};
  const processPromises = [];
  const globalRetryConfig = normalizeRetryConfig(retry);

  // Create a CommandRunner that holds processManager and provides methods
  const runner = {
    processManager,
    async processCommands(commands, onError, env, wdir, captureName, captureRoot, retryConfig = globalRetryConfig) {
      const capture = captureName ? { items: [] } : undefined;

      for (const cmd of commands) {
        try {
          if (typeof cmd === 'string') {
            // Get the retry config for this command (use the parent's config)
            const cmdRetryConfig = retryConfig;

            if (cmdRetryConfig) {
              await withRetry(
                () => executeCommand(cmd, env, wdir, capture, processManager),
                cmdRetryConfig
              );
            } else {
              await executeCommand(cmd, env, wdir, capture, processManager);
            }
          } else if (typeof cmd === 'object') {
            const keys = Object.keys(cmd);
            // Get the command-specific retry config, falling back to parent config
            const cmdRetryConfig = cmd.retry !== undefined ? normalizeRetryConfig(cmd.retry) : retryConfig;

            if ('exit' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Exit command object must contain only the "exit" key');
              }
              const exitCode = Number(processTemplates(cmd.exit, context));
              if (Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 127) {
                // Gracefully terminate all processes before exiting
                // console.log(`Exiting with code ${exitCode}...`);

                // Set the exit code first
                process.exitCode = exitCode;

                // Terminate all processes with a longer timeout to ensure completion
                await processManager.terminateAll(2000);

                // Add a small delay to ensure all console output is flushed
                await new Promise(resolve => setTimeout(resolve, 200));

                // Exit the process directly after cleanup is complete
                process.exit(exitCode);
              } else {
                throw new Error(`Invalid exit code: ${exitCode}. Must be integer between 0 and 127.`);
              }
            } else if ('sleep' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Sleep command object must contain only the "sleep" key');
              }
              await executeSleep(cmd.sleep, env, wdir, context);
            } else if ('echo' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Echo command object must contain only the "echo" key');
              }
              await executeEcho(cmd.echo, env, wdir, context);
            } else if ('filemap' in cmd) {
              // Process the filemap command
              await executeFilemap(cmd.filemap, env, wdir, context);
            } else if ('pause' in cmd) {
              // Process the pause command
              await executePause(cmd.pause, env, wdir, context);
            } else if (cmd.steps) {
              const executeSteps = async () => {
                if (cmd.useScript) {
                  await executeStepsWithScript(cmd.steps, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot);
                } else {
                  await this.processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot, cmdRetryConfig);
                }
              };

              if (cmdRetryConfig) {
                await withRetry(executeSteps, cmdRetryConfig);
              } else {
                await executeSteps();
              }
            } else if (cmd.parallel) {
              const executeParallel = async () => {
                await this.handleParallel(cmd.parallel, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot, cmdRetryConfig);
              };

              if (cmdRetryConfig) {
                await withRetry(executeParallel, cmdRetryConfig);
              } else {
                await executeParallel();
              }
            } else if (cmd.fork) {
              const executeFork = async () => {
                await this.handleFork(cmd.fork, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot, cmdRetryConfig);
              };

              if (cmdRetryConfig) {
                await withRetry(executeFork, cmdRetryConfig);
              } else {
                await executeFork();
              }
            }
          }
        } catch (error) {
          // console.error(`Error occurred: ${error.message}`);

          const lastError = { message: error.message, command: error.command, code: error.code, onError };
          captureRoot.error = lastError;
          captureRoot.errors = captureRoot.errors || [];
          captureRoot.errors.push(lastError);

          // TODO: Add a custom formatter and more options for errors
          captureRoot.errors.format = captureRoot.errors.format || (() => JSON.stringify(captureRoot.errors, null, 2));

          if (onError === "stop") break; // Stop execution if onError is "stop"
          else if (onError === "log") continue; // Log and continue if onError is "log"
          else if (onError === 'throw') throw error;
        }
      }

      if (capture) {
        captureRoot[captureName] = capture;
      }
    },

    async handleParallel(parallelCommands, onError, env, wdir, captureRoot, retryConfig) {
      const tasks = parallelCommands.map((cmd) =>
        this.processCommands([cmd], onError, env, wdir, undefined, captureRoot, retryConfig)
      );
      if (onError === 'stop') {
        await Promise.all(tasks);
      } else {
        await Promise.allSettled(tasks);
      }
    },

    async handleFork(forkCommands, onError, env, wdir, captureRoot, retryConfig) {
      // Handle both string and array inputs
      const commands = typeof forkCommands === 'string' ? [forkCommands] : forkCommands;

      // Don't await the promises, just start them and continue
      commands.forEach(cmd => {
        this.processCommands([cmd], onError, env, wdir, undefined, captureRoot, retryConfig)
          .catch(_error => {
            // console.error(`Fork error (log): ${_error}`);
          });
      });
    }
  };

  try {
    if (processedCommands) {
      let temp = processedCommands;
      if (!Array.isArray(processedCommands)) temp = [processedCommands];
      processPromises.push(runner.processCommands(temp, onError, processedEnv, processedWdir, undefined, capture, globalRetryConfig));
    }
    else if (processedParallel) {
      processPromises.push(runner.handleParallel(processedParallel, onError, processedEnv, processedWdir, capture, globalRetryConfig));
    }
    else if (processedFork) {
      processPromises.push(...processedFork.map(cmd =>
        runner.processCommands([cmd], onError, processedEnv, processedWdir, undefined, capture, globalRetryConfig)
          .catch(error => {
            // console.error(`Fork error (log): ${error.message}`);
            if (onError === 'throw') throw error;
          })
      ));
    }

    await Promise.all(processPromises);
    return Object.keys(capture).length ? capture : undefined;
  } catch (error) {
    // Make sure to terminate all processes even if an error occurs
    // console.error(`Error in shell-flow execution: ${error.message}`);
    await processManager.terminateAll(1000);
    throw error;
  } finally {
    // Ensure all processes are terminated and signal handlers are removed
    await processManager.dispose();
  }
}

/**
 * Executes a single shell command and streams output to active stdout and stderr.
 *
 * @param {string} command - The shell command to execute.
 * @param {Object} env - Environment variables for the command.
 * @param {string} wdir - Working directory for the command.
 * @returns {Promise<void>} Resolves when the command completes.
 */
async function executeCommand(command, env, wdir, captureParent, processManager) {
  return new Promise((resolve, reject) => {
    const pcs = spawn(command, {
      shell: true,
      stdio: captureParent ? 'pipe' : 'inherit',
      env: env ? { ...process.env, ...env } : process.env,
      cwd: wdir ? path.resolve(wdir) : process.cwd(),
      detached: true  // Ensure process runs in a new group
    });

    processManager.track(pcs);
    let capture;

    if (captureParent) {
      capture = { stdout: '', stderr: '' };

      pcs.stdout.on('data', (data) => {
        capture.stdout += data.toString();
      });

      pcs.stderr.on('data', (data) => {
        capture.stderr += data.toString();
      });
    }

    pcs.on('close', (code) => {
      if (capture) {
        capture.code = code;
        captureParent.items.push(capture);
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new ShellError('Process finished with error.', command, code));
      }
    });

    pcs.on('error', (error) => {
      reject(new ShellError(error.message, command));
    });
  });
}

/**
 * Executes a sequence of shell commands using a temporary script file.
 * Handles nested command groups (parallel, fork, or steps) within the steps.
 *
 * @param {Array} steps - Array of shell commands or nested command groups to execute sequentially.
 * @param {Object} env - Environment variables for the commands.
 * @param {string} wdir - Working directory for the commands.
 * @param {string} [captureName] - Name to capture command output.
 * @param {Object} captureRoot - Root object to store captured output.
 * @returns {Promise<void>} Resolves when all commands complete.
 */
async function executeStepsWithScript(steps, env, wdir, captureName, captureRoot) {
  const { nanoid } = await import('nanoid');
  const cwd = wdir ? path.resolve(wdir) : process.cwd();
  const tmpFileName = path.join(tmpdir(), `${nanoid()}`);
  const isWindows = process.platform === 'win32';

  const scriptExtension = isWindows ? '.bat' : '.sh';
  const scriptPath = `${tmpFileName}${scriptExtension}`;
  const interpreter = isWindows ? 'cmd.exe' : 'sh';

  // Collect script content for steps
  let scriptContent = '';

  // Add shebang line based on the platform
  if (!isWindows) {
    scriptContent += '#!/bin/sh\n\n';
  }

  for (const step of steps) {
    if (typeof step === 'string') {
      // Simple shell command, append to the script content
      scriptContent += isWindows ? `${step} && ` : `${step}\n`;
    } else if (step.parallel) {
      // Handle parallel commands in the script
      const parallelCommands = step.parallel.map((cmd) => {
        if (typeof cmd === 'string') {
          return `${cmd} &`; // Add `&` for background execution
        } else {
          throw new Error('Nested groups are not supported inside parallel in script mode.');
        }
      });
      scriptContent += parallelCommands.join(' ') + (isWindows ? '' : '\nwait\n');
    } else if (step.fork) {
      // Handle fork commands in the script (background processes)
      const forkCommands = step.fork.map((cmd) => {
        if (typeof cmd === 'string') {
          return `${cmd} &`; // Run command as a background process
        } else {
          throw new Error('Nested groups are not supported inside fork in script mode.');
        }
      });
      scriptContent += forkCommands.join(' ') + (isWindows ? '' : '\n');
    } else if (step.steps) {
      // Nested steps: Process them directly (not inside the script)
      throw new Error('Nested steps are not supported in script mode. Use useScript: false for nested steps.');
    } else {
      throw new Error('Invalid command structure in steps.');
    }
  }

  // Trim trailing "&& " for Windows
  if (isWindows) {
    scriptContent = scriptContent.trimEnd().replace(/&&$/, '');
  }

  try {
    // Write the script to a temporary file
    await writeFile(scriptPath, scriptContent, { mode: 0o755, encoding: 'utf8' });

    // Execute the script
    await new Promise((resolve, reject) => {
      const pcs = spawn(interpreter, [scriptPath], {
        shell: true,
        stdio: captureName ? 'pipe' : 'inherit',
        env: env ? { ...process.env, ...env } : process.env,
        cwd,
        detached: true,
      });

      // Create a new ProcessManager for script execution if one wasn't provided
      const scriptProcessManager = new ProcessManager();
      scriptProcessManager.track(pcs);

      let capture;

      if (captureName) {
        capture = { stdout: '', stderr: '' };

        pcs.stdout.on('data', (data) => {
          capture.stdout += data.toString();
        });

        pcs.stderr.on('data', (data) => {
          capture.stderr += data.toString();
        });
      }

      pcs.on('close', (code) => {
        if (captureName) {
          capture.code = code;
          captureRoot[captureName] = capture;
        }

        // Clean up the process manager
        scriptProcessManager.dispose().then(() => {
          if (code === 0) {
            resolve();
          } else {
            reject(new ShellError('Script process finished with error.', scriptPath, code));
          }
        });
      });

      pcs.on('error', (error) => {
        // Clean up the process manager on error
        scriptProcessManager.dispose().then(() => {
          reject(new ShellError(error.message, scriptPath));
        });
      });
    });
  } finally {
    // Clean up the temporary file
    await unlink(scriptPath).catch((_err) =>
    // console.error(`Failed to delete temp script: ${scriptPath}`, _err)
    { }
    );
  }
}

/**
 * Utility function to handle retries with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {Object} options - Retry options
 * @param {number} [options.attempts=3] - Maximum number of retry attempts
 * @param {number} [options.delay=1000] - Initial delay between retries in milliseconds
 * @param {number} [options.factor=2] - Exponential backoff factor
 * @param {number} [options.maxDelay=30000] - Maximum delay between retries in milliseconds
 * @param {number[]} [options.codes=[1]] - Exit codes to retry on
 * @returns {Promise<any>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    attempts = 3,
    delay = 1000,
    factor = 2,
    maxDelay = 30000,
    codes = [1]
  } = options;

  let lastError;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry if the error code is in the retry codes list
      if (!codes.includes(error.code)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === attempts) {
        throw error;
      }

      // console.log(`Command failed with code ${error.code}. Retrying (${attempt}/${attempts}) in ${currentDelay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * factor, maxDelay);
    }
  }

  // This should never happen, but just in case
  throw lastError;
}

/**
 * Normalizes retry configuration
 * @param {boolean|Object} retry - Retry configuration
 * @returns {Object|false} - Normalized retry configuration or false if retry is disabled
 */
function normalizeRetryConfig(retry) {
  if (retry === false) return false;

  if (retry === true) {
    return {
      attempts: 3,
      delay: 1000,
      factor: 2,
      maxDelay: 30000,
      codes: [1]
    };
  }

  return {
    attempts: retry.attempts || 3,
    delay: retry.delay || 1000,
    factor: retry.factor || 2,
    maxDelay: retry.maxDelay || 30000,
    codes: retry.codes || [1]
  };
}

class ShellError extends Error {
  #code;
  #command;
  #name;
  constructor(message, command, code = 1) {
    super(message);
    this.#code = code;
    this.#command = command;
    this.#name = this.constructor.name;
  }
  get code() {
    return this.#code;
  }
  get command() {
    return this.#command;
  }
  get name() {
    return this.#name;
  }
}

/**
 * Executes a sleep command using the shell's sleep command
 *
 * @param {number|string} seconds - Number of seconds to sleep
 * @param {Object} env - Environment variables for the command
 * @param {string} wdir - Working directory for the command
 * @param {Object} context - Template context object
 * @returns {Promise<void>} Resolves when the sleep completes
 */
async function executeSleep(seconds, env, wdir, context) {
  try {
    // Process any templates in the seconds
    const processedSeconds = Number(processTemplates(seconds, context));

    if (Number.isFinite(processedSeconds) && processedSeconds >= 0) {
      // Use the shell's sleep command
      const command = `sleep ${processedSeconds}`;
      await executeCommand(command, env, wdir, null, new ProcessManager());
    } else {
      throw new Error(`Invalid sleep duration: ${processedSeconds}. Must be a non-negative number.`);
    }
  } catch (error) {
    throw new ShellError(`Sleep operation failed: ${error.message}`, 'sleep', 1);
  }
}

/**
 * Executes an echo command using the shell's echo command
 *
 * @param {string} message - Message to echo
 * @param {Object} env - Environment variables for the command
 * @param {string} wdir - Working directory for the command
 * @param {Object} context - Template context object
 * @returns {Promise<void>} Resolves when the echo completes
 */
async function executeEcho(message, env, wdir, context) {
  try {
    // Process any templates in the message
    const processedMessage = processTemplates(message, context);

    // Use the shell's echo command
    const command = `echo "${processedMessage}"`;
    await executeCommand(command, env, wdir, null, new ProcessManager());
  } catch (error) {
    throw new ShellError(`Echo operation failed: ${error.message}`, 'echo', 1);
  }
}

/**
 * Executes a filemap operation using the @fnet/filemap package
 *
 * @param {Object|string} config - Filemap configuration object or path to config file
 * @param {Object} env - Environment variables for the command
 * @param {string} wdir - Working directory for the command
 * @param {Object} context - Template context object
 * @returns {Promise<void>} Resolves when the filemap operation completes
 */
async function executeFilemap(config, _env, wdir, context) {
  try {
    // Process any templates in the config
    const processedConfig = processTemplates(config, context);

    // If wdir is provided and processedConfig doesn't have a wdir, add it
    if (wdir && typeof processedConfig === 'object' && !processedConfig.wdir) {
      processedConfig.wdir = wdir;
    }

    // Dynamically import the @fnet/filemap package
    const { default: filemap } = await import('@fnet/filemap');

    // Execute filemap with the processed config
    await filemap(processedConfig);
  } catch (error) {
    console.error(`Filemap error: ${error.message}`);
    throw new ShellError(`Filemap operation failed: ${error.message}`, 'filemap', 1);
  }
}

/**
 * Pauses execution and waits for the user to press Enter
 *
 * @param {string} message - Message to display before pausing
 * @param {Object} env - Environment variables for the command
 * @param {string} wdir - Working directory for the command
 * @param {Object} context - Template context object
 * @returns {Promise<void>} Resolves when the user presses Enter
 */
async function executePause(message, env, wdir, context) {
  try {
    let displayMessage;

    if (message === true) {
      displayMessage = 'Press Enter to continue...';
    } else {
      // Process any templates in the message
      displayMessage = processTemplates(message, context);
    }

    // Use a simple shell command to display the message and wait for Enter
    const command = `echo "${displayMessage || 'Press Enter to continue...'}" && read`;

    // Execute the command
    await executeCommand(command, env, wdir, null, new ProcessManager());
  } catch (error) {
    throw new ShellError(`Pause operation failed: ${error.message}`, 'pause', 1);
  }
}