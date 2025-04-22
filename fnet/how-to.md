# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides developers with a streamlined way to execute shell commands in sequence, parallel, or as background processes. It offers robust error handling, output capture, and environment management capabilities.

## Installation

```bash
npm install @fnet/shell-flow
# or
yarn add @fnet/shell-flow
```

## Core Types

### CommandGroup

```typescript
{
  steps?: string[];           // Array of sequential commands
  parallel?: string[];        // Array of parallel commands
  fork?: string[];           // Array of background commands
  onError?: "stop" | "continue" | "log" | "throw";  // Error handling policy
  env?: Record<string, any>;  // Environment variables
  wdir?: string;             // Working directory
  captureName?: string;      // Name to capture output
  useScript?: boolean;       // Whether to execute in script mode
}
```

### Input Configuration

```typescript
{
  commands?: (string | CommandGroup)[];  // Sequential commands
  parallel?: (string | CommandGroup)[];  // Parallel commands
  fork?: (string | CommandGroup)[];      // Background commands
  onError?: "stop" | "continue" | "log" | "throw";  // Global error policy
  env?: Record<string, any>;  // Global environment variables
  wdir?: string;             // Global working directory (defaults to process.cwd())
  context?: Record<string, any>;  // Template context object
}
```

### CaptureResult

```typescript
{
  stdout: string;    // Command's standard output
  stderr: string;    // Command's standard error
  code: number;      // Exit code
}
```

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

### Mixed Execution Modes

```javascript
await shellFlow({
  commands: [
    'echo "Starting build process"',
    {
      parallel: [
        'npm run test:unit',
        'npm run test:integration'
      ]
    }
  ],
  fork: [
    'npm run watch:css',
    'npm run watch:js'
  ]
});
```

### Output Capture

```javascript
const result = await shellFlow({
  commands: [
    {
      steps: ['echo "Hello World"'],
      captureName: 'greeting'
    }
  ]
});

console.log(result.greeting.stdout);  // Command's standard output
console.log(result.greeting.stderr);  // Command's standard error
console.log(result.greeting.code);    // Exit code
```

### Environment Variables

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

```javascript
await shellFlow({
  commands: [
    {
      steps: ['npm run build'],
      wdir: './packages/app'
    }
  ],
  wdir: '/project/root'  // Global working directory
});
```

### Script Mode

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

## Template Variables

The library supports template variable substitution using context objects. Templates use the `{{variable}}` syntax with several features:

```javascript
await shellFlow({
  commands: [
    'echo "Hello {{user.name}}"',
    'mkdir -p {{paths.output}}'
  ],
  context: {
    user: {
      name: 'John'
    },
    paths: {
      output: './dist'
    }
  }
});
```

#### Template Features

1. **Nested Object Access**
```javascript
await shellFlow({
  commands: ['npm config set registry {{config.npm.registry}}'],
  context: {
    config: {
      npm: {
        registry: 'https://registry.npmjs.org'
      }
    }
  }
});
```

2. **Array Access**
```javascript
await shellFlow({
  commands: ['deploy {{services[0].name}}'],
  context: {
    services: [
      { name: 'api' },
      { name: 'web' }
    ]
  }
});
```

3. **Default Values**
```javascript
await shellFlow({
  commands: [
    'NODE_ENV={{env || production}}',
    'PORT={{port || 3000}}'
  ],
  context: {
    env: 'development'
  }
});
```

4. **Strict Mode**
```javascript
await shellFlow({
  commands: [
    // Will throw error if API_KEY is not in context
    'curl -H "Authorization: {{! API_KEY}}" {{url}}'
  ],
  context: {
    API_KEY: process.env.API_KEY,
    url: 'https://api.example.com'
  }
});
```

5. **Conditional Values**
```javascript
await shellFlow({
  commands: [
    'npm run {{isProd ? build:prod}}'
  ],
  context: {
    isProd: true
  }
});
```

## Error Handling

```javascript
try {
  await shellFlow({
    commands: ['invalid-command'],
    onError: 'throw'  // 'stop' | 'continue' | 'log' | 'throw'
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
7. Use `fork` for long-running background processes
8. Use `parallel` for concurrent tasks that need to complete before continuing

## Limitations

- Nested parallel/fork operations in script mode are not supported
- Output capture is limited to sequential commands
- Some shell features may have platform-specific behavior

## Support

For issues and feature requests, please visit our repository at [GitLab](https://gitlab.com/fnetai/shell-flow).
