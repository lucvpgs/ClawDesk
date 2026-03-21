# ClawDesk — Mission Control

A native macOS desktop app for [OpenClaw](https://openclaw.ai) — manage your agents, tasks, schedules, models, channels and memory from a clean UI.

![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![SQLite](https://img.shields.io/badge/SQLite-local-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-required-violet)

---

## What it does

- **Overview** — gateway status, active agents, task summary, cron alerts, journal status
- **Tasks & Projects** — create and track work; agents can create tasks directly via API
- **Schedules** — manage cron jobs with Discord/Telegram/Slack delivery validation
- **Agents** — view and configure your OpenClaw agents
- **Models** — manage providers and model assignments
- **Channels** — configure Discord, Telegram, Slack, Google Chat
- **Memory** — read and write daily journal entries
- **Activity** — recent agent sessions and events

---

## Requirements

- macOS (Apple Silicon or Intel)
- [OpenClaw](https://openclaw.ai) installed (`openclaw start` to run the gateway)
- That's it — the app bundles its own Node.js server

---

## Install (macOS)

### Option A — Build from source

You need: **Node.js 18+**, **pnpm**, **Rust** (via [rustup](https://rustup.rs)).

```bash
# 1. Clone
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk

# 2. Install dependencies
pnpm install

# 3. Build
pnpm build
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri build --bundles app

# 4. Install
APP_SRC="src-tauri/target/release/bundle/macos/ClawDesk.app"
rm -rf /Applications/ClawDesk.app
ditto "$APP_SRC" /Applications/ClawDesk.app
xattr -cr /Applications/ClawDesk.app
codesign --force --deep --sign - /Applications/ClawDesk.app
```

Open **ClawDesk** from `/Applications` or Spotlight.

> **Why `ditto` and `codesign`?**
> macOS `.app` bundles must be copied with `ditto` (not `cp -R`) to preserve resource forks and code signatures. `codesign` re-signs the bundle for local distribution without an Apple Developer certificate.

---

## First launch

1. Make sure OpenClaw is running: `openclaw start`
2. Open ClawDesk — the app auto-starts its internal server and logs you in automatically (no password prompt)
3. If OpenClaw is detected locally, the runtime source is provisioned automatically

On first launch a default `.env.local` is created at:
```
~/Library/Application Support/com.clawdesk.app/.env.local
```

Edit it to set your own password and secret:
```env
CLAWDESK_PASSWORD=your-password-here
CLAWDESK_SECRET=run-openssl-rand-hex-32-and-paste-here
```
Generate a secret: `openssl rand -hex 32`

Restart the app after editing.

---

## Agent integration (Discord → Tasks)

ClawDesk exposes a local HTTP API at `http://localhost:3131/api/`. All `/api/*` routes are unauthenticated (local-only server). Your OpenClaw agents can read and write directly:

```bash
# Create a task from Discord / CLI / agent
curl -X POST http://localhost:3131/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "My task", "priority": "high"}'
```

Tasks created this way appear instantly in the ClawDesk UI.

### Install the OpenClaw skill

Let your agent operate ClawDesk on your behalf (create tasks, manage schedules, check status):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/install.sh)
```

Then add `clawdesk` to your agent's skills list in `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "skills": ["clawdesk"]
      }
    ]
  }
}
```

The skill gives your agent full access to tasks, schedules, models, memory and activity — directly from Discord or any other channel.

---

## How it works

```
OpenClaw (Discord/Telegram/...)
        │
        ▼
   Icarus agent
        │  POST /api/tasks, GET /api/schedules, ...
        ▼
ClawDesk (Tauri app)
  ├── Embedded Next.js server  → port 3131 (127.0.0.1 only)
  ├── SQLite DB                → ~/Library/Application Support/com.clawdesk.app/
  └── WKWebView UI             → auto-logged in, no password prompt
        │
        ▼
  ~/.openclaw/openclaw.json   ← agent config, models, channels
  ~/.openclaw/cron/jobs.json  ← schedules
```

- The app starts a local Next.js server on port 3131 and opens a WKWebView pointing to it
- Auto-login is handled via a one-time token — no password prompt in the desktop app
- Only one instance can run at a time (second launch focuses the existing window)
- The server only listens on `127.0.0.1` — not accessible from the network

---

## Development

```bash
pnpm dev          # Next.js dev server on :3131
# In another terminal:
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri dev   # Tauri window pointing to dev server
```

---

## Notes

- ClawDesk reads directly from `~/.openclaw/` — changes take effect immediately
- `.env.local` is never committed — each installation has its own credentials
- Tested on macOS (Apple Silicon)
