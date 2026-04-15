import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Gets an environment variable and stores it in runtime context ($)
 *
 * @param {string} input - Environment variable name to read
 * @param {string} contextName - Name to store value in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeEnvGet(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const varName = String(processedInput).trim();
    const value = process.env[varName];

    runtimeContext[contextName] = value !== undefined ? value : null;
  } catch (error) {
    throw new ShellError(`env::get failed: ${error.message}`, 'env::get', 1);
  }
}

/**
 * Sets an environment variable from a value or runtime context
 *
 * @param {any} input - Array of [varName, value] or object {name, value}
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeEnvSet(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);

    let varName, value;

    if (Array.isArray(processedInput)) {
      if (processedInput.length !== 2) {
        throw new Error(`Expected [name, value] array, got ${processedInput.length} elements`);
      }
      [varName, value] = processedInput;
    } else if (typeof processedInput === 'object' && processedInput !== null) {
      varName = processedInput.name;
      value = processedInput.value;
    } else {
      throw new Error(`Expected [name, value] array or {name, value} object. Got: ${typeof processedInput}`);
    }

    const name = String(varName).trim();
    const val = String(value);

    process.env[name] = val;
    runtimeContext[contextName] = { name, value: val, set: true };
  } catch (error) {
    if (error instanceof ShellError) throw error;
    throw new ShellError(`env::set failed: ${error.message}`, 'env::set', 1);
  }
}

/**
 * Checks if an environment variable exists
 *
 * @param {string} input - Environment variable name to check
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeEnvExists(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const varName = String(processedInput).trim();
    const exists = varName in process.env;

    runtimeContext[contextName] = exists;
  } catch (error) {
    throw new ShellError(`env::exists failed: ${error.message}`, 'env::exists', 1);
  }
}

/**
 * Lists environment variables matching a glob-like pattern
 *
 * @param {string} input - Pattern to match (supports * wildcard, e.g. "FNET_*")
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeEnvList(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const pattern = String(processedInput).trim();

    // Convert simple glob pattern to regex (only supports * wildcard)
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr);

    const matches = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (regex.test(key)) {
        matches[key] = value;
      }
    }

    runtimeContext[contextName] = matches;
  } catch (error) {
    throw new ShellError(`env::list failed: ${error.message}`, 'env::list', 1);
  }
}

/**
 * Deletes an environment variable
 *
 * @param {string} input - Environment variable name to delete
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeEnvDelete(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const varName = String(processedInput).trim();
    const existed = varName in process.env;

    delete process.env[varName];
    runtimeContext[contextName] = { name: varName, deleted: existed };
  } catch (error) {
    throw new ShellError(`env::delete failed: ${error.message}`, 'env::delete', 1);
  }
}
