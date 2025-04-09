
import os
import subprocess
import tempfile
from pathlib import Path
import asyncio
import shutil
from typing import Dict, List, Union, Optional

class ShellError(Exception):
    def __init__(self, message: str, command: str, code: int = 1):
        super().__init__(message)
        self._code = code
        self._command = command
        self._name = self.__class__.__name__

    @property
    def code(self) -> int:
        return self._code

    @property
    def command(self) -> str:
        return self._command

    @property
    def name(self) -> str:
        return self._name

async def execute_command(command: str, env: Dict, wdir: str, capture_parent: Optional[Dict] = None) -> None:
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

    if capture_parent:
        stdout, stderr = await process.communicate()
        capture = {
            "stdout": stdout.decode() if stdout else "",
            "stderr": stderr.decode() if stderr else "",
            "code": process.returncode
        }
        capture_parent["items"].append(capture)

        if process.returncode != 0:
            raise ShellError("Process finished with error.", command, process.returncode)
    else:
        await process.wait()
        if process.returncode != 0:
            raise ShellError("Process finished with error.", command, process.returncode)

async def execute_steps_with_script(steps: List, env: Dict, wdir: str, capture_name: Optional[str] = None, capture_root: Optional[Dict] = None) -> None:
    """
    Executes commands using a temporary script file.
    """
    cwd = os.path.abspath(wdir) if wdir else os.getcwd()
    is_windows = os.name == 'nt'
    
    script_extension = '.bat' if is_windows else '.sh'
    with tempfile.NamedTemporaryFile(mode='w', suffix=script_extension, delete=False) as tmp_file:
        script_path = tmp_file.name
        
        if not is_windows:
            tmp_file.write('#!/bin/sh\n\n')
            
        for step in steps:
            if isinstance(step, str):
                tmp_file.write(f"{step} && " if is_windows else f"{step}\n")
            elif isinstance(step, dict):
                if "parallel" in step:
                    commands = []
                    for cmd in step["parallel"]:
                        if isinstance(cmd, str):
                            commands.append(f"{cmd} &")
                        else:
                            raise ValueError("Nested groups not supported in parallel script mode")
                    tmp_file.write(" ".join(commands))
                    if not is_windows:
                        tmp_file.write("\nwait\n")
                elif "fork" in step:
                    commands = []
                    for cmd in step["fork"]:
                        if isinstance(cmd, str):
                            commands.append(f"{cmd} &")
                        else:
                            raise ValueError("Nested groups not supported in fork script mode")
                    tmp_file.write(" ".join(commands) + ("\n" if not is_windows else ""))
                elif "steps" in step:
                    await process_commands([step], "stop", env, cwd)
                else:
                    raise ValueError("Invalid command structure in steps")

        if is_windows:
            content = tmp_file.name
            with open(content, 'r') as f:
                script_content = f.read().rstrip()
                script_content = script_content.rstrip('&& ')
            with open(content, 'w') as f:
                f.write(script_content)

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

async def _run(commands: Union[List, str], on_error: str = "stop", env: Optional[Dict] = None, 
              wdir: Optional[str] = None) -> Optional[Dict]:
    """
    Internal async runner for the shell commands.
    """
    capture_root = {}
    
    if not isinstance(commands, list):
        commands = [commands]
        
    await process_commands(
        commands,
        on_error,
        env or os.environ.copy(),
        wdir or os.getcwd(),
        None,
        capture_root
    )
    
    return capture_root if capture_root else None

def default(commands: Union[List, str], on_error: str = "stop", env: Optional[Dict] = None,
          wdir: Optional[str] = None) -> Optional[Dict]:
    """
    Main entry point for processing shell commands.
    """
    return asyncio.run(_run(commands, on_error, env, wdir))

# if __name__ == "__main__":
#     commands = [
#         "echo 'Starting Test Pipeline!'",
#         {
#             "steps": [
#                 "echo 'Step 1: Initialize'",
#                 {
#                     "parallel": [
#                         {
#                             "steps": [
#                                 "echo 'Parallel Block 1 - Task 1'",
#                                 "echo 'Parallel Block 1 - Task 2'",
#                                 "invalid-parallel-block-1-task"
#                             ],
#                             "onError": "continue",
#                             "captureName": "parallel_block_1_capture"
#                         },
#                         {
#                             "steps": [
#                                 "echo 'Parallel Block 2 - Task 1'",
#                                 "echo 'Parallel Block 2 - Task 2'"
#                             ],
#                             "captureName": "parallel_block_2_capture",
#                             "onError": "log"
#                         }
#                     ],
#                     "onError": "log"
#                 },
#                 "echo 'Step 2: Intermediate Cleanup'",
#                 {
#                     "fork": [
#                         "echo 'Fork Task 1'",
#                         "invalid-fork-task",
#                         "echo 'Fork Task 3'"
#                     ],
#                     "onError": "continue"
#                 },
#                 "echo 'Step 3: Processing'",
#                 {
#                     "steps": [
#                         {
#                             "steps": [
#                                 "echo 'Nested Capture Step A'",
#                                 "invalid-nested-step-command",
#                                 "echo 'Nested Capture Step B'"
#                             ],
#                             "captureName": "nested_capture",
#                             "onError": "log"
#                         },
#                         "echo 'Final Task in Processing'"
#                     ],
#                     "captureName": "processing_capture"
#                 },
#                 "echo 'Pipeline Completed!'"
#             ],
#             "onError": "continue"
#         }
#     ]

#     try:
#         results = default(commands, onError="log")
#         print("Execution Results:", results)
#     except Exception as e:
#         print("Error during execution:", str(e))
