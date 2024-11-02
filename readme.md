# @fnet/shell-flow

This project is designed to help users execute a series of shell commands efficiently and flexibly. With @fnet/shell-flow, you can manage how multiple commands run, specifying whether they should run sequentially, in parallel, or as separate forked processes. It provides a straightforward way to control error handling during shell command execution, ensuring that your scripts run smoothly even when errors occur.

## How It Works

@fnet/shell-flow operates by taking in an array of shell commands, which can be structured in different formats: sequentially, in parallel, or as forked processes. You can set error handling policies that determine whether the execution should stop, continue, or simply log errors when they occur. This flexibility allows you to customize your command execution flow based on the needs of your project.

## Key Features

- **Sequential Execution**: Run commands one after the other, ensuring that each completes before the next begins.
- **Parallel Execution**: Execute multiple commands at the same time, which can help save time by running independent tasks simultaneously.
- **Forked Processes**: Run commands as forked processes, which allows them to operate independently of each other.
- **Error Handling Options**: Choose how errors are handled with options to stop, continue, or log errors without disrupting the execution flow.
- **Environmental Control**: Pass specific environment variables and working directories to your commands for greater flexibility and control.

## Conclusion

In essence, @fnet/shell-flow provides a flexible and controlled environment for executing multiple shell commands. Whether you need sequential order or simultaneous execution, this tool helps streamline your command processing with easy-to-manage error handling and execution options. It's a practical solution for efficiently managing complex shell command sequences.