const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Configuration ---
const MODEL_NAME = "gemini-3-pro-preview"; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ FATAL: GEMINI_API_KEY is missing.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// --- Test Definition ---
const TOPIC = "A beginners guide to using Git";
// Use quotes for the argument to ensure it's treated as a single string
const TEST_SEQUENCE = [
    `/scribe:research "${TOPIC}" -- DO NOT ASK QUESTIONS. EXECUTE IMMEDIATELY.`,
    `/scribe:plan "${TOPIC}" -- EXECUTE IMMEDIATELY.`
];
const JUDGE_CRITERIA = `
1.  **Structure:** Does it follow the "Blueprint" format (Objective, Target Audience, Core Sections)?
2.  **Completeness:** Are the sections logical for the given topic?
3.  **Formatting:** Is it valid Markdown?
`;

// --- Helper: Run Shell Command ---
function runGeminiCommand(prompt) {
    return new Promise((resolve, reject) => {
        console.log(`💻 Executing: gemini -p "${prompt}" --yolo`);
        exec(`gemini -p '${prompt}' --yolo`, (error, stdout, stderr) => {
            // We don't reject on error immediately because the CLI might output useful stderr
            // but we do log it.
            if (error && error.code !== 0) {
                console.warn(`⚠️ CLI Exit Code ${error.code}: ${error.message}`);
            }
            resolve({ stdout, stderr, code: error ? error.code : 0 });
        });
    });
}

// --- Main Logic ---
async function runEval() {
    console.log(`🤖 Initializing End-to-End Eval with model: ${MODEL_NAME}`);
    
    // 0. Cleanup & Setup
    if (fs.existsSync('scribe')) {
        console.log("🧹 Cleaning up old 'scribe/' directory...");
        fs.rmSync('scribe', { recursive: true, force: true });
    }
    fs.mkdirSync('scribe'); // Pre-create root to prevent ENOENT flake

    let lastStdout = "";

    // 1. Run the CLI Command Sequence
    for (const cmd of TEST_SEQUENCE) {
        console.log(`\n--- Step: ${cmd} ---`);
        const { stdout, stderr, code } = await runGeminiCommand(cmd);
        lastStdout = stdout + stderr;
        
        console.log(lastStdout.substring(0, 300) + "..."); // Log partial output
        
        // Check for fatal errors in the output (heuristic)
        // Note: "Error executing tool" might be recoverable by the agent, so be careful.
        // We mostly care if the file was created.
    }
    
    // 2. Detect Generated File (BLUEPRINT.md)
    console.log("\n🔍 Scanning scribe/ directory for generated Blueprint...");
    
    const findBlueprint = (dir) => {
        let results = [];
        if (!fs.existsSync(dir)) return [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) { 
                results = results.concat(findBlueprint(filePath));
            } else if (file === 'BLUEPRINT.md') {
                results.push({ path: filePath, mtime: stat.mtime });
            }
        });
        return results;
    };
    
    // Wait a moment for IO to settle (rarely needed but safe)
    await new Promise(r => setTimeout(r, 1000));

    const files = findBlueprint('scribe');
    
    if (files.length === 0) {
        console.error("❌ Could not locate any BLUEPRINT.md file. Test Failed.");
        process.exit(1);
    }
    
    // Sort by newest
    files.sort((a, b) => b.mtime - a.mtime);
    const targetFile = files[0].path;

    console.log(`found Target File: ${targetFile}`);
    const fileContent = fs.readFileSync(targetFile, 'utf8');

    // 3. Evaluate the Output (LLM-as-a-Judge)
    const prompt = `
    You are an expert technical editor. Evaluate the following document based on these criteria:
    ${JUDGE_CRITERIA}

    Output a JSON object with the following schema:
    {
      "score": (number 1-10),
      "reasoning": "short explanation",
      "pass": (boolean)
    }

    ---
    DOCUMENT TO EVALUATE:
    ${fileContent}
    `;

    console.log("⚖️  Running Evaluation...");
    try {
        const evalResult = await model.generateContent(prompt);
        const evalText = evalResult.response.text();
        const cleanJson = evalText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const metrics = JSON.parse(cleanJson);
        console.log("\n📊 Evaluation Results:");
        console.log("Score:    ", metrics.score + "/10");
        console.log("Pass:     ", metrics.pass ? "✅ YES" : "❌ NO");
        console.log("Reasoning:", metrics.reasoning);
        
        if (!metrics.pass) process.exit(1);

    } catch (error) {
        console.error("❌ Evaluation Failed:", error.message);
        process.exit(1);
    }
}

runEval();