// Import core modules
import { ProcessManager } from './core/index.js';

// Import utility modules
import { processTemplates, withRetry, normalizeRetryConfig } from './utils/index.js';

// Import executor modules
import {
  executeCommand,
  executeStepsWithScript,
  executeSleep,
  executeEcho,
  executeFilemap,
  executePause,
  executeJsonParse,
  executeJsonStringify,
  executeJsonGet,
  executeTxtUppercase,
  executeTxtLowercase,
  executeTxtTrim,
  executeTxtReplace,
  executeTxtSplit,
  executeTxtJoin,
  executeFileRead,
  executeFileWrite,
  executeFileExists,
  executeFileDelete,
  executeFileCopy,
  executeFileList,
  executeHttpGet,
  executeHttpPost,
  executeHttpPut,
  executeHttpDelete,
  executeEncodeBase64,
  executeDecodeBase64,
  executeEncodeUrl,
  executeDecodeUrl,
  executeHashSha256,
  executeHashMd5,
  executeTimeNow,
  executeTimeFormat,
  executeTimeParse,
  executeTimeAdd,
  executeTimeDiff,
  executeAssertEqual,
  executeAssertNotEqual,
  executeAssertContains,
  executeAssertExists,
  executeAssertTruthy,
  executeAssertGt,
  executeAssertGte,
  executeAssertLt,
  executeAssertLte
} from './executors/index.js';

// Import expression parser
import parseExpression from '@fnet/expression';

// --- Builtin processor dispatch ---

const BUILTIN_PROCESSORS = new Set(['json', 'txt', 'file', 'http', 'encode', 'decode', 'hash', 'time', 'assert']);

function parseStatement(processor, statement) {
  const colonIndex = statement.indexOf('::');
  if (colonIndex === -1) {
    throw new Error(`Invalid ${processor} expression format. Expected: ${processor}::<operation>::<contextName>`);
  }
  return {
    operation: statement.substring(0, colonIndex).trim(),
    contextName: statement.substring(colonIndex + 2).trim(),
  };
}

async function dispatchBuiltin(processor, statement, input, originalInput, fullContext, runtimeContext) {
  const { operation, contextName } = parseStatement(processor, statement);
  switch (processor) {
    case 'json': await dispatchJson(operation, contextName, input, originalInput, fullContext, runtimeContext); break;
    case 'txt': await dispatchTxt(operation, contextName, input, fullContext, runtimeContext); break;
    case 'file': await dispatchFile(operation, contextName, input, fullContext, runtimeContext); break;
    case 'http': await dispatchHttp(operation, contextName, input, fullContext, runtimeContext); break;
    case 'encode': await dispatchEncode(operation, contextName, input, fullContext, runtimeContext); break;
    case 'decode': await dispatchDecode(operation, contextName, input, fullContext, runtimeContext); break;
    case 'hash': await dispatchHash(operation, contextName, input, fullContext, runtimeContext); break;
    case 'time': await dispatchTime(operation, contextName, input, fullContext, runtimeContext); break;
    case 'assert': await dispatchAssert(operation, contextName, input, fullContext, runtimeContext); break;
  }
}

async function dispatchJson(operation, contextName, input, originalInput, fullContext, runtimeContext) {
  switch (operation) {
    case 'parse': await executeJsonParse(input, contextName, fullContext, runtimeContext); break;
    case 'stringify': await executeJsonStringify(originalInput, contextName, fullContext, runtimeContext); break;
    case 'get': await executeJsonGet(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown json operation: ${operation}. Supported: parse, stringify, get`);
  }
}

async function dispatchTxt(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'upper':
    case 'uppercase': await executeTxtUppercase(input, contextName, fullContext, runtimeContext); break;
    case 'lower':
    case 'lowercase': await executeTxtLowercase(input, contextName, fullContext, runtimeContext); break;
    case 'trim': await executeTxtTrim(input, contextName, fullContext, runtimeContext); break;
    case 'replace': await executeTxtReplace(input, contextName, fullContext, runtimeContext); break;
    case 'split': await executeTxtSplit(input, contextName, fullContext, runtimeContext); break;
    case 'join': await executeTxtJoin(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown txt operation: ${operation}. Supported: upper, lower, trim, replace, split, join`);
  }
}

async function dispatchFile(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'read': await executeFileRead(input, contextName, fullContext, runtimeContext); break;
    case 'write': await executeFileWrite(input, contextName, fullContext, runtimeContext); break;
    case 'exists': await executeFileExists(input, contextName, fullContext, runtimeContext); break;
    case 'delete': await executeFileDelete(input, contextName, fullContext, runtimeContext); break;
    case 'copy': await executeFileCopy(input, contextName, fullContext, runtimeContext); break;
    case 'list': await executeFileList(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown file operation: ${operation}. Supported: read, write, exists, delete, copy, list`);
  }
}

async function dispatchHttp(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'get': await executeHttpGet(input, contextName, fullContext, runtimeContext); break;
    case 'post': await executeHttpPost(input, contextName, fullContext, runtimeContext); break;
    case 'put': await executeHttpPut(input, contextName, fullContext, runtimeContext); break;
    case 'delete': await executeHttpDelete(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown http operation: ${operation}. Supported: get, post, put, delete`);
  }
}

async function dispatchEncode(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'base64': await executeEncodeBase64(input, contextName, fullContext, runtimeContext); break;
    case 'url': await executeEncodeUrl(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown encode operation: ${operation}. Supported: base64, url`);
  }
}

async function dispatchDecode(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'base64': await executeDecodeBase64(input, contextName, fullContext, runtimeContext); break;
    case 'url': await executeDecodeUrl(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown decode operation: ${operation}. Supported: base64, url`);
  }
}

async function dispatchHash(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'sha256': await executeHashSha256(input, contextName, fullContext, runtimeContext); break;
    case 'md5': await executeHashMd5(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown hash operation: ${operation}. Supported: sha256, md5`);
  }
}

async function dispatchTime(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'now': await executeTimeNow(input, contextName, fullContext, runtimeContext); break;
    case 'format': await executeTimeFormat(input, contextName, fullContext, runtimeContext); break;
    case 'parse': await executeTimeParse(input, contextName, fullContext, runtimeContext); break;
    case 'add': await executeTimeAdd(input, contextName, fullContext, runtimeContext); break;
    case 'diff': await executeTimeDiff(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown time operation: ${operation}. Supported: now, format, parse, add, diff`);
  }
}

async function dispatchAssert(operation, contextName, input, fullContext, runtimeContext) {
  switch (operation) {
    case 'equal': await executeAssertEqual(input, contextName, fullContext, runtimeContext); break;
    case 'not_equal': await executeAssertNotEqual(input, contextName, fullContext, runtimeContext); break;
    case 'contains': await executeAssertContains(input, contextName, fullContext, runtimeContext); break;
    case 'exists': await executeAssertExists(input, contextName, fullContext, runtimeContext); break;
    case 'truthy': await executeAssertTruthy(input, contextName, fullContext, runtimeContext); break;
    case 'gt': await executeAssertGt(input, contextName, fullContext, runtimeContext); break;
    case 'gte': await executeAssertGte(input, contextName, fullContext, runtimeContext); break;
    case 'lt': await executeAssertLt(input, contextName, fullContext, runtimeContext); break;
    case 'lte': await executeAssertLte(input, contextName, fullContext, runtimeContext); break;
    default: throw new Error(`Unknown assert operation: ${operation}. Supported: equal, not_equal, contains, exists, truthy, gt, gte, lt, lte`);
  }
}

/**
 * @typedef {Object} RetryConfig
 * @property {number} [attempts=3] - Maximum number of retry attempts
 * @property {number} [delay=1000] - Initial delay between retries in milliseconds
 * @property {number} [factor=2] - Exponential backoff factor
 * @property {number} [maxDelay=30000] - Maximum delay between retries in milliseconds
 * @property {number[]} [codes=[1]] - Exit codes to retry on
 */

/**
 * @typedef {Object} CommandGroup
 * @property {string[]} [steps] - Array of sequential commands
 * @property {string[]} [parallel] - Array of parallel commands
 * @property {string[]} [fork] - Array of background commands
 * @property {string|Object} [filemap] - Filemap configuration (path to config file or inline config)
 * @property {string} [onError="stop"] - Error handling policy: "stop", "continue", "log", or "throw"
 * @property {Object} [env] - Environment variables for the commands
 * @property {string} [wdir] - Working directory for the commands
 * @property {string} [captureName] - Name to capture command output
 * @property {boolean} [useScript=false] - Whether to execute commands in a script file
 * @property {boolean|RetryConfig} [retry=false] - Retry configuration
 */

/**
 * @typedef {Object} Input
 * @property {(string|string[]|CommandGroup)[]} [commands] - Sequential commands to execute
 * @property {(string|CommandGroup)[]} [parallel] - Commands to execute in parallel
 * @property {(string|CommandGroup)[]} [fork] - Commands to execute in background
 * @property {string} [onError="stop"] - Global error handling policy
 * @property {Object} [env] - Global environment variables
 * @property {string} [wdir=process.cwd()] - Global working directory
 * @property {Object} [context] - Template context object
 * @property {boolean|RetryConfig} [retry=false] - Global retry configuration
 */

/**
 * @typedef {Object} CaptureResult
 * @property {string} stdout - Command's standard output
 * @property {string} stderr - Command's standard error
 * @property {number} code - Exit code
 */

/**
 * @typedef {Object} Output
 * @property {number} exitCode - Final exit code (0 = success, non-zero = error or manual exit)
 * @property {Object.<string, CaptureResult>} [captures] - Captured outputs by captureName
 * @property {Object} [$] - Runtime context containing builtin operation results
 * @property {Object} [error] - Last error details if any occurred
 * @property {Object[]} [errors] - Array of all errors that occurred
 */

/**
 * Executes shell commands with flexible execution modes and error handling.
 * @param {Input} args - The configuration object
 * @returns {Promise<Output>} Command execution results including exitCode, captures, and runtime context ($)
 * @throws {Error} When command execution fails and onError is "throw"
 */
export default async function ({
  commands,
  fork,
  parallel,
  env,
  wdir,
  onError = "stop",
  context = {},
  retry = false,
  gracefulTimeout,
  processManager: externalProcessManager
}) {
  wdir = wdir || process.cwd();

  // Create runtime context namespace ($)
  const runtimeContext = {};

  // Merge contexts: user context + runtime context ($)
  const fullContext = {
    ...context,
    $: runtimeContext
  };

  // Use external ProcessManager if provided, otherwise create a local one
  const isExternalPM = !!externalProcessManager;
  const pmOptions = gracefulTimeout ? { gracefulTimeout } : undefined;
  const processManager = externalProcessManager || new ProcessManager(pmOptions);
  const capture = {};
  const processPromises = [];
  const globalRetryConfig = normalizeRetryConfig(retry);

  // Create a CommandRunner that holds processManager and provides methods
  const runner = {
    processManager,
    async processCommands(commands, onError, env, wdir, captureName, captureRoot, retryConfig = globalRetryConfig, loopContext = {}) {
      const capture = captureName ? { items: [] } : undefined;

      // Merge loop variables (if any) into the shared context for this invocation
      const effectiveContext = Object.keys(loopContext).length > 0
        ? { ...fullContext, ...loopContext }
        : fullContext;

      for (let cmd of commands) {
        try {
          // Store original command before template processing (needed for json::stringify)
          const originalCmd = cmd;

          // Process templates with current context (includes runtime $ context)
          cmd = processTemplates(cmd, effectiveContext);

          if (typeof cmd === 'string') {
            // Check if command uses expression syntax (processor::statement)
            // Support composable expressions: retry::3::capture::logs::command
            let actualCommand = cmd;
            let expressionCaptureName = null;
            let expressionRetryConfig = null;

            // Process expressions in a loop to support composition
            let currentExpression = cmd;
            while (currentExpression.includes('::')) {
              const parsed = parseExpression({ expression: currentExpression });

              if (!parsed || !parsed.processor) {
                // No more processors, treat as command
                actualCommand = currentExpression;
                break;
              }

              if (parsed.processor === 'capture') {
                // Format: capture::<name>::<rest>
                const colonIndex = parsed.statement.indexOf('::');
                if (colonIndex !== -1) {
                  expressionCaptureName = parsed.statement.substring(0, colonIndex).trim();
                  currentExpression = parsed.statement.substring(colonIndex + 2).trim();
                } else {
                  throw new Error(`Invalid capture expression format. Expected: capture::<name>::<command>`);
                }
              }
              else if (parsed.processor === 'retry') {
                // Format: retry::<attempts>::<rest>
                const colonIndex = parsed.statement.indexOf('::');
                if (colonIndex !== -1) {
                  const attempts = parseInt(parsed.statement.substring(0, colonIndex).trim(), 10);
                  currentExpression = parsed.statement.substring(colonIndex + 2).trim();

                  if (Number.isInteger(attempts) && attempts > 0) {
                    expressionRetryConfig = normalizeRetryConfig({
                      attempts,
                      delay: 1000,
                      factor: 2,
                      maxDelay: 30000,
                      codes: [1]
                    });
                  } else {
                    throw new Error(`Invalid retry attempts: ${attempts}. Must be a positive integer.`);
                  }
                } else {
                  throw new Error(`Invalid retry expression format. Expected: retry::<attempts>::<command>`);
                }
              }
              else {
                // Unknown processor, treat rest as command
                actualCommand = currentExpression;
                break;
              }
            }

            // If no more :: found, use current expression as command
            if (!currentExpression.includes('::') && currentExpression !== cmd) {
              actualCommand = currentExpression;
            }

            // Get the retry config for this command
            // Priority: expression > parent config
            const cmdRetryConfig = expressionRetryConfig || retryConfig;

            // Determine capture target
            const captureTarget = expressionCaptureName
              ? { items: [] }
              : capture;

            if (cmdRetryConfig) {
              await withRetry(
                () => executeCommand(actualCommand, env, wdir, captureTarget, processManager),
                cmdRetryConfig
              );
            } else {
              await executeCommand(actualCommand, env, wdir, captureTarget, processManager);
            }

            // If expression capture was used, store it in captureRoot AND $ context
            if (expressionCaptureName && captureTarget) {
              captureRoot[expressionCaptureName] = captureTarget;
              runtimeContext[expressionCaptureName] = captureTarget; // Also add to $ context
            }
          } else if (typeof cmd === 'object') {
            const keys = Object.keys(cmd);

            // Check if any key uses expression syntax (processor::statement)
            const expressionKey = keys.find(k => k.includes('::'));

            if (expressionKey) {
              // Handle expression-based object commands
              // Format: { "capture::name": "command" } or { "retry::3": "command" }
              const commandValue = cmd[expressionKey];

              // Parse the expression key
              let expressionCaptureName = null;
              let expressionRetryConfig = null;
              let nestedCommand = commandValue;

              // Process expression key
              let currentExpression = expressionKey;
              while (currentExpression.includes('::')) {
                const parsed = parseExpression({ expression: currentExpression });

                if (!parsed || !parsed.processor) break;

                if (parsed.processor === 'capture') {
                  expressionCaptureName = parsed.statement.trim();
                  break;
                } else if (parsed.processor === 'retry') {
                  const attempts = parseInt(parsed.statement.trim(), 10);
                  if (Number.isInteger(attempts) && attempts > 0) {
                    expressionRetryConfig = normalizeRetryConfig({ attempts, delay: 1000, factor: 2, maxDelay: 30000, codes: [1] });
                  } else {
                    throw new Error(`Invalid retry attempts: ${attempts}. Must be a positive integer.`);
                  }
                  break;
                } else if (parsed.processor === 'each') {
                  // Format: each::<itemName>::<arrayPath>
                  const colonIndex = parsed.statement.indexOf('::');
                  if (colonIndex === -1) {
                    throw new Error(`Invalid each expression format. Expected: each::<itemName>::<arrayPath>`);
                  }
                  const itemName = parsed.statement.substring(0, colonIndex).trim();
                  const arrayPath = parsed.statement.substring(colonIndex + 2).trim();

                  // Resolve the array by traversing the path in effectiveContext
                  const pathParts = arrayPath.split('.');
                  let array = effectiveContext;
                  for (const part of pathParts) {
                    if (array == null) break;
                    array = array[part];
                  }

                  if (!Array.isArray(array)) {
                    throw new Error(`each:: path "${arrayPath}" did not resolve to an array. Got: ${typeof array}`);
                  }

                  // Use original (unprocessed) body commands so templates resolve per-iteration
                  // (same technique as json::stringify - body was already template-processed above)
                  const rawBody = typeof originalCmd === 'object' && originalCmd[expressionKey]
                    ? originalCmd[expressionKey]
                    : nestedCommand;
                  const bodyCommands = Array.isArray(rawBody) ? rawBody : [rawBody];
                  for (const item of array) {
                    await this.processCommands(bodyCommands, onError, env, wdir, captureName, captureRoot, retryConfig, { [itemName]: item });
                  }
                  nestedCommand = null;
                  break;
                } else if (BUILTIN_PROCESSORS.has(parsed.processor)) {
                  const originalInput = typeof originalCmd === 'object' && originalCmd[expressionKey]
                    ? originalCmd[expressionKey]
                    : nestedCommand;
                  await dispatchBuiltin(parsed.processor, parsed.statement, nestedCommand, originalInput, effectiveContext, runtimeContext);
                  nestedCommand = null;
                  break;
                } else {
                  break;
                }
              }

              // Handle nested command (could be string, object, or null if already handled)
              if (nestedCommand === null) {
                // Command was already handled by builtin (e.g., json::parse)
                // Skip to next command
              } else if (typeof nestedCommand === 'string') {
                const cmdRetryConfig = expressionRetryConfig || retryConfig;
                const captureTarget = expressionCaptureName ? { items: [] } : capture;

                if (cmdRetryConfig) {
                  await withRetry(
                    () => executeCommand(nestedCommand, env, wdir, captureTarget, processManager),
                    cmdRetryConfig
                  );
                } else {
                  await executeCommand(nestedCommand, env, wdir, captureTarget, processManager);
                }

                if (expressionCaptureName && captureTarget) {
                  captureRoot[expressionCaptureName] = captureTarget;
                  runtimeContext[expressionCaptureName] = captureTarget; // Also add to $ context
                }
              } else if (typeof nestedCommand === 'object') {
                // Nested expression object: { "retry::3": { "capture::logs": "command" } }
                // Recursively process as a command
                await this.processCommands([nestedCommand], onError, env, wdir, captureName, captureRoot, expressionRetryConfig || retryConfig);
              }

              continue; // Skip to next command
            }

            // Get the command-specific retry config, falling back to parent config
            const cmdRetryConfig = cmd.retry !== undefined ? normalizeRetryConfig(cmd.retry) : retryConfig;

            if ('exit' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Exit command object must contain only the "exit" key');
              }
              const exitCode = Number(cmd.exit); // Already processed by template above
              if (Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 127) {
                // Gracefully terminate all processes before exiting
                // console.log(`Exiting with code ${exitCode}...`);

                // Set the exit code first
                process.exitCode = exitCode;

                // Terminate all processes with a longer timeout to ensure completion
                await processManager.terminateAll(2000);

                // Add a small delay to ensure all console output is flushed
                await new Promise(resolve => setTimeout(resolve, 200));

                // Break the loop to stop execution and return normally
                // This allows the parent process to read the exitCode from the result
                process.exit(exitCode);
              } else {
                throw new Error(`Invalid exit code: ${exitCode}. Must be integer between 0 and 127.`);
              }
            } else if ('sleep' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Sleep command object must contain only the "sleep" key');
              }
              await executeSleep(cmd.sleep, env, wdir, context);
            } else if ('echo' in cmd) {
              if (keys.length !== 1) {
                throw new Error('Echo command object must contain only the "echo" key');
              }
              await executeEcho(cmd.echo, env, wdir, context);
            } else if ('filemap' in cmd) {
              // Process the filemap command
              await executeFilemap(cmd.filemap, env, wdir, context);
            } else if ('pause' in cmd) {
              // Process the pause command
              await executePause(cmd.pause, env, wdir, context);
            } else if (cmd.steps) {
              const executeSteps = async () => {
                if (cmd.useScript) {
                  await executeStepsWithScript(cmd.steps, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot, processManager);
                } else {
                  await this.processCommands(cmd.steps, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, cmd.captureName, captureRoot, cmdRetryConfig, loopContext);
                }
              };

              if (cmdRetryConfig) {
                await withRetry(executeSteps, cmdRetryConfig);
              } else {
                await executeSteps();
              }
            } else if (cmd.parallel) {
              const executeParallel = async () => {
                await this.handleParallel(cmd.parallel, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot, cmdRetryConfig, loopContext);
              };

              if (cmdRetryConfig) {
                await withRetry(executeParallel, cmdRetryConfig);
              } else {
                await executeParallel();
              }
            } else if (cmd.fork) {
              const executeFork = async () => {
                await this.handleFork(cmd.fork, cmd.onError || onError, cmd.env || env, cmd.wdir || wdir, captureRoot, cmdRetryConfig, loopContext);
              };

              if (cmdRetryConfig) {
                await withRetry(executeFork, cmdRetryConfig);
              } else {
                await executeFork();
              }
            }
          }
        } catch (error) {
          // Collect error information
          const lastError = { message: error.message, command: error.command, code: error.code, onError };
          captureRoot.error = lastError;
          captureRoot.errors = captureRoot.errors || [];
          captureRoot.errors.push(lastError);

          // TODO: Add a custom formatter and more options for errors
          captureRoot.errors.format = captureRoot.errors.format || (() => JSON.stringify(captureRoot.errors, null, 2));

          // Handle error based on policy
          if (onError === "stop") {
            // Set exit code and stop execution
            if (!process.exitCode) {
              process.exitCode = error.code || 1;
            }
            break;
          }
          else if (onError === 'continue') {
            // Continue without setting exit code ("I don't care")
            continue;
          }
          else if (onError === 'throw') {
            // Re-throw for parent to handle
            throw error;
          }
        }
      }

      if (capture) {
        captureRoot[captureName] = capture;
      }
    },

    async handleParallel(parallelCommands, onError, env, wdir, captureRoot, retryConfig, loopContext = {}) {
      const tasks = parallelCommands.map((cmd) =>
        this.processCommands([cmd], onError, env, wdir, undefined, captureRoot, retryConfig, loopContext)
      );
      if (onError === 'stop') {
        await Promise.all(tasks);
      } else {
        await Promise.allSettled(tasks);
      }
    },

    async handleFork(forkCommands, onError, env, wdir, captureRoot, retryConfig, loopContext = {}) {
      // Handle both string and array inputs
      const commands = typeof forkCommands === 'string' ? [forkCommands] : forkCommands;

      // Don't await the promises, just start them and continue
      commands.forEach(cmd => {
        this.processCommands([cmd], onError, env, wdir, undefined, captureRoot, retryConfig, loopContext)
          .catch(_error => {
            // console.error(`Fork error (log): ${_error}`);
          });
      });
    }
  };

  try {
    if (commands) {
      const cmds = Array.isArray(commands) ? commands : [commands];
      processPromises.push(runner.processCommands(cmds, onError, env, wdir, undefined, capture, globalRetryConfig));
    }
    else if (parallel) {
      processPromises.push(runner.handleParallel(parallel, onError, env, wdir, capture, globalRetryConfig));
    }
    else if (fork) {
      processPromises.push(...fork.map(cmd =>
        runner.processCommands([cmd], onError, env, wdir, undefined, capture, globalRetryConfig)
          .catch(error => {
            if (onError === 'throw') throw error;
          })
      ));
    }

    await Promise.all(processPromises);

    // Return capture data + runtime context ($) + exit code
    const result = {
      exitCode: process.exitCode || 0
    };

    // Add capture data if any
    if (Object.keys(capture).length > 0) {
      Object.assign(result, capture);
    }

    // Always include runtime context ($) if it has data
    if (Object.keys(runtimeContext).length > 0) {
      result.$ = runtimeContext;
    }

    return result;
  } catch (error) {
    // Make sure to terminate all processes even if an error occurs
    // console.error(`Error in shell-flow execution: ${error.message}`);
    if (!isExternalPM) {
      await processManager.terminateAll(1000);
    }
    throw error;
  } finally {
    // Only dispose if we created the ProcessManager locally
    // External ProcessManager lifecycle is managed by the caller
    if (!isExternalPM) {
      await processManager.dispose();
    }
  }
}

export { ProcessManager };