import os
import subprocess
import tempfile
from pathlib import Path

def default(commands, on_error="stop"):
    """
    Executes a sequence of shell commands with a flexible error handling policy.

    Args:
        commands (list): Command strings or groups to execute.
        on_error (str, optional): Error handling policy: "stop", "continue", or "log".
    Returns:
        dict: Captured outputs, if any.
    """
    capture = {}
    if not isinstance(commands, list):
        commands = [commands]
    process_commands(commands, on_error, os.environ.copy(), os.getcwd(), None, capture)
    return capture if capture else None

def process_commands(commands, on_error, env, wdir, capture_name=None, capture_root=None):
    """
    Processes a sequence of commands, supporting sequential, parallel, and forked executions.
    """
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
                    process_commands(
                        cmd["steps"], cmd.get("onError", on_error), cmd.get("env", env),
                        cmd.get("wdir", wdir), cmd.get("captureName"), capture_root
                    )

            elif "parallel" in cmd:
                handle_parallel(
                    cmd["parallel"], cmd.get("onError", on_error),
                    cmd.get("env", env), cmd.get("wdir", wdir)
                )

            elif "fork" in cmd:
                handle_fork(
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

def handle_parallel(parallel_commands, on_error, env, wdir):
    """
    Executes commands in parallel with optional error handling.
    """
    tasks = [lambda: process_commands([cmd], on_error, env, wdir, None, None) for cmd in parallel_commands]
    if on_error == "stop":
        for task in tasks:
            task()
    else:
        for task in tasks:
            try:
                task()
            except Exception as e:
                print(f"Parallel error (continue): {e}")

def handle_fork(fork_commands, on_error, env, wdir):
    """
    Executes forked commands, logging any errors.
    """
    for cmd in fork_commands:
        try:
            process_commands([cmd], on_error, env, wdir, None, None)
        except Exception as error:
            print(f"Fork error (log): {error}")

def execute_command(command, env, wdir, capture_parent=None):
    """
    Executes a single shell command and optionally captures its output.
    """
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
    """
    Executes a sequence of shell commands using a temporary script file.
    """
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

if __name__ == "__main__":
    # Example commands
    commands = [
        "echo 'Hello World!'",
        {
            "steps": [
                "echo 'Step 1: Preparation'",
                "echo 'Step 2: Execution'",
                "invalid-command"
            ],
            "onError": "log"
        },
        {
            "parallel": [
                "echo 'Task A'",
                "invalid-task-command",
                "echo 'Task C'"
            ],
            "onError": "continue"
        },
        {
            "steps": [
                "echo 'Step with capture 1'",
                "echo 'Step with capture 2'"
            ],
            "captureName": "example_capture",
            "onError": "continue"
        }
    ]

    try:
        results = default(commands, on_error="log")
        print("Execution Results:", results)
    except Exception as e:
        print("Error during execution:", str(e))
