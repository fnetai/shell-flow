# @fnet/shell-flow Developer Guide

## Overview

The `@fnet/shell-flow` library is designed to simplify the execution of shell commands in a flexible and error-tolerant manner. By providing a structured way to run commands sequentially, in parallel, or forked, it allows developers to manage complex shell command workflows with ease. The library's key feature is its ability to handle errors using customizable policies, making it a versatile tool for both straightforward and intricate shell task automation.

## Installation

You can install the `@fnet/shell-flow` library using npm or yarn. Here are the instructions for both:

### Using npm

```bash
npm install @fnet/shell-flow
```

### Using yarn

```bash
yarn add @fnet/shell-flow
```

## Usage

To use the `@fnet/shell-flow` library, import the default function and execute your shell commands by defining them in an array. You can specify how to handle errors to fit your needs, whether you want to stop execution, continue despite errors, or simply log them.

### Example: Basic Command Execution

```javascript
import runShellFlow from '@fnet/shell-flow';

(async () => {
  await runShellFlow({
    commands: ['echo "Hello, world!"', 'ls -al'],
    onError: 'continue',  // Options: 'stop', 'continue', 'log'
  });
})();
```

### Example: Parallel and Forked Execution with Error Handling

```javascript
import runShellFlow from '@fnet/shell-flow';

(async () => {
  await runShellFlow({
    commands: [
      { 
        parallel: ['echo "Command 1"', 'invalidcommand'],
        onError: 'log'
      },
      { 
        fork: ['echo "Forked command 1"', 'echo "Forked command 2"']
      }
    ],
  });
})();
```

## Examples

### Execute Commands Sequentially

```javascript
import runShellFlow from '@fnet/shell-flow';

(async () => {
  await runShellFlow({
    commands: ['echo "Starting process"', 'node --version'],
    onError: 'stop',
  });
})();
```

### Execute Multiple Commands in Parallel

```javascript
import runShellFlow from '@fnet/shell-flow';

(async () => {
  await runShellFlow({
    commands: [
      {
        parallel: ['echo "Command A"', 'echo "Command B"'],
        onError: 'continue',
      },
    ],
  });
})();
```

### Forked Command Execution

```javascript
import runShellFlow from '@fnet/shell-flow';

(async () => {
  await runShellFlow({
    commands: [
      {
        fork: ['echo "First Task"', 'echo "Second Task"'],
        onError: 'log',
      },
    ],
  });
})();
```

Each of these examples demonstrates how to utilize the primary function to manage shell operations efficiently, regardless of whether tasks need to run in parallel or in different forks.

## Acknowledgement

The functionality provided by this library simplifies command management in applications where complex execution flows are necessary. The patterns used here are based on common practices in system automation and scripting.