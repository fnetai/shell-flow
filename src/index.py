import os
import subprocess
import tempfile
from pathlib import Path
import asyncio

async def process_commands(commands, on_error, env, wdir, capture_name=None, capture_root=None):
    """
    Processes a sequence of commands, supporting sequential, parallel, and forked executions.
    """
    if capture_name and capture_root is None:
        capture_root = {}  # Ensure capture_root is initialized

    capture = {"items": []} if capture_name else None

    for cmd in commands:
        try:
            if isinstance(cmd, str):
                execute_command(cmd, env, wdir, capture)
            elif "steps" in cmd:
                if cmd.get("useScript", False):
                    execute_steps_with_script(
                        cmd["steps"], cmd.get("env", env), cmd.get("wdir", wdir),
                        cmd.get("captureName"), capture_root
                    )
                else:
                    await process_commands(
                        cmd["steps"], cmd.get("onError", on_error), cmd.get("env", env),
                        cmd.get("wdir", wdir), cmd.get("captureName"), capture_root
                    )
            elif "parallel" in cmd:
                await handle_parallel(
                    cmd["parallel"], cmd.get("onError", on_error),
                    cmd.get("env", env), cmd.get("wdir", wdir), capture_root
                )
            elif "fork" in cmd:
                await handle_fork(
                    cmd["fork"], cmd.get("onError", on_error),
                    cmd.get("env", env), cmd.get("wdir", wdir)
                )
        except Exception as error:
            print(f"Error occurred: {error}")
            if on_error == "stop":
                break
            elif on_error == "log":
                continue

    if capture_name:
        capture_root[capture_name] = capture

async def handle_parallel(parallel_commands, on_error, env, wdir, capture_root=None):
    """
    Executes commands in parallel with optional error handling.
    """
    async def task_wrapper(cmd):
        try:
            await process_commands([cmd], on_error, env, wdir, None, capture_root)
        except Exception as e:
            if on_error == "log":
                print(f"Parallel error (continue): {e}")
            elif on_error == "stop":
                raise e

    tasks = [task_wrapper(cmd) for cmd in parallel_commands]
    if on_error == "stop":
        await asyncio.gather(*tasks)
    else:
        await asyncio.gather(*tasks, return_exceptions=True)

async def handle_fork(fork_commands, on_error, env, wdir):
    """
    Executes forked commands asynchronously, logging any errors.
    """
    async def task_wrapper(cmd):
        try:
            await process_commands([cmd], on_error, env, wdir, None, None)
        except Exception as e:
            if on_error == "log":
                print(f"Fork error (log): {e}")
            elif on_error == "stop":
                raise e

    tasks = [task_wrapper(cmd) for cmd in fork_commands]
    await asyncio.gather(*tasks, return_exceptions=True)

def execute_command(command, env, wdir, capture_parent=None):
    process = subprocess.Popen(
        command, shell=True, cwd=wdir, env=env,
        stdout=subprocess.PIPE if capture_parent else None,
        stderr=subprocess.PIPE if capture_parent else None
    )
    stdout, stderr = process.communicate()

    if capture_parent:
        capture = {
            "stdout": stdout.decode("utf-8"),
            "stderr": stderr.decode("utf-8"),
            "code": process.returncode
        }
        capture_parent["items"].append(capture)

    if process.returncode != 0:
        raise RuntimeError(f"Command failed: {command}")

def execute_steps_with_script(steps, env, wdir, capture_name=None, capture_root=None):
    tmp_file = Path(tempfile.mktemp(suffix=".sh"))
    script_content = "\n".join(steps)

    try:
        with open(tmp_file, "w") as f:
            f.write("#!/bin/sh\n")
            f.write(script_content)
        os.chmod(tmp_file, 0o755)

        execute_command(
            str(tmp_file), env, wdir,
            capture_root.get(capture_name) if capture_name and capture_root else None
        )
    finally:
        try:
            tmp_file.unlink()
        except Exception as e:
            print(f"Failed to delete temp script: {tmp_file}. Error: {e}")

def default(commands, on_error="stop"):
    async def run(commands,on_error):
        capture = {}
        if not isinstance(commands, list):
            commands = [commands]
        await process_commands(commands, on_error, os.environ.copy(), os.getcwd(), None, capture)
        return capture if capture else None

    return asyncio.run(run(commands,on_error))

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
#         results = default(commands, on_error="log")
#         print("Execution Results:", results)
#     except Exception as e:
#         print("Error during execution:", str(e))