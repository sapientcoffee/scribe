import os
import sys
import vertexai
from vertexai.preview.evaluation import EvalTask, PointwiseMetric, MetricPromptTemplateExamples

# --- Configuration ---
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
FILE_PATH = "scribe/history-and-application-of-coffee-in-the-uk/BLUEPRINT.md"

if not PROJECT_ID:
    print("⚠️  Skipping Vertex AI Eval: GOOGLE_CLOUD_PROJECT not set.")
    sys.exit(0)

def run_vertex_eval():
    print(f"🤖 Initializing Vertex AI Eval (Project: {PROJECT_ID})...")
    vertexai.init(project=PROJECT_ID, location=LOCATION)

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
    eval_task = EvalTask(
        dataset=[{"response": response_text}],
        metrics=[
            # Built-in metrics
            "coherence",
            "safety",
            # Custom metric definition would go here in a real implementation
        ],
        experiment="scribe-blueprint-eval-001"
    )

    print("⚖️  Running Vertex AI Evaluation...")
    result = eval_task.evaluate()

    print("\n📊 Vertex AI Evaluation Results:")
    print(result.metrics_table)

    # Simple pass/fail logic on coherence
    if result.metrics_table["coherence"].mean() < 3.0:
        print("❌ Failed Coherence Check")
        sys.exit(1)
    else:
        print("✅ Passed Coherence Check")

if __name__ == "__main__":
    run_vertex_eval()
