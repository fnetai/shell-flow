import treeKill from 'tree-kill';
import { promisify } from 'node:util';

const treeKillAsync = promisify(treeKill);

export default class ProcessManager {
  #processes = new Set();
  #cleanup;
  #isExiting = false;
  #gracefulTimeout;

  constructor({ gracefulTimeout = 1500 } = {}) {
    this.#gracefulTimeout = gracefulTimeout;

    this.#cleanup = async (signal) => {
      // Prevent multiple cleanup calls
      if (this.#isExiting) {
        // If already exiting, just return - the existing cleanup will handle it
        return;
      }

      this.#isExiting = true;

      // Remove signal handlers to prevent recursive calls
      this.removeSignalHandlers();

      try {
        // Terminate all processes and wait for completion
        await this.terminateAll(this.#gracefulTimeout);

        // Small delay to ensure all logs are flushed
        await new Promise(resolve => setTimeout(resolve, 100));

        // If this was triggered by a signal, send the same signal to the process
        // This allows the parent process to handle the exit properly
        if (signal) {
          // Set a timeout to force exit if the signal doesn't terminate the process
          setTimeout(() => {
            process.exit(signal === 'SIGINT' ? 130 : 143); // 130 for SIGINT, 143 for SIGTERM
          }, 500);

          process.kill(process.pid, signal);
        }
      } catch (error) {
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

  async terminateAll(timeout = 1500) { // timeout in ms
    const processes = Array.from(this.#processes);
    if (processes.length === 0) return;

    // Filter to only alive processes
    const aliveProcesses = processes.filter(proc => this.#isAlive(proc));
    if (aliveProcesses.length === 0) {
      this.#processes.clear();
      return;
    }

    // Remove listeners to prevent error path triggers during termination
    aliveProcesses.forEach(proc => proc.removeAllListeners());

    // Send SIGTERM for graceful shutdown
    const termPromises = aliveProcesses.map(proc => {
      return treeKillAsync(proc.pid, 'SIGTERM').catch(() => {});
    });

    try {
      await Promise.all(termPromises);
    } catch {
      // Some processes might already be gone
    }

    // Poll every 250ms until all processes are dead or timeout expires
    const pollInterval = 250;
    const maxPolls = Math.ceil(timeout / pollInterval);

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const stillAlive = Array.from(this.#processes).filter(proc => this.#isAlive(proc));
      if (stillAlive.length === 0) {
        // All processes terminated gracefully — exit immediately
        this.#processes.clear();
        return;
      }
    }

    // Timeout expired — force kill any survivors with SIGKILL
    const survivors = Array.from(this.#processes).filter(proc => this.#isAlive(proc));
    if (survivors.length > 0) {
      const killPromises = survivors.map(proc => {
        return treeKillAsync(proc.pid, 'SIGKILL').catch(() => {});
      });

      try {
        await Promise.all(killPromises);
      } catch {
        // Some processes might already be gone
      }

      // Brief wait for SIGKILL to take effect
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    this.#processes.clear();
  }
}

