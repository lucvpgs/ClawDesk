# ClawDesk — Mission Control

A local dashboard for [OpenClaw](https://openclaw.ai) — manage your agents, tasks, schedules, models, and memory from a clean UI.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![SQLite](https://img.shields.io/badge/SQLite-local-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-required-violet)

---

## What it does

- **Overview** — gateway status, active agents, task summary, journal status
- **Tasks & Projects** — create and track work across projects
- **Schedules** — manage cron jobs with Discord/Telegram delivery
- **Agents** — view and configure your OpenClaw agents
- **Models** — manage providers and model assignments
- **Memory** — read and write daily journal entries
- **Activity** — recent agent sessions and events

---

## Requirements

- [OpenClaw](https://openclaw.ai) installed and running (`openclaw start`)
- Node.js 18+
- pnpm (`npm install -g pnpm`)

---

## Setup

```bash
# 1. Clone
git clone https://github.com/lucvpgs/ClawDesk.git
cd ClawDesk

# 2. Install dependencies
pnpm install

# 3. Configure auth
cp .env.example .env.local
```

Edit `.env.local`:
```env
CLAWDESK_PASSWORD=your-password-here
CLAWDESK_SECRET=run-openssl-rand-hex-32-and-paste-here
```

Generate a secret:
```bash
openssl rand -hex 32
```

```bash
# 4. Initialize database
pnpm run db:migrate

# 5. Start
pnpm dev
```

Open [http://localhost:3131](http://localhost:3131) and sign in with your password.

---

## Install the OpenClaw skill

Let your agent operate ClawDesk on your behalf:

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

---

## Updating

```bash
git pull
pnpm install
pnpm dev
```

---

## Notes

- ClawDesk reads directly from `~/.openclaw/` — no separate sync needed
- `.env.local` is never committed — each user sets their own password
- Tested on macOS and Linux
