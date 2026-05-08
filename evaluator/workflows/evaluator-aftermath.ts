/// <reference path="../../types/workflow-defs.d.ts" />

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const name = "evaluator-aftermath";
export const description = "Evaluate session aftermath, cancel stale running sessions, and drive repair/learning.";
export const HEURISTIC_VERSION = 2;

function extractTrigger(task: string): any {
  const match = task.match(/## Trigger Event\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function transcriptIssues(transcript: string): string[] {
  const issues: string[] = [];
  const hasLiveRuntimeSignals = /## Live Runtime Signals \(workflow-collected\)[\s\S]{0,800}?Status: available/.test(transcript);
  const liveRuntimeSignalsUnavailable = /## Live Runtime Signals \(workflow-collected\)[\s\S]{0,800}?Status: unavailable/.test(transcript);

  if (transcript.includes("finish() blocked [uncommitted changes]")) {
    issues.push("finish blocked by uncommitted changes");
  }
  if (/no such column:/i.test(transcript)) {
    issues.push("schema/query error in transcript");
  }
  if (/git\s+add\s+may\/\s+shared\/\s+&&\s+git\s+commit/.test(transcript)) {
    issues.push("broad may/shared commit during session");
  }
  if (/last-session\.md/.test(transcript) && /gate-outcomes\.log/.test(transcript) && /git\s+commit/.test(transcript)) {
    issues.push("committed generated runtime files");
  }
  if (liveRuntimeSignalsUnavailable) {
    issues.push("workflow live signal injection unavailable");
  }
  if (/\ball P[01] metrics (?:are )?(?:in range|healthy|green|at target)\b/i.test(transcript) && !/"name":"query_db"/.test(transcript) && !hasLiveRuntimeSignals) {
    issues.push("metric health claim without live evidence");
  }

  return issues;
}

export function classifyVerdict(session: any, transcript = ""): { quality: number; efficiency: number; verdict: string; issues: string[] } {
  const issues: string[] = [];
  const status = String(session?.status ?? "unknown");
  const opCount = Number(session?.opCount ?? 0);

  if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
  if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);
  if (opCount > 0 && opCount < 3 && status === "done") issues.push(`shallow session: ${opCount} ops`);
  issues.push(...transcriptIssues(transcript));

  const failed = status === "error" || status === "interrupted" || !!session?.error;
  return {
    quality: failed ? 0.2 : issues.length ? 0.55 : 0.85,
    efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8,
    verdict: failed || issues.length ? "needs_improvement" : "good",
    issues,
  };
}

export function evaluationHeuristicVersion(evaluation: any): number {
  if (!evaluation?.overall) return 0;
  try {
    const parsed = typeof evaluation.overall === "string" ? JSON.parse(evaluation.overall) : evaluation.overall;
    const version = Number(parsed?.heuristicVersion ?? 0);
    return Number.isFinite(version) ? version : 0;
  } catch {
    return 0;
  }
}

export function shouldRefreshEvaluation(evaluation: any, heuristic: { verdict: string; issues: string[] }): boolean {
  if (!evaluation) return true;
  if (String(evaluation.verdict) !== "good") return false;
  if (evaluationHeuristicVersion(evaluation) >= HEURISTIC_VERSION) return false;
  return true;
}

function getSessionIdFromTrigger(trigger: any): string | undefined {
  const data = trigger?.data ?? trigger ?? {};
  const direct = data.sessionId;
  const nested = data.session?.sessionId;
  return typeof direct === "string" ? direct : typeof nested === "string" ? nested : undefined;
}

function getModeFromTrigger(trigger: any): string {
  const data = trigger?.data ?? trigger ?? {};
  return typeof data.mode === "string" ? data.mode : "completed";
}

function firstText(result: any): string {
  return String(result?.lastAssistantText ?? result?.output ?? "{}");
}

function sessionTranscriptPath(persistDir: string, sessionId: string): string {
  const activePath = join(persistDir, "sessions", sessionId, "session.jsonl");
  if (existsSync(activePath)) return activePath;
  return join(persistDir, "sessions", "history", sessionId, "session.jsonl");
}

function readSessionTranscript(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, "utf-8") : "";
  } catch {
    return "";
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = extractTrigger(String(ctx.task ?? ""));
  const sessionId = getSessionIdFromTrigger(trigger);
  const mode = getModeFromTrigger(trigger);

  if (!sessionId) {
    return ctx.escalate("evaluator-aftermath requires a sessionId", { trigger });
  }

  const loaded = await (ctx as any).runFunction("load-session", async () => {
    const db = ctx.getDb() as any;
    const session = db.prepare("SELECT * FROM sessions WHERE sessionId = ?").get(sessionId);
    const evaluation = db.prepare("SELECT sessionId, verdict, overall, createdAt FROM evaluations WHERE sessionId = ?").get(sessionId);
    return JSON.stringify({ session, evaluation });
  });

  const loadedData = JSON.parse(firstText(loaded));
  const session = loadedData.session;
  const evaluation = loadedData.evaluation;
  if (!session) return ctx.escalate(`Session ${sessionId} not found`);

  if (session.agent === "evaluator" || session.agent === "judge") {
    return ctx.done(`Skipped self/judge session ${sessionId}.`);
  }

  const ageMs = Date.now() - Number(session.startedAt ?? Date.now());
  if (mode === "stale-running" || ["running", "idle"].includes(String(session.status))) {
    ctx.emit({
      type: "cancel",
      sessionId,
      reason: "evaluator-aftermath stale running session watchdog",
    } as any);
    ctx.emit({
      type: "session.watchdog.cancelled",
      sessionId,
      agent: session.agent,
      ageMs,
      owner: "evaluator",
    } as any);
    return ctx.done(`Cancelled stale ${session.status} session ${sessionId} (${session.agent}), age ${Math.round(ageMs / 60000)}m.`);
  }

  const projectRoot = String(ctx.projectRoot ?? "/app");
  const persistDir = String((ctx as any).persistDir ?? join(projectRoot, ".state"));
  const transcriptPath = sessionTranscriptPath(persistDir, sessionId);
  const transcript = readSessionTranscript(transcriptPath);
  const heuristic = classifyVerdict(session, transcript);
  const artifactPath = `agents/evaluator/workspace/aftermath/${sessionId}.md`;

  if (!shouldRefreshEvaluation(evaluation, heuristic)) {
    return ctx.done(`Session ${sessionId} already evaluated (${evaluation.verdict}).`);
  }

  await (ctx as any).runFunction("record-evaluation", async () => {
    const db = ctx.getDb() as any;
    db.run(
      `INSERT OR REPLACE INTO evaluations (
        sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
        verdict, issues, overall, usage, failureChains,
        evaluatedByHeuristic, skippedByJs, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        session.agent,
        heuristic.quality,
        heuristic.efficiency,
        Math.max(0, Number(session.opCount ?? 0) - heuristic.issues.length),
        heuristic.issues.length,
        heuristic.verdict,
        JSON.stringify(heuristic.issues),
        JSON.stringify({
          verdict: heuristic.verdict,
          status: session.status,
          aftermathWorkflow: true,
          heuristicVersion: HEURISTIC_VERSION,
          ...(evaluation ? { refreshedFrom: evaluation.verdict } : {}),
          ...(heuristic.verdict === "good" ? {} : { artifactPath }),
        }),
        null,
        JSON.stringify([]),
        1,
        0,
        Date.now(),
      ],
    );
    return `recorded ${heuristic.verdict} evaluation for ${sessionId}`;
  });

  if (heuristic.verdict === "good") {
    return ctx.done(`Evaluated ${sessionId}: good. No review needed.`);
  }

  mkdirSync(join(projectRoot, "agents/evaluator/workspace/aftermath"), { recursive: true });

  const reviewTask = [
    `Review session aftermath for ${sessionId}.`,
    ``,
    `Session: ${JSON.stringify(session, null, 2)}`,
    `Transcript path: ${transcriptPath}`,
    `Write your concise review to: ${artifactPath}`,
    ``,
    `Do exactly this loop:`,
    `1. Evaluate outcome quality from transcript evidence, not self-claims.`,
    `2. Write the concise review to the artifact path above.`,
    `3. Immediately call read() on that same artifact path and confirm the file contains the required sections.`,
    `4. If root cause is obvious and low-risk, fix it now; verify any additional edit by reading/checking it too.`,
    `5. If blocked/high-risk, escalate with a real agent recipient (for example may, arc, dev, scout, coach) or an escalation note in the artifact. NEVER use functions.message as a recipient; if no message/notify tool is available, do not fake it — write the escalation note and finish(partial).`,
    `6. If there is reusable learning, update the right agent context/knowledge file.`,
    `7. Only then call finish(success); the verify-after-write guard rejects success if the artifact was written but not read back.`,
    ``,
    `Keep the artifact short with sections: Verdict, Evidence, Root Cause, Action Taken, Learning.`,
  ].join("\n");

  const review = await ctx.runAgent("evaluator", reviewTask);

  if ((review as any).status === "error") {
    return ctx.escalate(`Evaluator review failed for ${sessionId}`, { reviewSessionId: (review as any).sessionId });
  }

  return ctx.done(`Evaluated ${sessionId}: ${heuristic.verdict}. Review session: ${(review as any).sessionId}. Artifact: ${artifactPath}`);
}
