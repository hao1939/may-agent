import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eventData, type AgentEvent, type EventBus, type EventTrace } from "./event-bus.js";

export type TaskCliTool = "codex" | "claude";

export type TaskCliExecution =
  | { status: "completed"; cliTaskId: string; result: unknown; resultPath: string; evidence: string[] }
  | { status: "failed"; cliTaskId: string; summary: string; evidence: string[] };

function cliTaskId(input: {
  appId: string;
  taskId: string;
  generation: number;
  attemptId: string;
  tool: TaskCliTool;
}): string {
  const digest = createHash("sha256")
    .update(`${input.appId}\0${input.taskId}\0${input.generation}\0${input.attemptId}\0${input.tool}`)
    .digest("hex")
    .slice(0, 24);
  return `reconcile_${digest}`;
}

/**
 * Thin adapter from one fenced Task attempt to the existing asynchronous CLI
 * worker. CLI process/session records are evidence; the caller still owns the
 * only Task result admission.
 */
export async function executeTaskWithCli(input: {
  bus: EventBus;
  persistDir: string;
  appId: string;
  taskId: string;
  generation: number;
  attemptId: string;
  owner: string;
  tool: TaskCliTool;
  cwd: string;
  prompt: string;
  timeoutMs: number;
  trace?: EventTrace;
}): Promise<TaskCliExecution> {
  const id = cliTaskId(input);
  const root = join(input.persistDir, "cli-tasks", id);
  const promptPath = join(root, "prompt.md");
  const resultPath = join(root, "result.md");
  const structuredResultPath = join(root, "runner-result.json");
  const eventsPath = join(root, "events.jsonl");
  mkdirSync(root, { recursive: true });
  writeFileSync(promptPath, input.prompt);

  return await new Promise<TaskCliExecution>((resolve) => {
    let settled = false;
    const finish = (result: TaskCliExecution): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      resolve(result);
    };
    const unsubscribe = input.bus.listen(
      (event) => {
        if (!["cli.task.completed", "cli.task.failed", "cli.task.orphaned"].includes(event.type)) return;
        const data = eventData(event) as Record<string, unknown>;
        if (data.taskId !== id) return;
        const evidence = [
          `cli-task:${id}`,
          ...(typeof data.resultPath === "string" ? [`cli-result:${data.resultPath}`] : []),
          ...(typeof data.eventsPath === "string" ? [`cli-events:${data.eventsPath}`] : []),
          ...(typeof data.cliSessionId === "string" ? [`cli-session:${data.cliSessionId}`] : []),
        ];
        if (event.type !== "cli.task.completed") {
          const summary =
            typeof data.error === "string"
              ? data.error
              : typeof data.reason === "string"
                ? data.reason
                : `${input.tool} CLI execution failed`;
          finish({ status: "failed", cliTaskId: id, summary, evidence });
          return;
        }
        try {
          const terminalPath = typeof data.resultPath === "string" ? data.resultPath : resultPath;
          finish({
            status: "completed",
            cliTaskId: id,
            result: JSON.parse(readFileSync(terminalPath, "utf8")),
            resultPath: terminalPath,
            evidence,
          });
        } catch (error) {
          finish({
            status: "failed",
            cliTaskId: id,
            summary: `${input.tool} CLI returned an invalid Task result: ${error instanceof Error ? error.message : String(error)}`,
            evidence,
          });
        }
      },
      { label: `task-cli:${id}`, types: ["cli.task.completed", "cli.task.failed", "cli.task.orphaned"] },
    );
    const timeout = setTimeout(
      () =>
        finish({
          status: "failed",
          cliTaskId: id,
          summary: `${input.tool} CLI did not report a terminal result within ${input.timeoutMs}ms`,
          evidence: [`cli-task:${id}`],
        }),
      input.timeoutMs + 5_000,
    );
    timeout.unref?.();

    try {
      input.bus.emit({
        type: "cli.task.requested",
        source: `app-task:${input.appId}`,
        owner: `agent:${input.owner}`,
        data: {
          taskId: id,
          tool: input.tool,
          mode: "patch",
          cwd: input.cwd,
          promptPath,
          resultPath,
          structuredResultPath,
          eventsPath,
          sandbox: "danger-full-access",
          timeoutMs: input.timeoutMs,
          sourceOwner: `agent:${input.owner}`,
          expectedOutput: { format: "json", requiredFields: ["state", "summary", "evidence"] },
        },
        ...(input.trace ? { trace: input.trace } : {}),
      } as AgentEvent);
    } catch (error) {
      finish({
        status: "failed",
        cliTaskId: id,
        summary: `Could not admit ${input.tool} CLI execution: ${error instanceof Error ? error.message : String(error)}`,
        evidence: [],
      });
    }
  });
}
