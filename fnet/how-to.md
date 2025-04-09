# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides developers with a streamlined way to execute shell commands in sequence, parallel, or as background processes. It offers robust error handling, output capture, and environment management capabilities. This library is particularly useful for automating complex workflows and managing shell-based operations.

## Installation

To include `@fnet/shell-flow` in your project, run one of the following commands:

```bash
npm install @fnet/shell-flow
# or
yarn add @fnet/shell-flow
```

## Core Concepts

### Execution Modes

1. **Sequential Execution** (`commands`): Commands are executed one after another
2. **Parallel Execution** (`parallel`): Commands are executed concurrently, waiting for all to complete
3. **Background Execution** (`fork`): Commands are executed in the background without waiting

### Error Handling Policies

- `"stop"`: Halts execution on first error (default)
- `"continue"`: Skips errors and continues execution
- `"log"`: Logs errors and continues execution
- `"throw"`: Throws error and stops execution

## Basic Usage

### Sequential Command Execution

```javascript
import shellFlow from '@fnet/shell-flow';

await shellFlow({
  commands: [
    'echo "First command"',
    'echo "Second command"'
  ],
  onError: 'stop'
});
```

### Parallel Command Execution

```javascript
await shellFlow({
  parallel: [
    'npm run test:unit',
    'npm run test:integration'
  ],
  onError: 'continue'
});
```

### Background Processes

```javascript
await shellFlow({
  fork: [
    'npm run watch',
    'npm run dev-server'
  ],
  onError: 'log'
});
```

## Advanced Features

### Command Groups

Commands can be grouped using `steps`, `parallel`, or `fork`:

```javascript
await shellFlow({
  commands: [
    {
      steps: [
        'npm install',
        'npm run build',
        'npm run test'
      ],
      onError: 'stop',
      captureName: 'build_output'
    }
  ]
});
```

### Output Capture

Use `captureName` to capture command output:

```javascript
const result = await shellFlow({
  commands: [
    {
      steps: ['echo "Hello World"'],
      captureName: 'greeting'
    }
  ]
});

console.log(result.greeting.stdout); // "Hello World\n"
```

### Environment Variables

Set environment variables globally or per command group:

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

Specify working directory globally or per command group:

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

Use `useScript` for complex shell operations:

```javascript
await shellFlow({
  commands: [
    {
      steps: [
        'set -e',
        'echo "Starting build"',
        'npm run build',
        'echo "Build complete"'
      ],
      useScript: true,
      captureName: 'build_log'
    }
  ]
});
```

## Complex Examples

### Build Pipeline with Mixed Execution

```javascript
await shellFlow({
  commands: [
    'echo "Starting pipeline"',
    {
      parallel: [
        {
          steps: [
            'npm install',
            'npm run build'
          ],
          captureName: 'build_output'
        },
        {
          fork: [
            'npm run watch',
            'npm run test:watch'
          ]
        }
      ]
    },
    {
      steps: [
        'docker build -t myapp .',
        'docker push myapp'
      ],
      env: {
        DOCKER_BUILDKIT: '1'
      }
    }
  ],
  wdir: '/project/root',
  onError: 'stop'
});
```

### Error Handling Demonstration

```javascript
await shellFlow({
  parallel: [
    {
      steps: [
        'echo "Task 1"',
        'invalid-command-1'
      ],
      onError: 'continue'
    },
    {
      steps: [
        'echo "Task 2"',
        'invalid-command-2'
      ],
      onError: 'log'
    }
  ],
  onError: 'stop'
});
```

## Error Handling

The library provides detailed error information:

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

1. Always specify an error handling policy appropriate for your use case
2. Use `captureName` when you need to process command output
3. Leverage `useScript` for commands requiring shell features
4. Group related commands using `steps`, `parallel`, or `fork`
5. Set environment variables at the most specific scope needed
6. Use working directory (`wdir`) to ensure correct command context

## Limitations

- Nested parallel/fork operations in script mode are not supported
- Output capture is not available for parallel and fork operations
- Windows support may vary for certain shell features

## Support

For issues and feature requests, please visit our repository at [GitLab](https://gitlab.com/fnetai/shell-flow).
