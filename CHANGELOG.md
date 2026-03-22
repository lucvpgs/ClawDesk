# Changelog

All notable changes to ClawDesk are documented here.

---

## [0.5.1] — 2026-03-22

### Fixed
- **White screen on fresh install** — when Node.js is missing or the embedded server fails to start, ClawDesk now shows a helpful error page (with Node.js install instructions and a Retry button) instead of a blank screen
- **server.js not found** — added explicit existence check with a clear log message before attempting to start the server; fail-fast instead of silent connection timeout
- **Agent identity mismatch** — task and schedule assignment dropdowns now fetch live agents from the runtime (`/api/agents`) instead of a hardcoded list; falls back to the built-in list when the gateway is offline
- **`/api/system` timeouts (25 s+)** — replaced synchronous `execSync` with async `exec` (`promisify`) in `GatewayClient`; `getStatus()`, `getHealth()`, `getAgents()`, etc. no longer block the Node.js event loop; `scanLocalOpenClaw()` now runs in parallel; CLI timeout reduced from 10 s to 5 s
- **Skill install fails in onboarding** — `skill/SKILL.md` is now copied into the standalone bundle during build, so the install route can find it at runtime via `process.cwd()/skill/SKILL.md`
- **Missing operator.read scope** — all `openclaw gateway call` and `openclaw cron` CLI invocations now pass `--token` and `--url` explicitly, so they authenticate with operator-level credentials instead of falling back to limited defaults
- **OpenClaw version stale after gateway update** — `/api/openclaw/version` now queries the live `/health` endpoint on the gateway (2.5 s timeout) and prefers the running version over the cached `meta.lastTouchedVersion` in `openclaw.json`

### Changed
- `GatewayClient` CLI timeout reduced from 10 000 ms to 5 000 ms across all methods
- `RuntimeAgent` interface extracted to `src/lib/agent-colors.ts` and shared across Tasks and Schedules pages

---

## [0.5.0] — 2026-03-22

### Added
- **Tauri desktop app** — ClawDesk is now a native macOS `.app`; the Next.js server runs embedded, no `pnpm dev` needed
- **Auto-login** — WKWebView window is logged in automatically via a one-time token; no password prompt in the desktop app
- **Single instance** — second launch focuses the existing window instead of opening a duplicate (`tauri-plugin-single-instance`)
- **Auto-setup on first launch** — if OpenClaw is running locally, ClawDesk provisions the runtime source automatically without going through onboarding
- **Auto-sync on startup** — Overview triggers a runtime sync once per session so agents and sessions are always fresh
- **`cli-env.ts`** — centralised PATH helper (`/opt/homebrew/bin:/usr/local/bin`) for all `execSync` calls; fixes `openclaw` CLI not found in Tauri's minimal environment
- **`/api/runtime-sources/auto-setup`** — scans for local OpenClaw and provisions it silently on first launch
- **Smoke test script** — `scripts/smoke-test-bundle.mjs` validates the standalone bundle in an isolated temp dir (6 endpoints)

### Fixed
- **White screen on launch** — `outputFileTracingIncludes` in `next.config.ts` force-bundles pnpm-symlinked packages (`styled-jsx`, `@swc/helpers`, `@next/env`, `bindings`, `file-uri-to-path`) that Next.js file tracer missed
- **WKWebView cookie on redirect** — `Set-Cookie` headers dropped by WKWebView on 3xx responses; `/api/auth/tauri` now returns an HTML page with `window.location.replace("/")` instead of `NextResponse.redirect()`
- **`openclaw` CLI not found** — Tauri starts Node with a minimal PATH; all `execSync` calls now use `cliEnv()` to add homebrew paths
- **`.env.local` not loaded in production** — `lib.rs` now parses `.env.local` from the app data dir and passes `CLAWDESK_PASSWORD`/`CLAWDESK_SECRET` to the Node server process; default file is seeded on first launch
- **Channels page empty** — channels API now falls back to live health data when the DB cache is empty; `probe.ok: true` treated as "running" in the UI
- **Discord alert false positive in Schedules** — `probe.ok: true` is now treated as running regardless of the WebSocket `running` field
- **Timestamp "2h ago" bug** — SQLite `datetime('now')` returns UTC without a timezone marker; `timeAgo()` now appends `Z` before parsing so the diff is correct for all timezones
- **`/api/*` routes required auth** — API routes are now public (local-only server on `127.0.0.1`); agents can call the API without a browser cookie

### Changed
- **Installation** — use `ditto` instead of `cp -R` to copy `.app` bundles (preserves code signatures); follow with `codesign --force --deep --sign -`
- **README** — completely rewritten to reflect desktop app installation and agent integration

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
