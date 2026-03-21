#!/bin/bash
# Install ClawDesk skill for OpenClaw
# Usage: bash install.sh

SKILL_DIR="$HOME/.openclaw/workspace/skills/clawdesk"
SKILL_URL="https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/SKILL.md"

mkdir -p "$SKILL_DIR"
curl -fsSL "$SKILL_URL" -o "$SKILL_DIR/SKILL.md"

echo "✅ ClawDesk skill installed at $SKILL_DIR/SKILL.md"
echo "   Add 'clawdesk' to your agent's skills list in openclaw.json"
