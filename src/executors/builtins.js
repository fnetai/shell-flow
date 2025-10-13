import { ProcessManager, ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';
import executeCommand from './executeCommand.js';

/**
 * Executes a sleep command using the shell's sleep command
 *
 * @param {number|string} seconds - Number of seconds to sleep
 * @param {Object} env - Environment variables for the command
 * @param {string} wdir - Working directory for the command
 * @param {Object} context - Template context object
 * @returns {Promise<void>} Resolves when the sleep completes
 */
export async function executeSleep(seconds, env, wdir, context) {
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
export async function executeEcho(message, env, wdir, context) {
  try {
    // Process any templates in the message
    const processedMessage = processTemplates(message, context);

    // Use the shell's echo command with basic escaping
    const safeMessage = String(processedMessage).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const command = `echo "${safeMessage}"`;
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
export async function executeFilemap(config, _env, wdir, context) {
  try {
    // Process any templates in the config
    const processedConfig = processTemplates(config, context);

    // Validate: filemap accepts only object configuration
    if (processedConfig === null || typeof processedConfig !== 'object') {
      throw new Error('Filemap config must be an object with { target, sources, ... }');
    }

    // If wdir is provided and processedConfig doesn't have a wdir, add it
    if (wdir && !processedConfig.wdir) {
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
export async function executePause(message, env, wdir, context) {
  try {
    let displayMessage;

    if (message === true) {
      displayMessage = 'Press Enter to continue...';
    } else {
      // Process any templates in the message
      displayMessage = processTemplates(message, context);
    }

    // Use a simple shell command to display the message and wait for Enter
    const msg = displayMessage || 'Press Enter to continue...';
    const safeMsg = String(msg).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const command = `echo "${safeMsg}" && read`;

    // Execute the command with a fallback to Node readline in non-interactive shells
    try {
      await executeCommand(command, env, wdir, null, new ProcessManager());
    } catch (_err) {
      const rlModule = await import('node:readline');
      const rl = rlModule.createInterface({ input: process.stdin, output: process.stdout });
      await new Promise(resolve => {
        rl.question(`${msg}\n`, () => {
          rl.close();
          resolve();
        });
      });
    }
  } catch (error) {
    throw new ShellError(`Pause operation failed: ${error.message}`, 'pause', 1);
  }
}

