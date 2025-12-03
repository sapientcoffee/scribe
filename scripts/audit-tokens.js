const fs = require('fs');
const path = require('path');
const { encodingForModel } = require('js-tiktoken');

// Initialize tokenizer (using GPT-4 model as a standard proxy for modern LLM tokenization)
const enc = encodingForModel("gpt-4");

function countTokens(text) {
    return enc.encode(text).length;
}

function getBaseContext() {
    try {
        const content = fs.readFileSync('scribe.md', 'utf8');
        return {
            name: 'scribe.md (Base Context)',
            tokens: countTokens(content),
            content: content
        };
    } catch (e) {
        return { name: 'scribe.md', tokens: 0, content: '' };
    }
}

function getCommands() {
    const commandsDir = 'commands/scribe';
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.toml'));
    
    return files.map(file => {
        const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
        // Extract prompt string from TOML (naive extraction for simplicity, or we could use a TOML parser)
        // Looking for: prompt = """...""" or prompt = "..."
        let promptContent = "";
        
        // Try multi-line string first
        const multiLineMatch = content.match(/prompt\s*=\s*"""([\s\S]*?)"""/);
        if (multiLineMatch) {
            promptContent = multiLineMatch[1];
        } else {
            // Try single line
            const singleLineMatch = content.match(/prompt\s*=\s*"(.*?)"/);
            if (singleLineMatch) {
                promptContent = singleLineMatch[1];
            }
        }

        return {
            name: file,
            tokens: countTokens(promptContent),
            totalTokens: 0 // To be calculated
        };
    });
}

// Main Execution
console.log("📊 Token Usage Audit");
console.log("====================\n");

const base = getBaseContext();
console.log(`🔹 Base Context (${base.name}): \x1b[33m${base.tokens}\x1b[0m tokens\n`);

console.log("🔸 Commands (Base + Specific Prompt):");
console.log("-------------------------------------");

// Threshold for warning/failure
const MAX_TOKENS = 4000;
let hasError = false;

const commands = getCommands();
// Sort by token count descending
commands.sort((a, b) => b.tokens - a.tokens);

commands.forEach(cmd => {
    const total = base.tokens + cmd.tokens;
    let statusColor = "\x1b[32m"; // Green
    let statusIcon = "";

    if (total > MAX_TOKENS) {
        statusColor = "\x1b[31m"; // Red
        statusIcon = " ⚠️  EXCESSIVE";
        hasError = true;
    }

    console.log(`- ${cmd.name.padEnd(20)}: \x1b[36m${cmd.tokens.toString().padStart(4)}\x1b[0m (Prompt) + \x1b[33m${base.tokens}\x1b[0m (Base) = ${statusColor}${total.toString().padStart(5)}\x1b[0m Total${statusIcon}`);
});

console.log("\n====================");
console.log("NOTE: Estimates using GPT-4 tokenizer. Actual Gemini tokens may vary slightly.");

if (hasError) {
    console.error(`\n❌ FAILED: One or more commands exceed the ${MAX_TOKENS} token limit.`);
    process.exit(1);
}
