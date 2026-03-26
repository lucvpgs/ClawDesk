import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

// ─── Runtime Sources ──────────────────────────────────────────────────────────

export const runtimeSources = sqliteTable("runtime_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gatewayUrl: text("gateway_url").notNull(),
  connectionMode: text("connection_mode").notNull().default("local"), // local | ssh | remote
  authMode: text("auth_mode").notNull().default("token"),
  authToken: text("auth_token"),            // stored in plaintext for now (local-first)
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const runtimeSourceState = sqliteTable("runtime_source_state", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id").notNull().references(() => runtimeSources.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("disconnected"), // connected | degraded | disconnected | error
  grantedScopes: text("granted_scopes"),   // JSON array string
  runtimeVersion: text("runtime_version"),
  primaryAgentId: text("primary_agent_id"),
  primaryAgentName: text("primary_agent_name"),
  lastSeenAt: text("last_seen_at"),
  lastProbeAt: text("last_probe_at"),
  lastSyncAt: text("last_sync_at"),
  degradedReason: text("degraded_reason"),
  lastError: text("last_error"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Runtime Snapshots ────────────────────────────────────────────────────────

export const runtimeAgents = sqliteTable("runtime_agents", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id").notNull(),
  agentId: text("agent_id").notNull(),
  name: text("name"),
  model: text("model"),
  status: text("status"),
  workspace: text("workspace"),
  rawJson: text("raw_json"),               // full snapshot JSON
  observedAt: text("observed_at").notNull().default(sql`(datetime('now'))`),
});

export const runtimeSessions = sqliteTable("runtime_sessions", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id").notNull(),
  sessionId: text("session_id").notNull(),
  agentId: text("agent_id"),
  status: text("status"),
  channel: text("channel"),
  rawJson: text("raw_json"),
  observedAt: text("observed_at").notNull().default(sql`(datetime('now'))`),
});

export const runtimeCronJobs = sqliteTable("runtime_cron_jobs", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id").notNull(),
  jobId: text("job_id").notNull(),
  name: text("name"),
  schedule: text("schedule"),
  status: text("status"),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  rawJson: text("raw_json"),
  observedAt: text("observed_at").notNull().default(sql`(datetime('now'))`),
});

export const runtimeChannels = sqliteTable("runtime_channels", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id").notNull(),
  channelType: text("channel_type").notNull(),
  status: text("status"),
  rawJson: text("raw_json"),
  observedAt: text("observed_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Mission Control Entities ─────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active | paused | done | archived
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  runtimeSourceId: text("runtime_source_id"),
  title: text("title").notNull(),
  description: text("description"),
  // todo | in_progress | review | blocked | done | failed | cancelled
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  assignedAgentId: text("assigned_agent_id"),
  linkedSessionId: text("linked_session_id"),
  linkedCronJobId: text("linked_cron_job_id"),
  dueAt: text("due_at"),
  // ── State machine ─────────────────────────────────────────────────────────
  dependencies: text("dependencies").default("[]"),       // JSON: string[] of task IDs
  requiresReview: integer("requires_review", { mode: "boolean" }).default(false),
  maxRetries: integer("max_retries").default(2),
  retryCount: integer("retry_count").default(0),
  nextTaskTemplate: text("next_task_template"),           // JSON: { title, description?, priority?, assignedAgentId? }
  // ── Temporal tracking ─────────────────────────────────────────────────────
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  durationMs: integer("duration_ms"),
  failedAt: text("failed_at"),
  // ─────────────────────────────────────────────────────────────────────────
  proof: text("proof"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const activityEvents = sqliteTable("activity_events", {
  id: text("id").primaryKey(),
  runtimeSourceId: text("runtime_source_id"),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type"),         // agent | session | task | cron | approval
  entityId: text("entity_id"),
  summary: text("summary"),
  rawJson: text("raw_json"),
  occurredAt: text("occurred_at").notNull().default(sql`(datetime('now'))`),
});

export const taskComments = sqliteTable("task_comments", {
  id:        text("id").primaryKey(),
  taskId:    text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  author:    text("author").notNull().default("user"),  // "user" | agentId
  body:      text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuntimeSource = typeof runtimeSources.$inferSelect;
export type RuntimeSourceState = typeof runtimeSourceState.$inferSelect;
export type RuntimeAgent = typeof runtimeAgents.$inferSelect;
export type RuntimeSession = typeof runtimeSessions.$inferSelect;
export type RuntimeCronJob = typeof runtimeCronJobs.$inferSelect;
export type RuntimeChannel = typeof runtimeChannels.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
