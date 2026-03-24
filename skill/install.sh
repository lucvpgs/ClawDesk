#!/bin/bash
# Install ClawDesk skill for OpenClaw
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/install.sh)

set -e

SKILL_DIR="$HOME/.openclaw/workspace/skills/clawdesk"
SKILL_URL="https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/SKILL.md"
CONFIG="$HOME/.openclaw/openclaw.json"

mkdir -p "$SKILL_DIR"
curl -fsSL "$SKILL_URL" -o "$SKILL_DIR/SKILL.md"
echo "✅ ClawDesk skill installed at $SKILL_DIR/SKILL.md"

# Add 'clawdesk' to the main agent's skills list in openclaw.json if not already present
if [ -f "$CONFIG" ]; then
  python3 - "$CONFIG" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    config = json.load(f)
agents = config.get("agents", {}).get("list", [])
patched = []
for agent in agents:
    skills = agent.get("skills", [])
    if "clawdesk" not in skills:
        skills.append("clawdesk")
        agent["skills"] = skills
        patched.append(agent.get("id", agent.get("name", "?")))
with open(path, "w") as f:
    json.dump(config, f, indent=2)
if patched:
    print(f"✅ Added 'clawdesk' skill to agent(s): {', '.join(patched)}")
else:
    print("ℹ️  'clawdesk' already in all agent skill lists")
PY
else
  echo "ℹ️  openclaw.json not found — add 'clawdesk' to your agent's skills list manually"
fi
