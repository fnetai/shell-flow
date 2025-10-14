import { ShellError } from '../core/index.js';
import { processTemplates } from '../utils/index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Reads file content and writes to runtime context ($)
 *
 * @param {string} filePath - Path to file to read
 * @param {string} contextName - Name to store content in runtime context ($)
 * @param {Object} context - Full context object (includes $ namespace)
 * @param {Object} runtimeContext - Runtime context object ($) where result will be written
 * @returns {Promise<void>} Resolves when read completes
 */
export async function executeFileRead(filePath, contextName, context, runtimeContext) {
  try {
    const processedPath = processTemplates(filePath, context);
    const resolvedPath = path.resolve(processedPath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    runtimeContext[contextName] = content;
  } catch (error) {
    throw new ShellError(`File read failed: ${error.message}`, 'file::read', 1);
  }
}

/**
 * Writes content to file and writes result to runtime context ($)
 */
export async function executeFileWrite(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { path: filePath, content } = processedConfig;
    
    if (!filePath || content === undefined) {
      throw new Error('Write requires: path, content');
    }
    
    const resolvedPath = path.resolve(filePath);
    await fs.writeFile(resolvedPath, String(content), 'utf-8');
    runtimeContext[contextName] = { path: resolvedPath, success: true };
  } catch (error) {
    throw new ShellError(`File write failed: ${error.message}`, 'file::write', 1);
  }
}

/**
 * Checks if file exists and writes result to runtime context ($)
 */
export async function executeFileExists(filePath, contextName, context, runtimeContext) {
  try {
    const processedPath = processTemplates(filePath, context);
    const resolvedPath = path.resolve(processedPath);
    
    try {
      await fs.access(resolvedPath);
      runtimeContext[contextName] = true;
    } catch {
      runtimeContext[contextName] = false;
    }
  } catch (error) {
    throw new ShellError(`File exists check failed: ${error.message}`, 'file::exists', 1);
  }
}

/**
 * Deletes file and writes result to runtime context ($)
 */
export async function executeFileDelete(filePath, contextName, context, runtimeContext) {
  try {
    const processedPath = processTemplates(filePath, context);
    const resolvedPath = path.resolve(processedPath);
    await fs.unlink(resolvedPath);
    runtimeContext[contextName] = { path: resolvedPath, deleted: true };
  } catch (error) {
    throw new ShellError(`File delete failed: ${error.message}`, 'file::delete', 1);
  }
}

/**
 * Copies file and writes result to runtime context ($)
 */
export async function executeFileCopy(config, contextName, context, runtimeContext) {
  try {
    const processedConfig = processTemplates(config, context);
    const { from, to } = processedConfig;
    
    if (!from || !to) {
      throw new Error('Copy requires: from, to');
    }
    
    const resolvedFrom = path.resolve(from);
    const resolvedTo = path.resolve(to);
    await fs.copyFile(resolvedFrom, resolvedTo);
    runtimeContext[contextName] = { from: resolvedFrom, to: resolvedTo, success: true };
  } catch (error) {
    throw new ShellError(`File copy failed: ${error.message}`, 'file::copy', 1);
  }
}

/**
 * Lists directory contents and writes to runtime context ($)
 */
export async function executeFileList(dirPath, contextName, context, runtimeContext) {
  try {
    const processedPath = processTemplates(dirPath, context);
    const resolvedPath = path.resolve(processedPath);
    const files = await fs.readdir(resolvedPath);
    runtimeContext[contextName] = files;
  } catch (error) {
    throw new ShellError(`File list failed: ${error.message}`, 'file::list', 1);
  }
}

