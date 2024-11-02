# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides a streamlined way to execute shell commands in various modes, including sequential, parallel, and forked executions. It features flexible error handling policies, allowing developers to decide whether a series of commands should stop on error, continue execution, or simply log the error. This can be particularly useful for automating complex workflows and handling shell scripts within Node.js applications.

## Installation

To install the `@fnet/shell-flow` library, use npm or yarn as follows:

```bash
npm install @fnet/shell-flow
```

or

```bash
yarn add @fnet/shell-flow
```

## Usage

Here's how you can use the library to run shell commands with different configurations:

### Basic Sequential Execution

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: 'echo "Hello, World!"',
  onError: 'stop' // Default error policy
});
```
This runs the command sequentially, stopping upon encountering an error.

### Parallel Execution

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [{ parallel: ['echo "First"', 'echo "Second"'] }],
  onError: 'continue' // Continue executing even if some commands fail
});
```
Commands inside the `parallel` array are executed simultaneously. The `onError` policy here allows continuation despite errors in individual commands.

### Forked Execution

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [{ fork: ['echo "Fork 1"', 'echo "Fork 2"'], onError: 'log' }],
});
```
Forked commands run independently of each other, logging any errors they encounter.

## Examples

### Example 1: Mixed Execution

This example mixes sequential and parallel commands:

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [
    'echo "Sequential Command 1"',
    { parallel: ['echo "Parallel 1"', 'echo "Parallel 2"'] },
    'echo "Sequential Command 2"'
  ],
  onError: 'log' // Errors will be logged, but not stop execution
});
```

### Example 2: Complex Error Handling

Illustrating a fork with specific error handling policies:

```javascript
import shellFlow from '@fnet/shell-flow';

shellFlow({
  commands: [
    { fork: ['echo "Forked A"', 'exit 1'], onError: 'notifyParent' },
    'echo "This will execute"'
  ],
  onError: 'continue' // Parent continues regardless of errors in fork
});
```

With `notifyParent`, even if a command in a fork group fails, the parent sequence operates according to its own `onError` policy.

## Acknowledgement

If required, this section may credit any external libraries used within `@fnet/shell-flow`, ensuring compliance with their licenses and contributions.