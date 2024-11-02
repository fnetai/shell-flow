import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Executes a sequence of shell commands with a flexible error handling policy.
 *
 * @param {Object} args - The arguments object.
 * @param {Array} args.commands - Command string or array of commands or command groups to execute.
 * @param {string} [args.onError="stop"] - Error handling policy: "stop", "continue", or "log".
 * 
 * Command formats:
 * - Sequential (default): `"command"` or `steps: [...]`
 * - Parallel: `{ parallel: ["command1", "command2"], onError: "stop" }`
 * - Fork: `{ fork: ["command1", "command2"], onError: "log" }`
 *
 * @returns {Promise<void>} Resolves when all commands complete or rejects based on the error policy.
 */
export default async ({ commands, onError = "stop" }) => {
  if (!Array.isArray(commands)) commands = [commands];

  await processCommands(commands, onError);
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
        await processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir);
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
 * Executes a single shell command and streams output to active stdout and stderr.
 *
 * @param {string} command - The shell command to execute.
 * @param {Object} env - Environment variables for the command.
 * @param {string} wdir - Working directory for the command.
 * @returns {Promise<void>} Resolves when the command completes.
 */
async function executeCommand(command, env, wdir) {
  return new Promise((resolve, reject) => {
    // Resolve the working directory to an absolute path
    const cwd = wdir ? path.resolve(wdir) : process.cwd();

    const process = spawn(command, { shell: true, stdio: 'inherit', env, cwd }); // Pass env and cwd variables

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