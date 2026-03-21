# Changelog

All notable changes to ClawDesk are documented here.

---

## [0.4.0] — 2026-03-21

### Added
- **Channel management** — Settings → Channels now has an "Add channel" button with a modal supporting Discord, Telegram, Slack and Google Chat; each type shows dynamic fields with inline hints; uses `openclaw channels add` CLI under the hood
- **Remove channel** — trash icon on each channel card with double-click confirmation; uses `openclaw channels remove --delete`
- **Run history per job** — collapsible "Run history" section in the cron job detail panel; shows last 10 runs with status badge, duration, timestamp and expandable output/error preview
- **Delivery channel validation** — when selecting Discord/Telegram/Slack on a cron job, ClawDesk checks if that channel is configured and running; shows ✓ green / ⚠ amber / ✗ red with a link to Settings if missing; applies to both create and edit modals
- **Upcoming schedules widget** — Overview Schedules panel now sorts jobs by `nextRunAt` ascending and shows countdowns (`in 3m`, `in 2h`, `in 1d`); jobs firing in under 5 minutes get an amber highlight
- **Skill auto-install in onboarding** — "Next steps" screen now has an "Install skill" button instead of a copy-paste command; checks existing status, installs `SKILL.md` and adds `clawdesk` to the agent's skills list in `openclaw.json` automatically
- **`/api/skill/install`** — copies `skill/SKILL.md` to `~/.openclaw/workspace/skills/clawdesk/` and patches the primary agent's skills list
- **`/api/skill/status`** — returns whether the skill file exists and which agents have it enabled
- **`/api/schedules/[id]/runs`** — per-job run history via `openclaw cron runs --id <id>`
- **`/api/channels/add`** and **`/api/channels/remove`** — add/remove chat channels via CLI

### Fixed
- Gateway status flickering in Overview — replaced 2s HTTP timeout with `openclaw status --json` CLI check (primary) + HTTP fallback at 4s + one retry; frontend now shows "Checking…" on first failure and only flips to "Offline" after two consecutive failures
- `CreateScheduleModal` was using the old delivery section without channel validation; now uses the same `DeliverySection` component as the edit panel
- Agent card emoji was hardcoded for specific agent IDs; now reads from `identity.emoji` in config

---

## [0.3.0] — 2026-03-21

### Added
- **Onboarding next-steps screen** — after connecting to OpenClaw, the onboarding flow now shows a "What's next" screen with the skill install command and a suggestion to create a first schedule, instead of jumping straight to the dashboard
- **Cron failure alert banner** — the Overview page now polls `/api/cron/runs` every 60 seconds and shows a dismissable red banner when any cron job has recently failed, with a direct link to Schedules
- **`/api/cron/runs` endpoint** — aggregates run history for all enabled jobs via `openclaw cron runs --id <id>`, returns `{ runs, failedCount }`

### Fixed
- Discord delivery now works correctly — the `delivery.to` field (Discord channel ID / Telegram chat ID) is written to `jobs.json` in the format OpenClaw expects (`delivery: { mode, channel, to }`)
- "Run now" button no longer silently fails when no runtime source is configured in the database — it now calls `openclaw cron run <id>` directly via CLI
- Cross-platform compatibility: replaced `process.env.HOME!` with `os.homedir()` in all API routes

---

## [0.2.0] — 2026-03-20

### Added
- **Password authentication** — all routes protected by middleware; login page at `/login`; logout button in sidebar footer
- **`.env.example`** — template for new users (`CLAWDESK_PASSWORD`, `CLAWDESK_SECRET`)
- **OpenClaw skill** — `skill/SKILL.md` describes all ClawDesk API endpoints so agents can operate the dashboard from chat
- **Skill installer** — `skill/install.sh` one-command install: `bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/skill/install.sh)`
- **Delivery destination field** — `deliveryTo` (Discord channel ID, Telegram chat ID, etc.) added to cron job creation and edit UI, and persisted correctly in `delivery.to`
- **Tailscale / network access** — `--hostname 0.0.0.0` added to `dev` and `start` scripts so ClawDesk is accessible over the local network

### Fixed
- Middleware Edge Runtime error (`crypto` module unavailable) resolved by storing `CLAWDESK_SECRET` as the session token directly instead of using HMAC

---

## [0.1.0] — 2026-03-19

### Added
- **Overview** — gateway status, active agents, task summary, journal status
- **Tasks & Projects** — create and track work across projects
- **Schedules** — manage cron jobs with Discord / Telegram / Slack delivery
- **Agents** — view and configure OpenClaw agents
- **Models** — manage providers and model assignments
- **Memory** — read and write daily journal entries
- **Activity** — recent agent sessions and events
- **Shared cron utilities** — `src/lib/cron-utils.ts` with a single `normalizeCronJob()` used by all schedule API routes
- **Onboarding flow** — auto-detects OpenClaw installation via `/api/gateway/scan`; falls back to manual entry
- **SQLite database** — local task and project storage via `pnpm run db:migrate`
