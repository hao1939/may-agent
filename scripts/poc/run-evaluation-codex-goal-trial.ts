import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AppEvent, TaskAttempt } from "@may-agent/sdk";
import { taskIntentForInput } from "../../../evaluation.app/app.ts";
import { createCodexGoalPocExecutor } from "../../src/app/codex-goal-poc-executor.js";

const focus =
  process.argv.slice(2).join(" ").trim() ||
  "Check whether evaluation.app's manual Codex goal trial is bounded, read-only, and isolated from scheduled project reviews.";
const intent = taskIntentForInput({
  kind: "codex-goal-trial",
  data: { targetProject: "evaluation.app", focus },
});
if (!intent || intent.executor !== "codex-goal-poc") throw new Error("evaluation.app did not produce the trial Task");

const root = join(tmpdir(), `may-codex-goal-app-trial-${process.pid}`);
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });
const startedAt = performance.now();
const progressEvents: Array<{
  localKey: string;
  event: AppEvent<Record<string, unknown>>;
}> = [];
const attempt: TaskAttempt = {
  appId: "evaluation",
  attemptId: `trial-${process.pid}`,
  resourceVersion: 1,
  task: {
    id: intent.id,
    parentId: intent.parentId,
    generation: 1,
    status: "running",
    outcome: intent.outcome,
    acceptance: intent.acceptance,
    mode: intent.mode,
    agent: intent.agent,
    executor: intent.executor,
    input: intent.input ?? {},
    priority: intent.priority,
    category: intent.category,
    conditions: [],
  },
  cwd: resolve(import.meta.dir, "../../../evaluation.app"),
  events: { items: [], truncated: false },
  async publish(localKey, event) {
    progressEvents.push({ localKey, event });
    return { eventId: progressEvents.length };
  },
  onEvent() {
    return () => {};
  },
};

try {
  const result = await createCodexGoalPocExecutor({ stateFile: join(root, "bindings.json") })(attempt);
  process.stdout.write(
    `${JSON.stringify(
      {
        appId: attempt.appId,
        taskId: attempt.task.id,
        executor: attempt.task.executor,
        sandbox: "read-only",
        elapsedMs: Math.round(performance.now() - startedAt),
        progressEvents,
        result,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
