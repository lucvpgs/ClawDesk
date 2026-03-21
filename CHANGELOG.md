# Changelog

All notable changes to ClawDesk are documented here.

---

## [Unreleased]

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
