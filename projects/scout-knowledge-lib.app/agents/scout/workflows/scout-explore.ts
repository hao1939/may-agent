/**
 * Scout explore — routine discovery cron task.
 *
 * Called by cron with a source-specific task (arXiv, HN, XHS, GitHub).
 * No gates, no heartbeat context loading — just runs the agent with the task.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  resolveTaskTreePath,
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  checkCircuitBreaker,
  recordCircuitOutcome,
  shouldDispatch,
  recordDispatch,
  recordDedupOutcome,
  cleanupDispatchRecords,
} from "@may-agent/sdk";
import { resolve } from "node:path";

export const name = "scout-explore";
export const description =
  "Routine discovery — fetch and process a specific source.";

export function buildExploreTask(task: string): string {
  return `${task}

Output contract:
- Durable Scout notes and findings belong under \`projects/scout-knowledge-lib/knowledge/\`.
- Source-level findings belong under \`projects/scout-knowledge-lib/knowledge/findings/\`.
- Run-level drafts may go under \`projects/scout-knowledge-lib.app/agents/scout/workspace/findings/\`.
- Append short user-facing highlights to \`projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md\` when useful.
- Search existing Scout knowledge files first and update an existing topical file when the topic already exists.
- Never create new top-level folders under \`projects/\`. In particular, do not write paths like \`projects/explore/...\`, \`projects/research/...\`, or \`projects/docs/...\`.
- If none of the allowed output roots fit, finish with a blocker explaining the missing destination instead of inventing a folder.
`;
}

function reconciliationPacket(task: string): Record<string, unknown> {
  const marker = "## Reconciliation Task";
  const markerIndex = task.indexOf(marker);
  if (markerIndex < 0) return {};
  const fenced = task.slice(markerIndex + marker.length);
  const start = fenced.indexOf("```json");
  if (start < 0) return {};
  const jsonStart = start + "```json".length;
  const end = fenced.indexOf("```", jsonStart);
  if (end < 0) return {};
  try {
    const value = JSON.parse(fenced.slice(jsonStart, end).trim());
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function xhsWaitResult(
  task: string,
  tree: Record<string, unknown>,
): ProjectAppTaskHandlerResult | null {
  const packet = reconciliationPacket(task);
  const input =
    packet.input &&
    typeof packet.input === "object" &&
    !Array.isArray(packet.input)
      ? (packet.input as Record<string, unknown>)
      : {};
  if (String(input.source ?? "").toLowerCase() !== "xhs") return null;

  const tasks =
    tree.tasks && typeof tree.tasks === "object" && !Array.isArray(tree.tasks)
      ? (tree.tasks as Record<string, Record<string, unknown>>)
      : {};
  const blocker = tasks["xhs-cookie-refresh-blocked"];
  const blockerState = String(blocker?.state ?? blocker?.status ?? "missing");
  if (["done", "accepted", "superseded", "cancelled"].includes(blockerState)) {
    return null;
  }

  const summary =
    "XHS exploration is waiting for the existing cookie-refresh task; no source agent was started.";
  return {
    disposition: "waiting",
    summary,
    evidence: [
      `xhs-cookie-refresh-blocked is ${blockerState}`,
      "The source lane remains gated before agent dispatch.",
    ],
    actions: [],
    conditions: [
      {
        id: "task-done:xhs-cookie-refresh-blocked",
        observer: "project.task.reconciled",
        taskId: "xhs-cookie-refresh-blocked",
        expectedState: "done",
      },
    ],
  };
}

function currentXhsWait(task: string): ProjectAppTaskHandlerResult | null {
  const treePath = resolveTaskTreePath("/app/projects/scout-knowledge-lib.app");
  if (!existsSync(treePath)) return null;
  try {
    return xhsWaitResult(
      task,
      JSON.parse(readFileSync(treePath, "utf-8")) as Record<string, unknown>,
    );
  } catch {
    return null;
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";
  const agentsRoot =
    ctx.agentsRoot || resolve(import.meta.dirname ?? ".", "../..");

  const waiting = currentXhsWait(ctx.task);
  if (waiting) return ctx.done(waiting.summary, waiting);

  // Circuit breaker + dedup
  const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
  if (circuitBlock) {
    return ctx.done(`Circuit breaker OPEN: ${circuitBlock}`);
  }
  const dedupCheck = shouldDispatch(agent, "explore");
  if (!dedupCheck.allowed) {
    return ctx.done(`Dedup blocked: ${dedupCheck.reason}`);
  }
  recordDispatch(agent, "explore");
  cleanupDispatchRecords();

  // The task comes from the workflow-backed handler config — source-specific instructions
  const task =
    ctx.task || "Explore sources and update the Scout knowledge library.";
  const agentTask = buildExploreTask(task);

  let result: any;
  try {
    result = await ctx.runAgent(agent, agentTask);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordCircuitOutcome(
      agentsRoot,
      agent,
      true,
      `explore threw: ${message.slice(0, 200)}`,
    );
    recordDedupOutcome(agent, "explore", "error");
    throw err;
  }

  recordCircuitOutcome(
    agentsRoot,
    agent,
    result.status === "error",
    result.status === "error" ? "explore error" : undefined,
  );
  recordDedupOutcome(
    agent,
    "explore",
    result.status === "error" ? "error" : "success",
  );

  return ctx.done(ctx.summarize(result, { maxLength: 500 }));
}
