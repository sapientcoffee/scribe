# Scribe Extension Testing Strategy

This document provides a comprehensive guide to the testing infrastructure of the Scribe extension. Our strategy employs a "Testing Pyramid" approach, ranging from fast static analysis to deep semantic quality checks.

## 1. Static Analysis & Linting (The Foundation)

**Command:** `npm test`  
**Script:** `scripts/run-tests.sh`

This is the first line of defense. It runs locally and in CI/CD to ensure the extension is syntactically correct and adheres to project standards. It does not make external API calls.

| Check Type | Tool | Why it is used |
| :--- | :--- | :--- |
| **Manifest Validation** | `ajv-cli` | Validates `gemini-extension.json` against the official Gemini CLI schema. Ensures the extension can be installed without errors. |
| **JSON Linting** | `jsonlint` | Scans all `.json` files for syntax errors (e.g., trailing commas, missing quotes). |
| **Markdown Linting** | `markdownlint` | Enforces style rules in documentation (headers, lists, code blocks) to ensure `README.md` and `scribe.md` render correctly. |
| **TOML Linting** | `@taplo/cli` | Validates the syntax of command definition files in `commands/*.toml`. Broken TOML crashes the CLI. |
| **YAML Linting** | `yamllint` | Checks GitHub Actions workflows and other YAML configs for structural validity. |
| **Token Audit** | `scripts/audit-tokens.js` | Estimates the token count of your prompts (`scribe.md` + commands). Ensures prompts fit within the context window of target models. |

---

## 2. Quality Assurance & Regression (The Semantic Layer)

**Command:** `npm run test:eval`  
**Tool:** [promptfoo](https://promptfoo.dev/)  
**Config:** `promptfooconfig.js`

This layer tests the **intelligence** of the extension. It verifies that the AI model understands your instructions, adopts the correct personas, and follows formatting constraints.

### Components

*   **Custom Provider (`scripts/promptfoo-provider.js`):**
    *   A custom adapter that wraps the official `@google/generative-ai` SDK.
    *   **Why:** It ensures the test runner connects to Gemini exactly the same way the actual CLI does, using the same API keys and models (`gemini-3-pro-preview` or `gemini-1.5-pro`).
*   **Test Configuration (`promptfooconfig.js`):**
    *   Automatically extracts the raw prompt strings from your `.toml` command files.
    *   Defines test cases with specific inputs (e.g., "History of Espresso").
*   **Assertions:**
    *   **Deterministic:** Checks if specific strings exist (e.g., `contains: "# Blueprint"`).
    *   **LLM-Graded:** Uses a "Judge" model to evaluate subjective qualities (e.g., "Does the tone sound professional?", "Did it refuse to hallucinate?").

### Why we use it
*   **Regression Testing:** If you edit `scribe.md` to change a rule, this test ensures the model actually follows the new rule.
*   **Tone Consistency:** Verifies that the "Architect" sounds like an architect and the "Reviewer" sounds critical.
*   **Constraint Enforcement:** Ensures the model refuses to generate content if prerequisites (like `RESEARCH.md`) are missing.

## 3. Model Matrix Testing (Future-Proofing)

**Command:** `npm run test:models`  
**Config:** `promptfoo-matrix.js`

This is an advanced variation of the Quality Assurance layer. It executes the **exact same test suite** against a matrix of different Gemini models simultaneously.

### Strategy
*   **Baseline:** We usually test against `gemini-3-pro-preview` (or the current stable standard).
*   **Experimental:** We compare results against `gemini-2.0-flash-exp` or other preview models.

### Why we use it
*   **Model Migration:** When a new Gemini version is released, we run this to ensure our prompts still work effectively before switching the default model.
*   **Cost Optimization:** We can verify if a cheaper/faster model (like Flash) is "good enough" to handle the complex Scribe prompts compared to Pro models.

---

## 4. End-to-End Integration (The "Golden Path")

**Command:** `node scripts/eval-custom.js`

This script simulates a real user interacting with the CLI to verify the entire workflow loop, including File I/O.

### Workflow Tested
1.  **User Action:** Run `/scribe:research "History of Coffee"`
2.  **System Action:** AI generates content -> **Writes file** `scribe/history-of-coffee/RESEARCH.md`.
3.  **User Action:** Run `/scribe:plan "history-of-coffee"`
4.  **System Action:** AI reads `RESEARCH.md` -> **Writes file** `scribe/history-of-coffee/BLUEPRINT.md`.

### Verification Logic
*   **File System Check:** Did the files actually appear on the disk? (Verifies `write_file` tool usage).
*   **LLM Judge:** The script reads the generated `BLUEPRINT.md` and asks a separate AI instance to grade it 1-10 on clarity and completeness.

### Why we use it
Static analysis and Promptfoo checks only return *text*. They don't prove that the AI can successfully use tools to create files on the user's disk. This test proves the **agentic** capabilities of the extension.

---

## Summary of Test Commands

| Goal | Command | When to run |
| :--- | :--- | :--- |
| **Quick Syntax Check** | `npm test` | After every file edit. |
| **Check AI Quality** | `npm run test:eval` | After modifying `scribe.md` or `.toml` prompts. |
| **Verify Workflow** | `node scripts/eval-custom.js` | Before merging a Pull Request or releasing. |
