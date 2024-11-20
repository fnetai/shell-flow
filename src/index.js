import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Executes a sequence of shell commands with a flexible error handling policy.
 *
 * @param {Object} args - The arguments object.
 * @param {Array} args.commands - Command string or array of commands or command groups to execute.
 * @param {string} [args.onError="stop"] - Error handling policy: "stop", "continue", or "log".
 * @returns {Promise<void>} Resolves when all commands complete or rejects based on the error policy.
 */
export default async ({ commands, onError = "stop" }) => {
  const capture = {};
  if (!Array.isArray(commands)) commands = [commands];

  await processCommands(commands, onError, process.env, process.cwd(), undefined, capture);

  return Object.keys(capture).length ? capture : undefined;
};

/**
 * Processes an array of commands, supporting sequential, parallel, forked, and steps executions with error policies.
 *
 * @param {Array} commands - Array of commands or command groups.
 * @param {string} onError - Determines the error handling policy for all modes.
 * @param {Object} [env] - Environment variables to pass to each command.
 * @param {string} [wdir] - Working directory for each command group.
 * @returns {Promise<void>} Resolves when all sequential commands in the array complete.
 */
async function processCommands(commands, onError, env = process.env, wdir = process.cwd(), captureName, captureRoot) {
  const capture = captureName ? { items: [] } : undefined;

  for (const cmd of commands) {
    try {
      if (typeof cmd === 'string') {
        // Execute a single command sequentially
        await executeCommand(cmd, env, wdir, capture);

      } else if (cmd.steps) {
        // Execute steps (sequential) commands if explicitly specified
        if (cmd.useScript) {
          await executeStepsWithScript(cmd.steps, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot);
        } else {
          await processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot);
        }
      } else if (cmd.parallel) {
        // Parallel command execution with error handling
        await handleParallel(cmd.parallel, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot);
      } else if (cmd.fork) {
        // Forked command execution with error handling
        handleFork(cmd.fork, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot);
      }
    } catch (error) {
      console.error(`Error occurred: ${error.message}`);

      captureRoot.errors = captureRoot.errors || [];
      captureRoot.errors.push({ message: error.message, command: error.command, code: error.code, onError });

      // TODO: Add a custom formatter and more options for errors
      captureRoot.errors.format = captureRoot.errors.format || (() => JSON.stringify(captureRoot.errors, null, 2));

      if (onError === "stop") break; // Stop execution if onError is "stop"
      if (onError === "log") continue; // Log and continue if onError is "log"
    }
  }

  if (capture) {
    captureRoot[captureName] = capture;
  }
}

/**
 * Executes commands in parallel with optional error handling policy.
 *
 * @param {Array} parallelCommands - Array of commands to execute in parallel.
 * @param {string} onError - Error handling policy for parallel commands: "stop" or "continue".
 * @param {Object} env - Environment variables for the parallel commands.
 * @param {string} wdir - Working directory for the parallel commands.
 */
async function handleParallel(parallelCommands, onError, env, wdir, captureRoot) {
  const tasks = parallelCommands.map((cmd) => processCommands([cmd], onError, env, wdir, undefined, captureRoot));
  if (onError === 'stop') {
    await Promise.all(tasks); // Waits for all to complete, throws if any error
  } else {
    await Promise.allSettled(tasks); // Collects all results, logs errors without stopping
  }
}

/**
 * Executes forked commands with optional error handling policy.
 *
 * @param {Array} forkCommands - Array of commands to execute in fork.
 * @param {string} onError - Error handling policy for forked commands: "log".
 * @param {Object} env - Environment variables for the forked commands.
 * @param {string} wdir - Working directory for the forked commands.
 */
function handleFork(forkCommands, onError, env, wdir, captureRoot) {
  forkCommands.forEach(async (cmd) => {
    try {
      await processCommands([cmd], onError, env, wdir, undefined, captureRoot);
    } catch (error) {
      console.error(`Fork error (log): ${error.message}`);
    }
  });
}

/**
 * Executes a single shell command and streams output to active stdout and stderr.
 *
 * @param {string} command - The shell command to execute.
 * @param {Object} env - Environment variables for the command.
 * @param {string} wdir - Working directory for the command.
 * @returns {Promise<void>} Resolves when the command completes.
 */
async function executeCommand(command, env, wdir, captureParent) {
  return new Promise((resolve, reject) => {
    const cwd = wdir ? path.resolve(wdir) : process.cwd();
    const process = spawn(command, {
      shell: true,
      stdio: captureParent ? 'pipe' : 'inherit',
      env,
      cwd
    });

    let capture;

    if (captureParent) {
      capture = { stdout: '', stderr: '' };

      process.stdout.on('data', (data) => {
        capture.stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        capture.stderr += data.toString();
      });
    }

    process.on('close', (code) => {
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

    process.on('error', (error) => {
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
      await processCommands([step], "stop", env, cwd);
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
      const process = spawn(interpreter, [scriptPath], {
        shell: true,
        stdio: captureName ? 'pipe' : 'inherit',
        env,
        cwd,
      });

      let capture;

      if (captureName) {
        capture = { stdout: '', stderr: '' };

        process.stdout.on('data', (data) => {
          capture.stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
          capture.stderr += data.toString();
        });
      }

      process.on('close', (code) => {
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

      process.on('error', (error) => {
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