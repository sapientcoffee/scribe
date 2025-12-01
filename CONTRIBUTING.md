# Contributing to Scribe

Thank you for your interest in contributing to Scribe! We welcome contributions from the community to help make this the best documentation workflow tool for the Gemini CLI.

## 🚀 Getting Started

### Prerequisites
*   **Gemini CLI:** Ensure you have the [Gemini CLI installed](https://geminicli.com/docs/getting-started/installation).
*   **Git:** You'll need Git to manage the repository.

### Installation for Development
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sapientcoffee/scribe.git
    cd scribe
    ```

2.  **Link the extension:**
    Use the Gemini CLI to link the local directory. This allows you to test your changes live without reinstalling.
    ```bash
    gemini extensions link .
    ```

3.  **Verify installation:**
    Run a status check to ensure Scribe is active.
    ```bash
    gemini run scribe:status
    ```

## 🛠️ Development Workflow

### Architecture
Scribe uses a **Modular JIT (Just-In-Time) Context** architecture.
*   **Command Files:** All logic resides in `commands/scribe/*.toml`.
*   **Inlined Context:** To ensure portability, context (personas, rules) is inlined directly into these TOML files.
*   **ADRs:** Please review `docs/adr/` for architectural decisions before making major structural changes.

### Making Changes
1.  **Create a Branch:** Always work on a new branch for your feature or fix.
    ```bash
    git checkout -b feature/my-new-feature
    ```
2.  **Modify Prompts:** Edit the `.toml` files in `commands/scribe/`.
    *   *Tip:* Keep the `prompt` strings clean and readable.
    *   *Constraint:* Do not introduce external file dependencies (e.g., `@{context/file.md}`) unless necessary, as this breaks portability.
3.  **Validate:** Run the validation tool to check for syntax errors.
    ```bash
    gemini extensions validate .
    ```

### Testing
*   **Manual Testing:** Run the command you modified with various inputs to ensure it behaves as expected.
*   **CI/CD:** We are building out an automated test suite. Ensure your PR passes all checks.

## 📝 Style Guide
*   **Commit Messages:** We follow [Conventional Commits](https://www.conventionalcommits.org/).
    *   `feat: add support for PDF export`
    *   `fix: correct typo in draft prompt`
    *   `docs: update workflow diagram`
*   **Documentation:** If you change a workflow, update the Mermaid diagram in `README.md`.

## 📬 Submitting a Pull Request
1.  Push your branch to GitHub.
2.  Open a Pull Request against the `main` branch.
3.  Describe your changes clearly.
4.  Link to any relevant issues.

We look forward to your code!
