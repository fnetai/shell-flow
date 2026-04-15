import { ShellError } from '../core/index.js';

/**
 * Wraps a function with a timeout. If the function doesn't resolve
 * within the specified duration, a ShellError is thrown.
 *
 * @param {Function} fn - Async function to execute
 * @param {number} seconds - Timeout in seconds
 * @returns {Promise<any>} Result of the function
 * @throws {ShellError} When the timeout is exceeded
 */
export async function withTimeout(fn, seconds) {
  if (!seconds || seconds <= 0) {
    return fn();
  }

  const ms = seconds * 1000;

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ShellError(
        `Command timed out after ${seconds}s`,
        'timeout',
        124 // Standard timeout exit code (consistent with GNU timeout)
      ));
    }, ms);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}
