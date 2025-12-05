const fs = require('fs');
const path = require('path');

// Helper to extract the prompt string from a TOML file
function extractPromptFromToml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Simple regex to capture the multi-line string inside prompt = """ ... """
  const match = content.match(/prompt\s*=\s*"""([\s\S]*?)"""/);
  if (match && match[1]) {
    return match[1];
  }
  throw new Error(`Could not extract prompt from ${filePath}`);
}

// Read the base context (scribe.md)
// Note: In the real CLI, scribe.md is the "context" and the TOML prompt is the "user message".
// But often the CLI concatenates them or sends them as System + User.
// The TOML prompt in this extension ALREADY includes the System Prompt content (Copy-Pasted).
// Wait, looking at the `read_file` output of `commands/scribe/plan.toml` above...
// It seems `plan.toml`'s prompt value ALREADY contains "# Scribe Core Principles & Workflow".
// This means `scribe.md` is duplicated in the TOML? 
// Let's check `scribe.md` content vs `plan.toml` content.

// `scribe.md` (from first turn): "# Scribe: The Documentation Assistant - System Prompt..."
// `plan.toml` (from previous turn): "# Scribe Core Principles & Workflow..."

// They look VERY similar but slightly different titles.
// It seems the TOML files are self-contained?
// "commands/scribe/plan.toml": `prompt = """... # Scribe Core Principles & Workflow ...`
// If the TOMLs are self-contained, then we just need to test the TOML content.
// But the `gemini-extension.json` says `"contextFileName": "scribe.md"`.
// Usually the CLI appends the context file to the prompt.
// If the TOML *also* has it, that's redundancy.
// Let's trust the TOML content for now as the "Prompt" to test.

const planPromptTemplate = extractPromptFromToml('commands/scribe/plan.toml');
const draftPromptTemplate = extractPromptFromToml('commands/scribe/draft.toml');

module.exports = {
  description: 'Scribe Extension Integration Tests',
  prompts: [
    {
      id: 'plan-command',
      label: '/scribe:plan',
      raw: planPromptTemplate, 
    },
    {
      id: 'draft-command',
      label: '/scribe:draft',
      raw: draftPromptTemplate,
    }
  ],
  providers: [
    'scripts/promptfoo-provider.js'
  ],
  defaultTest: {
    options: {
      provider: 'scripts/promptfoo-provider.js',
    }
  },
  tests: [
    {
      // Test 1: Plan Logic
      description: 'Plan Command - Protocol Check',
      vars: {
        args: 'History of Espresso'
      },
      options: {
        promptId: 'plan-command' 
      },
      assert: [
        {
          // It should try to find the research file
          type: 'contains',
          value: 'RESEARCH.md',
        },
        {
          // Persona Check - Verifying Protocol Adherence
          type: 'llm-rubric',
          value: 'The response should indicate an attempt to locate or read the "RESEARCH.md" file as the first step of the protocol.',
        }
      ]
    },
    {
      // Test 2: Draft Logic
      description: 'Draft Command - Protocol Check',
      vars: {
        args: 'History of Espresso'
      },
      options: {
        promptId: 'draft-command'
      },
      assert: [
        {
          // It should try to find the blueprint
          type: 'contains',
          value: 'BLUEPRINT.md',
        },
        {
          type: 'llm-rubric',
          value: 'The response should acknowledge the need to find BLUEPRINT.md and RESEARCH.md before writing.',
        }
      ]
    }
  ]
};
