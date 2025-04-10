
import asyncio
import json
import os
import signal
import tempfile
from typing import Dict, List, Optional, Union

class ProcessManager:
    def __init__(self):
        self._processes = set()
        self._cleanup_handlers = []
        
        async def cleanup():
            for proc in self._processes:
                try:
                    proc.terminate()  # Use terminate() instead of kill() for graceful shutdown
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=5.0)
                    except asyncio.TimeoutError:
                        proc.kill()  # Force kill if terminate doesn't work
                except Exception as err:
                    print(f"Failed to kill process: {err}")

        # Add signal handlers
        loop = asyncio.get_event_loop()
        for sig in ('SIGINT', 'SIGTERM'):
            try:
                loop.add_signal_handler(
                    getattr(signal, sig),
                    lambda: asyncio.create_task(cleanup())
                )
                self._cleanup_handlers.append((sig, cleanup))
            except NotImplementedError:
                # Windows doesn't support all signals
                pass

    def track(self, process):
        """Track an asyncio subprocess"""
        self._processes.add(process)
        
        async def remove_process():
            self._processes.remove(process)
            if not self._processes:
                self.dispose()
        
        # Create task to handle process completion
        asyncio.create_task(self._wait_and_remove(process, remove_process))

    async def _wait_and_remove(self, process, callback):
        """Wait for process to complete and call callback"""
        await process.wait()
        await callback()

    def dispose(self):
        """Remove all signal handlers"""
        loop = asyncio.get_event_loop()
        for sig, _ in self._cleanup_handlers:
            try:
                loop.remove_signal_handler(getattr(signal, sig))
            except NotImplementedError:
                pass
        self._cleanup_handlers.clear()

class ShellError(Exception):
    def __init__(self, message: str, command: Optional[str] = None, code: Optional[int] = None):
        super().__init__(message)
        self.command = command
        self.code = code

async def execute_command(command: str, env: Dict, wdir: str, capture_parent: Optional[Dict] = None, process_manager: Optional[ProcessManager] = None) -> None:
    """
    Executes a single shell command and handles output streaming.
    """
    cwd = os.path.abspath(wdir) if wdir else os.getcwd()
    env = {**os.environ, **env} if env else os.environ

    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE if capture_parent else None,
        stderr=asyncio.subprocess.PIPE if capture_parent else None,
        env=env,
        cwd=cwd
    )

    if process_manager:
        process_manager.track(process)

    if capture_parent:
        stdout, stderr = await process.communicate()
        capture_parent["stdout"] = stdout.decode() if stdout else ""
        capture_parent["stderr"] = stderr.decode() if stderr else ""
        capture_parent["code"] = process.returncode
        
        if process.returncode != 0:
            raise ShellError("Process finished with error.", command, process.returncode)
    else:
        returncode = await process.wait()
        if returncode != 0:
            raise ShellError("Process finished with error.", command, returncode)

async def execute_steps_with_script(steps: List, env: Dict, wdir: str, capture_name: Optional[str] = None, capture_root: Optional[Dict] = None) -> None:
    """
    Executes commands using a temporary script file.
    """
    cwd = os.path.abspath(wdir) if wdir else os.getcwd()
    is_windows = os.name == 'nt'
    
    script_extension = '.bat' if is_windows else '.sh'
    script_content = ''
    
    if not is_windows:
        script_content += '#!/bin/sh\n\n'
        
    for step in steps:
        if isinstance(step, str):
            script_content += f"{step} && " if is_windows else f"{step}\n"
        elif isinstance(step, dict):
            if "parallel" in step:
                commands = []
                for cmd in step["parallel"]:
                    if isinstance(cmd, str):
                        commands.append(f"{cmd} &")
                    else:
                        raise ValueError("Nested groups not supported in parallel script mode")
                script_content += " ".join(commands)
                if not is_windows:
                    script_content += "\nwait\n"
            elif "fork" in step:
                commands = []
                for cmd in step["fork"]:
                    if isinstance(cmd, str):
                        commands.append(f"{cmd} &")
                    else:
                        raise ValueError("Nested groups not supported in fork script mode")
                script_content += " ".join(commands) + ("\n" if not is_windows else "")
            elif "steps" in step:
                await process_commands([step], "stop", env, cwd)
            else:
                raise ValueError("Invalid command structure in steps")

    if is_windows:
        script_content = script_content.rstrip().rstrip('&&')

    with tempfile.NamedTemporaryFile(mode='w', suffix=script_extension, delete=False) as tmp_file:
        script_path = tmp_file.name
        tmp_file.write(script_content)

    try:
        os.chmod(script_path, 0o755)
        interpreter = 'cmd.exe' if is_windows else 'sh'
        await execute_command(f"{interpreter} {script_path}", env, cwd, 
                            capture_root.get(capture_name) if capture_name and capture_root else None)
    finally:
        try:
            os.unlink(script_path)
        except Exception as e:
            print(f"Failed to delete temp script: {script_path}. Error: {e}")

async def handle_parallel(parallel_commands: List, on_error: str, env: Dict, wdir: str, capture_root: Optional[Dict] = None) -> None:
    """
    Executes commands in parallel with error handling.
    """
    tasks = [process_commands([cmd], on_error, env, wdir, None, capture_root) 
            for cmd in parallel_commands]
    
    if on_error == "stop":
        await asyncio.gather(*tasks)
    else:
        await asyncio.gather(*tasks, return_exceptions=True)

async def handle_fork(fork_commands: List, on_error: str, env: Dict, wdir: str, capture_root: Optional[Dict] = None) -> None:
    """
    Executes forked commands with error handling.
    """
    for cmd in fork_commands:
        try:
            await process_commands([cmd], on_error, env, wdir, None, capture_root)
        except Exception as error:
            print(f"Fork error (log): {error}")

async def process_commands(commands: List, on_error: str, env: Dict, wdir: str, 
                        capture_name: Optional[str] = None, capture_root: Optional[Dict] = None) -> None:
    """
    Processes command sequences with error handling.
    """
    capture = {"items": []} if capture_name else None

    for cmd in commands:
        try:
            if isinstance(cmd, str):
                await execute_command(cmd, env, wdir, capture)
            elif isinstance(cmd, dict):
                if "steps" in cmd:
                    if cmd.get("useScript", False):
                        await execute_steps_with_script(
                            cmd["steps"],
                            cmd.get("env", env),
                            cmd.get("wdir", wdir),
                            cmd.get("captureName"),
                            capture_root
                        )
                    else:
                        await process_commands(
                            cmd["steps"],
                            cmd.get("onError", on_error),
                            cmd.get("env", env),
                            cmd.get("wdir", wdir),
                            cmd.get("captureName"),
                            capture_root
                        )
                elif "parallel" in cmd:
                    await handle_parallel(
                        cmd["parallel"],
                        cmd.get("onError", on_error),
                        cmd.get("env", env),
                        cmd.get("wdir", wdir),
                        capture_root
                    )
                elif "fork" in cmd:
                    await handle_fork(
                        cmd["fork"],
                        cmd.get("onError", on_error),
                        cmd.get("env", env),
                        cmd.get("wdir", wdir),
                        capture_root
                    )
        except Exception as error:
            print(f"Error occurred: {error}")
            
            last_error = {
                "message": str(error),
                "command": getattr(error, "command", None),
                "code": getattr(error, "code", 1),
                "onError": on_error
            }
            
            if capture_root:
                capture_root["error"] = last_error
                capture_root.setdefault("errors", []).append(last_error)
                capture_root["errors"].format = lambda: json.dumps(capture_root["errors"], indent=2)

            if on_error == "stop":
                break
            elif on_error == "log":
                continue
            elif on_error == "throw":
                raise

    if capture and capture_name and capture_root is not None:
        capture_root[capture_name] = capture

async def _run(*, commands: Union[List, str] = None, fork: List = None, 
              parallel: List = None, on_error: str = "stop", 
              env: Optional[Dict] = None, wdir: Optional[str] = None) -> Optional[Dict]:
    """
    Internal async runner for the shell commands.
    """
    capture_root = {}
    process_manager = ProcessManager()
    
    try:
        if commands:
            temp = commands if isinstance(commands, list) else [commands]
            await process_commands(temp, on_error, env or os.environ.copy(), 
                                wdir or os.getcwd(), None, capture_root)
        elif parallel:
            await handle_parallel(parallel, on_error, env or os.environ.copy(), 
                                wdir or os.getcwd(), capture_root)
        elif fork:
            await handle_fork(fork, on_error, env or os.environ.copy(), 
                            wdir or os.getcwd(), capture_root)
            
        return capture_root if capture_root else None
    finally:
        process_manager.dispose()

def default(*, commands: Union[List, str] = None, fork: List = None,
            parallel: List = None, on_error: str = "stop",
            env: Optional[Dict] = None, wdir: Optional[str] = None) -> Optional[Dict]:
    """
    Main entry point for processing shell commands.
    """
    return asyncio.run(_run(commands=commands, fork=fork, parallel=parallel,
                          on_error=on_error, env=env, wdir=wdir))
