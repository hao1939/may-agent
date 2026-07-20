/**
 * Scout explore — routine discovery cron task.
 *
 * Called by cron with a source-specific task (arXiv, HN, XHS, GitHub).
 * No gates, no heartbeat context loading — just runs the agent with the task.
 */
import {
  type ProjectAppTaskHandlerResult,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../tools/xhs-credential.js";

type TaskHandlerResult = Exclude<
  ProjectAppTaskHandlerResult,
  { state: "needs-owner" }
>;

export const name = "scout-explore";
export const description =
  "Routine discovery — fetch and process a specific source.";

const defaultAppDir = "/app/projects/scout-knowledge-lib.app";
const defaultProjectDir = "/app/projects/scout-knowledge-lib";

export function buildExploreTask(
  task: string,
  paths: { appDir: string; projectDir: string } = {
    appDir: defaultAppDir,
    projectDir: defaultProjectDir,
  },
): string {
  return `${task}

Output contract:
- Durable Scout notes and findings belong under \`${paths.projectDir}/knowledge/\`.
- Source-level findings belong under \`${paths.projectDir}/knowledge/findings/\`.
- Run-level drafts may go under \`${paths.appDir}/agents/scout/workspace/findings/\`.
- Append short user-facing highlights to \`${paths.appDir}/agents/scout/workspace/digest/today.md\` when useful.
- Search existing Scout knowledge files first and update an existing topical file when the topic already exists.
- Treat these absolute roots as authoritative. Never prepend \`projects/scout-knowledge-lib\` to the current working directory.
- Never create new top-level folders under \`projects/\`. In particular, do not write paths like \`projects/explore/...\`, \`projects/research/...\`, or \`projects/docs/...\`.
- If none of the allowed output roots fit, finish with a blocker explaining the missing destination instead of inventing a folder.
- DATE RULE: Filename dates and internal Date/last_updated fields MUST NOT be later than today. Run \`date -u +%Y-%m-%d\` to get the current date. Never derive dates from scan numbers or arithmetic.
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

function reconciliationSource(task: string): string {
  const packet = reconciliationPacket(task);
  const input =
    packet.input &&
    typeof packet.input === "object" &&
    !Array.isArray(packet.input)
      ? (packet.input as Record<string, unknown>)
      : {};
  return String(input.source ?? "").toLowerCase();
}

export function xhsWaitResult(
  task: string,
  credential: XhsCredentialStatus,
): TaskHandlerResult | null {
  if (reconciliationSource(task) !== "xhs") return null;
  if (credential.state === "ready") return null;

  const summary =
    "XHS exploration is waiting for the browser credential to become ready; no source agent was started.";
  return {
    state: "waiting",
    summary,
    evidence: [
      credential.reason,
      ...credential.evidence,
      "The source lane remains gated before agent dispatch.",
    ],
    actions: [],
    conditions: [
      {
        id: "credential-ready:xhs",
        type: "credential.ready",
        subject: "credential:xhs",
        expected: { field: "state", equals: "ready" },
      },
    ],
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agent = "scout";
  const appDir = ctx.appDir ?? defaultAppDir;
  const projectDir = ctx.projectDir ?? defaultProjectDir;

  if (reconciliationSource(ctx.task) === "xhs") {
    const waiting = xhsWaitResult(ctx.task, inspectXhsCredential(appDir));
    if (waiting) return ctx.done(waiting.summary, waiting);
  }

  // The task comes from the workflow-backed handler config — source-specific instructions
  const task =
    ctx.task || "Explore sources and update the Scout knowledge library.";
  const agentTask = buildExploreTask(task, { appDir, projectDir });

  const result = await ctx.runAgent(agent, agentTask);

  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Scout exploration session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }
  const summary = ctx.summarize(result, { maxLength: 500 });
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`session:${result.sessionId}`],
    actions: [],
  });
}
