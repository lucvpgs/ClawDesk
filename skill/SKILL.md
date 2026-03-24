---
name: clawdesk
version: "2026-03-24"
description: >
  Operate the ClawDesk Mission Control application on behalf of the user.
  Use this skill whenever the user asks you to manage tasks, projects, schedules
  (cron jobs), models, integrations, settings, or wants a status report about
  the system. Also use it when the user says things like "add a task",
  "create a schedule", "show me my tasks", "what's pending", "mark as done",
  or any request that involves reading from or writing to the ClawDesk app.
  Also governs agent behavior disciplines: memory journaling, task tracking,
  cost awareness, and structured planning.
---

# ClawDesk — Mission Control

ClawDesk is your command interface for the OpenClaw system. It gives you and the user a full view of everything running: tasks, schedules, models, integrations, agent activity, and configuration.

**Important:** The ClawDesk HTTP API at `http://localhost:3131` is inaccessible from agent sessions due to SSRF policy. All ClawDesk operations are performed via:
- **sqlite3** — for all task/project/activity reads and writes
- **openclaw CLI** — for schedules, agents, models, and config
- **python3 + file I/O** — for memory/journal reads and writes

---

## Architecture

```
User (Discord / Telegram / Slack / etc.)
     │
     ▼
  Your primary agent (you)
     │  uses
     ├── sqlite3              → ClawDesk DB (tasks, projects, activity)
     ├── openclaw             → schedules, agents, models, gateway
     └── python3 + files      → memory/journal (~/.openclaw/workspace/memory/)

ClawDesk DB path (auto-detected by OS — see DB path section below)
OpenClaw config: ~/.openclaw/openclaw.json
Cron jobs: ~/.openclaw/cron/jobs.json
Memory files: ~/.openclaw/workspace/memory/YYYY-MM-DD.md
```

---

## DB path

The DB location depends on the OS. Always detect it with python3:

```bash
DB=$(python3 -c "
import os, sys
if sys.platform == 'darwin':
    p = os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db')
elif sys.platform == 'win32':
    p = os.path.join(os.environ.get('APPDATA', ''), 'com.vpgs.clawdesk', 'clawdesk.db')
else:
    p = os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db')
print(p)
")
```

Use this snippet at the top of every bash block that needs the DB. Always quote `"$DB"`.
Use `-separator '|'` for parseable output or `-json` for structured results.

---

## Autonomy rules

Proceed without asking for confirmation:
- All read operations (status, lists, reports)
- Creating new tasks or projects
- Marking tasks as done / changing task status
- Creating new cron schedules
- Viewing activity, models, integrations

Send a brief summary before doing (no wait needed):
- Bulk operations (updating/deleting multiple items at once)
- Adding a new model or integration
- Enabling or disabling a cron job
- Updating schedule timing

Always ask the user explicitly before:
- Deleting a cron job permanently
- Removing a configured model or integration
- Changing the primary model (affects all agents)
- Modifying openclaw.json gateway or auth settings
- Any action the user flagged as "confirm first"

When in doubt: do it, then report. The user prefers results over back-and-forth.

---

## Session startup

At the beginning of every session, before doing anything else:

1. **Read today's journal** — check `~/.openclaw/workspace/memory/YYYY-MM-DD.md` (today's date)
2. **Read yesterday's journal** — check `~/.openclaw/workspace/memory/YYYY-MM-DD.md` (yesterday)
3. **Check pending tasks** — query DB for `status IN ('todo','in_progress')`

This gives you full context without asking the user to repeat themselves.

---

## Memory & Journal

Journal files are plain markdown at `~/.openclaw/workspace/memory/YYYY-MM-DD.md` — visible in ClawDesk → Memory page.

### Read today's journal
```python
import os, datetime
today = datetime.date.today().strftime("%Y-%m-%d")
path = os.path.expanduser(f"~/.openclaw/workspace/memory/{today}.md")
print(open(path).read() if os.path.exists(path) else "(no entry yet)")
```

### Read yesterday's journal
```python
import os, datetime
yesterday = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
path = os.path.expanduser(f"~/.openclaw/workspace/memory/{yesterday}.md")
print(open(path).read() if os.path.exists(path) else "(no entry)")
```

### Create or overwrite today's entry
```python
import os, datetime
today = datetime.date.today().strftime("%Y-%m-%d")
mem_dir = os.path.expanduser("~/.openclaw/workspace/memory")
os.makedirs(mem_dir, exist_ok=True)
path = os.path.join(mem_dir, f"{today}.md")
with open(path, "w") as f:
    f.write(f"""# Journal — {today}

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
""")
```

### Append to today's entry
```python
import os, datetime
today = datetime.date.today().strftime("%Y-%m-%d")
path = os.path.expanduser(f"~/.openclaw/workspace/memory/{today}.md")
with open(path, "a") as f:
    f.write("\n## Notes\n- Something happened\n")
```

### When to write a journal entry

Write or update today's journal when:
- A task is completed (append to `## Completed`)
- A problem is resolved (append to `## Resolved`)
- You learn something about the environment, tools, or user preferences (append to `## Learned`)
- A decision is made that affects future sessions (append to `## Decisions`)
- At the end of any session that produced real work

Do NOT write journal entries for: routine reads, simple status checks, one-line responses.

---

## Task discipline

**Rule: if a task has 3 or more steps, create it in ClawDesk before executing it.**

This is not optional. The user sees the task list in ClawDesk and needs visibility.

Workflow:
1. Identify that the work has 3+ steps
2. Create the task (INSERT into tasks table)
3. Update to `in_progress` when you start
4. Update to `done` when complete
5. Append completion to today's journal

---

## Tasks — sqlite3

### DB schema (tasks)
```sql
tasks(
  id TEXT PRIMARY KEY,       -- UUID string
  project_id TEXT,           -- references projects(id)
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- todo | in_progress | done | cancelled
  priority TEXT DEFAULT 'medium', -- low | medium | high | urgent
  assigned_agent_id TEXT,
  due_at TEXT,               -- ISO datetime or date string
  created_at TEXT,
  updated_at TEXT,
  proof TEXT,
  notes TEXT
)
```

### List all open tasks
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 -json "$DB" "
  SELECT t.id, t.title, t.status, t.priority, t.due_at,
         p.name AS project
  FROM tasks t
  LEFT JOIN projects p ON t.project_id = p.id
  WHERE t.status NOT IN ('done','cancelled')
  ORDER BY CASE t.priority
    WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
    WHEN 'medium' THEN 3 ELSE 4 END, t.created_at
"
```

### List tasks by status
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 -json "$DB" "SELECT id, title, status, priority FROM tasks WHERE status='todo' ORDER BY created_at DESC LIMIT 20"
```

### Create a task
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
ID=$(python3 -c "import uuid; print(uuid.uuid4())")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "
  INSERT INTO tasks (id, title, description, status, priority, created_at, updated_at)
  VALUES ('$ID', 'Task title here', 'Optional description', 'todo', 'medium', '$NOW', '$NOW')
"
echo "Created task: $ID"
```

For tasks with a project:
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
PROJECT_ID=$(sqlite3 "$DB" "SELECT id FROM projects WHERE name LIKE '%ProjectName%' LIMIT 1")
ID=$(python3 -c "import uuid; print(uuid.uuid4())")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "
  INSERT INTO tasks (id, project_id, title, priority, status, created_at, updated_at)
  VALUES ('$ID', '$PROJECT_ID', 'Task title', 'high', 'todo', '$NOW', '$NOW')
"
```

### Update task status
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "UPDATE tasks SET status='done', updated_at='$NOW' WHERE id='<task-id>'"
```

### Update task priority
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "UPDATE tasks SET priority='urgent', updated_at='$NOW' WHERE id='<task-id>'"
```

### Update task fields (general)
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "UPDATE tasks SET title='New title', description='New desc', updated_at='$NOW' WHERE id='<task-id>'"
```

### Delete a task
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 "$DB" "DELETE FROM tasks WHERE id='<task-id>'"
```

### Find task by title (fuzzy)
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 -json "$DB" "SELECT id, title, status, priority FROM tasks WHERE title LIKE '%keyword%'"
```

---

## Projects — sqlite3

### DB schema (projects)
```sql
projects(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',  -- active | archived
  created_at TEXT,
  updated_at TEXT
)
```

### List all active projects
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 -json "$DB" "
  SELECT p.id, p.name, p.description, p.status,
         COUNT(t.id) AS task_count,
         SUM(CASE WHEN t.status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) AS open_tasks
  FROM projects p
  LEFT JOIN tasks t ON t.project_id = p.id
  WHERE p.status = 'active'
  GROUP BY p.id
  ORDER BY p.created_at
"
```

### Create a project
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
ID=$(python3 -c "import uuid; print(uuid.uuid4())")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "
  INSERT INTO projects (id, name, description, status, created_at, updated_at)
  VALUES ('$ID', 'Project Name', 'Description here', 'active', '$NOW', '$NOW')
"
echo "Created project: $ID"
```

### Update project
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "UPDATE projects SET name='New Name', updated_at='$NOW' WHERE id='<project-id>'"
```

### Archive a project
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "UPDATE projects SET status='archived', updated_at='$NOW' WHERE id='<project-id>'"
```

---

## Activity — sqlite3

### Recent activity events
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
sqlite3 -json "$DB" "
  SELECT event_type, entity_type, summary, occurred_at
  FROM activity_events
  ORDER BY occurred_at DESC
  LIMIT 20
"
```

### Log a custom activity event
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")
ID=$(python3 -c "import uuid; print(uuid.uuid4())")
NOW=$(python3 -c "import datetime; print(datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))")
sqlite3 "$DB" "
  INSERT INTO activity_events (id, event_type, entity_type, summary, occurred_at)
  VALUES ('$ID', 'agent_action', 'task', 'Agent completed X', '$NOW')
"
```

---

## Schedules (cron jobs) — openclaw CLI

All schedule operations use the `openclaw cron` CLI:

### List all cron jobs
```bash
openclaw cron list
```

### Create a cron job
```bash
openclaw cron add \
  --name "Daily summary" \
  --schedule "0 9 * * *" \
  --prompt "Summarize today's tasks and activity" \
  --agent main \
  --output discord
```

Common schedule expressions:
- Every day at 9:00 → `0 9 * * *`
- Every Monday at 8:00 → `0 8 * * 1`
- Every hour → `0 * * * *`
- Every 30 minutes → `*/30 * * * *`
- Every weekday at 18:00 → `0 18 * * 1-5`

### Enable / disable a job
```bash
openclaw cron enable <job-id>
openclaw cron disable <job-id>
```

### Edit a job
```bash
openclaw cron edit <job-id> --schedule "0 10 * * *"
openclaw cron edit <job-id> --prompt "Updated prompt"
```

### Delete a job
```bash
openclaw cron rm <job-id>
```

### Run a job immediately
```bash
openclaw cron run <job-id>
```

### View run history
```bash
openclaw cron runs <job-id>
```

---

## Models & config — openclaw CLI + direct file reads

### Get current agent config
```python
import json, os
with open(os.path.expanduser("~/.openclaw/openclaw.json")) as f:
    config = json.load(f)
agents = config.get("agents", {}).get("list", [])
defaults = config.get("agents", {}).get("defaults", {})
print("Default model:", defaults.get("model", {}).get("primary"))
for agent in agents:
    print(f"Agent {agent['id']}: model={agent.get('model', 'inherits default')}")
```

### Gateway status
```bash
openclaw gateway status
```

---

## System status — combined

### Full status report
```bash
DB=$(python3 -c "import os,sys; print(os.path.expanduser('~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db') if sys.platform=='darwin' else os.path.join(os.environ.get('APPDATA',''),'com.vpgs.clawdesk','clawdesk.db') if sys.platform=='win32' else os.path.expanduser('~/.local/share/com.vpgs.clawdesk/clawdesk.db'))")

echo "=== OPEN TASKS ==="
sqlite3 -json "$DB" "
  SELECT t.title, t.status, t.priority, p.name as project
  FROM tasks t LEFT JOIN projects p ON t.project_id = p.id
  WHERE t.status NOT IN ('done','cancelled')
  ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
  LIMIT 15
"

echo "=== SCHEDULES ==="
openclaw cron list

echo "=== GATEWAY ==="
openclaw gateway status
```

---

## Common workflows

### "Add an urgent task"
1. Generate UUID: `python3 -c "import uuid; print(uuid.uuid4())"`
2. Get DB path: use python3 DB detection snippet
3. INSERT into tasks with `priority='urgent'`
4. Report: "✅ Task created: [title]"

### "Show pending tasks / what's open"
1. Query DB: `status NOT IN ('done','cancelled')`
2. Format list: title, priority, project, due date

### "Create a schedule that does X every day at Y"
1. Parse intent → cron expression
2. `openclaw cron add --name "..." --schedule "..." --prompt "..."`
3. Report: "✅ Schedule created: [name] — runs [schedule]"

### "Mark task [X] as done"
1. Find task: `SELECT id, title FROM tasks WHERE title LIKE '%X%'`
2. Confirm with user which task if ambiguous
3. `UPDATE tasks SET status='done', updated_at='...' WHERE id='...'`
4. Append to journal

### "What did the agent do today?"
1. Read today's journal via python3
2. Query recent activity: `SELECT event_type, summary, occurred_at FROM activity_events ORDER BY occurred_at DESC LIMIT 10`
3. Compose summary

### "Show me the system status"
1. Open tasks count from DB
2. `openclaw cron list` — active schedules
3. `openclaw gateway status` — gateway health
4. Compose concise summary

### Start of a multi-step task
1. Confirm it has 3+ steps
2. INSERT task with `status='todo'`
3. UPDATE to `status='in_progress'`
4. Execute steps
5. UPDATE to `status='done'`
6. Append to today's journal

---

## Response format

Keep responses concise and scannable. Use:
- ✅ for success
- ❌ for errors
- ⏳ for in-progress operations
- Short bullet lists, not paragraphs
- Mention key details: title, schedule, priority, count
- For lists: max 10 items inline, offer to show more if needed

---

## Error handling

- If sqlite3 fails: check that ClawDesk has been launched at least once (creates the DB)
- If openclaw CLI fails: check `openclaw gateway status` — gateway may be stopped
- If memory file missing: normal for first session of the day — create it fresh

---

## Notes

- ClawDesk DB path: auto-detected by OS (see DB path section)
  - macOS: `~/Library/Application Support/com.vpgs.clawdesk/clawdesk.db`
  - Linux: `~/.local/share/com.vpgs.clawdesk/clawdesk.db`
  - Windows: `%APPDATA%\com.vpgs.clawdesk\clawdesk.db`
- OpenClaw config: `~/.openclaw/openclaw.json`
- Cron jobs: `~/.openclaw/cron/jobs.json`
- Memory files: `~/.openclaw/workspace/memory/YYYY-MM-DD.md`
- Task status values: `todo` · `in_progress` · `done` · `cancelled`
- Priority values: `low` · `medium` · `high` · `urgent`
- IDs are UUIDs — generate with `python3 -c "import uuid; print(uuid.uuid4())"`
- **HTTP API at localhost:3131 is SSRF-blocked** — never use web_fetch to localhost
