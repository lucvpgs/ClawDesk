# ClawDesk — Mission Control

A native desktop app for [OpenClaw](https://openclaw.ai) — manage your agents, tasks, schedules, models, channels and memory from a clean UI.

> **v0.5.2** — Linux support, auto-updater error display, cron agent compatibility fix, macOS release archive fix.

![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![SQLite](https://img.shields.io/badge/SQLite-local-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-required-violet)

| Platform | Status | Notes |
|----------|--------|-------|
| macOS (Apple Silicon) | ✅ Supported | Primary development target |
| macOS (Intel) | ✅ Supported | |
| Linux (x86_64) | ✅ Supported | `.deb` and `.AppImage` bundles |
| Linux (ARM64) | 🧪 Experimental | Builds succeed; limited testing |
| Windows | 🚧 Planned | Binary path detection in progress |

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

- **macOS** 12+ or **Linux** (Ubuntu 22.04+, Debian 12+, Fedora 38+)
- [OpenClaw](https://openclaw.ai) installed and running (`openclaw start`)
- The app bundles its own Node.js server — no separate Node install required at runtime

---

## Install

### macOS — Build from source

You need: **Node.js 18+**, **pnpm**, **Rust** (via [rustup](https://rustup.rs)).

```bash
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk
pnpm install
pnpm build
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri build --bundles app

APP_SRC="src-tauri/target/release/bundle/macos/ClawDesk.app"
rm -rf /Applications/ClawDesk.app
ditto "$APP_SRC" /Applications/ClawDesk.app
xattr -cr /Applications/ClawDesk.app
codesign --force --deep --sign - /Applications/ClawDesk.app
```

Open **ClawDesk** from `/Applications` or Spotlight.

> **Why `ditto` and `codesign`?**
> macOS `.app` bundles must be copied with `ditto` (not `cp -R`) to preserve resource forks and code signatures. `codesign` re-signs the bundle for local distribution without an Apple Developer certificate.

### Linux — Build from source

**System dependencies (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  build-essential curl
```

**Fedora/RHEL:**
```bash
sudo dnf install -y webkit2gtk4.1-devel openssl-devel gtk3-devel \
  libappindicator-gtk3-devel librsvg2-devel
```

**Then build:**
```bash
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
npm install -g pnpm
pnpm install
pnpm build
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri build
```

Install the `.deb` or use the `.AppImage`:
```bash
# Debian/Ubuntu
sudo dpkg -i src-tauri/target/release/bundle/deb/clawdesk_*.deb

# AppImage (any distro)
chmod +x src-tauri/target/release/bundle/appimage/clawdesk_*.AppImage
./src-tauri/target/release/bundle/appimage/clawdesk_*.AppImage
```

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

> **Note for cron / scheduled agents:** OpenClaw's sandbox blocks `web_fetch` to `localhost` (hardcoded SSRF policy — not configurable). For read-only queries from cron jobs, use `sqlite3` directly on the ClawDesk database or `openclaw` CLI instead of HTTP:
>
> ```bash
> # Read tasks from cron agent
> sqlite3 "$HOME/Library/Application Support/com.vpgs.clawdesk/clawdesk.db" \
>   "SELECT count(*) FROM tasks WHERE status='pending'"
>
> # On Linux
> sqlite3 "$HOME/.local/share/com.vpgs.clawdesk/clawdesk.db" \
>   "SELECT count(*) FROM tasks WHERE status='pending'"
> ```

### OpenClaw skill

The skill is installed automatically during onboarding — click **"Install skill"** on the "What's next" screen after connecting to OpenClaw. No manual steps needed.

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
- Tested on macOS (Apple Silicon) and Ubuntu 22.04 (x86_64)
- Windows support is planned — binary path detection and PATH separator handling are implemented but the release pipeline and installer are not yet ready

## Known limitations

| Limitation | Workaround |
|-----------|------------|
| OpenClaw cron agents can't call `localhost:3131` via `web_fetch` (SSRF policy) | Use `sqlite3` on the ClawDesk DB or `openclaw` CLI from cron prompts |
| Auto-updater requires manually quitting and relaunching the app | Quit ClawDesk after "Update Now" completes, then relaunch |
| Ollama models unavailable to cron agents on macOS | Add `OLLAMA_API_KEY=ollama-local` to LaunchAgent plist `EnvironmentVariables` |
