# @fnet/shell-flow

## Introduction

The `@fnet/shell-flow` project provides a powerful, expression-based shell command orchestration system for Node.js. Execute shell commands in sequence, parallel, or as background processes with built-in support for JSON operations, HTTP requests, file management, text transformations, and more. All builtin operations write to a dedicated runtime context (`$`) for clean, collision-free data management.

## How It Works

At its core, `@fnet/shell-flow` accepts a configuration object that specifies the commands to run, the working environment, and error handling strategies. Commands can be executed in sequence, parallel, or as background processes. The process manager integrated into the system ensures that all spawned processes are tracked and can be cleanly terminated if necessary. Additionally, it supports the use of templates for environment variables, enabling dynamic command configurations based on the user's context.

## Key Features

### Core Execution Modes

- **Sequential Command Execution**: Run commands one after the other, halting on errors if required.
- **Parallel Command Execution**: Execute multiple commands simultaneously for increased efficiency.
- **Background Execution**: Fork commands to run in the background, allowing the main process to continue without waiting.

### Expression-Based Builtins

- **JSON Operations**: Parse, stringify, and extract JSON data (`json::parse`, `json::get`)
- **HTTP Requests**: Make GET, POST, PUT, DELETE requests (`http::get`, `http::post`)
- **File Operations**: Read, write, copy, delete files (`file::read`, `file::write`)
- **Text Transformations**: Uppercase, lowercase, trim, replace, split, join (`txt::upper`, `txt::lower`)
- **Encoding/Hashing**: Base64, URL encoding, SHA256, MD5 (`encode::base64`, `hash::sha256`)
- **Time Operations**: Timestamps, formatting, parsing (`time::now`, `time::format`)

### Advanced Features

- **Runtime Context ($)**: Dedicated namespace for builtin results, prevents naming collisions
- **Template Variables**: Dynamic value substitution with `{{variable}}` syntax
- **Error Handling**: Customizable policies: stop, continue, throw
- **Output Capture**: Store and access command outputs for further processing or logging

## Documentation

For comprehensive documentation, examples, and API reference, see [fnet/how-to.md](fnet/how-to.md).

## Conclusion

`@fnet/shell-flow` provides a powerful, expression-based tool for managing shell command execution within a Node.js application. It allows developers to streamline their workflow by running and controlling multiple commands efficiently, with robust error handling, output capturing, and built-in operations for JSON, HTTP, files, text transformations, and more. This makes it suitable for automation scripts, build systems, and various development tasks requiring programmatic shell command executions.
