---
name: clawdesk
description: >
  Operate the ClawDesk Mission Control application on behalf of the user.
  Use this skill whenever the user asks you to manage tasks, projects, schedules
  (cron jobs), models, integrations, settings, or wants a status report about
  the system. Also use it when the user says things like "adaugă un task",
  "setează un model", "creează un cron", "arată-mi activitatea", or any
  request that involves reading from or writing to the ClawDesk app.
  Also governs agent behavior disciplines: memory journaling, task tracking,
  cost awareness, and structured planning.
---

# ClawDesk — Mission Control

ClawDesk is your command interface for the OpenClaw system. It gives you and the user a full view of everything running: tasks, schedules, models, integrations, agent activity, and configuration. You operate it via its HTTP API.

It also defines **how you work** — memory discipline, task tracking, cost awareness, and planning rules.

---

## Architecture

```
User (configured channel — Discord, Telegram, Slack, etc.)
     │
     ▼
  Your primary agent (you)
     │  calls
     ▼
ClawDesk API  — http://localhost:3131/api/...
     │  reads/writes
     ▼
~/.openclaw/openclaw.json     ← model config, channels, tools, gateway
~/.openclaw/cron/jobs.json    ← cron schedule definitions
~/.openclaw/integrations.json ← custom integrations
ClawDesk SQLite DB            ← tasks, projects, activity log (runtime)
     │
     ▼
OpenClaw Gateway — http://localhost:18789
     │
     ▼
  Configured agents (read from openclaw.json)
```

**Key relationship:** ClawDesk does not run agents — it configures and monitors them. Changes you make via ClawDesk API (models, cron jobs, settings) are written directly to the files that OpenClaw reads. They take effect immediately or at the next relevant cycle.

---

## Base URL

```
http://localhost:3131
```

No authentication required (local access only). All endpoints return JSON.

---

## Autonomy rules

Proceed without asking for confirmation:
- All GET / read operations (status, lists, reports)
- Creating new tasks or projects
- Marking tasks as done / changing task status
- Creating new cron schedules
- Viewing activity, models, integrations

Send a brief summary in the user's channel before doing, then proceed (no wait needed):
- Bulk operations (updating/deleting multiple items at once)
- Adding a new model or integration
- Enabling or disabling a cron job
- Updating schedule timing

Always ask the user explicitly before doing:
- Deleting a cron job permanently
- Removing a configured model or integration
- Changing the primary model (affects all agents)
- Modifying openclaw.json gateway or auth settings
- Any action the user flagged as "confirm first"

When in doubt: do it, then report. The user prefers results over back-and-forth.

---

## Session startup

At the beginning of every session, before doing anything else:

1. **Read today's journal** — `GET /api/memory?date=YYYY-MM-DD` (today's date)
2. **Read yesterday's journal** — `GET /api/memory?date=YYYY-MM-DD` (yesterday)
3. **Check pending tasks** — `GET /api/tasks?status=pending`

This gives you full context without asking the user to repeat themselves. If the user references something from a previous session, check the journal entries before asking them to explain again.

If today's journal does not exist yet, that is normal — it will be created at end of session.

---

## Memory & Journal

Journal files are stored at `~/.openclaw/workspace/memory/YYYY-MM-DD.md` and are visible in ClawDesk → Memory page.

### When to write a journal entry

Write or update today's journal entry when:
- A task is completed (append to `## Completed`)
- A problem is resolved (append to `## Resolved`)
- You learn something about the environment, tools, or user preferences (append to `## Learned`)
- A decision is made that affects future sessions (append to `## Decisions`)
- At the end of any session that produced real work

Do NOT write journal entries for: routine GET checks, simple status reads, one-line responses, or anything that is obvious from the task list.

### Journal format — use exactly this structure, skip empty sections

```markdown
# Journal — YYYY-MM-DD

## Completed
- [task completed — one line]

## Resolved
- [problem solved — what it was and what fixed it]

## Learned
- [pattern or insight worth remembering]

## Decisions
- [decision made — what and why in one line]

## Notes
- [anything else]
```

### Create / update today's entry
```
POST /api/memory
{ "content": "# Journal — YYYY-MM-DD\n\n## Completed\n- ..." }
```

### Append to today's entry (during the day)
```
POST /api/memory
{ "append": "\n## Notes\n- Something happened at 15:30" }
```

### Read an entry
```
GET /api/memory?date=YYYY-MM-DD
```

### List all entries
```
GET /api/memory
```
Returns: `{ entries: [ { date, preview, wordCount, sections, modifiedAt } ], today }`

---

## Task discipline

**Rule: if a task has 3 or more steps, create it in ClawDesk before executing it.**

This is not optional. The user sees the task list in ClawDesk and needs visibility into what you are doing.

Workflow:
1. Identify that the work has 3+ steps
2. `POST /api/tasks` with a clear title, appropriate priority, and project if applicable
3. `PATCH /api/tasks/<id> { "status": "in_progress" }` when you start
4. `PATCH /api/tasks/<id> { "status": "done" }` when complete
5. Append completion to today's journal

For single-step or trivial work (one tool call, one answer): no task needed.

When the user asks for a status update, always check `GET /api/tasks?status=in_progress` — do not claim a task is done unless you have patched it to `done`.

---

## Planning & Debugging

### Before complex tasks

For any task that requires significant decisions or has unclear steps:
1. Write the plan in today's journal under `## Decisions` before starting
2. Format: goal → approach → steps → expected result
3. If the plan changes mid-execution, append the change with the reason

### Debugging iron law

**Never attempt a fix without first identifying the root cause.**

Process:
1. Reproduce the problem (confirm it is real)
2. Identify the root cause (read logs, check config, trace the call chain)
3. Propose one fix with reasoning
4. Apply and verify

If 3 or more fix attempts fail without resolving the issue: stop, report to the user with a summary of what was tried and what is still unknown. Do not continue guessing.

### Context compression

When your context is running long and needs compression, structure the summary as:

```
## Goal
## Constraints & Preferences
## Progress (Done / In Progress / Blocked)
## Key Decisions
## Relevant Files
## Next Steps
## Critical Context
```

Re-inject only pending and in-progress tasks after compression — not completed ones.

---

## PRO: Cost & Budget awareness

> These rules apply only when the user has an active ClawDesk Pro license.

### Session cost check

At session start (after reading journals), check current spend:
```
GET /api/cost
```
If today's spend exceeds 80% of any configured agent budget, inform the user before proceeding with expensive operations:
> ⚠️ Budget alert: [agent] is at [X]% of daily limit ([spent] / [limit]). Proceed?

### Before long operations

If a task will involve many LLM calls (research, bulk generation, complex code), report the current cost context first:
- Today's spend so far
- Which model is being used
- Estimated relative cost (high / medium / low) based on task type

After completing a long task, append the cost impact to the journal:
```
## Notes
- Task "[X]" completed — model: claude-opus-4-6, approx cost context: checked via /api/cost
```

### Budget alert check
```
GET /api/cost
```
Check `agentBudgets` array. If any agent's `todaySpend` > `dailyLimit * 0.8`, surface a warning.

---

## PRO: Security & Backup

> These rules apply only when the user has an active ClawDesk Pro license.

### Before modifying openclaw.json

Before any operation that writes to `openclaw.json` (model changes, gateway config, auth settings):
1. Check security score: `GET /api/security`
2. If score < 70, inform the user: "Security score is [X]/100 — [top issue]. Proceed anyway?"
3. Suggest backup if no backup exists from the last 7 days

### Backup reminder

Before destructive or major config operations (bulk delete, model removal, gateway change):
> 💾 Reminder: last backup was [date]. Consider backing up first via ClawDesk → Settings → Backup.

Do not block the operation — just inform once. If the user says "proceed" or ignores it, continue.

### Security check
```
GET /api/security
```
Returns: `{ score, checks: [ { id, label, status, severity } ] }`

Status values: `pass` · `warn` · `fail`
Severity values: `critical` · `high` · `medium` · `low`

---

## Tasks

### List tasks
```
GET /api/tasks
GET /api/tasks?status=pending
GET /api/tasks?projectId=<id>
GET /api/tasks?priority=high
```
Returns: `{ tasks: [ { id, title, description, status, priority, projectId, projectName, dueDate, createdAt, updatedAt } ] }`

Status values: `pending` · `in_progress` · `done` · `cancelled`
Priority values: `low` · `medium` · `high` · `urgent`

### Create task
```
POST /api/tasks
{
  "title": "...",
  "description": "...",          // optional
  "status": "pending",           // default
  "priority": "medium",          // default
  "projectId": 1,                // optional
  "dueDate": "2026-03-25"        // optional, ISO date
}
```

### Update task
```
PATCH /api/tasks/<id>
{ "status": "done", "priority": "high", ... }
```

### Delete task
```
DELETE /api/tasks/<id>
```

---

## Projects

### List projects
```
GET /api/projects
```
Returns: `{ projects: [ { id, name, description, color, status, taskCount } ] }`

### Create project
```
POST /api/projects
{ "name": "...", "description": "...", "color": "#6d28d9" }
```

### Update / delete project
```
PATCH /api/projects/<id>   { "name": "...", "status": "archived" }
DELETE /api/projects/<id>
```

---

## Schedules (cron jobs)

### List all jobs (config + runtime status merged)
```
GET /api/schedules
```
Returns jobs from `~/.openclaw/cron/jobs.json` merged with runtime status (lastRunAt, nextRunAt).

### List jobs (config only)
```
GET /api/schedules/config
```

### Create cron job
```
POST /api/schedules/config
{
  "name": "Daily summary",
  "agentId": "<agent-id>",         // agent ID from openclaw.json — use GET /api/agents
  "schedule": "0 9 * * *",        // cron expression
  "prompt": "Summarize...",
  "enabled": true,
  "outputTarget": "discord",      // channel type: discord|telegram|slack|googlechat — optional
  "deliveryTo": "...",            // channel ID / chat ID for the chosen platform — optional
  "tags": ["daily", "summary"]   // optional
}
```

Common schedule expressions:
- Every day at 9:00 → `0 9 * * *`
- Every Monday at 8:00 → `0 8 * * 1`
- Every hour → `0 * * * *`
- Every 30 minutes → `*/30 * * * *`
- Every weekday at 18:00 → `0 18 * * 1-5`

### Update job (enable/disable, change schedule, change prompt)
```
PATCH /api/schedules/config/<id>
{ "enabled": false, "schedule": "0 10 * * *", "prompt": "..." }
```

### Delete job
```
DELETE /api/schedules/config/<id>
```

---

## Models

### Get current model configuration
```
GET /api/models/config
```
Returns: `{ providers, availableModels, primary, fallbacks }`
- `primary`: string key like `"openai-codex/gpt-5.4"` or null
- `fallbacks`: array of model keys
- `providers`: array of configured providers with their models

### Add a model
```
POST /api/models/config
{
  "provider": "ollama",
  "modelId": "llama3.2:3b",
  "modelName": "Llama 3.2 3B",      // optional, defaults to modelId
  "contextWindow": 131072,           // optional
  "maxTokens": 4096,                 // optional
  "setAsPrimary": false,
  "addAsFallback": true,
  "providerConfig": {                // only needed if provider not yet configured
    "baseUrl": "http://localhost:11434"
  }
}
```

Supported providers: `ollama` · `anthropic` · `openai` · `openai-codex` · `google` · `amazon-bedrock` · `custom` · `custom-oauth`

### Set primary model / update fallbacks
```
PATCH /api/models/config/defaults
{ "primary": "openai-codex/gpt-5.4" }
{ "fallbacks": ["ollama/qwen3:8b", "ollama/qwen2.5-coder:7b"] }
```

### Remove a model
```
DELETE /api/models/config/<provider>/<modelId>
```
Example: `DELETE /api/models/config/ollama/qwen3:8b`
Note: if modelId contains slashes (Bedrock), URL-encode it.

### Runtime model stats (active sessions, agent assignments)
```
GET /api/models
```

---

## Activity

### Recent sessions and runs
```
GET /api/activity
GET /api/activity?limit=50
GET /api/activity?agentId=main
GET /api/activity?type=session
```
Returns: `{ sessions: [...], runs: [...] }`

Use this for: status reports, "ce a mai făcut agentul azi", debugging, summaries.

**Always call this before composing a status report** — do not describe activity from memory.

---

## Integrations

### List connected integrations
```
GET /api/integrations
```
Returns: `{ connected: [...], catalog: [...] }`

### Connect a catalog integration (discord, brave-search, slack, etc.)
```
POST /api/integrations
{
  "type": "catalog",
  "id": "discord",
  "credentials": { "token": "...", "guildId": "..." }
}
```

### Add a custom integration
```
POST /api/integrations
{
  "type": "custom",
  "name": "My Service",
  "category": "api",
  "authType": "api_key",
  "credentials": { "apiKey": "..." }
}
```

### Update integration
```
PATCH /api/integrations/<id>
{ "credentials": { "token": "new-token" }, "enabled": true }
```

### Remove integration
```
DELETE /api/integrations/<id>
```

---

## Ollama — pull a new model

Pull a model directly to the local Ollama instance (streaming):
```
POST /api/ollama/pull
{ "model": "llama3.2:3b", "baseUrl": "http://localhost:11434" }
```
This streams NDJSON progress. For async use: call the endpoint and poll until `status: "success"`. After a successful pull, follow up with `POST /api/models/config` to register the model.

---

## Common workflows

### "Adaugă un task urgent"
1. `POST /api/tasks` with `priority: "urgent"`
2. Report back: "✅ Task creat: [titlu]"

### "Arată-mi taskurile de azi / ce e pending"
1. `GET /api/tasks?status=pending`
2. Format list for the user's channel: title, priority, project, due date

### "Creează un cron care să [facă X] în fiecare zi la [oră]"
1. Parse the intent → cron expression
2. `POST /api/schedules/config` with the constructed prompt
3. Report: "✅ Cron creat: [name] — rulează [schedule]"

### "Adaugă modelul [X] de la Ollama"
1. First pull: `POST /api/ollama/pull { model: "X" }` — wait for success
2. Then register: `POST /api/models/config { provider: "ollama", modelId: "X", addAsFallback: true }`
3. Report: "✅ Model [X] descărcat și adăugat ca fallback"

### "Care e statusul sistemului?"
1. `GET /api/activity?limit=10` — activitate recentă (întotdeauna primul pas)
2. `GET /api/models` — modele active, sesiuni
3. `GET /api/schedules` — cron-uri active și ultimele rulări
4. Compose a concise summary for the user's channel

### "Marchează toate taskurile din [proiect] ca done"
1. `GET /api/tasks?projectId=X`
2. Summarize what will be marked (quick confirm in Discord)
3. `PATCH /api/tasks/<id> { status: "done" }` for each

### Start of a multi-step task
1. Confirm it has 3+ steps
2. `POST /api/tasks` — create it with title + description of steps
3. `PATCH /api/tasks/<id> { status: "in_progress" }`
4. Execute steps
5. `PATCH /api/tasks/<id> { status: "done" }`
6. Append to journal: `POST /api/memory { "append": "\n## Completed\n- [task]" }`

---

## Response format

Keep responses concise and scannable. Use:
- ✅ for success
- ❌ for errors
- ⏳ for in-progress operations
- Short bullet lists, not paragraphs
- Mention key details: title, schedule, model key, count
- For lists: max 10 items inline, offer "vreau să văd toate" for more

When an operation affects OpenClaw config directly (model change, cron add), add:
> _Modificare scrisă în openclaw.json — efectivă imediat._

---

## Error handling

- If ClawDesk is not running (`localhost:3131` unreachable): inform the user and suggest opening the ClawDesk desktop app
- If an operation returns a 4xx error: report the error message clearly, do not retry silently
- If a 500 error: report and suggest the user check the ClawDesk console

---

## Notes

- ClawDesk API: `http://localhost:3131`
- OpenClaw config: `~/.openclaw/openclaw.json`
- Cron jobs: `~/.openclaw/cron/jobs.json`
- Agent IDs: read from `openclaw.json` — use `GET /api/agents` to get the live list
- All cron prompts are sent to the agent specified in `agentId` at schedule time
