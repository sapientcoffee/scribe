const fs = require('fs');
const path = require('path');
const { encodingForModel } = require('js-tiktoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const MAX_TOKENS = 4500;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_API = !!GEMINI_API_KEY;

// --- Initialization ---
const enc = encodingForModel("gpt-4");
let genAI = null;
let model = null;

if (USE_API) {
    console.log("🔑 Gemini API Key found. Using API for precise token counting.");
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
} else {
    console.error("❌ FATAL: GEMINI_API_KEY is missing.");
    console.error("   Token audit requires a valid API key to ensure accurate counts.");
    process.exit(1);
}

// --- Helper Functions ---

async function countTokens(text) {
    if (USE_API && model) {
        try {
            const result = await model.countTokens(text);
            return result.totalTokens;
        } catch (error) {
            console.warn(`   ⚠️  API Error counting tokens: ${error.message}. Falling back to static.`);
            return enc.encode(text).length;
        }
    }
    return enc.encode(text).length;
}

function getFileContent(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        return "";
    }
}

function extractPrompt(content) {
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
    return promptContent;
}

// --- Main Logic ---

async function runAudit() {
    console.log("\n📊 Token Usage Audit");
    console.log("====================\n");

    // 1. Base Context
    const baseContent = getFileContent('scribe.md');
    const baseTokens = await countTokens(baseContent);
    
    console.log(`🔹 Base Context (scribe.md): \x1b[33m${baseTokens}\x1b[0m tokens${USE_API ? ' (Exact)' : ' (Est.)'}\n`);

    console.log("🔸 Commands (Base + Specific Prompt):");
    console.log("-------------------------------------");

    // 2. Commands
    const commandsDir = 'commands/scribe';
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.toml'));
    
    const commandData = [];

    for (const file of files) {
        const content = getFileContent(path.join(commandsDir, file));
        const prompt = extractPrompt(content);
        
        // Note: In a real request, base + prompt are combined. 
        // The API might count them slightly differently when concatenated vs summed, 
        // but sum is a very close approximation for this audit.
        const promptTokens = await countTokens(prompt);
        const totalTokens = baseTokens + promptTokens;

        commandData.push({
            name: file,
            promptTokens,
            totalTokens
        });
    }

    // Sort by total count descending
    commandData.sort((a, b) => b.totalTokens - a.totalTokens);

    let hasError = false;

    commandData.forEach(cmd => {
        let statusColor = "\x1b[32m"; // Green
        let statusIcon = "";

        if (cmd.totalTokens > MAX_TOKENS) {
            statusColor = "\x1b[31m"; // Red
            statusIcon = " ⚠️  EXCESSIVE";
            hasError = true;
        }

        console.log(`- ${cmd.name.padEnd(20)}: \x1b[36m${cmd.promptTokens.toString().padStart(4)}\x1b[0m (Prompt) + \x1b[33m${baseTokens}\x1b[0m (Base) = ${statusColor}${cmd.totalTokens.toString().padStart(5)}\x1b[0m Total${statusIcon}`);
    });

    console.log("\n====================");
    if (USE_API) {
        console.log("✅ Token counts are accurate (from Gemini API).");
    } else {
        console.log("NOTE: Estimates using GPT-4 tokenizer. Actual Gemini tokens may vary slightly.");
    }

    if (hasError) {
        console.error(`\n❌ FAILED: One or more commands exceed the ${MAX_TOKENS} token limit.`);
        process.exit(1);
    }
}

// Run the async main function
runAudit().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});