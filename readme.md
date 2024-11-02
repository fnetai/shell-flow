# @fnet/shell-flow

@fnet/shell-flow is a utility designed to simplify the execution of shell commands in a structured and flexible manner. It allows users to execute commands sequentially, in parallel, or as independent processes ("forks"), all while managing error handling based on user preferences.

## How It Works

This utility operates by accepting a collection of shell commands to be executed. Users can specify these commands either individually or grouped for different execution strategies (sequential, parallel, or forked). The utility executes these commands and allows the user to define how errors should be handled, offering policies like stopping on the first error, logging errors and continuing, or treating errors in forked processes differently.

## Key Features

- **Sequential Execution**: Run commands one after the other, ensuring each completes before moving to the next.
- **Parallel Execution**: Execute multiple commands at the same time for faster processing, with customizable error handling.
- **Forked Execution**: Run commands independently of each other, perfect for non-blocking tasks.
- **Flexible Error Handling**: Choose between stopping on errors, logging them, or notifying the parent process in forked executions.

## Conclusion

@fnet/shell-flow offers a straightforward way to manage and execute multiple shell commands efficiently with customizable error handling capabilities. It is useful for users needing to automate command sequences while maintaining control over how errors are processed.