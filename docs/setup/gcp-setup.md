# Google Cloud Platform (Vertex AI) Setup Guide

To unlock the "Enterprise" evaluation capabilities of this demo (specifically `scripts/eval_vertex.py`), you need to configure a Google Cloud Project.

## 1. Create a Google Cloud Project
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., `scribe-demo-eval`).
3.  Note your **Project ID** (it might be different from the name).

## 2. Enable Required APIs
You must enable the Vertex AI API for the evaluation tools to work.
1.  Open the **Cloud Shell** (top right icon) or use your local terminal.
2.  Run the following command:
    ```bash
    gcloud services enable aiplatform.googleapis.com
    ```

## 3. Set Up Authentication
The scripts need permission to talk to Vertex AI.

### Option A: Local Development (Easiest)
If you have the `gcloud` CLI installed locally:
```bash
gcloud auth application-default login
gcloud config set project <YOUR_PROJECT_ID>
```
This creates a temporary credential file that the scripts will automatically find.

### Option B: Service Account (For CI/CD)
1.  **Create Service Account:**
    ```bash
    gcloud iam service-accounts create scribe-eval-sa --display-name="Scribe Eval Runner"
    ```
2.  **Grant Permissions:**
    Give it the `Vertex AI User` role:
    ```bash
    gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
        --member="serviceAccount:scribe-eval-sa@<YOUR_PROJECT_ID>.iam.gserviceaccount.com" \
        --role="roles/aiplatform.user"
    ```
3.  **Download Key:**
    ```bash
    gcloud iam service-accounts keys create key.json \
        --iam-account=scribe-eval-sa@<YOUR_PROJECT_ID>.iam.gserviceaccount.com
    ```
4.  **Use Key:**
    Set the environment variable:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
    ```

## 4. Running the Evaluation
Once set up, you can run the enterprise evaluation:

```bash
# 1. Generate the content (Simulation)
node scripts/eval-custom.js

# 2. Run the Vertex Evaluation
export PROJECT_ID=<YOUR_PROJECT_ID>
export GEMINI_API_KEY=<YOUR_KEY>
python3 scripts/eval_vertex.py
```

You should see a link to the **Vertex AI Experiments** console at the end of the run!
