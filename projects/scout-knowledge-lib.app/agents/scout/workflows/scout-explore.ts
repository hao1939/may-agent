/**
 * Scout explore — routine discovery cron task.
 *
 * Called by cron with a source-specific task (arXiv, HN, XHS, GitHub).
 * No gates, no heartbeat context loading — just runs the agent with the task.
 */
import { isAbsolute, resolve, sep } from "node:path";
import {
  type ProjectAppTaskHandlerResult,
  Type,
  type WorkflowContext,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  inspectXhsCredential,
  type XhsCredentialStatus,
} from "../tools/xhs-credential.js";
import {
  searchXhs,
  type XhsSearchItem,
  type XhsSearchResult,
} from "../tools/xhs-source.js";

type TaskHandlerResult = Exclude<
  ProjectAppTaskHandlerResult,
  { state: "needs-owner" }
>;

export const name = "scout-explore";
export const description =
  "Routine discovery — fetch and process a specific source.";

const defaultAppDir = "/app/projects/scout-knowledge-lib.app";
const defaultProjectDir = "/app/projects/scout-knowledge-lib";
const defaultXhsQuery = "AI agent 智能体";

const ExploreAgentResultSchema = Type.Object({
  summary: Type.String({ minLength: 1 }),
  evidence: Type.Array(Type.String()),
  outputs: Type.Array(Type.String()),
});

type ExploreAgentResult = {
  summary: string;
  evidence: string[];
  outputs: string[];
};

export type ScoutExploreDependencies = {
  inspectXhsCredential(appDir: string): XhsCredentialStatus;
  searchXhs(appDir: string, query: string): XhsSearchResult;
};

const defaultDependencies: ScoutExploreDependencies = {
  inspectXhsCredential,
  searchXhs,
};

export function buildExploreTask(
  task: string,
  paths: { appDir: string; projectDir: string } = {
    appDir: defaultAppDir,
    projectDir: defaultProjectDir,
  },
  xhsPacket?: { query: string; items: XhsSearchItem[] },
): string {
  const source = reconciliationSource(task);
  const sourceContract =
    source === "xhs"
      ? `
XHS execution contract:
- The workflow already performed the current live status and search calls. Do not infer current access from old blocked findings, cookie-file timestamps, or legacy cookie paths.
- Use the current source packet below as the discovery starting point. Read returned links with the XHS tool when more detail is needed.
- Only write a finding when current source content supports it. Never create or update a blocked-scan knowledge or digest artifact from stale notes.

Current XHS source packet:
\`\`\`json
${JSON.stringify(xhsPacket ?? { query: "missing", items: [] }, null, 2)}
\`\`\`
`
      : "";
  const resultContract =
    source === "xhs"
      ? `
Result contract:
- Return summary, evidence, and outputs through finish().
- List every created or updated file as an absolute path in outputs.
- For an evidence-backed no-op, return outputs: [].
`
      : "";

  return `${task}${sourceContract}

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
${resultContract}`;
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

function xhsAccessEvidence(credential: XhsCredentialStatus): string[] {
  return [`access:${credential.state}`, ...credential.evidence];
}

function admittedOutputPaths(
  outputs: string[],
  paths: { appDir: string; projectDir: string },
): string[] | null {
  const roots = [
    resolve(paths.projectDir, "knowledge"),
    resolve(paths.appDir, "agents", "scout", "workspace"),
  ];
  const normalized = outputs.map((output) => output.trim()).filter(Boolean);
  if (normalized.some((output) => !isAbsolute(output))) return null;
  const resolved = normalized.map((output) => resolve(output));
  return resolved.every((output) =>
    roots.some((root) => output.startsWith(`${root}${sep}`)),
  )
    ? resolved
    : null;
}

export async function executeScoutExplore(
  ctx: WorkflowContext,
  dependencies: ScoutExploreDependencies = defaultDependencies,
): Promise<WorkflowResult> {
  const agent = "scout";
  const appDir = ctx.appDir ?? defaultAppDir;
  const projectDir = ctx.projectDir ?? defaultProjectDir;
  const source = reconciliationSource(ctx.task);
  let xhsPacket: { query: string; items: XhsSearchItem[] } | undefined;
  let sourceEvidence: string[] = [];

  if (source === "xhs") {
    const credential = dependencies.inspectXhsCredential(appDir);
    const waiting = xhsWaitResult(ctx.task, credential);
    if (waiting) return ctx.done(waiting.summary, waiting);

    const search = dependencies.searchXhs(appDir, defaultXhsQuery);
    sourceEvidence = [...xhsAccessEvidence(credential), ...search.evidence];
    if (search.state === "failed") {
      return ctx.blocked(`XHS search failed: ${search.reason}`, {
        evidence: sourceEvidence,
      });
    }
    if (search.items.length === 0) {
      const summary = `XHS search for "${search.query}" returned no current source items; no artifact was created.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [...sourceEvidence, "result:evidence-backed-no-op"],
        actions: [],
      } satisfies TaskHandlerResult);
    }
    xhsPacket = { query: search.query, items: search.items.slice(0, 20) };
  }

  // The task comes from the workflow-backed handler config — source-specific instructions
  const task =
    ctx.task || "Explore sources and update the Scout knowledge library.";
  const agentTask = buildExploreTask(task, { appDir, projectDir }, xhsPacket);

  const result =
    source === "xhs"
      ? await ctx.runAgent(agent, agentTask, {
          schema: ExploreAgentResultSchema,
        })
      : await ctx.runAgent(agent, agentTask);

  if (result.status === "error" || result.status === "interrupted") {
    return ctx.blocked("Scout exploration session failed", {
      sessionId: result.sessionId,
      status: result.status,
      summary: result.lastAssistantText,
    });
  }
  if (source === "xhs") {
    const structured = result.structuredResult as ExploreAgentResult;
    const outputs = admittedOutputPaths(structured.outputs, {
      appDir,
      projectDir,
    });
    if (!outputs) {
      return ctx.blocked(
        "Scout exploration returned an output outside the allowed roots",
        {
          outputs: structured.outputs,
        },
      );
    }
    return ctx.done(structured.summary, {
      state: "converged",
      summary: structured.summary,
      evidence: [
        ...new Set([
          ...sourceEvidence,
          ...structured.evidence,
          ...outputs.map((output) => `output:${output}`),
          ...(result.sessionId ? [`session:${result.sessionId}`] : []),
        ]),
      ],
      actions: [],
    } satisfies TaskHandlerResult);
  }
  const summary = ctx.summarize(result, { maxLength: 500 });
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`session:${result.sessionId}`],
    actions: [],
  });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return executeScoutExplore(ctx);
}
