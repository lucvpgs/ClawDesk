---
name: clawdesk
description: >
  Operate the ClawDesk Mission Control application on behalf of the user.
  Use this skill whenever the user asks you to manage tasks, projects, schedules
  (cron jobs), channels, models, integrations, settings, or wants a status report about
  the system.
---

# ClawDesk — Mission Control

ClawDesk is your command interface for the OpenClaw system. It gives you and the user a full view of everything running: tasks, schedules, models, integrations, agent activity, and configuration. You operate it via its HTTP API.

---

## Architecture

```
User (Discord / Telegram)
     │
     ▼
  Agent (you)
     │  calls
     ▼
ClawDesk API  — http://localhost:3131/api/...
     │  reads/writes
     ▼
~/.openclaw/openclaw.json     ← model config, channels, tools, gateway
~/.openclaw/cron/jobs.json    ← cron schedule definitions
ClawDesk SQLite DB            ← tasks, projects, activity log
     │
     ▼
OpenClaw Gateway — http://localhost:18789
```

**Key relationship:** ClawDesk does not run agents — it configures and monitors them. Changes made via ClawDesk API are written directly to the files OpenClaw reads. They take effect immediately.

---

## Base URL

```
http://localhost:3131
```

All endpoints return JSON. Auth via cookie (handled by the browser session).

---

## Autonomy rules

Proceed without asking:
- All GET / read operations
- Creating tasks, projects, cron jobs
- Marking tasks done / changing status

Brief summary before proceeding:
- Bulk operations
- Enabling / disabling cron jobs
- Adding models, channels or integrations

Always ask before:
- Deleting cron jobs permanently
- Removing channels
- Changing the primary model
- Modifying openclaw.json gateway settings

---

## Tasks

```
GET  /api/tasks
GET  /api/tasks?status=pending|in_progress|done|blocked
POST /api/tasks        { title, description?, status?, priority?, projectId?, dueDate? }
PATCH /api/tasks/<id>  { status, priority, ... }
DELETE /api/tasks/<id>
```

Priority: `low` · `medium` · `high` · `urgent`
Status: `pending` · `in_progress` · `blocked` · `done`

---

## Projects

```
GET    /api/projects
POST   /api/projects   { name, description?, color? }
PATCH  /api/projects/<id>
DELETE /api/projects/<id>
```

---

## Schedules (cron jobs)

```
GET  /api/schedules                  ← config + runtime merged
GET  /api/schedules/config           ← config only
POST /api/schedules/config           ← create
PATCH /api/schedules/config/<id>     ← update
DELETE /api/schedules/config/<id>    ← delete
POST /api/schedules  { action: "run", jobId }   ← trigger manually
GET  /api/schedules/<id>/runs        ← last 10 run entries for a specific job
GET  /api/cron/runs                  ← recent runs across all jobs + failedCount
```

Create / update payload:
```json
{
  "name": "Daily summary",
  "agentId": "main",
  "schedule": "0 9 * * *",
  "prompt": "...",
  "enabled": true,
  "outputTarget": "discord",
  "deliveryTo": "<discord-channel-id or telegram-chat-id>"
}
```

Run history entry fields: `status` · `startedAt` · `finishedAt` · `durationMs` · `output` · `error`

Common schedules: `0 9 * * *` (daily 9am) · `0 18 * * 1-5` (weekdays 6pm) · `0 10 * * 7` (sunday 10am)

---

## Channels

```
GET    /api/channels              ← list configured channels with live status
POST   /api/channels/add          ← add or update a channel
DELETE /api/channels/remove       ← remove a channel
```

Add channel payload:
```json
{
  "channel": "discord",       // discord | telegram | slack | googlechat
  "name": "My Discord",       // optional display name
  "token": "...",             // discord / telegram bot token
  "botToken": "xoxb-...",     // slack only
  "appToken": "xapp-...",     // slack only
  "webhookUrl": "https://..."  // googlechat only
}
```

Remove channel payload:
```json
{ "channel": "discord" }
```

Channel status fields: `channelType` · `running` · `configured` · `lastError` · `probe.ok` · `probe.elapsedMs`

---

## Models

```
GET   /api/models/config
POST  /api/models/config          { provider, modelId, setAsPrimary?, addAsFallback?, providerConfig? }
PATCH /api/models/config/defaults { primary?, fallbacks? }
DELETE /api/models/config/<provider>/<modelId>
POST  /api/ollama/pull            { model, baseUrl? }
```

Providers: `ollama` · `anthropic` · `openai` · `openai-codex` · `google` · `amazon-bedrock` · `custom`

---

## Activity & Overview

```
GET /api/activity?limit=20&agentId=main
GET /api/overview
```

---

## Memory / Journal

```
GET  /api/memory
GET  /api/memory?date=YYYY-MM-DD
POST /api/memory  { content }    ← write/overwrite
POST /api/memory  { append }     ← append to today
```

Journal format:
```markdown
# Journal — YYYY-MM-DD

## Completed
- ...

## Resolved
- ...

## Learned
- ...

## Decisions
- ...

## Notes
- ...
```

Files stored at `~/.openclaw/workspace/memory/YYYY-MM-DD.md` — visible in ClawDesk → Memory page.

---

## Skill management

```
GET  /api/skill/status   ← check if ClawDesk skill is installed and which agents have it
POST /api/skill/install  ← install SKILL.md + add "clawdesk" to primary agent's skills list
```

---

## Response format

- ✅ success · ❌ error · ⏳ in progress
- Short bullets, not paragraphs
- Max 10 items inline
- For config changes: `_Efectivă imediat._`

---

## Error handling

- ClawDesk unreachable (`localhost:3131`): tell the user to start it — `cd <clawdesk-path> && pnpm dev`
- 4xx: report the error, do not retry silently
- 500: report and suggest checking the ClawDesk console
