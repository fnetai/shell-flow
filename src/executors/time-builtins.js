import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Gets current timestamp and writes to runtime context ($)
 *
 * @param {string} _input - Unused (for consistency)
 * @param {string} contextName - Name to store timestamp in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when operation completes
 */
export async function executeTimeNow(_input, contextName, context, runtimeContext) {
  try {
    const timestamp = Date.now();
    runtimeContext[contextName] = timestamp;
  } catch (error) {
    throw new ShellError(`Time now failed: ${error.message}`, 'time::now', 1);
  }
}

/**
 * Formats timestamp to string and writes to runtime context ($)
 */
export async function executeTimeFormat(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { timestamp, format = 'iso' } = typeof processedConfig === 'object'
      ? processedConfig
      : { timestamp: processedConfig, format: 'iso' };

    const ts = timestamp ? Number(timestamp) : Date.now();
    const date = new Date(ts);
    
    let result;
    if (format === 'iso') {
      result = date.toISOString();
    } else if (format === 'date') {
      result = date.toDateString();
    } else if (format === 'time') {
      result = date.toTimeString();
    } else if (format === 'locale') {
      result = date.toLocaleString();
    } else {
      // Simple format support: YYYY-MM-DD HH:mm:ss
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      result = format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
    }
    
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Time format failed: ${error.message}`, 'time::format', 1);
  }
}

/**
 * Parses date string to timestamp and writes to runtime context ($)
 */
export async function executeTimeParse(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const timestamp = new Date(processedInput).getTime();
    
    if (isNaN(timestamp)) {
      throw new Error(`Invalid date string: ${processedInput}`);
    }
    
    runtimeContext[contextName] = timestamp;
  } catch (error) {
    throw new ShellError(`Time parse failed: ${error.message}`, 'time::parse', 1);
  }
}

/**
 * Adds time to timestamp and writes to runtime context ($)
 */
export async function executeTimeAdd(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { timestamp, amount, unit = 'milliseconds' } = processedConfig;
    
    if (!timestamp || amount === undefined) {
      throw new Error('Add requires: timestamp, amount');
    }
    
    let milliseconds = amount;
    if (unit === 'seconds') milliseconds = amount * 1000;
    else if (unit === 'minutes') milliseconds = amount * 60 * 1000;
    else if (unit === 'hours') milliseconds = amount * 60 * 60 * 1000;
    else if (unit === 'days') milliseconds = amount * 24 * 60 * 60 * 1000;
    
    const result = timestamp + milliseconds;
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Time add failed: ${error.message}`, 'time::add', 1);
  }
}

/**
 * Calculates difference between two timestamps and writes to runtime context ($)
 */
export async function executeTimeDiff(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { from, to, unit = 'milliseconds' } = processedConfig;
    
    if (!from || !to) {
      throw new Error('Diff requires: from, to');
    }
    
    let diff = to - from;
    
    if (unit === 'seconds') diff = diff / 1000;
    else if (unit === 'minutes') diff = diff / (60 * 1000);
    else if (unit === 'hours') diff = diff / (60 * 60 * 1000);
    else if (unit === 'days') diff = diff / (24 * 60 * 60 * 1000);
    
    runtimeContext[contextName] = diff;
  } catch (error) {
    throw new ShellError(`Time diff failed: ${error.message}`, 'time::diff', 1);
  }
}

