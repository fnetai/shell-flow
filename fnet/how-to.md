# Developer Guide for @fnet/shell-flow

## Overview

The `@fnet/shell-flow` library provides developers with a powerful, expression-based shell command orchestration system. Execute shell commands in sequence, parallel, or as background processes with built-in support for JSON operations, HTTP requests, file management, data transformations, and more. All builtin operations write to a dedicated runtime context (`$`) for clean, collision-free data management.

## Installation

```bash
npm install @fnet/shell-flow
# or
yarn add @fnet/shell-flow
```

## Key Features

### Core Execution Modes

- **Sequential Command Execution** - Run commands one after the other
- **Parallel Command Execution** - Execute multiple commands simultaneously
- **Background Execution (Fork)** - Run long-running processes in background
- **Script Mode** - Execute commands in a single shell session

### Expression-Based Builtins

- **JSON Operations** - Parse, stringify, and extract JSON data (`json::parse`, `json::get`)
- **HTTP Requests** - Make GET, POST, PUT, DELETE requests (`http::get`, `http::post`)
- **File Operations** - Read, write, copy, delete files (`file::read`, `file::write`)
- **String Transformations** - Uppercase, lowercase, trim, replace, split, join (`transform::*`)
- **Encoding/Hashing** - Base64, URL encoding, SHA256, MD5 (`encode::*`, `hash::*`)
- **Time Operations** - Timestamps, formatting, parsing (`time::now`, `time::format`)
- **Capture & Retry** - Capture command output and retry with backoff (`capture::`, `retry::`)

### Advanced Features

- **Runtime Context ($)** - Dedicated namespace for builtin results, prevents naming collisions
- **Template Variables** - Dynamic value substitution with `{{variable}}` syntax
- **Error Handling** - Customizable policies: stop, continue, throw
- **Output Capture** - Store and access command outputs for processing
- **Environment Management** - Flexible environment variable configuration
- **Composable Expressions** - Nest expressions for complex workflows

## Core Types

### CommandGroup

```typescript
{
  steps?: string[];           // Array of sequential commands
  parallel?: string[];        // Array of parallel commands
  fork?: string[];            // Array of background commands
  filemap?: object;           // Filemap configuration object
  onError?: "stop" | "continue" | "throw";  // Error handling policy
  env?: Record<string, any>;  // Environment variables
  wdir?: string;              // Working directory
  captureName?: string;       // Name to capture output
  useScript?: boolean;        // Whether to execute in script mode
  retry?: boolean | {         // Optional retry config
    attempts?: number;        // default 3
    delay?: number;           // default 1000ms
    factor?: number;          // default 2
    maxDelay?: number;        // default 30000ms
    codes?: number[];         // default [1]
  };
}
```

### Input Configuration

```typescript
{
  commands?: (string | CommandGroup)[];  // Sequential commands
  parallel?: (string | CommandGroup)[];  // Parallel commands
  fork?: (string | CommandGroup)[];      // Background commands
  onError?: "stop" | "continue" | "throw";  // Global error policy
  env?: Record<string, any>;             // Global environment variables
  wdir?: string;                         // Global working directory (defaults to process.cwd())
  context?: Record<string, any>;         // Template context object
  retry?: boolean | {                    // Optional global retry config
    attempts?: number;
    delay?: number;
    factor?: number;
    maxDelay?: number;
    codes?: number[];
  };
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

Non-script steps capture produce an items array:

```javascript
const result = await shellFlow({
  commands: [
    {
      steps: ['echo "Hello World"', 'echo "Second"'],
      captureName: 'greeting'
    }
  ]
});

console.log(result.greeting.items[0].stdout);  // First command stdout
console.log(result.greeting.items[0].stderr);  // First command stderr
console.log(result.greeting.items[0].code);    // First command exit code
```

Script mode (useScript: true) produces a single capture object:

```javascript
const result = await shellFlow({
  commands: [
    {
      steps: ['echo "Hello World"', 'echo "Second"'],
      useScript: true,
      captureName: 'greeting'
    }
  ]
});

console.log(result.greeting.stdout);  // Combined script stdout
console.log(result.greeting.stderr);  // Combined script stderr
console.log(result.greeting.code);    // Script exit code
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

## Expression Syntax

The library supports powerful expression-based commands using the `processor::operation::contextName` syntax. Expressions enable advanced operations like JSON parsing, HTTP requests, file operations, and more - all with automatic result storage in the runtime context (`$`).

### Basic Expression Format

```yaml
commands:
  - capture::logs: npm run test
  - retry::3: curl https://api.example.com
  - json::parse::data: "{{response}}"
  - transform::uppercase::result: "hello world"
```

### Composable Expressions

Expressions can be nested for powerful workflows:

```yaml
commands:
  - retry::3:
      capture::logs: npm run test
  - json::parse::data: "{{logs.items[0].stdout}}"
  - echo: "Status: {{$.data.status}}"
```

### Runtime Context ($)

All expression-based builtins write their results to the **runtime context** (`$`), which is separate from user-defined context variables. This prevents naming collisions and provides a clean namespace for builtin results.

```javascript
const result = await shellFlow({
  commands: [
    { 'http::get::response': 'https://api.example.com/users' },
    { 'json::parse::users': '{{$.response.body}}' },
    { echo: 'First user: {{$.users[0].name}}' }
  ]
});

// Result includes both capture data and runtime context
console.log(result);
// {
//   $: {
//     response: { status: 200, body: "..." },
//     users: [{ name: "John" }, ...]
//   }
// }
```

**Key Points:**

- User context: `{{varName}}`
- Runtime context: `{{$.varName}}`
- Final result always includes `$` object with all builtin results

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

### Template Features

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

1. **Array Access**

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

1. **Default Values**

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

1. **Strict Mode (use {{API_KEY!}})**

```javascript
await shellFlow({
  commands: [
    'curl -H "Authorization: {{API_KEY!}}" {{url}}'
  ],
  context: {
    API_KEY: process.env.API_KEY,
    url: 'https://api.example.com'
  }
});
```

1. **Conditional Value (presence-based)**

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

The `filemap` command accepts an object (not a file path string) with the following properties:

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
    { pause: "Press Enter to continue..." },
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

## Expression-Based Builtins

The library provides powerful expression-based builtins that write results to the runtime context (`$`). All builtins follow the format: `processor::operation::contextName: input`

### Capture Expression

Capture command output to runtime context:

```javascript
await shellFlow({
  commands: [
    { 'capture::logs': 'npm run test' },
    { echo: 'Test output: {{$.logs.items[0].stdout}}' }
  ]
});
```

### Retry Expression

Retry commands with automatic backoff:

```javascript
await shellFlow({
  commands: [
    { 'retry::3': 'curl https://api.example.com' },
    { 'retry::5': {
        'capture::response': 'curl https://api.example.com'
      }
    }
  ]
});
```

### JSON Operations

Parse, stringify, and extract JSON data:

```javascript
await shellFlow({
  commands: [
    // Parse JSON string
    { 'json::parse::data': '{"user":{"name":"John","age":30}}' },
    { echo: 'Name: {{$.data.user.name}}' },

    // Extract JSON path
    { 'json::get::name': '$.data.user.name' },
    { echo: 'Extracted: {{$.name}}' },

    // Stringify object
    { 'json::stringify::output': '{{$.data}}' }
  ]
});
```

**JSON Operations:**

- `json::parse::<name>: <json_string>` - Parse JSON to object
- `json::stringify::<name>: <object>` - Convert object to JSON string
- `json::get::<name>: <json_path>` - Extract value using JSONPath

### Transform Operations

String transformation operations:

```javascript
await shellFlow({
  commands: [
    // Uppercase
    { 'transform::uppercase::upper': 'hello world' },
    { echo: '{{$.upper}}' },  // HELLO WORLD

    // Lowercase
    { 'transform::lowercase::lower': 'HELLO WORLD' },

    // Trim whitespace
    { 'transform::trim::trimmed': '  hello  ' },

    // Replace text
    { 'transform::replace::result': {
        input: 'hello world',
        search: 'world',
        replace: 'universe'
      }
    },

    // Split string to array
    { 'transform::split::items': {
        input: 'a,b,c',
        delimiter: ','
      }
    },

    // Join array to string
    { 'transform::join::result': {
        input: ['a', 'b', 'c'],
        delimiter: ','
      }
    }
  ]
});
```

**Transform Operations:**

- `transform::uppercase::<name>: <text>` - Convert to uppercase
- `transform::lowercase::<name>: <text>` - Convert to lowercase
- `transform::trim::<name>: <text>` - Trim whitespace
- `transform::replace::<name>: {input, search, replace}` - Replace text (supports regex)
- `transform::split::<name>: {input, delimiter}` - Split string to array
- `transform::join::<name>: {input, delimiter}` - Join array to string

### File Operations

Read, write, and manage files:

```javascript
await shellFlow({
  commands: [
    // Write file
    { 'file::write::write_result': {
        path: '/tmp/data.txt',
        content: 'Hello World'
      }
    },

    // Read file
    { 'file::read::content': '/tmp/data.txt' },
    { echo: 'Content: {{$.content}}' },

    // Check if file exists
    { 'file::exists::check': '/tmp/data.txt' },
    { echo: 'Exists: {{$.check}}' },

    // Copy file
    { 'file::copy::copy_result': {
        source: '/tmp/data.txt',
        destination: '/tmp/backup.txt'
      }
    },

    // List directory
    { 'file::list::files': '/tmp' },

    // Delete file
    { 'file::delete::delete_result': '/tmp/data.txt' }
  ]
});
```

**File Operations:**

- `file::read::<name>: <path>` - Read file content
- `file::write::<name>: {path, content}` - Write content to file
- `file::exists::<name>: <path>` - Check if file exists (returns boolean)
- `file::delete::<name>: <path>` - Delete file
- `file::copy::<name>: {source, destination}` - Copy file
- `file::list::<name>: <path>` - List directory contents

### HTTP Operations

Make HTTP requests:

```javascript
await shellFlow({
  commands: [
    // GET request
    { 'http::get::response': 'https://api.example.com/users' },
    { echo: 'Status: {{$.response.status}}' },
    { echo: 'Body: {{$.response.body}}' },

    // POST request
    { 'http::post::create_result': {
        url: 'https://api.example.com/users',
        body: { name: 'John', email: 'john@example.com' },
        headers: { 'Content-Type': 'application/json' }
      }
    },

    // PUT request
    { 'http::put::update_result': {
        url: 'https://api.example.com/users/1',
        body: { name: 'John Updated' }
      }
    },

    // DELETE request
    { 'http::delete::delete_result': 'https://api.example.com/users/1' }
  ]
});
```

**HTTP Operations:**

- `http::get::<name>: <url>` or `{url, headers}`
- `http::post::<name>: {url, body, headers?}`
- `http::put::<name>: {url, body, headers?}`
- `http::delete::<name>: <url>` or `{url, headers}`

**Response Format:**

```javascript
{
  status: 200,
  statusText: "OK",
  headers: { ... },
  body: "..." // Response body as string
}
```

### Encoding Operations

Encode, decode, and hash data:

```javascript
await shellFlow({
  commands: [
    // Base64 encode
    { 'encode::base64::encoded': 'hello world' },
    { echo: 'Encoded: {{$.encoded}}' },

    // Base64 decode
    { 'decode::base64::decoded': '{{$.encoded}}' },
    { echo: 'Decoded: {{$.decoded}}' },

    // URL encode
    { 'encode::url::url_encoded': 'hello world' },
    { echo: 'URL: {{$.url_encoded}}' },

    // URL decode
    { 'decode::url::url_decoded': '{{$.url_encoded}}' },

    // SHA256 hash
    { 'hash::sha256::hash': 'password123' },
    { echo: 'Hash: {{$.hash}}' },

    // MD5 hash
    { 'hash::md5::md5_hash': 'password123' }
  ]
});
```

**Encoding Operations:**

- `encode::base64::<name>: <text>` - Base64 encode
- `decode::base64::<name>: <text>` - Base64 decode
- `encode::url::<name>: <text>` - URL encode
- `decode::url::<name>: <text>` - URL decode
- `hash::sha256::<name>: <text>` - SHA256 hash (hex)
- `hash::md5::<name>: <text>` - MD5 hash (hex)

### Time Operations

Work with timestamps and dates:

```javascript
await shellFlow({
  commands: [
    // Get current timestamp
    { 'time::now::timestamp': null },
    { echo: 'Now: {{$.timestamp}}' },

    // Format timestamp
    { 'time::format::formatted': {
        timestamp: '{{$.timestamp}}',
        format: 'iso'  // iso, date, time, locale, or custom
      }
    },
    { echo: 'Formatted: {{$.formatted}}' },

    // Parse date string
    { 'time::parse::parsed': '2024-10-14' },
    { echo: 'Parsed: {{$.parsed}}' },

    // Add time
    { 'time::add::future': {
        timestamp: '{{$.timestamp}}',
        amount: 3600000,  // 1 hour in ms
        unit: 'milliseconds'
      }
    },

    // Calculate difference
    { 'time::diff::difference': {
        start: '{{$.timestamp}}',
        end: '{{$.future}}',
        unit: 'hours'
      }
    }
  ]
});
```

**Time Operations:**

- `time::now::<name>:` - Get current timestamp (milliseconds)
- `time::format::<name>: {timestamp, format}` - Format timestamp
  - Formats: `iso`, `date`, `time`, `locale`, or custom pattern
- `time::parse::<name>: <date_string>` - Parse date to timestamp
- `time::add::<name>: {timestamp, amount, unit}` - Add time
  - Units: `milliseconds`, `seconds`, `minutes`, `hours`, `days`
- `time::diff::<name>: {start, end, unit}` - Calculate difference

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
    onError: 'throw'  // 'stop' | 'continue' | 'throw'
  });
} catch (error) {
  console.log(error.message);    // Error description
  console.log(error.command);    // Failed command
  console.log(error.code);       // Exit code
  console.log(error.onError);    // Active error policy
}
```

### Error handling and retry examples

- onError policies:
  - stop: stop current sequence on first error in that scope (sets exit code)
  - continue: continue execution, collect errors (exit code 0)
  - throw: throw immediately

- retry options (global or per group):
  - attempts: number of tries (default 3)
  - delay: initial delay in ms (default 1000)
  - factor: backoff multiplier (default 2)
  - maxDelay: cap on delay (default 30000)
  - codes: exit codes to retry on (default [1])

```javascript
// Global retry, with per-group override
await shellFlow({
  onError: 'stop',
  retry: { attempts: 3, delay: 1000, factor: 2, maxDelay: 30_000, codes: [1] },
  commands: [
    {
      steps: [
        'may-fail-once',
        'then-run-next'
      ]
    },
    {
      // Override retry for this group only
      steps: ['another-maybe-failing-command'],
      retry: { attempts: 5, delay: 500 }
    },
    {
      // Continue on error without throwing/logging
      steps: ['bad-command'],
      onError: 'continue'
    }
  ]
});
```

## Best Practices

1. **Use expression syntax for builtin operations** - Leverage `json::`, `http::`, `file::`, etc. instead of shell commands
2. **Access builtin results via `$.name`** - Runtime context prevents naming collisions
3. **Use appropriate error handling policy** - Choose `stop`, `continue`, or `throw` based on your use case
4. **Capture output when needed** - Use `capture::name` for command output processing
5. **Use script mode for shell-specific features** - Enable `useScript: true` for complex shell scripts
6. **Group related commands** - Use `steps` to organize sequential operations
7. **Set environment variables at the most specific scope** - Apply `env` at command, group, or global level
8. **Use working directory correctly** - Set `wdir` to ensure proper command context
9. **Use `fork` for background processes** - Long-running services should run in background
10. **Use `parallel` for concurrent tasks** - Execute independent tasks simultaneously
11. **Compose expressions for complex workflows** - Nest `retry::`, `capture::`, and other expressions
12. **Use template variables for dynamic values** - Leverage `{{variable}}` syntax with context

## Limitations

- Nested parallel/fork operations in script mode are not supported
- Output capture is limited to sequential commands
- Some shell features may have platform-specific behavior

## Support

For issues and feature requests, please visit our repository at [GitLab](https://gitlab.com/fnetai/shell-flow).
