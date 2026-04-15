import { createInterface } from 'node:readline';
import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Creates a readline interface for user input
 * @returns {import('node:readline').Interface}
 */
function createRL() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

/**
 * Asks a yes/no confirmation question and stores result in runtime context ($)
 *
 * @param {string|Object} input - Question string or { message, default }
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executePromptConfirm(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);

    let message;
    let defaultValue = null;
    let abort = false;

    if (typeof processedInput === 'string') {
      message = processedInput;
    } else if (typeof processedInput === 'object' && processedInput !== null) {
      message = processedInput.message || 'Confirm?';
      defaultValue = processedInput.default;
      abort = processedInput.abort === true;
    } else {
      message = 'Confirm?';
    }

    const defaultHint = defaultValue === true ? ' (Y/n)' :
                         defaultValue === false ? ' (y/N)' : ' (y/n)';
    const prompt = `${message}${defaultHint} `;

    const rl = createRL();
    const answer = await new Promise(resolve => {
      rl.question(prompt, (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });

    let result;
    if (answer === '') {
      result = defaultValue !== null ? defaultValue : false;
    } else {
      result = answer === 'y' || answer === 'yes';
    }

    runtimeContext[contextName] = result;

    if (abort && !result) {
      throw new ShellError('Aborted by user', 'prompt::confirm', 1);
    }
  } catch (error) {
    if (error instanceof ShellError) throw error;
    throw new ShellError(`prompt::confirm failed: ${error.message}`, 'prompt::confirm', 1);
  }
}

/**
 * Asks for text input and stores result in runtime context ($)
 *
 * @param {string|Object} input - Question string or { message, default }
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executePromptText(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);

    let message;
    let defaultValue = null;

    if (typeof processedInput === 'string') {
      message = processedInput;
    } else if (typeof processedInput === 'object' && processedInput !== null) {
      message = processedInput.message || 'Input:';
      defaultValue = processedInput.default !== undefined ? String(processedInput.default) : null;
    } else {
      message = 'Input:';
    }

    const defaultHint = defaultValue !== null ? ` (${defaultValue})` : '';
    const prompt = `${message}${defaultHint} `;

    const rl = createRL();
    const answer = await new Promise(resolve => {
      rl.question(prompt, (ans) => {
        rl.close();
        resolve(ans);
      });
    });

    const result = answer === '' && defaultValue !== null ? defaultValue : answer;
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`prompt::text failed: ${error.message}`, 'prompt::text', 1);
  }
}
