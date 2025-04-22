# @fnet/shell-flow

## Introduction

The `@fnet/shell-flow` project is designed to simplify the process of executing shell commands within a Node.js environment. It offers a structured way to orchestrate command execution sequences with customizable error handling, allowing for execution in parallel, in sequence, or in the background. Users looking to run a series of shell commands programmatically will find this tool helpful for managing and capturing command outputs.

## How It Works

At its core, `@fnet/shell-flow` accepts a configuration object that specifies the commands to run, the working environment, and error handling strategies. Commands can be executed in sequence, parallel, or as background processes. The process manager integrated into the system ensures that all spawned processes are tracked and can be cleanly terminated if necessary. Additionally, it supports the use of templates for environment variables, enabling dynamic command configurations based on the user's context.

## Key Features

- **Sequential Command Execution**: Run commands one after the other, halting on errors if required.
- **Parallel Command Execution**: Execute multiple commands simultaneously for increased efficiency.
- **Background Execution**: Fork commands to run in the background, allowing the main process to continue without waiting.
- **Error Handling**: Customize how to handle command errors with options to stop, continue, log, or throw errors.
- **Environment Variable Support**: Flexibly manage environment configurations per command or globally.
- **Template Resolution**: Process string templates embedded in commands for dynamic parameter substitution.
- **Capture Command Outputs**: Store and access command outputs for further processing or logging.

## Conclusion

`@fnet/shell-flow` provides a modest yet effective tool for managing shell command execution within a Node.js application. It allows developers to streamline their workflow by running and controlling multiple commands efficiently, with robust error handling and output capturing capabilities. This makes it suitable for automation scripts, build systems, and various development tasks requiring programmatic shell command executions.