#!/bin/bash
set -e

echo "🚀 Setting up Vertex AI Environment for Project: coffee-and-codey"

# 1. Ensure Gcloud Config
gcloud config set project coffee-and-codey

# 2. Setup Python Virtual Environment
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

# 3. Install Dependencies
echo "⬇️  Installing Python dependencies..."
pip install -r requirements.txt

# 4. Auth Check (Advisory)
echo "🔑 Checking Application Default Credentials..."
if [ ! -f "$HOME/.config/gcloud/application_default_credentials.json" ]; then
    echo "⚠️  ADC not found. You may need to run: gcloud auth application-default login"
fi

echo "✅ Setup complete! You can now run: source .venv/bin/activate && python scripts/eval_vertex.py"
