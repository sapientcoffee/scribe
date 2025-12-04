# Gemini CLI Extension Developer Guide

_This file serves as your expert guide for developing Gemini CLI extensions. It contains core concepts, best practices, and detailed syntax for building powerful, context-aware commands._

## 1. Core Concepts

A Gemini CLI Extension is a package containing prompts, custom commands, and/or custom tools (via MCP servers) that extend the functionality of the Gemini CLI.

### Key File: `gemini-extension.json`

This manifest file is the heart of the extension. It defines:

- `name`: The unique name of the extension.
- `version`: The version number.
- `contextFileName`: The markdown file providing core logic (e.g., `"scribe.md"`).
- `mcpServers`: (For tool-based extensions) Paths to servers that provide new tools to the model.
- `excludeTools`: A list of built-in tools to disable for a more focused environment.

### Extension Context (`.md` file)

For context-only extensions, this file (e.g., `scribe.md`) is the "brain." It contains the detailed instructions, templates, and logic that the model follows when a custom command is executed.

## 2. Development Workflow

- **Bootstrap:** `gemini extensions new <path> [template]`
- **Local Dev:** `gemini extensions link .` (symlinks your project for live updates).
- **Validation:** `gemini extensions validate` (checks for manifest errors).

## 3. Expertise: Custom Commands

Custom commands are defined in `.toml` files within the `commands/` directory. They are the primary way users interact with your extension.

### Naming and Namespacing

The command name is derived from its file path. Subdirectories create namespaces.

- `commands/research.toml` → `/research`
- `commands/scribe/plan.toml` → `/scribe:plan`

### Command Definition (`.toml`)

- `description` (String, Optional): A one-line summary for the `/help` menu. **Best Practice:** Always include this.
- `prompt` (String, Required): The detailed, multi-line instruction sent to the model.
- `command` (String, Alternative): Executes a shell command instead of using a static prompt.

### Dynamic Prompts: The Core of Powerful Commands

You can make prompts dynamic by injecting live system information.

- **Shell Command Injection `!{...}`:** Executes a shell command and injects its `stdout` into the prompt. This is ideal for bringing in context that changes, like the state of a Git repository.
  - _Example:_ `prompt = "Review this code: !{git diff --staged}"`
  - _Security:_ The CLI will always ask for user confirmation before executing shell commands.

- **File Content Injection `@{...}`:** Directly embeds the content of one or more files into the prompt. This is the most efficient way to provide context from the user's workspace. It supports text, images, PDFs, and more.
  - _Example:_ `prompt = "Summarize this document: @{./project/README.md}"`

### Advanced Argument Handling (`{{args}}`)

The `{{args}}` placeholder allows you to use the arguments a user provides to the command.

1. **Default Append:** If `{{args}}` is **not** found in the prompt, any arguments the user provides are automatically appended to the end of the prompt.
2. **Context-Aware Injection:** If `{{args}}` **is** in the prompt, it is replaced with the user's arguments at that specific location.
3. **Automatic Shell Escaping:** If `{{args}}` is used inside a shell command `!{...}`, the arguments are automatically and safely shell-escaped to prevent injection attacks.
    - _Example:_ `prompt = "!{grep -r {{args}} .}"`

### Command Precedence

If command names conflict, the CLI uses a clear override order:

1. **Project Commands** (`<project>/.gemini/commands/`)
2. **User/Global Commands** (`~/.gemini/commands/`)
3. **Extension Commands** (like this one)

## 4. Standard Command Structure (Scribe Project)

All commands in this project should follow the "meta-prompt" template below to ensure consistent and predictable behavior.

```toml
description = "[A one-line summary of the command's purpose.]"
prompt = """You are operating in **[MODE] Mode**. Your role is to act as a [PERSONA].

**Role & Persona:**
[Describe the persona's skills and mindset.]

## Core Mandates
1.  **[Rule 1]:** [A non-negotiable constraint.]

## Workflow
### Phase 1: Analyze
1.  **Analyze User Request:** `{{args}}`
2.  **Consult Context:** Use the principles and templates in `scribe.md`.

### Phase 2: Act
1.  **Action:** [The primary action of the command.]

---
*User Request: {{args}}*
"""
```
