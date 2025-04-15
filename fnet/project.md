# Shell-Flow Project

## The Problem

Developers often need to run multiple shell commands as part of their workflows - building apps, running tests, starting services, etc. Managing these commands can be messy:

- Error handling is inconsistent
- Running commands in parallel requires platform-specific syntax
- Background processes are hard to manage
- Command output is difficult to capture and process
- Working with different environments is error-prone

## The Solution

Shell-Flow will provide a simple way to:

- Execute shell commands with consistent error handling
- Run commands in sequence, parallel, or background
- Capture and process command output
- Manage environment variables and working directories
- Work the same way across different platforms

## Target Users

- Software developers
- DevOps engineers
- Build system maintainers
- Anyone who needs to automate shell commands

## Features & Development Plan

### Command Execution

Features:

- [x] Run commands sequentially
- [x] Execute commands in parallel
- [x] Manage background processes
- [x] Group related commands together

Development:

1. [x] Phase 1: Basic sequential execution
2. [x] Phase 2: Add parallel execution
3. [x] Phase 2: Implement background processes
4. [x] Phase 2: Enable command grouping

### Error Management

Features:

- [x] Multiple error handling policies:
  - [x] Stop on first error
  - [x] Continue despite errors
  - [x] Log errors and continue
  - [x] Throw errors immediately

Development:

1. [x] Phase 1: Basic error handling (stop/continue)
2. [x] Phase 1: Add error logging
3. [x] Phase 2: Implement advanced policies
4. [ ] Phase 3: Cross-platform error consistency

### Output Control

Features:

- [x] Capture command outputs
- [x] Name outputs for later use
- [x] Track both success and error messages

Development:

1. [x] Phase 1: Basic output capture
2. [x] Phase 2: Named outputs
3. [x] Phase 2: Enhanced error tracking
4. [ ] Phase 3: Output processing utilities

### Environment Control

Features:

- [x] Manage working directories
- [x] Control environment variables
- [x] Share settings between command groups

Development:

1. [x] Phase 1: Basic directory management
2. [x] Phase 1: Environment variables support
3. [x] Phase 2: Shared settings
4. [ ] Phase 3: Cross-platform compatibility

### Template Support

Features:

- [x] Double brace syntax {{variable}}
- [x] Error handling flags ({{var!}} required, {{var?}} optional)
- [x] Dot notation for nested objects ({{app.config.port}})
- [x] Array access support ({{services[0].name}})
- [x] Mixed dot and array notation ({{config.envs[1].port}})

Development:

1. [x] Phase 1: Basic variable substitution
2. [x] Phase 1: Required/Optional flags
3. [x] Phase 2: Nested object support
4. [x] Phase 2: Array access support

## Success Criteria

We'll know we've succeeded when:

- [x] Commands execute reliably
- [x] Error handling works as expected
- [x] Output capture is consistent
- [ ] Works on Windows and Unix
- [x] Easy to understand and use
- [x] Well documented with examples
