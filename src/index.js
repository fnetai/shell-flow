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
export default async ({ commands, onError = "stop"}) => {
  if (!Array.isArray(commands)) commands = [commands];
  await processCommands(commands, onError, process.env);
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
async function processCommands(commands, onError, env = process.env, wdir = process.cwd()) {
  for (const cmd of commands) {
    try {
      if (typeof cmd === 'string') {
        // Execute a single command sequentially
        await executeCommand(cmd, env, wdir);
      } else if (cmd.steps) {
        // Execute steps (sequential) commands if explicitly specified
        if (cmd.useScript) {
          await executeStepsWithScript(cmd.steps, cmd.env || env, cmd.wdir || wdir);
        } else {
          await processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir);
        }
      } else if (cmd.parallel) {
        // Parallel command execution with error handling
        await handleParallel(cmd.parallel, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir);
      } else if (cmd.fork) {
        // Forked command execution with error handling
        handleFork(cmd.fork, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir);
      }
    } catch (error) {
      console.error(`Error occurred: ${error.message}`);
      if (onError === "stop") break; // Stop execution if onError is "stop"
      if (onError === "log") continue; // Log and continue if onError is "log"
    }
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
async function handleParallel(parallelCommands, onError, env, wdir) {
  const tasks = parallelCommands.map((cmd) => processCommands([cmd], onError, env, wdir));
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
 * @param {string} onError - Error handling policy for forked commands: "log" or "notifyParent".
 * @param {Object} env - Environment variables for the forked commands.
 * @param {string} wdir - Working directory for the forked commands.
 */
function handleFork(forkCommands, onError, env, wdir) {
  forkCommands.forEach(async (cmd) => {
    try {
      await processCommands([cmd], onError, env, wdir);
    } catch (error) {
      if (onError === 'notifyParent') {
        console.error(`Fork error reported: ${error.message}`);
      } else {
        console.log(`Fork error (log): ${error.message}`);
      }
    }
  });
}

/**
 * Executes a sequence of shell commands using a temporary script file.
 *
 * @param {Array} steps - Array of shell commands to execute sequentially.
 * @param {Object} env - Environment variables for the commands.
 * @param {string} wdir - Working directory for the commands.
 */
async function executeStepsWithScript(steps, env, wdir) {
  const cwd = wdir ? path.resolve(wdir) : process.cwd();
  const tmpFileName = path.join(tmpdir(), `temp_script_${Date.now()}`);
  const isWindows = process.platform === 'win32';

  const scriptContent = isWindows ? steps.join(' && ') : steps.join('\n');
  const scriptExtension = isWindows ? '.bat' : '.sh';
  const scriptPath = `${tmpFileName}${scriptExtension}`;
  const interpreter = isWindows ? 'cmd.exe' : 'sh';

  try {
    // Write the script to a temporary file
    await writeFile(scriptPath, scriptContent, { mode: 0o755 });

    // Execute the script
    await new Promise((resolve, reject) => {
      const process = spawn(interpreter, [scriptPath], {
        shell: true,
        stdio: 'inherit',
        env,
        cwd,
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script execution failed with code: ${code}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Script process error: ${error.message}`));
      });
    });
  } finally {
    // Clean up the temporary file
    await unlink(scriptPath).catch((err) =>
      console.error(`Failed to delete temp script: ${scriptPath}`, err)
    );
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
async function executeCommand(command, env, wdir) {
  return new Promise((resolve, reject) => {
    const cwd = wdir ? path.resolve(wdir) : process.cwd();
    const process = spawn(command, { shell: true, stdio: 'inherit', env, cwd });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Process error: ${error.message}`));
    });
  });
}