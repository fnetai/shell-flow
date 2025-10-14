import { spawn } from 'node:child_process';
import path from 'node:path';
import { ShellError } from '../core/index.js';

/**
 * Executes a single shell command and streams output to active stdout and stderr.
 *
 * @param {string} command - The shell command to execute.
 * @param {Object} env - Environment variables for the command.
 * @param {string} wdir - Working directory for the command.
 * @returns {Promise<void>} Resolves when the command completes.
 */
export default function executeCommand(command, env, wdir, captureParent, processManager) {
  return new Promise((resolve, reject) => {
    const pcs = spawn(command, {
      shell: true,
      stdio: captureParent ? 'pipe' : 'inherit',
      env: env ? { ...process.env, ...env } : process.env,
      cwd: wdir ? path.resolve(wdir) : process.cwd(),
      detached: true  // Ensure process runs in a new group
    });

    processManager.track(pcs);
    let capture;

    if (captureParent) {
      capture = { stdout: '', stderr: '' };

      pcs.stdout.on('data', (data) => {
        capture.stdout += data.toString();
      });

      pcs.stderr.on('data', (data) => {
        capture.stderr += data.toString();
      });
    }

    pcs.on('close', (code) => {
      if (capture) {
        capture.code = code;
        captureParent.items.push(capture);
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new ShellError('Process finished with error.', command, code));
      }
    });

    pcs.on('error', (error) => {
      reject(new ShellError(error.message, command));
    });
  });
}

