import { spawn } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ShellError } from '../core/index.js';

/**
 * Executes a sequence of shell commands using a temporary script file.
 * Handles nested command groups (parallel, fork, or steps) within the steps.
 *
 * @param {Array} steps - Array of shell commands or nested command groups to execute sequentially.
 * @param {Object} env - Environment variables for the commands.
 * @param {string} wdir - Working directory for the commands.
 * @param {string} [captureName] - Name to capture command output.
 * @param {Object} captureRoot - Root object to store captured output.
 * @param {import('../core/ProcessManager.js').default} processManager - Shared process manager instance.
 * @returns {Promise<void>} Resolves when all commands complete.
 */
export default async function executeStepsWithScript(steps, env, wdir, captureName, captureRoot, processManager) {
  const { nanoid } = await import('nanoid');
  const cwd = wdir ? path.resolve(wdir) : process.cwd();
  const tmpFileName = path.join(tmpdir(), `${nanoid()}`);
  const isWindows = process.platform === 'win32';

  const scriptExtension = isWindows ? '.bat' : '.sh';
  const scriptPath = `${tmpFileName}${scriptExtension}`;
  const interpreter = isWindows ? 'cmd.exe' : 'sh';

  // Collect script content for steps
  let scriptContent = '';

  // Add shebang line based on the platform
  if (!isWindows) {
    scriptContent += '#!/bin/sh\n\n';
  }

  for (const step of steps) {
    if (typeof step === 'string') {
      // Simple shell command, append to the script content
      scriptContent += isWindows ? `${step} && ` : `${step}\n`;
    } else if (step.parallel) {
      // Handle parallel commands in the script
      const parallelCommands = step.parallel.map((cmd) => {
        if (typeof cmd === 'string') {
          return `${cmd} &`; // Add `&` for background execution
        } else {
          throw new Error('Nested groups are not supported inside parallel in script mode.');
        }
      });
      scriptContent += parallelCommands.join(' ') + (isWindows ? '' : '\nwait\n');
    } else if (step.fork) {
      // Handle fork commands in the script (background processes)
      const forkCommands = step.fork.map((cmd) => {
        if (typeof cmd === 'string') {
          return `${cmd} &`; // Run command as a background process
        } else {
          throw new Error('Nested groups are not supported inside fork in script mode.');
        }
      });
      scriptContent += forkCommands.join(' ') + (isWindows ? '' : '\n');
    } else if (step.steps) {
      // Nested steps: Process them directly (not inside the script)
      throw new Error('Nested steps are not supported in script mode. Use useScript: false for nested steps.');
    } else {
      throw new Error('Invalid command structure in steps.');
    }
  }

  // Trim trailing "&& " for Windows
  if (isWindows) {
    scriptContent = scriptContent.trimEnd().replace(/&&$/, '');
  }

  try {
    // Write the script to a temporary file
    await writeFile(scriptPath, scriptContent, { mode: 0o755, encoding: 'utf8' });

    // Execute the script
    await new Promise((resolve, reject) => {
      const pcs = spawn(interpreter, [scriptPath], {
        shell: true,
        stdio: captureName ? 'pipe' : 'inherit',
        env: env ? { ...process.env, ...env } : process.env,
        cwd,
        detached: false,
      });

      processManager.track(pcs);

      let capture;

      if (captureName) {
        capture = { stdout: '', stderr: '' };

        pcs.stdout.on('data', (data) => {
          capture.stdout += data.toString();
        });

        pcs.stderr.on('data', (data) => {
          capture.stderr += data.toString();
        });
      }

      pcs.on('close', (code) => {
        if (captureName) {
          capture.code = code;
          captureRoot[captureName] = capture;
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new ShellError('Script process finished with error.', scriptPath, code));
        }
      });

      pcs.on('error', (error) => {
        reject(new ShellError(error.message, scriptPath));
      });
    });
  } finally {
    // Clean up the temporary file
    await unlink(scriptPath).catch((_err) =>
    // console.error(`Failed to delete temp script: ${scriptPath}`, _err)
    { }
    );
  }
}

