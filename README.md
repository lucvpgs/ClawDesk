# ClawDesk — Mission Control

> **Installing the ClawDesk skill?**
>
> **macOS / Linux** (bash):
> ```bash
> bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/install.sh)
> ```
>
> **Windows** (PowerShell):
> ```powershell
> $d="$env:USERPROFILE\.openclaw\workspace\skills\clawdesk"; New-Item -ItemType Directory -Force -Path $d | Out-Null; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/SKILL.md" -OutFile "$d\SKILL.md"; Write-Host "✅ Installed"
> ```
>
> ⚠️ `openclaw skills install <github-url>` does **not** work — use the commands above.

---

A native desktop app for [OpenClaw](https://openclaw.ai) — manage your AI agents, tasks, schedules, models, channels, memory and costs from a single UI.

![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![SQLite](https://img.shields.io/badge/SQLite-local--first-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-required-violet) ![License](https://img.shields.io/badge/license-BSL_1.1-orange)

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | ✅ Supported |
| macOS (Intel) | ✅ Supported |
| Linux (x86_64) | ✅ Supported — `.deb` and `.AppImage` |
| Linux (ARM64) | 🧪 Experimental |
| Windows | 🚧 Planned |

---

## Features

### Free
- **Overview** — gateway status, active agents, task summary, cron alerts, journal status
- **Activity** — recent agent sessions, events, task and project history
- **Sessions** — full session log with token counts, timestamps, continuation
- **Tasks & Projects** — kanban board with comments, priority, due dates, CSV/JSON export
- **Schedules** — create and manage cron jobs; run history, Discord/Telegram/Slack delivery
- **Agents** — view and configure agents, run prompts directly from the UI
- **Skills** — install and manage agent skills, inline editor, GitHub URL install
- **Models** — manage providers (Anthropic, OpenAI, Ollama, Bedrock, custom) and model assignments
- **Memory** — read and write daily journal entries, browse all memory files
- **Docs** — browse agent workspace documents with syntax highlighting
- **Channels** — configure Discord, Telegram, Slack, Google Chat with connection testing
- **⌘K global search** — search tasks, projects, schedules, agents
- **macOS native notifications** — cron failures, agent events, task updates
- **Light / dark / warm themes** — persisted across sessions

### Pro ($39 one-time)
- **Cost Tracker** — daily / 7-day / 30-day spend by agent and model, custom rate editor
- **Token Budget Alerts** — per-agent daily limit with notifications at 80% and 100%
- **Security Health Panel** — automated checks on your OpenClaw config, scored 0–100
- **Token Analytics** — 30-day bar chart, breakdown by agent and model, CSV export
- **Backup & Restore** — export full config bundle, import restore, auto-backup Daily/Weekly

---

## Requirements

- **macOS** 12+ or **Linux** (Ubuntu 22.04+, Debian 12+, Fedora 38+)
- [OpenClaw](https://openclaw.ai) installed and running (`openclaw start`)
- The app bundles its own Node.js server — no separate runtime needed

---

## Install

### macOS — Build from source

Requires: **Node.js 18+**, **pnpm**, **Rust** (via [rustup](https://rustup.rs)).

```bash
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk
pnpm install
pnpm build:desktop

APP_SRC="src-tauri/target/release/bundle/macos/ClawDesk.app"
rm -rf /Applications/ClawDesk.app
ditto "$APP_SRC" /Applications/ClawDesk.app
xattr -cr /Applications/ClawDesk.app
codesign --force --deep --sign - /Applications/ClawDesk.app
```

Open **ClawDesk** from `/Applications` or Spotlight.

> **Why `ditto` and `codesign`?**
> `ditto` preserves resource forks and code signatures. `codesign` re-signs for local distribution without an Apple Developer certificate.

### Linux — Build from source

**Debian/Ubuntu:**
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev build-essential curl
```

**Fedora:**
```bash
sudo dnf install -y webkit2gtk4.1-devel openssl-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

```bash
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && source ~/.cargo/env
npm install -g pnpm
pnpm install
pnpm build:desktop

# Install .deb
sudo dpkg -i src-tauri/target/release/bundle/deb/clawdesk_*.deb

# Or use AppImage
chmod +x src-tauri/target/release/bundle/appimage/clawdesk_*.AppImage
./src-tauri/target/release/bundle/appimage/clawdesk_*.AppImage
```

---

## First launch

1. Make sure OpenClaw is running: `openclaw start`
2. Open ClawDesk — the app auto-starts its internal server and logs you in automatically
3. If OpenClaw is detected locally, the runtime source is provisioned automatically
4. The OpenClaw agent skill is installed automatically on the "What's next" onboarding screen

On first launch, a default config is created at:
```
~/Library/Application Support/com.vpgs.clawdesk/.env.local   # macOS
~/.local/share/com.vpgs.clawdesk/.env.local                   # Linux
```

Set your own password and secret:
```env
CLAWDESK_PASSWORD=your-password-here
CLAWDESK_SECRET=your-secret-here   # generate: openssl rand -hex 32
```

Restart the app after editing.

---

## Background service (macOS)

ClawDesk can run as a macOS LaunchAgent so the server starts at login and stays running even when the desktop window is closed. Your OpenClaw agents can interact with ClawDesk 24/7.

Enable in **Settings → System → Background Service → Install & Start**.

When the background service is active, opening the ClawDesk app shows the login page — sign in once per session to connect the window to the running server.

---

## Agent integration

ClawDesk exposes a local HTTP API at `http://localhost:3131/api/`. All `/api/*` routes accept unauthenticated requests from localhost. Your OpenClaw agents can read and write directly:

```bash
# Create a task from an agent or script
curl -X POST http://localhost:3131/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Review PR #42", "priority": "high"}'
```

Tasks, projects and activity events created this way appear instantly in the UI.

### OpenClaw skill

The `clawdesk` skill is installed automatically during onboarding. It gives your agent full access to tasks, schedules, models, memory and activity — directly from Discord, Telegram, or any other configured channel.

To install or reinstall manually, run this one command:
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/install.sh)
```

> **Note:** `openclaw skills install` only works with ClawHub slugs — it does not accept GitHub URLs. Use the curl command above instead.

Or install directly from ClawDesk → **Skills → Install from GitHub URL** by pasting:
```
https://github.com/lucvpgs/ClawDesk
```

---

## How it works

```
OpenClaw (Discord / Telegram / Slack / ...)
        │
        ▼
   Your OpenClaw agent
        │  GET /api/tasks, POST /api/tasks, GET /api/schedules, ...
        ▼
ClawDesk (Tauri desktop app)
  ├── Embedded Next.js server  → port 3131 (127.0.0.1 only)
  ├── SQLite database          → ~/Library/Application Support/com.vpgs.clawdesk/
  └── WKWebView UI             → auto-logged in on first launch
        │
        ▼
  ~/.openclaw/openclaw.json    ← agent config, models, channels, gateway
  ~/.openclaw/cron/jobs.json   ← cron schedule definitions
  OpenClaw gateway             → http://localhost:18789 (default)
```

- The app starts a local Next.js server on port 3131 and opens a WKWebView pointing to it
- Auto-login via one-time token — no password prompt when Tauri starts the server
- Single instance — second launch focuses the existing window
- Server listens on `127.0.0.1` only — not accessible from the network by default

---

## Development

```bash
pnpm dev                                          # Next.js dev server on :3131
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri dev      # Tauri window (separate terminal)
```

Quick deploy to `/Applications` without a full Tauri rebuild:
```bash
pnpm deploy:local
```

---

## Known limitations

| Limitation | Workaround |
|-----------|------------|
| OpenClaw cron agents can't call `localhost:3131` via `web_fetch` (SSRF policy) | Use `sqlite3` on the ClawDesk DB directly from cron prompts |
| Auto-updater requires manually quitting and relaunching | Quit ClawDesk after "Update Now" completes, then relaunch |
| Ollama models unavailable to cron agents on macOS | Add `OLLAMA_API_KEY=ollama-local` to the LaunchAgent plist `EnvironmentVariables` |

---

## License

[Business Source License 1.1](LICENSE) — converts to MIT on **2030-03-23**.

Free to use for personal and non-commercial purposes. Commercial use requires a Pro license.
