/**
 * ClawDesk task state machine.
 * Handles all status transitions with gates, tracking, retry, and chaining.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { generateId } from "@/lib/utils";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "failed"
  | "cancelled";

const VALID_STATUSES: TaskStatus[] = [
  "todo", "in_progress", "review", "blocked", "done", "failed", "cancelled",
];

export interface MoveResult {
  task: typeof schema.tasks.$inferSelect;
  retried: boolean;
  chainedTask?: typeof schema.tasks.$inferSelect;
}

export interface MoveError {
  error: string;
  requiresReview?: boolean;
  blockers?: { id: string; title: string; status: string }[];
}

export async function moveTask(
  taskId: string,
  newStatus: TaskStatus
): Promise<MoveResult | MoveError> {
  if (!VALID_STATUSES.includes(newStatus)) {
    return { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .limit(1);

  const task = rows[0];
  if (!task) return { error: `Task ${taskId} not found` };

  // ── Dependency gate: in_progress requires all deps done ──────────────────
  if (newStatus === "in_progress") {
    const deps: string[] = JSON.parse(task.dependencies ?? "[]");
    if (deps.length > 0) {
      const depRows = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, deps[0])); // fetch individually below

      // Fetch all deps in one query using IN — Drizzle needs a loop or raw SQL
      const blockers: { id: string; title: string; status: string }[] = [];
      for (const depId of deps) {
        const [dep] = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, depId))
          .limit(1);
        if (dep && dep.status !== "done") {
          blockers.push({ id: dep.id, title: dep.title, status: dep.status });
        }
      }
      void depRows; // unused, suppress lint
      if (blockers.length > 0) {
        return {
          error: `Blocked by unresolved dependencies: ${blockers.map(b => `"${b.title}" (${b.status})`).join(", ")}`,
          blockers,
        };
      }
    }
  }

  // ── Quality gate: done requires review if requiresReview is set ──────────
  if (newStatus === "done" && task.requiresReview && task.status !== "review") {
    return {
      error: `Quality gate: this task requires review before done. Move to 'review' first.`,
      requiresReview: true,
    };
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const now = new Date().toISOString();
  const update: Partial<typeof schema.tasks.$inferInsert> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === "in_progress" && !task.startedAt) {
    update.startedAt = now;
  }

  if (newStatus === "done") {
    update.completedAt = now;
    if (task.startedAt) {
      update.durationMs = Date.now() - new Date(task.startedAt).getTime();
    }
  }

  if (newStatus === "failed") {
    update.failedAt = now;
  }

  await db.update(schema.tasks).set(update).where(eq(schema.tasks.id, taskId));

  const [updated] = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .limit(1);

  // ── Auto-retry on failure ─────────────────────────────────────────────────
  let retried = false;
  if (newStatus === "failed") {
    const retryCount = updated.retryCount ?? 0;
    const maxRetries = updated.maxRetries ?? 2;

    if (retryCount < maxRetries) {
      await db.update(schema.tasks).set({
        status: "todo",
        retryCount: retryCount + 1,
        failedAt: undefined,
        updatedAt: now,
      }).where(eq(schema.tasks.id, taskId));

      await addSystemComment(
        taskId,
        `Auto-retry ${retryCount + 1}/${maxRetries}: task reset to todo after failure.`
      );
      retried = true;
    } else {
      await addSystemComment(
        taskId,
        `Max retries (${maxRetries}) exhausted. Task requires manual intervention.`
      );
    }
  }

  // ── Notify dependent tasks when a blocker resolves ────────────────────────
  if (newStatus === "done") {
    const allTasks = await db.select().from(schema.tasks);
    for (const t of allTasks) {
      const deps: string[] = JSON.parse(t.dependencies ?? "[]");
      if (deps.includes(taskId)) {
        await addSystemComment(
          t.id,
          `Dependency resolved: "${updated.title}" (${updated.id}) is now done.`
        );
      }
    }
  }

  // ── Task chaining: spawn next task on completion ──────────────────────────
  let chainedTask: typeof schema.tasks.$inferSelect | undefined;
  if (newStatus === "done" && updated.nextTaskTemplate) {
    try {
      const tpl = JSON.parse(updated.nextTaskTemplate) as {
        title: string;
        description?: string;
        priority?: string;
        assignedAgentId?: string;
      };
      const chainId = generateId();
      await db.insert(schema.tasks).values({
        id: chainId,
        projectId: updated.projectId,
        title: tpl.title,
        description: tpl.description ?? `Chained from: ${updated.title} (${updated.id})`,
        status: "todo",
        priority: (tpl.priority as typeof updated.priority) ?? updated.priority,
        assignedAgentId: tpl.assignedAgentId ?? updated.assignedAgentId,
        dependencies: "[]",
        createdAt: now,
        updatedAt: now,
      });
      await addSystemComment(
        chainId,
        `Auto-created from completed task "${updated.title}" (${updated.id}).`
      );
      const [chained] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, chainId))
        .limit(1);
      chainedTask = chained;
    } catch {
      // Malformed template — skip silently, don't fail the move
    }
  }

  const final = retried
    ? (await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1))[0]
    : updated;

  return { task: final, retried, ...(chainedTask ? { chainedTask } : {}) };
}

async function addSystemComment(taskId: string, body: string) {
  const db = getDb();
  await db.insert(schema.taskComments).values({
    id: generateId(),
    taskId,
    author: "system",
    body,
    createdAt: new Date().toISOString(),
  });
}
