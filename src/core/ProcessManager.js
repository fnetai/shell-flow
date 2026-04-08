import treeKill from 'tree-kill';
import { promisify } from 'node:util';

const treeKillAsync = promisify(treeKill);

export default class ProcessManager {
  #processes = new Set();
  #cleanup;
  #isExiting = false;

  constructor() {
    this.#cleanup = async (signal) => {
      // Prevent multiple cleanup calls
      if (this.#isExiting) {
        // If already exiting, just return - the existing cleanup will handle it
        return;
      }

      this.#isExiting = true;

      // Remove signal handlers to prevent recursive calls
      this.removeSignalHandlers();

      // console.log(`Received ${signal || 'exit'} signal. Cleaning up processes...`);

      try {
        // Terminate all processes and wait for completion
        await this.terminateAll(1500); // Give processes more time to terminate gracefully

        // Small delay to ensure all logs are flushed
        await new Promise(resolve => setTimeout(resolve, 100));

        // If this was triggered by a signal, send the same signal to the process
        // This allows the parent process to handle the exit properly
        if (signal) {
          // Set a timeout to force exit if the signal doesn't terminate the process
          setTimeout(() => {
            // console.log('Forcing exit after timeout...');
            process.exit(signal === 'SIGINT' ? 130 : 143); // 130 for SIGINT, 143 for SIGTERM
          }, 500);

          process.kill(process.pid, signal);
        }
      } catch (error) {
        // console.error('Error during cleanup:', error);
        // Force exit in case of error
        process.exit(1);
      }
    };

    // Pre-bind handler references so we can cleanly remove them later
    this._onSigint = () => this.#cleanup('SIGINT');
    this._onSigterm = () => this.#cleanup('SIGTERM');
    this._onUncaught = async (_err) => { await this.#cleanup('SIGTERM'); };
    this._onUnhandled = async (_reason) => { await this.#cleanup('SIGTERM'); };

    // Add signal handlers
    this.addSignalHandlers();

    // Handle uncaught exceptions and unhandled promise rejections
    process.on('uncaughtException', this._onUncaught);
    process.on('unhandledRejection', this._onUnhandled);
  }

  addSignalHandlers() {
    process.on('SIGINT', this._onSigint);
    process.on('SIGTERM', this._onSigterm);
    // Avoid async cleanup in 'exit' event; rely on finally and signals instead
    // process.on('exit', this.#cleanup);
  }

  removeSignalHandlers() {
    process.off('SIGINT', this._onSigint);
    process.off('SIGTERM', this._onSigterm);
    // process.off('exit', this.#cleanup);
    process.off('uncaughtException', this._onUncaught);
    process.off('unhandledRejection', this._onUnhandled);
  }

  track(childProcess) {
    this.#processes.add(childProcess);
    childProcess.once('exit', () => {
      this.#processes.delete(childProcess);
      if (this.#processes.size === 0) {
        this.dispose();
      }
    });
  }

  dispose() {
    this.removeSignalHandlers();
    // Ensure all processes are terminated when dispose is called
    return this.terminateAll(500);
  }

  /**
   * Check if a child process is still alive by sending signal 0.
   */
  #isAlive(proc) {
    try {
      process.kill(proc.pid, 0); // signal 0 = just check, don't actually signal
      return true;
    } catch {
      return false;
    }
  }

  async terminateAll(timeout = 500) { // timeout in ms
    const processes = Array.from(this.#processes);
    if (processes.length === 0) return;

    // First try SIGTERM for graceful shutdown — only for alive processes
    const aliveProcesses = processes.filter(proc => this.#isAlive(proc));

    if (aliveProcesses.length > 0) {
      const termPromises = aliveProcesses.map(proc => {
        proc.removeAllListeners();
        return treeKillAsync(proc.pid, 'SIGTERM').catch(() => {
          // Ignore errors - process might already be gone
        });
      });

      try {
        await Promise.all(termPromises);
      } catch (err) {
        // Some processes might already be gone
      }

      // Give processes some time to terminate gracefully
      await new Promise(resolve => setTimeout(resolve, Math.min(timeout / 2, 250)));
    }

    // Check which processes are STILL alive after SIGTERM and use SIGKILL
    const stillAlive = Array.from(this.#processes).filter(proc => this.#isAlive(proc));

    if (stillAlive.length > 0) {
      const killPromises = stillAlive.map(proc => {
        return treeKillAsync(proc.pid, 'SIGKILL').catch(() => {
          // Ignore errors - process might already be gone
        });
      });

      try {
        await Promise.all(killPromises);
      } catch (err) {
        // Some processes might already be gone
      }

      // Final wait to ensure processes have time to exit
      await new Promise(resolve => setTimeout(resolve, Math.min(timeout / 2, 250)));
    }

    this.#processes.clear();
  }
}

