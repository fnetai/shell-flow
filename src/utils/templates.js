/**
 * Resolves template variables in a string using context
 * @param {string} str - String with templates
 * @param {Object} context - Context object
 * @returns {string} Processed string
 */
export function resolveTemplates(str, context) {
  if (typeof str !== 'string' || !context) return str;

  return str.replace(/\{\{([^}|]+?)(!)?(?:\s*\?\s*([^}|]+?))?(?:\s*\|\|\s*([^}|]*))?\s*\}\}/g, (_, path, modifier, conditionalValue, defaultValue) => {
    // Handle strict mode with default value error
    if (modifier === '!' && defaultValue !== undefined) {
      throw new Error(`Cannot use strict mode (!) with default value for template variable: ${path.trim()}`);
    }

    const trimmedPath = path.trim();

    // Template resolution logic
    const value = trimmedPath
      .replace(/\[(['"]?\w+['"]?)\]/g, '.$1')
      .split('.')
      .reduce((obj, key) => {
        if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) {
          return undefined;
        }
        return /^\d+$/.test(key) ? obj[parseInt(key, 10)] : obj[key];
      }, context);

    // Handle conditional value
    if (conditionalValue !== undefined) {
      return value !== undefined ? conditionalValue.trim() : '';
    }

    if (value !== undefined) return String(value);
    if (defaultValue !== undefined) return defaultValue.trim() || '';
    if (modifier === '!') {
      throw new Error(`Required template variable not found: ${trimmedPath}`);
    }
    return '';
  });
}

/**
 * Processes templates in an object or array recursively
 * @param {*} input - Input to process
 * @param {Object} context - Context object
 * @returns {*} Processed input
 */
export function processTemplates(input, context) {
  if (!input) return input;

  if (typeof input === 'string') return resolveTemplates(input, context);
  if (Array.isArray(input)) return input.map(item => processTemplates(item, input.context ? input.context : context));
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, processTemplates(v, input.context ? input.context : context)])
    );
  }
  return input;
}

