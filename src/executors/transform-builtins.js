import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Converts string to uppercase and writes to runtime context ($)
 *
 * @param {string} input - String to convert
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when conversion completes
 */
export async function executeTransformUppercase(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = String(processedInput).toUpperCase();
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform uppercase failed: ${error.message}`, 'transform::uppercase', 1);
  }
}

/**
 * Converts string to lowercase and writes to runtime context ($)
 */
export async function executeTransformLowercase(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = String(processedInput).toLowerCase();
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform lowercase failed: ${error.message}`, 'transform::lowercase', 1);
  }
}

/**
 * Trims whitespace from string and writes to runtime context ($)
 */
export async function executeTransformTrim(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = String(processedInput).trim();
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform trim failed: ${error.message}`, 'transform::trim', 1);
  }
}

/**
 * Replaces text in string and writes to runtime context ($)
 */
export async function executeTransformReplace(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { input, search, replace, flags = 'g' } = processedConfig;
    
    if (!input || search === undefined || replace === undefined) {
      throw new Error('Replace requires: input, search, replace');
    }
    
    const regex = new RegExp(search, flags);
    const result = String(input).replace(regex, replace);
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform replace failed: ${error.message}`, 'transform::replace', 1);
  }
}

/**
 * Splits string into array and writes to runtime context ($)
 */
export async function executeTransformSplit(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { input, delimiter = ',' } = processedConfig;
    
    if (!input) {
      throw new Error('Split requires: input');
    }
    
    const result = String(input).split(delimiter);
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform split failed: ${error.message}`, 'transform::split', 1);
  }
}

/**
 * Joins array into string and writes to runtime context ($)
 */
export async function executeTransformJoin(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { input, delimiter = ',' } = processedConfig;
    
    if (!input || !Array.isArray(input)) {
      throw new Error('Join requires: input (array)');
    }
    
    const result = input.join(delimiter);
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Transform join failed: ${error.message}`, 'transform::join', 1);
  }
}

