import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';
import crypto from 'crypto';

/**
 * Encodes string to Base64 and writes to runtime context ($)
 *
 * @param {string} input - String to encode
 * @param {string} contextName - Name to store result in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when encoding completes
 */
export async function executeEncodeBase64(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = Buffer.from(String(processedInput)).toString('base64');
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Base64 encode failed: ${error.message}`, 'encode::base64', 1);
  }
}

/**
 * Decodes Base64 string and writes to runtime context ($)
 */
export async function executeDecodeBase64(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = Buffer.from(String(processedInput), 'base64').toString('utf-8');
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`Base64 decode failed: ${error.message}`, 'decode::base64', 1);
  }
}

/**
 * URL encodes string and writes to runtime context ($)
 */
export async function executeEncodeUrl(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = encodeURIComponent(String(processedInput));
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`URL encode failed: ${error.message}`, 'encode::url', 1);
  }
}

/**
 * URL decodes string and writes to runtime context ($)
 */
export async function executeDecodeUrl(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const result = decodeURIComponent(String(processedInput));
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`URL decode failed: ${error.message}`, 'decode::url', 1);
  }
}

/**
 * Hashes string with SHA256 and writes to runtime context ($)
 */
export async function executeHashSha256(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const hash = crypto.createHash('sha256');
    hash.update(String(processedInput));
    const result = hash.digest('hex');
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`SHA256 hash failed: ${error.message}`, 'hash::sha256', 1);
  }
}

/**
 * Hashes string with MD5 and writes to runtime context ($)
 */
export async function executeHashMd5(input, contextName, context, runtimeContext) {
  try {
    const processedInput = processTemplates(input, context);
    const hash = crypto.createHash('md5');
    hash.update(String(processedInput));
    const result = hash.digest('hex');
    runtimeContext[contextName] = result;
  } catch (error) {
    throw new ShellError(`MD5 hash failed: ${error.message}`, 'hash::md5', 1);
  }
}

