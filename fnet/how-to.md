# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides developers with a streamlined way to execute shell commands in sequence or in parallel, with versatile error handling. This library can automate complex workflows and manage shell-based operations with ease. It supports sequential, parallel, forked, and grouped command execution while allowing flexible responses to command failures.

## Installation

To include `@fnet/shell-flow` in your project, run one of the following commands:

Using npm:
```bash
npm install @fnet/shell-flow
```

Using yarn:
```bash
yarn add @fnet/shell-flow
```

## Usage

Here's a basic guide on how to use the `@fnet/shell-flow` library in your projects.

### Sequential and Parallel Command Execution

You can execute a series of commands sequentially or in parallel. The execution flow can be customized based on success or failure criteria.

```javascript
import shellFlow from '@fnet/shell-flow';

async function runCommands() {
  try {
    await shellFlow({
      commands: [
        'echo "Starting process..."',
        {
          steps: [
            'echo "Step 1: Preparation"',
            'echo "Step 2: Execution"'
          ],
          onError: 'stop'
        },
        {
          parallel: [
            'echo "Task A"',
            'echo "Task B"'
          ],
          onError: 'continue'
        },
      ],
      onError: 'log'
    });
    console.log('All commands executed successfully');
  } catch (error) {
    console.error('Command execution failed:', error);
  }
}

runCommands();
```

## Examples

### Example 1: Simple Sequential Execution

This example demonstrates executing a series of shell commands in sequence. If any command fails, execution stops.

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [
    'echo "Hello World"',
    'echo "This is a sequential command execution"',
    'invalid-command' // This will cause the process to stop.
  ],
  onError: 'stop'
})
.catch((error) => console.error(error.message));
```

### Example 2: Parallel Execution with Continued Processing

Execute multiple commands in parallel where failure of one does not affect the others. A detailed log of each success and failure is maintained.

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [
    {
      parallel: [
        'echo "Running Task 1"',
        'invalid-task-command', // This will log an error but won't stop execution.
        'echo "Running Task 3"'
      ],
      onError: 'continue'
    }
  ]
})
.then(() => console.log('Tasks completed'))
.catch((error) => console.error('Some tasks failed:', error.message));
```

## Acknowledgement

Development of this library was influenced by the need for robust command-line tooling. We acknowledge the contributions of all collaborative efforts in the open-source community that enhance toolset interoperability and functionality.