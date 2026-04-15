import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Asserts strict equality between two values
 *
 * @param {any} input - Array of [actual, expected] or single value
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertEqual(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, expected] = parseAssertPair(processedInput);

    const passed = String(actual) === String(expected);
    runtimeContext[contextName] = { passed, actual, expected };

    if (!passed) {
      throw new Error(`Expected "${expected}" but got "${actual}"`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected')) {
      throw new ShellError(`Assertion failed (equal): ${error.message}`, 'assert::equal', 1);
    }
    throw new ShellError(`Assertion error (equal): ${error.message}`, 'assert::equal', 1);
  }
}

/**
 * Asserts two values are not equal
 *
 * @param {any} input - Array of [actual, unexpected]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertNotEqual(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, unexpected] = parseAssertPair(processedInput);

    const passed = String(actual) !== String(unexpected);
    runtimeContext[contextName] = { passed, actual, unexpected };

    if (!passed) {
      throw new Error(`Expected value to not equal "${unexpected}"`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected')) {
      throw new ShellError(`Assertion failed (not_equal): ${error.message}`, 'assert::not_equal', 1);
    }
    throw new ShellError(`Assertion error (not_equal): ${error.message}`, 'assert::not_equal', 1);
  }
}

/**
 * Asserts that a string or array contains a value
 *
 * @param {any} input - Array of [haystack, needle]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertContains(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [haystack, needle] = parseAssertPair(processedInput);

    let passed;
    if (Array.isArray(haystack)) {
      passed = haystack.includes(needle);
    } else {
      passed = String(haystack).includes(String(needle));
    }

    runtimeContext[contextName] = { passed, haystack, needle };

    if (!passed) {
      throw new Error(`Expected "${haystack}" to contain "${needle}"`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected')) {
      throw new ShellError(`Assertion failed (contains): ${error.message}`, 'assert::contains', 1);
    }
    throw new ShellError(`Assertion error (contains): ${error.message}`, 'assert::contains', 1);
  }
}

/**
 * Asserts that a file exists at the given path
 *
 * @param {string} input - File path to check
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertExists(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const filePath = String(processedInput).trim();
    const resolvedPath = resolve(filePath);
    const passed = existsSync(resolvedPath);

    runtimeContext[contextName] = { passed, path: filePath };

    if (!passed) {
      throw new Error(`File does not exist: "${filePath}"`);
    }
  } catch (error) {
    if (error.message.startsWith('File does not')) {
      throw new ShellError(`Assertion failed (exists): ${error.message}`, 'assert::exists', 1);
    }
    throw new ShellError(`Assertion error (exists): ${error.message}`, 'assert::exists', 1);
  }
}

/**
 * Asserts that a value is truthy
 *
 * @param {any} input - Value to check for truthiness
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertTruthy(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const value = processedInput;

    // Treat "false", "0", "", "null", "undefined" as falsy strings
    const falsyStrings = ['false', '0', '', 'null', 'undefined'];
    const passed = value != null && !falsyStrings.includes(String(value).trim().toLowerCase());

    runtimeContext[contextName] = { passed, value };

    if (!passed) {
      throw new Error(`Expected truthy value but got "${value}"`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected truthy')) {
      throw new ShellError(`Assertion failed (truthy): ${error.message}`, 'assert::truthy', 1);
    }
    throw new ShellError(`Assertion error (truthy): ${error.message}`, 'assert::truthy', 1);
  }
}

/**
 * Asserts that actual > expected (numeric comparison)
 *
 * @param {any} input - Array of [actual, expected]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertGt(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, expected] = parseAssertPair(processedInput).map(Number);

    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(`Both values must be numeric. Got: actual="${actual}", expected="${expected}"`);
    }

    const passed = actual > expected;
    runtimeContext[contextName] = { passed, actual, expected };

    if (!passed) {
      throw new Error(`Expected ${actual} > ${expected}`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected') || error.message.startsWith('Both values')) {
      throw new ShellError(`Assertion failed (gt): ${error.message}`, 'assert::gt', 1);
    }
    throw new ShellError(`Assertion error (gt): ${error.message}`, 'assert::gt', 1);
  }
}

/**
 * Asserts that actual >= expected (numeric comparison)
 *
 * @param {any} input - Array of [actual, expected]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertGte(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, expected] = parseAssertPair(processedInput).map(Number);

    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(`Both values must be numeric. Got: actual="${actual}", expected="${expected}"`);
    }

    const passed = actual >= expected;
    runtimeContext[contextName] = { passed, actual, expected };

    if (!passed) {
      throw new Error(`Expected ${actual} >= ${expected}`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected') || error.message.startsWith('Both values')) {
      throw new ShellError(`Assertion failed (gte): ${error.message}`, 'assert::gte', 1);
    }
    throw new ShellError(`Assertion error (gte): ${error.message}`, 'assert::gte', 1);
  }
}

/**
 * Asserts that actual < expected (numeric comparison)
 *
 * @param {any} input - Array of [actual, expected]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertLt(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, expected] = parseAssertPair(processedInput).map(Number);

    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(`Both values must be numeric. Got: actual="${actual}", expected="${expected}"`);
    }

    const passed = actual < expected;
    runtimeContext[contextName] = { passed, actual, expected };

    if (!passed) {
      throw new Error(`Expected ${actual} < ${expected}`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected') || error.message.startsWith('Both values')) {
      throw new ShellError(`Assertion failed (lt): ${error.message}`, 'assert::lt', 1);
    }
    throw new ShellError(`Assertion error (lt): ${error.message}`, 'assert::lt', 1);
  }
}

/**
 * Asserts that actual <= expected (numeric comparison)
 *
 * @param {any} input - Array of [actual, expected]
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($)
 * @returns {Promise<void>}
 */
export async function executeAssertLte(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const [actual, expected] = parseAssertPair(processedInput).map(Number);

    if (isNaN(actual) || isNaN(expected)) {
      throw new Error(`Both values must be numeric. Got: actual="${actual}", expected="${expected}"`);
    }

    const passed = actual <= expected;
    runtimeContext[contextName] = { passed, actual, expected };

    if (!passed) {
      throw new Error(`Expected ${actual} <= ${expected}`);
    }
  } catch (error) {
    if (error.message.startsWith('Expected') || error.message.startsWith('Both values')) {
      throw new ShellError(`Assertion failed (lte): ${error.message}`, 'assert::lte', 1);
    }
    throw new ShellError(`Assertion error (lte): ${error.message}`, 'assert::lte', 1);
  }
}

// --- Helper ---

function parseAssertPair(input) {
  if (Array.isArray(input)) {
    if (input.length !== 2) {
      throw new Error(`Expected array with exactly 2 elements [actual, expected], got ${input.length}`);
    }
    return input;
  }
  // Try to parse as JSON array
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed) && parsed.length === 2) {
        return parsed;
      }
    } catch (_) {
      // not JSON
    }
  }
  throw new Error(`Expected [actual, expected] array. Got: ${typeof input}`);
}
