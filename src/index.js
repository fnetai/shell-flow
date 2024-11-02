import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

/**
 * Executes a sequence of shell commands with support for error handling policies.
 *
 * @param {Object} args - The arguments object.
 * @param {Array} args.commands - Array of commands or command groups to execute.
 * @param {boolean} [args.continueOnError=false] - If true, continues execution even if a command fails (for sequential mode).
 * 
 * Command formats:
 * - Sequential: `"command"` (default behavior)
 * - Parallel: `{ parallel: ["command1", "command2"], onError: "stop" }`
 * - Fork: `{ fork: ["command1", "command2"], onError: "logOnly" }`
 *
 * @returns {Promise<void>} Resolves when all commands complete or rejects on error based on policy.
 */
export default async ({ commands, continueOnError = false }) => {
  await processCommands(commands, continueOnError);
};

/**
 * Processes an array of commands, supporting sequential, parallel, and forked executions with error policies.
 *
 * @param {Array} commands - Array of commands or command groups.
 * @param {boolean} continueOnError - Determines if execution continues on error for sequential mode.
 * @returns {Promise<void>} Resolves when all commands complete.
 */
async function processCommands(commands, continueOnError) {
  for (const cmd of commands) {
    try {
      if (typeof cmd === 'string') {
        // Execute a single command sequentially
        await executeCommand(cmd);
      } else if (cmd.parallel) {
        // Parallel command execution with error handling
        await handleParallel(cmd.parallel, cmd.onError || 'stop');
      } else if (cmd.fork) {
        // Forked command execution with error handling
        handleFork(cmd.fork, cmd.onError || 'logOnly');
      }
    } catch (error) {
      console.error(`Error occurred: ${error.message}`);
      if (!continueOnError) break; // Stop execution for sequential if continueOnError is false
    }
  }
}

/**
 * Executes commands in parallel with optional error handling policy.
 *
 * @param {Array} parallelCommands - Array of commands to execute in parallel.
 * @param {string} onError - Error handling policy: "stop" or "continue".
 */
async function handleParallel(parallelCommands, onError) {
  const tasks = parallelCommands.map((cmd) => processCommands([cmd], true));
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
 * @param {string} onError - Error handling policy: "logOnly" or "notifyParent".
 */
function handleFork(forkCommands, onError) {
  forkCommands.forEach(async (cmd) => {
    try {
      await processCommands([cmd], true);
    } catch (error) {
      if (onError === 'notifyParent') {
        console.error(`Fork error reported: ${error.message}`);
      } else {
        console.log(`Fork error (logOnly): ${error.message}`);
      }
    }
  });
}

/**
 * Executes a single shell command and logs output.
 *
 * @param {string} command - The shell command to execute.
 * @returns {Promise<void>} Resolves when the command completes.
 */
async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stdout) console.log(`Output: ${stdout}`);
    if (stderr) console.error(`Error: ${stderr}`);
  } catch (error) {
    throw new Error(`Command failed: ${command}`);
  }
}