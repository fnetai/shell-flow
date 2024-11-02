# @fnet/shell-flow Developer Guide

## Overview
The `@fnet/shell-flow` library provides a structured way to execute shell commands within a Node.js environment. Developers can utilize its functionality to run sequences of commands with flexible error handling policies. The library allows for sequential execution of commands, as well as parallel and forked executions, offering diverse options for managing script automation and execution flows effectively.

## Installation

To install the `@fnet/shell-flow` library in your project, you can use either npm or yarn. Simply run one of the following commands in your terminal:

```bash
npm install @fnet/shell-flow
```

Or, if you prefer using yarn:

```bash
yarn add @fnet/shell-flow
```

## Usage

Here is how you can use the `@fnet/shell-flow` library to execute commands:

```javascript
import shellFlow from '@fnet/shell-flow';

// Basic example with sequential execution
(async () => {
  try {
    await shellFlow({
      commands: [
        'echo "Starting process..."',
        'node -v', // Example command to run Node.js version
        'echo "All done!"'
      ],
    });
  } catch (error) {
    console.error(`Execution halted: ${error.message}`);
  }
})();
```

In this example, the commands are executed in sequence, and execution stops if any command fails (based on the default `onError = "stop"` policy).

## Examples

### Sequential Execution

```javascript
await shellFlow({
  commands: [
    'echo "This is the first command"',
    'echo "This is the second command"',
  ],
  onError: 'stop', // Halts on any error
});
```

### Parallel Execution

```javascript
await shellFlow({
  commands: [
    { parallel: ['echo "Task 1"', 'echo "Task 2"'], onError: 'continue' }
  ],
});
```
In parallel execution, two commands run simultaneously. The `onError: 'continue'` policy ensures that execution moves forward despite errors in individual commands.

### Forked Execution

```javascript
await shellFlow({
  commands: [
    { fork: ['echo "Forked task A"', 'echo "Forked task B"'], onError: 'log' }
  ],
});
```

Here, forked execution allows commands to run separately without affecting each other, with errors being logged as they occur.

## Acknowledgements

Special thanks to all contributors who have helped develop and maintain the `@fnet/shell-flow` library, ensuring a reliable and efficient tool for managing shell command executions in Node.js.