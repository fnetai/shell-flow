import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

class ProcessManager {
  #processes = new Set();
  #cleanup;

  constructor() {
    this.#cleanup = () => {
      for (const proc of this.#processes) {
        try {
          proc.kill();
        } catch (err) {
          console.error(`Failed to kill process: ${err}`);
        }
      }
    };

    process.once('SIGINT', this.#cleanup);
    process.once('SIGTERM', this.#cleanup);
    process.once('exit', this.#cleanup);
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
    process.off('SIGINT', this.#cleanup);
    process.off('SIGTERM', this.#cleanup);
    process.off('exit', this.#cleanup);
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
  
  return str.replace(/\{\{([^}]+?)([\!?])?\}\}/g, (match, path, flag) => {
    // Handle both dot notation and array access
    const value = path.trim()
      .replace(/\[(\w+)\]/g, '.$1') // Convert [0] to .0
      .split('.')
      .reduce((obj, key) => {
        // Handle array indices
        if (/^\d+$/.test(key)) {
          return obj?.[parseInt(key, 10)];
        }
        return obj?.[key];
      }, context);

    if (value !== undefined) return String(value);
    
    if (flag === '!') throw new Error(`Required value '${path.trim()}' not found in context`);
    if (flag === '?') return '';
    return match;
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
  
  if (typeof input === 'string') return resolveTemplates(input, context || {});
  if (Array.isArray(input)) return input.map(item => processTemplates(item, context));
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, processTemplates(v, context)])
    );
  }
  return input;
}

/**
 * @typedef {Object} CommandGroup
 * @property {string[]} [steps] - Array of sequential commands
 * @property {string[]} [parallel] - Array of parallel commands
 * @property {string[]} [fork] - Array of background commands
 * @property {string} [onError="stop"] - Error handling policy: "stop", "continue", "log", or "throw"
 * @property {Object} [env] - Environment variables for the commands
 * @property {string} [wdir] - Working directory for the commands
 * @property {string} [captureName] - Name to capture command output
 * @property {boolean} [useScript=false] - Whether to execute commands in a script file
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
export default async function({ 
  commands, 
  fork, 
  parallel, 
  env, 
  wdir = process.cwd(), 
  onError = "stop",
  context = {} 
}) {
  // Process templates in all inputs
  const processedCommands = processTemplates(commands, context);
  const processedFork = processTemplates(fork, context);
  const processedParallel = processTemplates(parallel, context);
  const processedEnv = processTemplates(env, context);
  const processedWdir = processTemplates(wdir, context);

  const processManager = new ProcessManager();
  const capture = {};
  const processPromises = [];

  // Create a CommandRunner that holds processManager and provides methods
  const runner = {
    processManager,
    async processCommands(commands, onError, env, wdir, captureName, captureRoot) {
      const capture = captureName ? { items: [] } : undefined;

      for (const cmd of commands) {
        try {
          if (typeof cmd === 'string') {
            await executeCommand(cmd, env, wdir, capture, processManager);
          } else if (cmd.steps) {
            if (cmd.useScript) {
              await executeStepsWithScript(cmd.steps, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot, processManager);
            } else {
              await this.processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot);
            }
          } else if (cmd.parallel) {
            await this.handleParallel(cmd.parallel, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot);
          } else if (cmd.fork) {
            await this.handleFork(cmd.fork, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot);
          }
        } catch (error) {
          console.error(`Error occurred: ${error.message}`);

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

    async handleParallel(parallelCommands, onError, env, wdir, captureRoot) {
      const tasks = parallelCommands.map((cmd) => 
        this.processCommands([cmd], onError, env, wdir, undefined, captureRoot)
      );
      if (onError === 'stop') {
        await Promise.all(tasks);
      } else {
        await Promise.allSettled(tasks);
      }
    },

    async handleFork(forkCommands, onError, env, wdir, captureRoot) {
      for (const cmd of forkCommands) {
        try {
          await this.processCommands([cmd], onError, env, wdir, undefined, captureRoot);
        } catch (error) {
          console.error(`Fork error (log): ${error}`);
        }
      }
    }
  };

  try {
    if (processedCommands) {
      let temp = processedCommands;
      if (!Array.isArray(processedCommands)) temp = [processedCommands];
      processPromises.push(runner.processCommands(temp, onError, processedEnv, processedWdir, undefined, capture));
    }
    else if (processedParallel) {
      processPromises.push(runner.handleParallel(processedParallel, onError, processedEnv, processedWdir, capture));
    }
    else if (processedFork) {
      processPromises.push(...processedFork.map(cmd => 
        runner.processCommands([cmd], onError, processedEnv, processedWdir, undefined, capture)
          .catch(error => {
            console.error(`Fork error (log): ${error.message}`);
            if (onError === 'throw') throw error;
          })
      ));
    }

    await Promise.all(processPromises);
    return Object.keys(capture).length ? capture : undefined;
  } finally {
    processManager.dispose();
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
      cwd: wdir ? path.resolve(wdir) : process.cwd()
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
 * @returns {Promise<void>} Resolves when all commands complete.
 */
async function executeStepsWithScript(steps, env, wdir, captureName, captureRoot, processManager) {
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
      await runner.processCommands([step], "stop", env, cwd);
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
      });

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

        if (code === 0) {
          resolve();
        } else {
          reject(new ShellError('Script process finished with error.', scriptPath, code));
        }
      });

      pcs.on('error', (error) => {
        reject(new ShellError(error.message, scriptPath));
      });
    });
  } finally {
    // Clean up the temporary file
    await unlink(scriptPath).catch((err) =>
      console.error(`Failed to delete temp script: ${scriptPath}`, err)
    );
  }
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
