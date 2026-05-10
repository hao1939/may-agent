/// <reference path="../../types/workflow-defs.d.ts" />

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const name = "evaluator-aftermath";
export const description = "Evaluate session aftermath, cancel stale running sessions, and drive repair/learning.";
export const HEURISTIC_VERSION = 6;

export type EvaluationLane = "needs_triage" | "success_candidate" | "routine_ok";

type TranscriptView = {
  text: string;
  liveEvidenceText: string;
  userText: string;
  toolCallCount?: number;
};

type HeuristicVerdict = {
  quality: number;
  efficiency: number;
  verdict: string;
  issues: string[];
};

type EvaluationRoute = {
  lane: EvaluationLane;
  reason: string;
  signals: string[];
};

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
  const view = sessionOwnedTranscriptView(transcript);
  const ownText = view.text;
  const liveText = view.liveEvidenceText;
  const taskText = view.userText;
  const hasLiveRuntimeSignals = /## Live Runtime Signals \(workflow-collected\)[\s\S]{0,800}?Status: available/.test(liveText);
  const liveRuntimeSignalsUnavailable = /## Live Runtime Signals \(workflow-collected\)[\s\S]{0,800}?Status: unavailable/.test(liveText);

  if (ownText.includes("finish() blocked [uncommitted changes]")) {
    issues.push("finish blocked by uncommitted changes");
  }
  if (hasUnresolvedSchemaQueryIssue(transcript, ownText)) {
    issues.push("schema/query error in transcript");
  }
  if (/git\s+add\s+may\/\s+shared\/\s+&&\s+git\s+commit/.test(ownText)) {
    issues.push("broad may/shared commit during session");
  }
  if (/last-session\.md/.test(ownText) && /gate-outcomes\.log/.test(ownText) && /git\s+add[^;\n]*(last-session\.md|gate-outcomes\.log|may\/\s+shared\/)[\s\S]{0,240}git\s+commit/.test(ownText)) {
    issues.push("committed generated runtime files");
  }
  if (liveRuntimeSignalsUnavailable) {
    issues.push("workflow live signal injection unavailable");
  }
  if (/\ball P[01] metrics (?:are )?(?:in range|healthy|green|at target)\b/i.test(ownText) && !/"name":"query_db"/.test(ownText) && !hasLiveRuntimeSignals) {
    issues.push("metric health claim without live evidence");
  }

  const forbiddenPaths = forbiddenEditPathsFromTask(taskText);
  if (forbiddenPaths.length > 0) {
    const editedForbidden = editedForbiddenPaths(ownText, forbiddenPaths);
    if (editedForbidden.length > 0) {
      issues.push(`constraint violation: edited forbidden path(s): ${editedForbidden.join(", ")}`);
    }
  }

  return issues;
}

function forbiddenEditPathsFromTask(text: string): string[] {
  const paths = new Set<string>();
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lower = line.toLowerCase();
    if (!/(forbidden|cannot|must not|do not|don't|no edits?|not edit|never edit)/.test(lower)) continue;

    for (const match of line.matchAll(/(?:\/app\/|\.state\/|src\/|agents\/)?[\w.-]+(?:\/[\w.-]+)+/g)) {
      const raw = match[0].replace(/[).,;:'\"]+$/, "");
      if (looksLikeConcreteForbiddenPath(raw)) paths.add(raw);
    }
    for (const match of line.matchAll(/\b[A-Z][A-Z0-9_-]*\.md\b/g)) {
      paths.add(match[0]);
    }
  }
  return [...paths];
}

function looksLikeConcreteForbiddenPath(candidate: string): boolean {
  if (!candidate.includes("/")) return false;
  if (candidate.startsWith("/app/") || candidate.startsWith("agents/") || candidate.startsWith("src/") || candidate.startsWith(".state/")) {
    return true;
  }
  return /\/[^/\s]+\.[A-Za-z0-9._-]+$/.test(candidate);
}

function editedForbiddenPaths(ownText: string, forbiddenPaths: string[]): string[] {
  const edited = new Set<string>();
  const canonicalForbiddenPaths = canonicalizeForbiddenPaths(forbiddenPaths);
  const editJsonPattern = /\{"name":"(?:write|edit|apply_patch)","arguments":\{[^\n]*?"(?:path|filePath)":"([^"]+)"/g;
  for (const match of ownText.matchAll(editJsonPattern)) {
    const editedPath = match[1] ?? "";
    for (const forbidden of canonicalForbiddenPaths) {
      if (pathMatchesForbidden(editedPath, forbidden)) edited.add(forbidden);
    }
  }

  for (const forbidden of canonicalForbiddenPaths) {
    const escaped = escapeRegExp(forbidden);
    if (new RegExp(`\\b(?:M|A|AM|MM)\\s+[^\\n]*${escaped}(?:\\s|$)`).test(ownText)) {
      edited.add(forbidden);
    }
  }

  return [...edited];
}

function canonicalizeForbiddenPaths(forbiddenPaths: string[]): string[] {
  return forbiddenPaths.filter((candidate) => {
    if (isRuntimeLastSessionPath(candidate)) return false;
    if (candidate.includes("/")) return true;
    return !forbiddenPaths.some((other) => other !== candidate && !isRuntimeLastSessionPath(other) && pathMatchesForbidden(other, candidate));
  });
}

function isRuntimeLastSessionPath(candidate: string): boolean {
  return candidate === "last-session.md" || candidate.endsWith("/last-session.md");
}

function pathMatchesForbidden(editedPath: string, forbiddenPath: string): boolean {
  if (!editedPath || !forbiddenPath) return false;
  return editedPath === forbiddenPath || editedPath.endsWith(`/${forbiddenPath}`) || editedPath.endsWith(forbiddenPath);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasUnresolvedSchemaQueryIssue(transcript: string, ownText: string): boolean {
  const records = parseJsonlTranscript(transcript);
  if (records) {
    let lastSchemaError = -1;
    let lastRecoveringQuery = -1;
    let queryIndex = 0;

    for (const record of records) {
      if (record?.role !== "toolResult" || record?.toolName !== "query_db") continue;
      const text = contentText(record.content);
      const isSchemaError =
        record?.isError === true || /"error"\s*:\s*"(?:[^"]*no such (?:column|table)[^"]*)"/i.test(text);

      if (isSchemaError) lastSchemaError = queryIndex;
      else lastRecoveringQuery = queryIndex;
      queryIndex += 1;
    }

    if (lastSchemaError !== -1) return lastSchemaError > lastRecoveringQuery;
    return false;
  }

  const lastSchemaError = Math.max(ownText.lastIndexOf("no such column:"), ownText.lastIndexOf("no such table:"));
  if (lastSchemaError === -1) return false;

  const afterLastSchemaError = ownText.slice(lastSchemaError);
  return !/\{"name":"query_db","arguments":\{/.test(afterLastSchemaError);
}

function hasUnresolvedFinishBlockedIssue(ownText: string): boolean {
  const lastFinishBlocked = ownText.lastIndexOf("finish() blocked [uncommitted changes]");
  if (lastFinishBlocked === -1) return false;

  const afterLastFinishBlocked = ownText.slice(lastFinishBlocked + "finish() blocked [uncommitted changes]".length);
  return !/\{"name":"finish","arguments":\{/.test(afterLastFinishBlocked);
}

function finishBlockedByUncommittedChanges(transcript: string): boolean {
  return sessionOwnedTranscriptView(transcript).text.includes("finish() blocked [uncommitted changes]");
}

function sessionSelfRepairedOrCleanlyExited(session: any, transcript: string): boolean {
  const status = String(session?.status ?? "unknown");
  if (status === "error" || status === "interrupted" || session?.error) return false;

  const view = sessionOwnedTranscriptView(transcript);
  const ownText = view.text;
  if (!ownText.includes("finish() blocked [uncommitted changes]")) return false;

  const postBlockedText = ownText.slice(ownText.lastIndexOf("finish() blocked [uncommitted changes]"));
  if (/"name":"finish","arguments":\{[^\n]*"status":"(?:success|partial|blocked|failure)"/.test(postBlockedText)) return true;

  return /\bgit\s+commit\b/.test(postBlockedText) && /(?:\bgit\s+status\s+--short\b|\bgit\s+status\b)/.test(postBlockedText);
}

function contentText(content: any): string {
  if (Array.isArray(content)) return content.map((part) => String(part?.text ?? "")).filter(Boolean).join("\n");
  return typeof content === "string" ? content : "";
}

function toolCalls(content: any): any[] {
  return Array.isArray(content) ? content.filter((part) => part?.type === "toolCall" && typeof part?.name === "string") : [];
}

function parseJsonlTranscript(transcript: string): any[] | null {
  const lines = transcript.split(/\n/).filter((line) => line.trim().startsWith("{"));
  if (lines.length === 0) return null;
  const parsed: any[] = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      return null;
    }
  }
  return parsed.length > 0 ? parsed : null;
}

function sessionOwnedTranscriptView(transcript: string): TranscriptView {
  const records = parseJsonlTranscript(transcript);
  if (!records) return { text: transcript, liveEvidenceText: transcript, userText: transcript };

  const own: string[] = [];
  const liveEvidence: string[] = [];
  const userOnly: string[] = [];
  const callsById = new Map<string, any>();
  let toolCallCount = 0;

  for (const record of records) {
    if (record?.role === "user") {
      const userText = contentText(record.content);
      liveEvidence.push(userText);
      userOnly.push(userText);
    }

    if (record?.role === "assistant") {
      const assistantText = contentText(record.content);
      if (assistantText) own.push(assistantText);

      for (const call of toolCalls(record.content)) {
        toolCallCount += 1;
        callsById.set(String(call.id), call);
        own.push(JSON.stringify({ name: call.name, arguments: call.arguments ?? {} }));
      }
    }

    if (record?.role === "toolResult") {
      const toolName = String(record.toolName ?? "");
      const text = contentText(record.content);
      const call = callsById.get(String(record.toolCallId));
      const command = String(call?.arguments?.command ?? "");

      if (toolName === "query_db") {
        if (record?.isError === true || /"error"\s*:\s*"(?:[^"]*no such (?:column|table)[^"]*)"/i.test(text)) {
          own.push(text);
        }
      } else if (toolName === "finish") {
        own.push(text);
      } else if (toolName === "bash") {
        own.push(command);
        const inspectsSessionTranscript = /\.state\/sessions\/(?:history\/)?[^/\s]+\/session\.jsonl/.test(command);
        if (!inspectsSessionTranscript && /\bgit\s+(?:status|add|commit|diff|show)\b/.test(command)) own.push(text);
      } else if (toolName === "read" && /\.state\/sessions\/(?:history\/)?[^/\s]+\/session\.jsonl/.test(String(call?.arguments?.path ?? ""))) {
        own.push("SESSION_READ_BLOCKED_OR_ATTEMPTED");
      }
    }
  }

  return {
    text: own.join("\n"),
    liveEvidenceText: liveEvidence.concat(own).join("\n"),
    userText: userOnly.join("\n"),
    toolCallCount,
  };
}

function antiShallowIssues(session: any, transcript: string): string[] {
  if (session?.agent === "evaluator" || session?.agent === "judge") return [];
  const task = String(session?.task ?? "");
  if (!/ANTI-SHALLOW GATE/i.test(task)) return [];
  const threshold = Number(task.match(/minimum:\s*(\d+)/i)?.[1] ?? 10);
  const view = sessionOwnedTranscriptView(transcript);
  const count = view.toolCallCount;
  if (typeof count === "number" && Number.isFinite(threshold) && count < threshold) {
    return [`anti-shallow gate not satisfied: ${count}/${threshold} tool calls`];
  }
  return [];
}

function formatWorkflowCollectedFacts(session: any, transcript: string, heuristic: { verdict: string; issues: string[] }): string {
  const view = sessionOwnedTranscriptView(transcript);
  const lines = [
    `Status: ${String(session?.status ?? "unknown")}`,
    `Error: ${session?.error ? String(session.error).slice(0, 240) : "none"}`,
    `Recorded opCount: ${Number(session?.opCount ?? 0)}`,
    `Transcript tool calls: ${typeof view.toolCallCount === "number" ? view.toolCallCount : "unknown"}`,
    `Heuristic verdict: ${heuristic.verdict}`,
    `Heuristic issues: ${heuristic.issues.length ? heuristic.issues.join("; ") : "none"}`,
  ];

  return ["## Workflow-Collected Session Facts", ...lines.map((line) => `- ${line}`)].join("\n");
}

export function classifyVerdict(session: any, transcript = ""): { quality: number; efficiency: number; verdict: string; issues: string[] } {
  const issues: string[] = [];
  const status = String(session?.status ?? "unknown");
  const opCount = Number(session?.opCount ?? 0);

  if (status === "error" || status === "interrupted") issues.push(`terminal status: ${status}`);
  if (session?.error) issues.push(`error: ${String(session.error).slice(0, 240)}`);
  if (opCount > 0 && opCount < 3 && status === "done") issues.push(`shallow session: ${opCount} ops`);
  issues.push(...transcriptIssues(transcript));
  issues.push(...antiShallowIssues(session, transcript));

  const failed = status === "error" || status === "interrupted" || !!session?.error;
  const finishOnlySelfRepaired =
    !failed &&
    issues.length === 1 &&
    issues[0] === "finish blocked by uncommitted changes" &&
    sessionSelfRepairedOrCleanlyExited(session, transcript);

  return {
    quality: failed ? 0.2 : finishOnlySelfRepaired ? 0.85 : issues.length ? 0.55 : 0.85,
    efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8,
    verdict: failed || (issues.length && !finishOnlySelfRepaired) ? "needs_improvement" : "good",
    issues,
  };
}

export function transcriptOutputSignals(session: any, transcript: string): string[] {
  const signals = new Set<string>();
  const view = sessionOwnedTranscriptView(transcript);
  const ownText = view.text;

  if (/"name":"(?:write|edit|apply_patch)"/.test(ownText)) signals.add("file write/edit");
  if (/\bgit\s+commit\b/.test(ownText)) signals.add("git commit");
  if (/agents\/shared\/projects\/[^/\s"']+\/(?:outputs\/|project\.md|journal\.md)/.test(ownText)) {
    signals.add("project artifact");
  }
  if (/agents\/[^/\s"']+\/knowledge\//.test(ownText)) signals.add("knowledge update");
  if (/\b(?:bun|npm|pnpm|yarn)\s+(?:test|run\s+(?:test|check|build))\b|\bvitest\b|\bpytest\b|\bPASS\b/i.test(ownText)) {
    signals.add("verification command");
  }
  if (session?.projectId) signals.add("project-linked session");
  if (session?.workflowRunId) signals.add("workflow-linked session");

  return [...signals];
}

export function classifyEvaluationLane(session: any, transcript: string, heuristic: HeuristicVerdict = classifyVerdict(session, transcript)): EvaluationRoute {
  if (heuristic.verdict !== "good") {
    return {
      lane: "needs_triage",
      reason: heuristic.issues.length ? heuristic.issues.join("; ") : `verdict=${heuristic.verdict}`,
      signals: heuristic.issues,
    };
  }

  if (finishBlockedByUncommittedChanges(transcript)) {
    return {
      lane: "success_candidate",
      reason: "finish/uncommitted friction self-repaired or cleanly exited; review output quality separately from hygiene friction",
      signals: [...heuristic.issues, ...transcriptOutputSignals(session, transcript)],
    };
  }

  const signals = transcriptOutputSignals(session, transcript);
  const materialSignals = signals.filter((signal) =>
    ["file write/edit", "git commit", "project artifact", "knowledge update"].includes(signal),
  );
  if (materialSignals.length > 0) {
    return {
      lane: "success_candidate",
      reason: `good session with material output: ${materialSignals.join(", ")}`,
      signals,
    };
  }

  return {
    lane: "routine_ok",
    reason: signals.length ? `good session; no material output signal (${signals.join(", ")})` : "good session; no material output signal",
    signals,
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

function readArtifact(path: string): string {
  try {
    return existsSync(path) ? readFileSync(path, "utf-8") : "";
  } catch {
    return "";
  }
}

export function artifactVerdict(artifactText: string): string | null {
  const match = artifactText.match(/^\s*#{1,3}\s*Verdict\s*\n+\s*([a-z_ -]+)/im);
  const raw = match?.[1]?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return null;
  if (raw.startsWith("needs_triage")) return "needs_improvement";
  if (raw.startsWith("needs_improvement")) return "needs_improvement";
  if (raw.startsWith("low_quality")) return "needs_improvement";
  if (raw.startsWith("good")) return "good";
  if (raw.startsWith("acceptable")) return "acceptable";
  return raw;
}

function shouldOverrideWithReview(heuristicVerdict: string, reviewedVerdict: string | null): boolean {
  if (!reviewedVerdict) return false;
  return heuristicVerdict === "good" && ["needs_improvement", "acceptable"].includes(reviewedVerdict);
}

function reviewOverrideQuality(reviewedVerdict: string): number {
  return reviewedVerdict === "acceptable" ? 0.65 : 0.55;
}

export function falseGoodEventPayload(params: {
  sessionId: string;
  agent: string;
  heuristicVerdict: string;
  reviewedVerdict: string;
  reviewSessionId: string;
  artifactPath: string;
}): Record<string, unknown> {
  return {
    source: "evaluator-aftermath",
    owner: "evaluator",
    evaluationId: params.sessionId,
    sessionId: params.sessionId,
    agent: params.agent,
    originalVerdict: params.heuristicVerdict,
    newVerdict: params.reviewedVerdict,
    heuristicVerdict: params.heuristicVerdict,
    reviewedVerdict: params.reviewedVerdict,
    reviewSessionId: params.reviewSessionId,
    artifactPath: params.artifactPath,
  };
}

export function buildReviewTask(params: {
  sessionId: string;
  session: any;
  transcriptPath: string;
  artifactPath: string;
  workflowCollectedFacts: string;
  route: EvaluationRoute;
}): string {
  const { sessionId, session, transcriptPath, artifactPath, workflowCollectedFacts, route } = params;
  const lanePurpose = route.lane === "needs_triage"
    ? "Find the root cause, fix it if obvious and low-risk, otherwise escalate with evidence."
    : "Judge why this good session produced real value, inspect the actual output, and extract reusable learning if present.";

  return [
    `Review session aftermath for ${sessionId}.`,
    ``,
    `Session: ${JSON.stringify(session, null, 2)}`,
    `Transcript path: ${transcriptPath}`,
    `Evaluation lane: ${route.lane}`,
    `Routing reason: ${route.reason}`,
    `Output signals: ${route.signals.length ? route.signals.join(", ") : "none"}`,
    ``,
    workflowCollectedFacts,
    ``,
    `The workflow facts and heuristic are routing signals, not the final judgment. Your job is to decide from goal/context/facts whether the session produced real value, merely avoided errors, or needs repair.`,
    `Use bounded transcript commands (grep/jq/sed/head/tail) for targeted evidence. Do not load the whole session.jsonl into context. When the session changed files or produced artifacts, inspect the actual artifacts, diffs, or relevant files; do not judge from transcript self-claims alone.`,
    ``,
    `Lane purpose: ${lanePurpose}`,
    `Write your concise review to: ${artifactPath}`,
    ``,
    `Do exactly this loop:`,
    `1. Evaluate outcome quality: did this session produce real value for its task/project goal?`,
    `2. Check the actual output artifacts/diffs/files when the route signals material output.`,
    `3. Write the concise review to the artifact path above.`,
    `4. Immediately call read() on that same artifact path and confirm the file contains the required sections.`,
    `5. For needs_triage: if root cause is obvious and low-risk, fix it now and verify; if blocked/high-risk, escalate with a real agent recipient (may, arc, dev, scout, coach) or an escalation note in the artifact. NEVER use "functions.message" as the 'to' field.`,
    `6. For success_candidate: extract why it worked. If there is reusable learning, update the right agent context/knowledge file.`,
    `7. Only then call finish(success) or finish(partial); the verify-after-write guard rejects success if the artifact was written but not read back.`,
    ``,
    `Keep the artifact short with sections: Verdict, Evidence, Output Quality, Root Cause, Action Taken, Learning, Learning Created: yes|no.`,
  ].join("\n");
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
  const route = classifyEvaluationLane(session, transcript, heuristic);
  const workflowCollectedFacts = formatWorkflowCollectedFacts(session, transcript, heuristic);
  const artifactPath = `agents/evaluator/workspace/aftermath/${sessionId}.md`;
  const artifactAbsPath = join(projectRoot, artifactPath);

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
          lane: route.lane,
          routeReason: route.reason,
          outputSignals: route.signals,
          ...(evaluation ? { refreshedFrom: evaluation.verdict } : {}),
          ...(route.lane === "routine_ok" ? {} : { artifactPath }),
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

  ctx.emit({
    type: "evaluation.routed",
    source: "evaluator-aftermath",
    owner: "evaluator",
    sessionId,
    agent: session.agent,
    lane: route.lane,
    verdict: heuristic.verdict,
    reason: route.reason,
    signals: route.signals,
    projectId: session.projectId ?? null,
    workflowRunId: session.workflowRunId ?? null,
    heuristicVersion: HEURISTIC_VERSION,
  } as any);

  if (route.lane === "routine_ok") {
    return ctx.done(`Evaluated ${sessionId}: good (${route.lane}). No review needed.`);
  }

  mkdirSync(join(projectRoot, "agents/evaluator/workspace/aftermath"), { recursive: true });

  const reviewTask = buildReviewTask({ sessionId, session, transcriptPath, artifactPath, workflowCollectedFacts, route });

  const review = await ctx.runAgent("evaluator", reviewTask);

  if ((review as any).status === "error") {
    return ctx.escalate(`Evaluator review failed for ${sessionId}`, { reviewSessionId: (review as any).sessionId });
  }

  const artifactText = readArtifact(artifactAbsPath);
  const reviewedVerdict = artifactVerdict(artifactText);
  if (shouldOverrideWithReview(heuristic.verdict, reviewedVerdict)) {
    await (ctx as any).runFunction("record-review-override", async () => {
      const db = ctx.getDb() as any;
      const prior = db.prepare("SELECT overall FROM evaluations WHERE sessionId = ?").get(sessionId) as any;
      let overall: Record<string, unknown> = {};
      try {
        overall = prior?.overall ? JSON.parse(prior.overall) : {};
      } catch {
        overall = {};
      }
      overall.reviewedVerdict = reviewedVerdict;
      overall.reviewOverride = true;
      overall.reviewSessionId = (review as any).sessionId;
      overall.artifactPath = artifactPath;
      db.run(
        `UPDATE evaluations
         SET verdict = ?,
             quality = MIN(COALESCE(quality, 0.55), ?),
             issues = ?,
             overall = ?
         WHERE sessionId = ?`,
        [
          reviewedVerdict,
          reviewOverrideQuality(reviewedVerdict),
          JSON.stringify([...(heuristic.issues ?? []), `review override: ${reviewedVerdict}`]),
          JSON.stringify(overall),
          sessionId,
        ],
      );
      return `review override ${heuristic.verdict} -> ${reviewedVerdict}`;
    });
    ctx.emit({
      type: "evaluation.false_good",
      ...falseGoodEventPayload({
        sessionId,
        heuristicVerdict: heuristic.verdict,
        reviewedVerdict,
        reviewSessionId: (review as any).sessionId,
        artifactPath,
        agent: session.agent,
      }),
    } as any);
  }

  ctx.emit({
    type: "evaluation.reviewed",
    source: "evaluator-aftermath",
    owner: "evaluator",
    sessionId,
    agent: session.agent,
    lane: route.lane,
    verdict: heuristic.verdict,
    reviewedVerdict,
    reviewSessionId: (review as any).sessionId,
    artifactPath,
    artifactFound: artifactText.length > 0,
  } as any);

  if (route.lane === "success_candidate") {
    ctx.emit({
      type: "evaluation.success_candidate",
      source: "evaluator-aftermath",
      owner: "evaluator",
      sessionId,
      agent: session.agent,
      reason: route.reason,
      signals: route.signals,
      reviewSessionId: (review as any).sessionId,
      artifactPath,
    } as any);
  }

  if (route.lane === "needs_triage") {
    ctx.emit({
      type: "evaluation.triage_closed",
      source: "evaluator-aftermath",
      owner: "evaluator",
      sessionId,
      agent: session.agent,
      reviewSessionId: (review as any).sessionId,
      artifactPath,
    } as any);
  }

  if (/Learning Created:\s*yes/i.test(artifactText)) {
    ctx.emit({
      type: "evaluation.learning_created",
      source: "evaluator-aftermath",
      owner: "evaluator",
      sessionId,
      agent: session.agent,
      lane: route.lane,
      reviewSessionId: (review as any).sessionId,
      artifactPath,
    } as any);
  }

  return ctx.done(`Evaluated ${sessionId}: ${heuristic.verdict} (${route.lane}). Review session: ${(review as any).sessionId}. Artifact: ${artifactPath}`);
}
