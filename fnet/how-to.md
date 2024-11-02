# @fnet/shell-flow Developer Guide

## Overview

The `@fnet/shell-flow` library provides a straightforward solution for executing shell commands with added flexibility and error handling capabilities. It is particularly useful for applications requiring the execution of multiple shell commands in sequence, parallel, or forked modes with configurable error management strategies. This library allows developers to specify how to handle errors, ensuring more robust and controlled scripts.

## Installation

You can install the `@fnet/shell-flow` library via npm or yarn:

```bash
npm install @fnet/shell-flow
```

or

```bash
yarn add @fnet/shell-flow
```

## Usage

To use the library, import the default function and provide a structured list of commands. Commands can be executed in three different formats: sequentially, in parallel, or forked. Each format can be customized with specific error handling policies.

### Example: Sequential Execution

The default mode is sequential, where each command waits for the previous one to complete. You can choose to continue execution even if a command fails by setting `continueOnError` to `true`.

```javascript
import shellFlow from '@fnet/shell-flow';

async function runCommands() {
  await shellFlow({
    commands: [
      "echo 'Command 1'",
      "echo 'Command 2'",
      "invalid-command", // This will throw an error
      "echo 'Command 3'"  
    ],
    continueOnError: true
  });
}

runCommands();
```

### Example: Parallel Execution

For parallel execution, use the `parallel` property with a list of commands. Specify an `onError` policy to decide whether to stop on the first error or continue executing other commands.

```javascript
import shellFlow from '@fnet/shell-flow';

async function runParallelCommands() {
  await shellFlow({
    commands: [
      { parallel: ["echo 'First'", "echo 'Second'"], onError: "stop" }
    ]
  });
}

runParallelCommands();
```

### Example: Forked Execution

Fork execution allows commands to start simultaneously, each in its own isolated process. Error handling policies like `logOnly` or `notifyParent` determine how to manage errors encountered during execution.

```javascript
import shellFlow from '@fnet/shell-flow';

async function runForkedCommands() {
  await shellFlow({
    commands: [
      { fork: ["echo 'Fork 1'", "invalid-command"], onError: "notifyParent" }
    ]
  });
}

runForkedCommands();
```

## Examples

Here are some concise examples demonstrating the core functionalities of the `@fnet/shell-flow`:

- **Sequential Execution with Error Handling**
  ```javascript
  await shellFlow({
    commands: ["echo 'Hello'", "invalid-command"],
    continueOnError: false
  });
  ```

- **Parallel Execution with Stop-on-Error**
  ```javascript
  await shellFlow({
    commands: [
      { parallel: ["echo 'Start'", "invalid-command"], onError: "stop" }
    ]
  });
  ```

- **Forked Execution with Logging**
  ```javascript
  await shellFlow({
    commands: [
      { fork: ["echo 'Fork A'", "invalid-command"], onError: "logOnly" }
    ]
  });
  ```

Each of these examples highlights the library's capability to execute shell commands reliably, with customizable error management strategies to fit different use cases in software development projects.