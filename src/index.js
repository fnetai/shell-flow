// Import core modules
import { ProcessManager } from './core/index.js';

// Import utility modules
import { processTemplates } from './utils/index.js';
import { withRetry, normalizeRetryConfig } from './utils/index.js';

// Import executor modules
import {
  executeCommand,
  executeStepsWithScript,
  executeSleep,
  executeEcho,
  executeFilemap,
  executePause
} from './executors/index.js';



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
          else if (onError === 'continue') continue; // Explicit continue without logging
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
