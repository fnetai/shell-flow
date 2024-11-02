# @fnet/shell-flow Developer Guide

## Overview

The `@fnet/shell-flow` library facilitates the execution of shell commands with flexibility and robust error handling policies. It allows developers to run shell commands sequentially, in parallel, or through forked processes, accommodating diverse error management strategies. This library is ideal for automating command-line tasks and processes, enhancing productivity by managing complex command sequences with ease.

## Installation

Install the library via npm or yarn with the following commands:

Using npm:
```bash
npm install @fnet/shell-flow
```

Using yarn:
```bash
yarn add @fnet/shell-flow
```

## Usage

The library provides a straightforward API to manage shell command executions. Here's how you can use the core function to handle different types of command sequences and error policies.

### Sequential Command Execution

To execute commands sequentially, simply pass an array of command strings:

```javascript
import executeShellCommands from '@fnet/shell-flow';

executeShellCommands({ commands: ['echo "Hello"', 'echo "World"'] })
  .then(() => console.log("Commands executed successfully!"))
  .catch((error) => console.error("Execution error:", error));
```

### Parallel Command Execution

For parallel execution, use the `parallel` property and specify the error policy:

```javascript
import executeShellCommands from '@fnet/shell-flow';

executeShellCommands({
  commands: [{ parallel: ['echo "Command 1"', 'echo "Command 2"'], onError: 'log' }]
})
  .then(() => console.log("Parallel commands executed successfully!"))
  .catch((error) => console.error("Execution error:", error));
```

### Fork Command Execution

Forked command execution can be set up using the `fork` property:

```javascript
import executeShellCommands from '@fnet/shell-flow';

executeShellCommands({
  commands: [{ fork: ['echo "Fork 1"', 'echo "Fork 2"'], onError: 'log' }]
})
  .then(() => console.log("Forked commands executed successfully!"))
  .catch((error) => console.error("Execution error:", error));
```

## Examples

Below are examples highlighting different command executions:

- **Sequential Execution Example:**

  ```javascript
  executeShellCommands({ commands: ['echo "Start"', 'echo "End"'] });
  ```

- **Handling Errors:**

  Parallel execution with error handling policy:

  ```javascript
  executeShellCommands({
    commands: [{ parallel: ['invalidCommand', 'echo "Valid Command"'], onError: 'continue' }]
  });
  ```

  Forked execution with error notification to parent:

  ```javascript
  executeShellCommands({
    commands: [{ fork: ['invalidFork', 'echo "Another Fork"'], onError: 'notifyParent' }]
  });
  ```

## Acknowledgement

This library simplifies shell command automation by providing a flexible and powerful API for running and managing different command execution flows.