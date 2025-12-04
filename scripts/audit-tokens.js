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

function getStaticCount(text) {
    return enc.encode(text).length;
}

async function getApiCount(text) {
    if (!model) return null;
    try {
        const result = await model.countTokens(text);
        return result.totalTokens;
    } catch (error) {
        console.warn(`   ⚠️  API Error counting tokens: ${error.message}`);
        return null;
    }
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
    const baseStatic = getStaticCount(baseContent);
    const baseApi = await getApiCount(baseContent);
    
    // Use API count if available, otherwise fallback (though script exits if no key)
    const baseUsed = baseApi !== null ? baseApi : baseStatic;
    
    console.log(`🔹 Base Context (scribe.md):`);
    console.log(`   API: \x1b[33m${baseApi !== null ? baseApi : 'N/A'}\x1b[0m`);
    console.log(`   Est: \x1b[36m${baseStatic}\x1b[0m\n`);

    console.log("🔸 Commands (Base + Specific Prompt):");
    console.log("-------------------------------------");

    // 2. Commands
    const commandsDir = 'commands/scribe';
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.toml'));
    
    const commandData = [];

    for (const file of files) {
        const content = getFileContent(path.join(commandsDir, file));
        const prompt = extractPrompt(content);
        
        const promptStatic = getStaticCount(prompt);
        const promptApi = await getApiCount(prompt);
        
        const totalStatic = baseStatic + promptStatic;
        const totalApi = (baseApi !== null && promptApi !== null) ? (baseApi + promptApi) : null;

        // Determining the "Official" total for pass/fail
        const officialTotal = totalApi !== null ? totalApi : totalStatic;

        commandData.push({
            name: file,
            totalApi,
            totalStatic,
            officialTotal
        });
    }

    // Sort by official total count descending
    commandData.sort((a, b) => b.officialTotal - a.officialTotal);

    let hasError = false;

    commandData.forEach(cmd => {
        let statusColor = "\x1b[32m"; // Green
        let statusIcon = "";

        if (cmd.officialTotal > MAX_TOKENS) {
            statusColor = "\x1b[31m"; // Red
            statusIcon = " ⚠️  EXCESSIVE";
            hasError = true;
        }

        const apiStr = cmd.totalApi !== null ? cmd.totalApi.toString().padStart(5) : "  N/A";
        const estStr = cmd.totalStatic.toString().padStart(5);

        console.log(`- ${cmd.name.padEnd(20)}: API: ${statusColor}${apiStr}\x1b[0m | Est: \x1b[36m${estStr}\x1b[0m${statusIcon}`);
    });

    console.log("\n====================");
    console.log("Legend: API = Gemini 3 Pro (Exact) | Est = GPT-4 Tokenizer (Approximate)");

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
