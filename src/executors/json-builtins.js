import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Parses JSON string and writes result to runtime context ($)
 *
 * @param {string} input - JSON string to parse
 * @param {string} contextName - Name to store parsed data in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when parsing completes
 */
export async function executeJsonParse(input, contextName, context, runtimeContext) {
  try {
    // Process any templates in the input
    const processedInput = processTemplates(input, context);

    // Trim whitespace (including newlines)
    const trimmedInput = typeof processedInput === 'string' ? processedInput.trim() : processedInput;

    // Parse JSON
    const parsed = JSON.parse(trimmedInput);
    
    // Write to runtime context ($)
    runtimeContext[contextName] = parsed;
    
    // console.log(`JSON parsed and stored in $.${contextName}`);
  } catch (error) {
    throw new ShellError(`JSON parse failed: ${error.message}`, 'json::parse', 1);
  }
}

/**
 * Stringifies JavaScript object to JSON and writes to runtime context ($)
 *
 * @param {any} input - Data to stringify
 * @param {string} contextName - Name to store stringified data in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when stringification completes
 */
export async function executeJsonStringify(input, contextName, context, runtimeContext) {
  try {
    let processedInput;

    // Special handling for template references to objects
    // Check if input is a template that references an object in context
    if (typeof input === 'string' && input.match(/^\{\{\$\.([^}]+)\}\}$/)) {
      // Extract the path from the template
      const templateMatch = input.match(/^\{\{\$\.([^}]+)\}\}$/);
      const path = templateMatch[1];
      const parts = path.split('.');
      let value = context.$;

      for (const part of parts) {
        if (value === null || value === undefined) {
          throw new Error(`Cannot read property '${part}' of ${value}`);
        }
        value = value[part];
      }
      processedInput = value;
    } else {
      // For non-template inputs or complex templates, use normal processing
      processedInput = processTemplates(input, context);
    }

    // Stringify to JSON
    const stringified = JSON.stringify(processedInput, null, 2);

    // Write to runtime context ($)
    runtimeContext[contextName] = stringified;

    // console.log(`JSON stringified and stored in $.${contextName}`);
  } catch (error) {
    throw new ShellError(`JSON stringify failed: ${error.message}`, 'json::stringify', 1);
  }
}

/**
 * Gets a value from a JSON path and writes to runtime context ($)
 *
 * @param {string} path - JSON path (e.g., "user.name" or "items.0.id")
 * @param {string} contextName - Name to store extracted value in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when extraction completes
 */
export async function executeJsonGet(path, contextName, context, runtimeContext) {
  try {
    // Process any templates in the path
    const processedPath = processTemplates(path, context);
    
    // Split path and traverse
    const parts = processedPath.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value === null || value === undefined) {
        throw new Error(`Cannot read property '${part}' of ${value}`);
      }
      value = value[part];
    }
    
    // Write to runtime context ($)
    runtimeContext[contextName] = value;
    
    // console.log(`JSON path extracted and stored in $.${contextName}`);
  } catch (error) {
    throw new ShellError(`JSON get failed: ${error.message}`, 'json::get', 1);
  }
}

