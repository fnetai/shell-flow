/**
 * Utility function to handle retries with exponential backoff
 * @param {Function} fn - The function to retry
 * @param {Object} options - Retry options
 * @param {number} [options.attempts=3] - Maximum number of retry attempts
 * @param {number} [options.delay=1000] - Initial delay between retries in milliseconds
 * @param {number} [options.factor=2] - Exponential backoff factor
 * @param {number} [options.maxDelay=30000] - Maximum delay between retries in milliseconds
 * @param {number[]} [options.codes=[1]] - Exit codes to retry on
 * @returns {Promise<any>} - Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    attempts = 3,
    delay = 1000,
    factor = 2,
    maxDelay = 30000,
    codes = [1]
  } = options;

  let lastError;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry if the error code is in the retry codes list
      if (!codes.includes(error.code)) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === attempts) {
        throw error;
      }

      // console.log(`Command failed with code ${error.code}. Retrying (${attempt}/${attempts}) in ${currentDelay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));

      // Calculate next delay with exponential backoff
      currentDelay = Math.min(currentDelay * factor, maxDelay);
    }
  }

  // This should never happen, but just in case
  throw lastError;
}

/**
 * Normalizes retry configuration
 * @param {boolean|Object} retry - Retry configuration
 * @returns {Object|false} - Normalized retry configuration or false if retry is disabled
 */
export function normalizeRetryConfig(retry) {
  if (retry === false) return false;

  if (retry === true) {
    return {
      attempts: 3,
      delay: 1000,
      factor: 2,
      maxDelay: 30000,
      codes: [1]
    };
  }

  return {
    attempts: retry.attempts || 3,
    delay: retry.delay || 1000,
    factor: retry.factor || 2,
    maxDelay: retry.maxDelay || 30000,
    codes: retry.codes || [1]
  };
}

