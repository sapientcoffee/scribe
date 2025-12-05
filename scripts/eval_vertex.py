import os
import sys
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

    # 2. Define a Custom Metric (e.g., "Blueprint Adherence")
    # We use a Pointwise metric because we are evaluating a single response without a reference.
    blueprint_metric = PointwiseMetric(
        metric="blueprint_adherence",
        metric_prompt_template=MetricPromptTemplateExamples.get_prompt_template(
            "fluency" # We use 'fluency' as a base structure but could customize the definition
        )
    )

    # Alternatively, define a fully custom prompt criteria
    custom_criteria = {
        "blueprint_quality": """
        Score the document on a scale of 1-5 based on:
        1. Clarity of the Objective.
        2. Specificity of the Target Audience.
        3. Logical flow of the Core Sections.
        """
    }

    # 3. Run the Evaluation Task
    # Create a unique run ID
    run_id = f"eval-run-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    # We must provide the 'prompt' so the metrics can evaluate the context
    eval_task = EvalTask(
        dataset=pd.DataFrame({
            "prompt": ["Create a blueprint for a guide on: History and application of coffee in the UK"],
            "response": [response_text]
        }),
        metrics=[
            # Built-in metrics
            "coherence",
            "safety",
            # Custom metric definition would go here in a real implementation
        ]
    )

    print("⚖️  Running Vertex AI Evaluation...")
    
    result = eval_task.evaluate()

    print("\n📊 Vertex AI Evaluation Results:")
    print(result.metrics_table)
    print("\nColumns:", result.metrics_table.columns)

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
    print(f"https://console.cloud.google.com/vertex-ai/experiments/experiments/scribe-eval-demo?project={PROJECT_ID}&m={LOCATION}")

if __name__ == "__main__":
    run_vertex_eval()
