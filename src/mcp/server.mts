#!/usr/bin/env node
/**
 * ClawDesk MCP Server
 * Exposes ClawDesk tasks, projects, and agents as native MCP tools.
 *
 * Usage:
 *   node src/mcp/server.mjs [--port 3131]
 *
 * Configure in ~/.claude/settings.json:
 *   "mcpServers": {
 *     "clawdesk": {
 *       "command": "node",
 *       "args": ["/Applications/ClawDesk.app/Contents/Resources/server/src/mcp/server.mjs"]
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Parse --port flag (default 3131)
const portIdx = process.argv.indexOf("--port");
const PORT = portIdx !== -1 ? process.argv[portIdx + 1] : "3131";
const BASE = `http://localhost:${PORT}`;

async function api<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`ClawDesk API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "clawdesk",
  version: "1.0.0",
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

server.tool(
  "clawdesk_list_tasks",
  "List all tasks. Optionally filter by projectId, status (todo/in_progress/done/blocked), or assignedAgentId.",
  {
    projectId: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    assignedAgentId: z.string().optional(),
  },
  async (filters) => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.status) params.set("status", filters.status);
    if (filters.assignedAgentId) params.set("assignedAgentId", filters.assignedAgentId);
    const qs = params.toString();
    const data = await api<{ tasks: unknown[] }>("GET", `/api/tasks${qs ? "?" + qs : ""}`);
    return ok(data.tasks);
  }
);

server.tool(
  "clawdesk_get_task",
  "Get a single task by ID including its comments (full context for an agent before starting work).",
  { id: z.string() },
  async ({ id }) => {
    const [taskData, commentsData] = await Promise.all([
      api<{ tasks: unknown[] }>("GET", `/api/tasks`).then(
        (d) => (d.tasks as { id: string }[]).find((t) => t.id === id)
      ),
      api<{ comments: unknown[] }>("GET", `/api/tasks/${id}/comments`),
    ]);
    if (!taskData) return err(`Task ${id} not found`);
    return ok({ ...taskData, comments: commentsData.comments });
  }
);

server.tool(
  "clawdesk_create_task",
  "Create a new task.",
  {
    title: z.string(),
    description: z.string().optional(),
    projectId: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    assignedAgentId: z.string().optional(),
  },
  async (body) => {
    const data = await api<{ task: unknown }>("POST", "/api/tasks", body);
    return ok(data.task);
  }
);

server.tool(
  "clawdesk_update_task",
  "Update task fields (status, priority, title, description, assignedAgentId, notes, proof, dueAt).",
  {
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignedAgentId: z.string().optional(),
    notes: z.string().optional(),
    proof: z.string().optional(),
    dueAt: z.string().optional(),
  },
  async ({ id, ...body }) => {
    const data = await api<{ task: unknown }>("PATCH", `/api/tasks/${id}`, body);
    return ok(data.task);
  }
);

server.tool(
  "clawdesk_delete_task",
  "Delete a task by ID.",
  { id: z.string() },
  async ({ id }) => {
    await api("DELETE", `/api/tasks/${id}`);
    return ok({ ok: true, deletedId: id });
  }
);

server.tool(
  "clawdesk_add_comment",
  "Add a comment to a task.",
  {
    taskId: z.string(),
    body: z.string(),
    author: z.string().optional(),
  },
  async ({ taskId, body, author = "agent" }) => {
    const data = await api<{ comment: unknown }>(
      "POST",
      `/api/tasks/${taskId}/comments`,
      { body, author }
    );
    return ok(data.comment);
  }
);

// ─── Projects ────────────────────────────────────────────────────────────────

server.tool(
  "clawdesk_list_projects",
  "List all projects with their task counts and status breakdown.",
  {},
  async () => {
    const data = await api<{ projects: unknown[] }>("GET", "/api/projects");
    return ok(data.projects);
  }
);

server.tool(
  "clawdesk_get_project",
  "Get a single project by ID with all its tasks.",
  { id: z.string() },
  async ({ id }) => {
    const [projectsData, tasksData] = await Promise.all([
      api<{ projects: { id: string }[] }>("GET", "/api/projects"),
      api<{ tasks: { projectId: string }[] }>("GET", "/api/tasks"),
    ]);
    const project = projectsData.projects.find((p) => p.id === id);
    if (!project) return err(`Project ${id} not found`);
    const tasks = tasksData.tasks.filter((t) => t.projectId === id);
    return ok({ ...project, tasks });
  }
);

server.tool(
  "clawdesk_create_project",
  "Create a new project.",
  {
    name: z.string(),
    description: z.string().optional(),
  },
  async (body) => {
    const data = await api<{ project: unknown }>("POST", "/api/projects", body);
    return ok(data.project);
  }
);

// ─── Agents ──────────────────────────────────────────────────────────────────

server.tool(
  "clawdesk_list_agents",
  "List all connected OpenClaw agents and their active sessions.",
  {},
  async () => {
    const data = await api<{ agents: unknown[] }>("GET", "/api/agents");
    return ok(data.agents);
  }
);

// ─── Overview ────────────────────────────────────────────────────────────────

server.tool(
  "clawdesk_get_overview",
  "Get a full dashboard overview: runtime status, agent count, task stats, recent activity.",
  {},
  async () => {
    const data = await api("GET", "/api/overview");
    return ok(data);
  }
);

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("ClawDesk MCP server error:", err);
  process.exit(1);
});
