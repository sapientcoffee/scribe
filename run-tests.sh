#!/bin/bash
set -e

echo "🔍 Starting Local Linting Checks..."

# --- NPM Tools via NPX ---
# No installation check needed, npx handles it.

echo "--------------------------------------------------"
echo "📋 Validating Extension Manifest Schema..."
npx -y ajv-cli validate -s .github/schemas/extension-schema.json -d gemini-extension.json
echo "✅ Manifest schema check passed."

echo "--------------------------------------------------"
echo "📄 Linting JSON..."
# Use npx to run jsonlint
find . -type f -name "*.json" -not -path "*/node_modules/*" -not -path "*/.git/*" -print0 | xargs -0 -n 1 npx -y jsonlint -q
echo "✅ JSON check passed."

echo "--------------------------------------------------"
echo "📝 Linting Markdown..."
npx -y markdownlint-cli "**/*.md" --ignore node_modules --ignore .git
echo "✅ Markdown check passed."

echo "--------------------------------------------------"
echo "⚙️  Linting TOML..."
npx -y @taplo/cli check "commands/**/*.toml"
echo "✅ TOML check passed."

echo "--------------------------------------------------"
echo "🏗️  Linting YAML..."

# Setup Python venv for yamllint if needed
VENV_DIR=".lint-venv"
YAMLLINT_CMD="yamllint"

if ! command -v yamllint &> /dev/null; then
    if [ ! -d "$VENV_DIR" ]; then
        echo "📦 Creating virtual environment for yamllint..."
        python3 -m venv "$VENV_DIR"
    fi
    
    if [ ! -f "$VENV_DIR/bin/yamllint" ]; then
        echo "⬇️  Installing yamllint into venv..."
        "$VENV_DIR/bin/pip" install yamllint > /dev/null
    fi
    YAMLLINT_CMD="$VENV_DIR/bin/yamllint"
fi

$YAMLLINT_CMD .
echo "✅ YAML check passed."

echo "--------------------------------------------------"
echo "📊 Running Token Audit..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies for token audit..."
    npm install --no-audit --no-fund --quiet
fi
node scripts/audit-tokens.js
echo "✅ Token audit passed."

echo "--------------------------------------------------"
echo "🎉 All checks passed successfully!"