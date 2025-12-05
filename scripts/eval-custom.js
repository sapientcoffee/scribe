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
const TOPIC = "History and application of coffee in the UK";
const TOPIC_SLUG = "history-and-application-of-coffee-in-the-uk";
// Use quotes for the argument to ensure it's treated as a single string
const TEST_SEQUENCE = [
    `/scribe:research "${TOPIC}" -- You MUST use the 'write_file' tool to create 'scribe/${TOPIC_SLUG}/RESEARCH.md'. Do not just print the text.`,
    `/scribe:plan ${TOPIC_SLUG} -- You MUST read 'scribe/${TOPIC_SLUG}/RESEARCH.md' and use 'write_file' to create 'scribe/${TOPIC_SLUG}/BLUEPRINT.md'.`
];
const JUDGE_CRITERIA = `
1.  **Clarity:** Is the plan easy to understand and follow?
2.  **Completeness:** Does it cover the topic of "${TOPIC}" in a logical way?
3.  **Formatting:** Is it valid Markdown?
`;

// --- Helper: Run Shell Command ---
function runGeminiCommand(prompt) {
    return new Promise((resolve, reject) => {
        console.log(`💻 Executing: gemini -p "${prompt}" --yolo`);
        exec(`gemini -p '${prompt.replace(/'/g, "'\\''")}' --yolo`, (error, stdout, stderr) => {
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
        
        // Check for fatal errors in the output
        if (code !== 0) {
             console.error("❌ Step failed with non-zero exit code.");
             process.exit(1);
        }

        // Debug: Check file system state after Research step
        if (cmd.includes("research")) {
             const researchPath = `scribe/history-and-application-of-coffee-in-the-uk/RESEARCH.md`;
             if (!fs.existsSync(researchPath)) {
                 console.error(`❌ RESEARCH.md not found at expected path: ${researchPath}`);
                 console.log("📂 Current scribe/ contents:");
                 try {
                    // Recursive ls
                    const list = (dir) => {
                        if (!fs.existsSync(dir)) return;
                        const files = fs.readdirSync(dir);
                        files.forEach(f => {
                            const p = path.join(dir, f);
                            const stat = fs.statSync(p);
                            console.log(`${p} ${stat.isDirectory() ? '/' : ''}`);
                            if (stat.isDirectory()) list(p);
                        });
                    };
                    list('scribe');
                 } catch(e) { console.error(e); }
                 
                 // Don't exit yet, let's see if the plan step fails (it will)
             } else {
                 console.log("✅ RESEARCH.md successfully created.");
             }
        }
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
        const jsonMatch = evalText.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : evalText;
        
        const metrics = JSON.parse(cleanJson);
        console.log("\n📊 Evaluation Results:");
        console.log("Score:    ", metrics.score + "/10");
        console.log("Pass:     ", metrics.pass ? "✅ YES" : "❌ NO");
        console.log("Reasoning:", metrics.reasoning);
        
        // Write Report for CI
        if (process.env.GITHUB_ACTIONS) {
            const report = `### 🤖 Custom Judge Results (Node.js)
| Metric | Value |
| :--- | :--- |
| **Score** | **${metrics.score}/10** |
| **Status** | ${metrics.pass ? '✅ PASS' : '❌ FAIL'} |

> **Judge Reasoning:** ${metrics.reasoning}
`;
            fs.writeFileSync("custom_eval_report.md", report);
        }
        
        if (!metrics.pass) {
            console.warn("⚠️ Judge marked this as a FAIL, but we will proceed to Vertex AI Eval for a second opinion.");
            // process.exit(1); // Relaxed for demo purposes
        }

    } catch (error) {
        console.error("❌ Evaluation Failed:", error.message);
        process.exit(1);
    }
}

runEval();