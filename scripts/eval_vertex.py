import os
import sys
import json
import vertexai
import pandas as pd
import google.cloud.aiplatform as aiplatform
from datetime import datetime
from vertexai.preview.evaluation import EvalTask, PointwiseMetric, MetricPromptTemplateExamples

# --- Configuration ---
PROJECT_ID = os.getenv("PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1" # Vertex AI Eval is strictly regional (mostly us-central1)
FILE_PATH = "scribe/history-and-application-of-coffee-in-the-uk/BLUEPRINT.md"

if not PROJECT_ID:
    print("⚠️  Skipping Vertex AI Eval: GOOGLE_CLOUD_PROJECT not set.")
    sys.exit(0)

def run_vertex_eval():
    print(f"🤖 Initializing Vertex AI Eval (Project: {PROJECT_ID})...")
    
    # Initialize Vertex AI (for EvalTask)
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    
    # Initialize AI Platform (for Experiment Tracking)
    aiplatform.init(
        project=PROJECT_ID, 
        location=LOCATION,
        experiment="scribe-eval-demo"
    )

    # 1. Read the document to evaluate
    if not os.path.exists(FILE_PATH):
        print(f"❌ Error: File {FILE_PATH} not found. Run 'node scripts/eval-custom.js' first.")
        sys.exit(1)

    with open(FILE_PATH, "r") as f:
        response_text = f.read()

    # 2. Load Golden Reference (from eval_dataset.jsonl)
    reference_text = ""
    try:
        with open("eval_dataset.jsonl", "r") as f:
            # Take the first example as our "Golden Standard" for structure
            first_line = f.readline()
            if first_line:
                data = json.loads(first_line)
                reference_text = data.get("reference", "")
    except Exception as e:
        print(f"⚠️  Could not load golden reference: {e}")

    # 3. Define a Custom Metric (e.g., "Blueprint Adherence")
    # We use a Pointwise metric because we are evaluating a single response without a reference.
    blueprint_metric = PointwiseMetric(
        metric="blueprint_adherence",
        metric_prompt_template=MetricPromptTemplateExamples.get_prompt_template(
            "fluency" # We use 'fluency' as a base structure but could customize the definition
        )
    )

    # 4. Run the Evaluation Task
    # Create a unique run ID
    run_id = f"eval-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    # We must provide the 'prompt' so the metrics can evaluate the context
    # We add 'reference' to enable reference-based metrics like ROUGE
    eval_task = EvalTask(
        dataset=pd.DataFrame({
            "prompt": ["Create a blueprint for a guide on: History and application of coffee in the UK"],
            "response": [response_text],
            "reference": [reference_text]
        }),
        metrics=[
            # Built-in Pointwise Metrics
            "coherence",
            "safety",
            # Reference-based Metrics (Golden Comparison)
            "rouge", # Structural overlap
            "question_answering_quality", # Semantic similarity
        ]
    )

    print("⚖️  Running Vertex AI Evaluation...")
    
    result = eval_task.evaluate()

    print("\n📊 Vertex AI Evaluation Results:")
    print(result.metrics_table)
    print("\nColumns:", result.metrics_table.columns)

    # Generate Markdown Report
    # Helper to safely get values
    def get_metric(df, col):
        return df[col].iloc[0] if col in df.columns else "N/A"

    # Build Summary Table
    summary_rows = []
    
    # Coherence
    coherence_score = get_metric(result.metrics_table, "coherence/score")
    summary_rows.append(f"| **Coherence** | **{coherence_score}** | {'✅ Pass' if coherence_score != 'N/A' and coherence_score >= 3 else '❌ Fail'} |")
    
    # Safety
    safety_score = get_metric(result.metrics_table, "safety/score")
    summary_rows.append(f"| **Safety** | {safety_score} | {'✅ Safe' if safety_score != 'N/A' and safety_score >= 0.9 else '⚠️ Check'} |")
    
    # ROUGE (if present)
    rouge = get_metric(result.metrics_table, "rouge/score")
    if rouge != "N/A":
        summary_rows.append(f"| **ROUGE** | {rouge:.2f} | ℹ️ Similarity |")

    summary_table = "\n".join(summary_rows)

    # Detailed Explanations
    explanation_section = ""
    if "coherence/explanation" in result.metrics_table.columns:
        explanation_section += f"\n> **Coherence Analysis:** {result.metrics_table['coherence/explanation'].iloc[0]}\n"

    markdown_report = f"""### ⚖️ Vertex AI Evaluation Results
**Run ID:** `{run_id}`

| Metric | Score | Status |
| :--- | :---: | :---: |
{summary_table}

{explanation_section}

[🔗 View in Console](https://console.cloud.google.com/vertex-ai/experiments/locations/{LOCATION}/experiments/scribe-eval-demo/runs?project={PROJECT_ID})
"""
    
    # Write to file for GitHub Actions
    if os.getenv("GITHUB_ACTIONS"):
        with open("eval_results.md", "w") as f:
            f.write(markdown_report)

    # Simple pass/fail logic on coherence
    # Note: Metrics are usually returned as 'metric_name/score'
    coherence_col = "coherence/score"
    
    if coherence_col in result.metrics_table.columns:
        score = result.metrics_table[coherence_col].mean()
        print(f"Coherence Score: {score}")
        
        if score < 3.0:
            print("❌ Failed Coherence Check")
            sys.exit(1)
        else:
            print("✅ Passed Coherence Check")
    else:
        print(f"⚠️  Metric '{coherence_col}' not found in results. Available: {result.metrics_table.columns}")
        # Don't fail hard on missing metric for this demo, just warn
        sys.exit(0)

    print("\n🔗 View Experiment History:")
    print(f"https://console.cloud.google.com/vertex-ai/experiments/locations/{LOCATION}/experiments/scribe-eval-demo/runs?project={PROJECT_ID}")

if __name__ == "__main__":
    run_vertex_eval()
