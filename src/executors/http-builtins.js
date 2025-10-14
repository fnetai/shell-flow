import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';

/**
 * Makes HTTP GET request and writes response to runtime context ($)
 *
 * @param {string|Object} config - URL string or config object
 * @param {string} contextName - Name to store response in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when request completes
 */
export async function executeHttpGet(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const url = typeof processedConfig === 'string' ? processedConfig : processedConfig.url;
    const headers = typeof processedConfig === 'object' ? processedConfig.headers : undefined;
    
    if (!url) {
      throw new Error('GET requires: url');
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers || {}
    });
    
    const body = await response.text();
    
    runtimeContext[contextName] = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: body
    };
  } catch (error) {
    throw new ShellError(`HTTP GET failed: ${error.message}`, 'http::get', 1);
  }
}

/**
 * Makes HTTP POST request and writes response to runtime context ($)
 */
export async function executeHttpPost(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { url, body, headers = {} } = processedConfig;
    
    if (!url) {
      throw new Error('POST requires: url');
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    
    const responseBody = await response.text();
    
    runtimeContext[contextName] = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody
    };
  } catch (error) {
    throw new ShellError(`HTTP POST failed: ${error.message}`, 'http::post', 1);
  }
}

/**
 * Makes HTTP PUT request and writes response to runtime context ($)
 */
export async function executeHttpPut(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { url, body, headers = {} } = processedConfig;
    
    if (!url) {
      throw new Error('PUT requires: url');
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    
    const responseBody = await response.text();
    
    runtimeContext[contextName] = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody
    };
  } catch (error) {
    throw new ShellError(`HTTP PUT failed: ${error.message}`, 'http::put', 1);
  }
}

/**
 * Makes HTTP DELETE request and writes response to runtime context ($)
 */
export async function executeHttpDelete(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const url = typeof processedConfig === 'string' ? processedConfig : processedConfig.url;
    const headers = typeof processedConfig === 'object' ? processedConfig.headers : undefined;
    
    if (!url) {
      throw new Error('DELETE requires: url');
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: headers || {}
    });
    
    const body = await response.text();
    
    runtimeContext[contextName] = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: body
    };
  } catch (error) {
    throw new ShellError(`HTTP DELETE failed: ${error.message}`, 'http::delete', 1);
  }
}

