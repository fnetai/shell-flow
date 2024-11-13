# @fnet/shell-flow Developer Guide

## Overview

The `@fnet/shell-flow` library provides a streamlined method for executing shell commands with various error-handling options. It allows you to run commands sequentially or in parallel, and supports complex workflows with nested command groups. The library is designed to help developers efficiently manage command execution in scripts or applications, making it easier to automate tasks that involve interacting with the system shell.

## Installation

To include `@fnet/shell-flow` in your project, use npm or yarn for installation:

```sh
npm install @fnet/shell-flow
```

or

```sh
yarn add @fnet/shell-flow
```

## Usage

The library's primary function is to execute shell commands with customizable error handling. You can specify commands as strings or groups, define execution flow (sequential, parallel, etc.), and determine what happens when an error occurs.

Here's how you can use the library in a real-world scenario:

```javascript
import shellFlow from '@fnet/shell-flow';

const run = async () => {
  try {
    await shellFlow({
      commands: [
        'echo "Starting process..."',
        { 
          parallel: [
            'echo "Parallel command 1"',
            'echo "Parallel command 2"'
          ],
          onError: 'continue'
        },
        {
          steps: [
            'echo "Step 1 in a sequence"',
            'echo "Step 2 in a sequence"'
          ],
          useScript: true
        }
      ],
      onError: 'log' // Continues execution and logs errors
    });
  } catch (error) {
    console.error('Execution failed:', error.message);
  }
};

run();
```

### Command Groups

- **Sequential Execution**: Pass an array of commands or steps, and they will be executed in order. You can group them using `steps`.
- **Parallel Execution**: Use `parallel` to execute multiple commands simultaneously. Customize the error-handling strategy by specifying `onError`.
- **Fork Execution**: Similar to parallel, but `fork` runs commands in separate processes.

### Error Handling

You can control error handling through the `onError` parameter:
- `"stop"`: Stops execution upon encountering an error.
- `"continue"`: Ignores errors and continues execution.
- `"log"`: Logs errors while allowing the process to continue.

## Examples

Here are some concise examples:

### Sequential Commands

```javascript
await shellFlow({
  commands: [
    'echo "First command"',
    'echo "Second command"'
  ]
});
```

### Parallel Commands with Error Logging

```javascript
await shellFlow({
  commands: [
    {
      parallel: [
        'echo "Parallel command A"',
        'invalidcommand' // This will be logged
      ],
      onError: 'log'
    }
  ]
});
```

### Forked Commands

```javascript
await shellFlow({
  commands: [
    {
      fork: [
        'echo "Fork command 1"',
        'echo "Fork command 2"'
      ]
    }
  ]
});
```

By using `@fnet/shell-flow`, developers can manage shell command execution patterns efficiently, handling errors gracefully and customizing workflows as needed.