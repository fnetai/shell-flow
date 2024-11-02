# @fnet/shell-flow

This project is designed to assist with executing shell commands within the Node.js environment. It provides a simple way to run multiple shell commands either sequentially, in parallel, or forked, with various error handling policies. The project aims to streamline command execution and error management for users who need to run complex sequences of operations in a shell environment.

## How It Works

The main functionality of this project is to execute given shell commands based on user-defined formats and error handling strategies. Users provide a list of commands either as strings for sequential execution or as objects specifying parallel or forked execution. The system handles the execution process and manages errors according to the specified policy, such as continuing on error or logging errors without interrupting the flow.

## Key Features

- **Sequential Execution**: Execute commands one after another, with the option to stop on error or continue.
- **Parallel Execution**: Run multiple commands concurrently, with optional error policies like stopping or continuing on errors.
- **Forked Execution**: Execute commands in a forked manner, allowing errors to be logged or reported to a parent process.
- **Error Handling Policies**: Customize how errors are handled during command execution, providing flexibility based on user needs.

## Conclusion

The `@fnet/shell-flow` project is a useful tool for those needing to run and manage multiple shell commands efficiently. By offering structured command execution and flexible error handling, it simplifies complex operations that involve multiple shell interactions in a Node.js environment.