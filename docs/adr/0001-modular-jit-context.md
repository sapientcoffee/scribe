# ADR 001: Modular JIT Context Architecture via Inlining

**Date:** 2025-11-27
**Status:** Accepted

## Context

The Scribe extension originally used a "Monolithic Context" architecture. A single, massive `scribe.md` file (now located at `docs/workflow/scribe.md`) was defined in `gemini-extension.json` as the `contextFileName`. This meant that **every** interaction with the CLI loaded the entire system prompt (all personas, all workflows, all rules), regardless of the specific command being executed.

**Problems:**

1. **Token Inefficiency:** Simple commands like `/scribe:status` incurred the cost of loading the "Researcher" and "Writer" instructions.
2. **Context Pollution:** The model sometimes confused instructions from one persona with another (e.g., acting like a Critic during a Drafting phase).

We initially attempted to solve this by splitting `scribe.md` into modular files (`context/*.md`) and injecting them via `@{context/file.md}` in the `.toml` commands. However, this failed because the Gemini CLI resolves `@{...}` paths relative to the *user's current working directory*, not the extension's directory. This caused "File Not Found" errors when users ran Scribe from outside the extension folder.

## Decision

We have adopted a **Modular Just-In-Time (JIT) Context Architecture via Inlining**.

1. **No Global Context:** The `contextFileName` field in `gemini-extension.json` is intentionally omitted.
2. **Inlined Prompts:** All necessary context (Principles, Persona definitions, Safety Protocols) is **duplicated and inlined directly** into each specific `commands/scribe/*.toml` file.
    * `draft.toml` contains the "Core Principles" and "Writer Persona" text.
    * `review.toml` contains the "Core Principles" and "Coach Persona" text.

## Consequences

### Positive

* **Token Efficiency:** We achieve ~60-80% reduction in input tokens per command. The model only sees exactly what it needs for the current task.
* **Portability:** The extension works from any directory because it has no external file dependencies for its prompts.
* **Focus:** The model's performance is improved because the context window is not cluttered with irrelevant instructions.

### Negative

* **Maintenance Overhead:** The "Core Principles" text is now duplicated across 8+ files. Updating a core rule (e.g., changing the line length limit) requires updating every single `.toml` file.
* **Git Noise:** PRs involving core rule changes will touch many files.

## Mitigation

To mitigate the maintenance overhead, we rely on the "Syntax & Structure Tests" (CI/CD) to ensure consistency across the files. Future improvements might involve a build script to generate the `.toml` files from a source of truth, but manual synchronization is acceptable for the current scale.
