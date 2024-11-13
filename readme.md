# @fnet/shell-flow

The `@fnet/shell-flow` module is a utility designed to facilitate the execution of shell commands with a versatile error handling mechanism. This tool aims to provide users with flexibility in controlling the flow of command execution, including support for sequential, parallel, and forked command execution patterns.

## How It Works

This module allows users to execute shell commands from JavaScript or TypeScript code by defining an array of command strings or groups. Users can specify an error handling policy, choosing whether to stop execution on error, continue executing remaining commands, or simply log errors without halting progress. 

When you provide a list or sequence of commands, the module will process them based on the defined structure — either running them one after the other, simultaneously, or as split processes, depending on the setup. It captures and handles output and errors effectively, and if needed, can create temporary script files to execute more complex workflows.

## Key Features

- **Sequential Execution**: Run commands one after the other in a specified order.
- **Parallel Execution**: Execute multiple commands simultaneously without waiting for each one to finish before starting the next.
- **Forked Execution**: Run commands as background processes.
- **Flexible Error Handling**: Define policy to stop, continue, or log errors during execution.
- **Environment and Directory Control**: Specify environment variables and working directories for command execution.
- **Temporary Script File Creation**: Handle complex sequences via temporary shell scripts when necessary.

## Conclusion

`@fnet/shell-flow` offers practical functionality for managing and executing shell commands with a simple API, giving users flexibility and control over how commands are run and errors are handled. This utility can be an asset for developers looking to integrate command-line operations into their applications with ease and clarity.