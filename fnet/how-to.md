# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides developers with a streamlined way to execute shell commands in sequence, parallel, or as background processes. It offers robust error handling, output capture, and environment management capabilities.

## Installation

```bash
npm install @fnet/shell-flow
# or
yarn add @fnet/shell-flow
```

## Core Concepts

### Execution Modes

1. **Sequential Execution** (`commands`): Commands are executed one after another
2. **Parallel Execution** (`parallel`): Commands are executed concurrently
3. **Background Execution** (`fork`): Commands are executed in the background

### Error Handling Policies

- `"stop"`: Halts execution on first error (default)
- `"continue"`: Continues execution despite errors
- `"log"`: Logs errors and continues execution
- `"throw"`: Throws error immediately

## Basic Usage

### Sequential Commands

```javascript
import shellFlow from '@fnet/shell-flow';

await shellFlow({
  commands: [
    'echo "First command"',
    'echo "Second command"'
  ]
});
```

### Parallel Commands

```javascript
await shellFlow({
  parallel: [
    'npm run test:unit',
    'npm run test:integration'
  ]
});
```

### Background Processes

```javascript
await shellFlow({
  fork: [
    'npm run watch',
    'npm run dev-server'
  ]
});
```

## Advanced Features

### Command Groups

Group related commands with additional options:

```javascript
await shellFlow({
  commands: [
    {
      steps: [
        'npm install',
        'npm run build'
      ],
      onError: 'stop',
      captureName: 'build_output'
    }
  ]
});
```

### Output Capture

Capture command output for processing:

```javascript
const result = await shellFlow({
  commands: [
    {
      steps: ['echo "Hello World"'],
      captureName: 'greeting'
    }
  ]
});

console.log(result.greeting.stdout);
```

### Environment Variables

Set environment variables globally or per command:

```javascript
await shellFlow({
  commands: [
    {
      steps: ['npm run build'],
      env: {
        NODE_ENV: 'production'
      }
    }
  ],
  env: {
    CI: 'true'
  }
});
```

### Working Directory

Specify working directory:

```javascript
await shellFlow({
  commands: [
    {
      steps: ['npm run build'],
      wdir: './packages/app'
    }
  ],
  wdir: '/project/root'
});
```

### Script Mode

Use shell script features:

```javascript
await shellFlow({
  commands: [
    {
      steps: [
        'set -e',
        'echo "Starting build"',
        'npm run build'
      ],
      useScript: true,
      captureName: 'build_log'
    }
  ]
});
```

## Error Handling

Handle command failures:

```javascript
try {
  await shellFlow({
    commands: ['invalid-command']
  });
} catch (error) {
  console.log(error.message);    // Error description
  console.log(error.command);    // Failed command
  console.log(error.code);       // Exit code
  console.log(error.onError);    // Active error policy
}
```

## Best Practices

1. Use appropriate error handling policy for your use case
2. Capture output when you need to process command results
3. Use script mode for shell-specific features
4. Group related commands using steps
5. Set environment variables at the most specific scope needed
6. Use working directory to ensure correct command context

## Limitations

- Nested parallel/fork operations in script mode are not supported
- Output capture is limited to sequential commands
- Some shell features may have platform-specific behavior

## Support

For issues and feature requests, please visit our repository at [GitLab](https://gitlab.com/fnetai/shell-flow).
