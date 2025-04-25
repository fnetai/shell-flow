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
  filemap?: object;          // Filemap configuration object
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

## Control Commands

The library provides built-in control commands for common operations:

### Echo Command

```javascript
await shellFlow({
  commands: [
    { echo: "Starting process..." },
    { echo: "User: {{user.name}}" }
  ],
  context: {
    user: { name: "John" }
  }
});
```

### Sleep Command

```javascript
await shellFlow({
  commands: [
    { echo: "Starting..." },
    { sleep: 2 },  // Wait for 2 seconds
    { sleep: "{{delay}}" }  // Dynamic delay from context
  ],
  context: {
    delay: 1
  }
});
```

### Exit Command

```javascript
await shellFlow({
  commands: [
    { echo: "Running tests..." },
    "npm test",
    { exit: "{{testsPassed ? 0 : 1}}" }  // Dynamic exit code
  ],
  context: {
    testsPassed: true
  }
});
```

### Filemap Command

The `filemap` command allows you to map files from source directories to target directories with support for templating, symlinks, and multiple output formats.

```javascript
await shellFlow({
  commands: [
    { echo: "Starting file mapping..." },
    { filemap: {
        target: "dist",
        sources: [
          {
            source: "templates",
            target: ".",
            symlink: false
          },
          {
            source: "assets",
            target: "assets",
            symlink: true
          }
        ]
      }
    },
    { echo: "File mapping completed" }
  ],
  context: {
    app: {
      name: "My App",
      version: "1.0.0"
    }
  }
});
```

#### Filemap Configuration

The `filemap` command accepts an object with the following properties:

- `target` (required): The target directory path where processed files will be placed.
- `sources` (required): An array of source objects with the following properties:
  - `source` (required): The source from which to fetch files, supports multiple protocols and providers.
  - `target` (optional): Target subdirectory within the main target directory for output.
  - `context` (optional): Context data to be used with the templating engine for dynamic content rendering.
  - `engine` (optional): Template engine to use, defaults to 'njk' (Nunjucks).
  - `symlink` (optional): Determines whether to create symbolic links instead of copying files (default: false).
  - `provider` (optional): Custom provider configurations that can override defaults.
- `output` (optional): Output format; options include 'file', 'stdout', or 'json' (default: 'file').
- `provider` (optional): Default provider configurations for various source types.

### Pause Command

The `pause` command pauses execution and waits for the user to press Enter before continuing. This is particularly useful for interactive scripts or when running background processes that you want to keep running until manually terminated.

```javascript
await shellFlow({
  commands: [
    { echo: "Starting background processes..." },
    { fork: [
        "npm run server",
        "npm run watch"
      ]
    },
    { echo: "Background processes started" },
    { pause: "Press Enter to terminate all processes and exit..." },
    { echo: "Cleaning up and exiting" }
  ]
});
```

The `pause` command can be used in two ways:

```javascript
// With a custom message
{ pause: "Press Enter to continue..." }

// With a default message ("Press Enter to continue...")
{ pause: true }
```

Control commands must contain only their respective key (`echo`, `sleep`, `exit`, `pause`, or `filemap`). The `exit` command accepts values 0-127, and `sleep` accepts non-negative numbers for seconds.

## Exit Control

The library supports controlled process termination using the `exit` command. The exit code can be specified directly or using template variables:

```javascript
// Simple exit
await shellFlow({
  commands: [
    'echo "Done"',
    { exit: 0 }  // Success exit
  ]
});

// Using template variables
await shellFlow({
  commands: [
    'npm run test',
    { exit: '{{testResult.code || 0}}' }
  ],
  context: {
    testResult: { code: 1 }
  }
});

// With conditional logic
await shellFlow({
  commands: [
    { parallel: ['server', 'watch'] },
    'run-tests',
    { exit: '{{isCI && testsFailed ? 1 : 0}}' }
  ],
  context: {
    isCI: true,
    testsFailed: false
  }
});
```

The exit command will:

1. Gracefully terminate all running processes
2. Wait for processes to clean up (with 5s timeout)
3. Exit with the specified code (0-127)

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
