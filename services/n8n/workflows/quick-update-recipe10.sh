#!/bin/bash
# Quick Update Recipe 10 Script

echo "🚀 Recipe 10 Quick Update Helper"
echo "================================="
echo ""
echo "Step 1: Opening n8n UI..."
open http://localhost:5678 2>/dev/null || echo "  → Please open http://localhost:5678 manually"
echo ""
echo "Step 2: Opening copy-paste code file..."
open -e "$(dirname "$0")/recipe-10-merge-fix-COPYPASTE.txt" 2>/dev/null || \
  open "$(dirname "$0")/recipe-10-merge-fix-COPYPASTE.txt" || \
  echo "  → File location: $(dirname "$0")/recipe-10-merge-fix-COPYPASTE.txt"
echo ""
echo "Step 3: Manual steps in n8n UI:"
echo "  1. Find 'Recipe 10: TODO.md Auto-sync' workflow"
echo "  2. Click 'Merge Tasks into TODO' node"
echo "  3. Copy code from opened text file"
echo "  4. Paste into n8n code editor"
echo "  5. Save (Cmd+S)"
echo "  6. Execute workflow"
echo ""
echo "Step 4: Verify in Obsidian:"
echo "  → Check TODO.md for updated '## Today — 2025-12-02' section"
echo ""
echo "✅ Done! Follow the steps above."
