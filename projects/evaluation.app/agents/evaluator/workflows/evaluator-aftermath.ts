import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "evaluator-aftermath";
export const description = "Evaluate session aftermath, cancel stale running sessions, and drive repair/learning.";
export const HEURISTIC_VERSION = 11;

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

type NormalizedEvaluationState = {
  heuristic: HeuristicVerdict;
  route: EvaluationRoute;
  downgradedFromRepairExecution: boolean;
};

type SessionEvalTrailParams = {
  sessionId: string;
  session: any;
  transcript: string;
  transcriptSource: string;
  heuristic: HeuristicVerdict;
  route: EvaluationRoute;
  createdAt?: number;
  source?: string;
};

export function extractTrigger(task: string): any {
  // The trigger event JSON is always appended at the END of the task text
  // by the SDK's appendEvent(). When the task text itself contains nested
  // markdown fences (common in heartbeat/owner-loop prompts that embed
  // full agent instructions), regex-based extraction fails because lazy
  // [\s\S]*? stops at the first internal ``` instead of the real closing
  // fence.
  //
  // Strategy: find the LAST line-anchored "## Trigger Event" header (preceded
  // by an actual newline, not a JSON \n escape), then find the LAST closing
  // ``` fence. The JSON lives between the opening ```json and that closing
  // fence.
  //
  // Why line-anchored? When a session's task text contains an embedded
  // "## Trigger Event" inside a JSON string value (e.g., aks-explorer planner
  // sessions whose task text includes their own trigger), lastIndexOf picks
  // the INNER occurrence. The inner occurrence is inside a JSON string where
  // newlines are encoded as literal \n (backslash-n), while the OUTER header
  // starts on its own line preceded by an actual newline character.
  const headerPattern = "## Trigger Event";
  const lineAnchoredIdx = task.lastIndexOf("\n" + headerPattern);
  const lastHeaderIdx = lineAnchoredIdx !== -1
    ? lineAnchoredIdx + 1  // skip the \n prefix to point at "##"
    : (task.startsWith(headerPattern) ? 0 : -1);
  if (lastHeaderIdx === -1) return null;

  const afterHeader = task.slice(lastHeaderIdx + headerPattern.length);
  const jsonFenceStart = afterHeader.indexOf("```json");
  if (jsonFenceStart === -1) return null;

  const jsonStart = jsonFenceStart + 7; // length of "```json"
  const remaining = afterHeader.slice(jsonStart);

  // Find the LAST closing ``` fence in the remaining text (the one the SDK appended)
  const lastClosingFence = remaining.lastIndexOf("```");
  if (lastClosingFence === -1) return null;

  const jsonText = remaining.slice(0, lastClosingFence).trim();
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText);
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
  if (/last-session\.md/.test(ownText) && /git\s+add[^;\n]*(last-session\.md|may\/)[\s\S]{0,240}git\s+commit/.test(ownText)) {
    issues.push("committed runtime handoff files");
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

  const shellWrittenToolPaths = shellWrittenPaths(transcript).filter(isAgentToolPath);
  if (shellWrittenToolPaths.length > 0 && /creative heartbeat mode/i.test(taskText)) {
    issues.push(`unexpected shell write to agent tool path(s): ${shellWrittenToolPaths.join(", ")}`);
  }

  return issues;
}

function shellWrittenPaths(transcript: string): string[] {
  const records = parseJsonlTranscript(transcript);
  if (!records) return [];

  const paths = new Set<string>();
  for (const record of records) {
    if (record?.role !== "assistant") continue;
    for (const call of toolCalls(record.content)) {
      if (call?.name !== "bash" || typeof call?.arguments?.command !== "string") continue;
      for (const path of extractBashWritePaths(call.arguments.command)) {
        paths.add(path);
      }
    }
  }
  return [...paths];
}

function extractBashWritePaths(command: string): string[] {
  const paths: string[] = [];
  const add = (raw: string | undefined) => {
    if (!raw) return;
    const normalized = normalizeAgentPath(raw.replace(/^['"]|['"]$/g, ""));
    if (normalized) paths.push(normalized);
  };

  const redirectPattern = /(?:^|[\s;&|])(?:\d?>|>>)\s*(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(redirectPattern)) add(match[2]);

  const teePattern = /(?:^|[\s;&|])tee(?:\s+-a)?(?:\s+--)?\s+(['"]?)([^'"\s;&|]+)\1/g;
  for (const match of command.matchAll(teePattern)) add(match[2]);

  return [...new Set(paths)];
}

function normalizeAgentPath(path: string): string | null {
  const normalized = path
    .trim()
    .replace(/^\/app\/agents\//, "")
    .replace(/^\/app\//, "")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
  if (normalized.startsWith("agents/")) return normalized.slice("agents/".length);
  if (/^[^/]+\//.test(normalized)) return normalized;
  return null;
}

function isAgentToolPath(path: string): boolean {
  return /^[^/]+\/tools\/[^/]+/.test(path);
}

function forbiddenEditPathsFromTask(text: string): string[] {
  const paths = new Set<string>();
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const constraintText = forbiddenConstraintText(lines[i] ?? "");
    if (!constraintText) continue;

    for (const match of constraintText.matchAll(/(?:\/app\/|\.state\/|src\/|agents\/)?[\w.-]+(?:\/[\w.-]+)+/g)) {
      const raw = match[0].replace(/[).,;:'\"]+$/, "");
      if (looksLikeConcreteForbiddenPath(raw)) paths.add(raw);
    }
    for (const match of constraintText.matchAll(/\b[A-Z][A-Z0-9_-]*\.md\b/g)) {
      paths.add(match[0]);
    }
  }
  return [...paths];
}

function forbiddenConstraintText(line: string): string | null {
  const normalized = line.trim().replace(/^[-*•>\s]+/, "").replace(/^\d+[.)]\s+/, "").replace(/\*\*/g, "");

  const forbidden = normalized.match(/\bforbidden\s*:\s*(.+)$/i);
  if (forbidden) return forbidden[1] ?? "";

  // Match edit prohibition at start or after common prefix (e.g. "Task constraints: Do not edit ...")
  const editProhibition = normalized.match(
    /\b(?:do\s+not|don't|never|must\s+not|cannot|can't)\s+(?:edit|modify|write|change|touch)\b\s*:?[\s—–-]*(.+)$/i,
  );
  if (editProhibition) return editProhibition[1] ?? "";

  // Also match "You CANNOT edit ..." form
  const youEditProhibition = normalized.match(
    /\byou\s+(?:cannot|can't|must\s+not|should\s+not)\s+(?:edit|modify|write|change|touch)\b\s*:?[\s—–-]*(.+)$/i,
  );
  if (youEditProhibition) return youEditProhibition[1] ?? "";

  const noEdits = normalized.match(/\bno\s+edits?\s+(?:to|under|in)\b\s*:?[\s—–-]*(.+)$/i);
  if (noEdits) return noEdits[1] ?? "";

  return null;
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
    // Anchored to start-of-line in multiline mode: two-column git status code + space + path.
    // Prevents prose like "Audited metric-alerts.md" from matching.
    if (new RegExp(`^[ MADRCU?!]{1,2}\\s+(?:\\S+/)*${escaped}(?:\\s|$)`, "m").test(ownText)) {
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
    let lastSchemaErrorIdx = -1;
    let lastRecoveryIdx = -1;
    let recordIdx = 0;

    for (const record of records) {
      // Track schema errors in query_db results
      if (record?.role === "toolResult" && record?.toolName === "query_db") {
        const text = contentText(record.content);
        const isSchemaError =
          record?.isError === true || /"error"\s*:\s*"(?:[^"]*no such (?:column|table)[^"]*)"/i.test(text);

        if (isSchemaError) lastSchemaErrorIdx = recordIdx;
        else lastRecoveryIdx = recordIdx;
      }

      // A finish(success|partial) call is recovery evidence — the agent completed
      // its work despite the schema error (e.g. it got what it needed from the
      // error's schema hint, or the query was ancillary exploration).
      if (record?.role === "assistant") {
        for (const call of toolCalls(record.content)) {
          if (call?.name === "finish") {
            const status = String(call?.arguments?.status ?? "");
            if (status === "success" || status === "partial") {
              lastRecoveryIdx = recordIdx;
            }
          }
        }
      }

      recordIdx += 1;
    }

    if (lastSchemaErrorIdx !== -1) return lastSchemaErrorIdx > lastRecoveryIdx;
    return false;
  }

  const lastSchemaError = Math.max(ownText.lastIndexOf("no such column:"), ownText.lastIndexOf("no such table:"));
  if (lastSchemaError === -1) return false;

  const afterLastSchemaError = ownText.slice(lastSchemaError);
  return !/\{"name":"(?:query_db|finish)","arguments":\{/.test(afterLastSchemaError);
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

function normalizedToolPath(rawPath: unknown): string | null {
  if (typeof rawPath !== "string") return null;
  const normalized = rawPath.trim().replace(/^\/app\//, "").replace(/^\.\//, "").replace(/\/+/g, "/");
  return normalized || null;
}

function toolCallPaths(call: any): string[] {
  const argumentsObject = call?.arguments ?? {};
  const directPaths = [argumentsObject?.path, argumentsObject?.filePath]
    .map(normalizedToolPath)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (String(call?.name ?? "") !== "apply_patch") return [...new Set(directPaths)];

  const patchText = typeof argumentsObject?.patch === "string" ? argumentsObject.patch : "";
  const patchPaths = [...patchText.matchAll(/^(?:\+\+\+|---)\s+(?:b\/|a\/)?([^\n\t]+)$/gm)]
    .map((match) => normalizedToolPath(match[1]))
    .filter((value): value is string => typeof value === "string" && value.length > 0 && value !== "/dev/null");

  return [...new Set([...directPaths, ...patchPaths])];
}

function assistantToolCallRecords(transcript: string): Array<{ name: string; paths: string[]; command: string }> {
  const records = parseJsonlTranscript(transcript);
  if (!records) return [];

  const calls: Array<{ name: string; paths: string[]; command: string }> = [];
  for (const record of records) {
    if (record?.role !== "assistant") continue;
    for (const call of toolCalls(record.content)) {
      calls.push({
        name: String(call?.name ?? ""),
        paths: toolCallPaths(call),
        command: String(call?.arguments?.command ?? ""),
      });
    }
  }
  return calls;
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
  const assistantCalls = assistantToolCallRecords(transcript);
  const materialWriteCalls = assistantCalls.filter((call) => ["write", "edit", "apply_patch"].includes(call.name));
  const materialPaths = materialWriteCalls.flatMap((call) => call.paths);

  if (materialWriteCalls.length > 0) signals.add("file write/edit");
  if (/\bgit\s+commit\b/.test(ownText)) signals.add("git commit");
  if (materialPaths.some((path) => /^(?:projects\/[^/]+\/(?:outputs\/|project\.md|journal\.md))/.test(path))) {
    signals.add("project artifact");
  }
  if (materialPaths.some((path) => /^agents\/[^/]+\/knowledge\//.test(path))) {
    signals.add("knowledge update");
  }
  if (assistantCalls.some((call) => isVerificationToolCall({ name: call.name, arguments: { command: call.command } })) || /\bPASS\b/i.test(ownText)) {
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

  const signals = transcriptOutputSignals(session, transcript);
  const materialSignals = signals.filter((signal) =>
    ["file write/edit", "git commit", "project artifact", "knowledge update"].includes(signal),
  );

  if (finishBlockedByUncommittedChanges(transcript)) {
    return {
      lane: "success_candidate",
      reason: "finish/uncommitted friction self-repaired or cleanly exited; review output quality separately from hygiene friction",
      signals: [...heuristic.issues, ...signals],
    };
  }

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

function isTerminalFailureSession(session: any): boolean {
  const status = String(session?.status ?? "unknown");
  return status === "error" || status === "interrupted" || !!session?.error;
}

function isProviderAuthFailureText(text: string): boolean {
  if (!text) return false;
  if (/litellm\.AuthenticationError|Github_copilotException|IDE token expired|unauthorized:\s*token expired/i.test(text)) {
    return true;
  }
  return /Error code:\s*499/i.test(text) && /Github_copilotException|github[-_ ]?copilot|litellm/i.test(text);
}

function isProviderAuthFailureTranscript(transcript: string): boolean {
  const records = parseJsonlTranscript(transcript);
  if (!records) return isProviderAuthFailureText(transcript);

  for (const record of records) {
    if (record?.role !== "assistant") continue;
    const text = [
      String(record?.errorMessage ?? ""),
      contentText(record?.content),
      String(record?.provider ?? ""),
      String(record?.model ?? ""),
    ].join("\n");
    if (isProviderAuthFailureText(text)) return true;
  }
  return false;
}

export function shouldSkipAftermathAmplification(session: any, transcript: string): { skip: boolean; reason: string } {
  if (!isTerminalFailureSession(session)) return { skip: false, reason: "" };

  const opCount = Number(session?.opCount ?? 0);
  if (opCount === 0) {
    return { skip: true, reason: "terminal_zero_op_session" };
  }

  if (opCount === 1) {
    const hasProviderAuthFailure =
      isProviderAuthFailureText(String(session?.error ?? "")) ||
      isProviderAuthFailureTranscript(transcript);
    if (hasProviderAuthFailure) {
      return { skip: true, reason: "one_op_provider_auth_failure" };
    }
  }

  return { skip: false, reason: "" };
}

export function shouldRefreshEvaluation(evaluation: any, heuristic: { verdict: string; issues: string[] }): boolean {
  if (!evaluation) return true;
  return evaluationHeuristicVersion(evaluation) < HEURISTIC_VERSION;
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

export function sessionEvalTrailPath(transcriptPath: string): string {
  return transcriptPath.replace(/session\.jsonl$/, "session.eval.jsonl");
}

function displayPath(projectRoot: string, path: string): string {
  const rel = relative(projectRoot, path);
  return rel && !rel.startsWith("..") ? rel : path;
}

function compactEvalText(value: unknown, max = 260): string {
  const text = (typeof value === "string" ? value : JSON.stringify(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const head = text.slice(0, Math.max(0, max - 3)).replace(/\s+\S*$/, "");
  return `${head || text.slice(0, Math.max(0, max - 3))}...`;
}

function lineContentText(content: any): string {
  if (Array.isArray(content)) return content.map((part) => String(part?.text ?? "")).filter(Boolean).join("\n");
  return typeof content === "string" ? content : "";
}

type EvalCheck = {
  name: string;
  rating: "good" | "mixed" | "weak" | "risk" | "not_applicable";
  note: string;
};

function makeCheck(name: string, rating: EvalCheck["rating"], note: string): EvalCheck {
  return { name, rating, note };
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  return /\btruncated\b|\[\.\.\.\]|<\.\.\.>|…/i.test(text) || /^\.\.\./.test(trimmed) || /\.\.\.$/.test(trimmed);
}

function evalScoreFromChecks(checks: EvalCheck[]): "ok" | "check" | "issue" | "context" {
  if (checks.some((check) => check.rating === "weak" || check.rating === "risk")) return "issue";
  if (checks.some((check) => check.rating === "mixed")) return "check";
  return "ok";
}

function evalIssuesFromChecks(checks: EvalCheck[]): string[] {
  return checks
    .filter((check) => check.rating === "weak" || check.rating === "risk")
    .map((check) => check.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
}

type EvalTarget = "request" | "execution" | "result" | "verification" | "evolution" | "session";
type TargetQuality = "ok" | "check" | "issue" | "unknown";
type RepairAction = "none" | "clarify_request" | "ask_human_or_owner" | "repair_execution" | "repair_verification" | "extract_evolution_candidate";
type FindingScope = "request_quality" | "agent_behavior" | "project_context" | "workflow" | "tooling" | "verification";
type FindingSeverity = "low" | "medium" | "high";

type OwnerFinding = {
  id: string;
  scope: FindingScope;
  owner: string;
  ownerReason: string;
  severity: FindingSeverity;
  finding: string;
  impact: string;
  evidence: Array<Record<string, unknown>>;
  suggestedActions: string[];
};

function isVerificationToolCall(call: any): boolean {
  const name = String(call?.name ?? "");
  const command = String(call?.arguments?.command ?? call?.input?.command ?? "");
  if (name === "finish") return true;
  if (name === "workflow") return /verify|check|test|review/i.test(String(call?.arguments?.name ?? call?.arguments?.task ?? ""));
  if (name !== "bash") return false;
  return /\b(bun\s+(test|run\s+(check|test|build|typecheck|lint|verify))|npm\s+(test|run\s+(check|test|build|typecheck|lint|verify))|pnpm\s+(test|run\s+(check|test|build|typecheck|lint|verify))|yarn\s+(test|run\s+(check|test|build|typecheck|lint|verify))|tsc\b|vitest\b|jest\b|pytest\b|cargo\s+test\b|go\s+test\b|playwright\b|curl\b|docker\b)/i.test(command);
}

function classifyToolCallTarget(call: any): EvalTarget {
  return isVerificationToolCall(call) ? "verification" : "execution";
}

function scoreQuality(score: unknown): TargetQuality {
  if (score === "issue") return "issue";
  if (score === "check") return "check";
  if (score === "ok" || score === "context") return "ok";
  return "unknown";
}

function worseQuality(a: TargetQuality, b: TargetQuality): TargetQuality {
  const rank: Record<TargetQuality, number> = { unknown: 0, ok: 1, check: 2, issue: 3 };
  return rank[b] > rank[a] ? b : a;
}

function summarizeTargetQuality(rows: Record<string, unknown>[], target: EvalTarget): TargetQuality {
  const targetRows = rows.filter((row) => row.target === target);
  if (targetRows.length === 0) return "unknown";
  return targetRows.reduce<TargetQuality>((quality, row) => worseQuality(quality, scoreQuality(row.score)), "ok");
}

function rowIssues(row: Record<string, unknown>): string[] {
  return Array.isArray(row.issues) ? row.issues.map(String) : [];
}

function hasIssue(rows: Record<string, unknown>[], target: EvalTarget, issue: string): boolean {
  return rows.some((row) => row.target === target && rowIssues(row).includes(issue));
}

function hasMaterialOutputSignal(signals: string[]): boolean {
  return signals.some((signal) => /file write\/edit|git commit|project artifact|knowledge update/i.test(signal));
}

function issueEvidence(lineRows: Record<string, unknown>[], target?: EvalTarget): Array<Record<string, unknown>> {
  return lineRows
    .filter((row) => ["issue", "check"].includes(String(row.score ?? "")) && (!target || row.target === target))
    .slice(0, 6)
    .map((row) => ({
      source: row.rawSource,
      line: row.line,
      target: row.target,
      issues: row.issues ?? [],
      comment: row.comment ?? row.judgment ?? row.rawPreview ?? "",
    }));
}

function agentOwner(params: SessionEvalTrailParams): string {
  const agent = String(params.session?.agent ?? "").trim();
  return `agent:${agent || "may"}`;
}

function humanOwner(): string {
  return "human:requester";
}

function isBlockedOrWaitingStatus(status: unknown): boolean {
  return /^(blocked|waiting)$/i.test(String(status ?? ""));
}

function hasBlockedLoopSignal(text: string): boolean {
  return (
    /HTTP_CODE:000/i.test(text) ||
    /\b(?:\d+\s+)?consecutive checks?\b/i.test(text) ||
    /\bblocked for \d+\b/i.test(text) ||
    /\bNo e2e tests can run until\b/i.test(text) ||
    /\bstandalone RP\b[\s\S]{0,180}\b(?:dead|down|unavailable|not reachable)\b/i.test(text) ||
    /\b(?:retry|recheck|check)\b[\s\S]{0,120}\b(?:same|known|stale)\s+blocker\b/i.test(text)
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildOwnerFindings(
  params: SessionEvalTrailParams,
  lineRows: Record<string, unknown>[],
  targetBreakdown: Record<string, TargetQuality>,
): OwnerFinding[] {
  const findings: OwnerFinding[] = [];
  const materialOutput = hasMaterialOutputSignal(params.route.signals);
  const requestHasStaleRisk = hasIssue(lineRows, "request", "misleading_or_stale_risk");
  const requestHasIntegrityRisk = hasIssue(lineRows, "request", "information_integrity");
  const requestHasPurposeIssue = hasIssue(lineRows, "request", "purpose_clarity");
  const blockedOrWaiting = isBlockedOrWaitingStatus(params.session?.status);
  const joinedEvidence = `${params.transcript}\n${params.heuristic.issues.join("\n")}\n${params.route.reason}`;

  if (hasBlockedLoopSignal(joinedEvidence)) {
    findings.push({
      id: "stale-blocker-loop",
      scope: "project_context",
      owner: agentOwner(params),
      ownerReason: "The project owner agent is the concrete actor that can update project context, add a resume condition, or ask the human for a decision.",
      severity: "high",
      finding: "The session appears to be in a stale blocker loop rather than moving the project toward an unblock decision.",
      impact: "Repeated full sessions can spend turns rechecking a known dead condition without changing project state, owner decision, or monitoring strategy.",
      evidence: issueEvidence(lineRows).length ? issueEvidence(lineRows) : [{ source: params.transcriptSource, line: null, target: "session", comment: "Blocked-loop signal found in transcript or heuristic evidence." }],
      suggestedActions: [
        "Update project context with the latest blocker evidence and a concrete resume condition.",
        "Ask the human/owner to choose redeploy, wait, re-scope, or close if that decision is required.",
        "Convert repeated liveness polling into a cheap metric/watch instead of full project iterations.",
      ],
    });
  }

  const requestFindingIsActionable =
    params.route.lane !== "routine_ok" ||
    params.heuristic.verdict !== "good" ||
    blockedOrWaiting;

  if (requestFindingIsActionable && (requestHasIntegrityRisk || requestHasPurposeIssue || requestHasStaleRisk || targetBreakdown.request === "issue")) {
    findings.push({
      id: "request-quality",
      scope: "request_quality",
      owner: requestHasIntegrityRisk ? humanOwner() : agentOwner(params),
      ownerReason: requestHasIntegrityRisk
        ? "The requester or human owner must clarify missing/corrupted intent before agents can safely continue."
        : "The owner agent can rewrite stale or overloaded project instructions into a cleaner next WorkRequest.",
      severity: requestHasIntegrityRisk || blockedOrWaiting ? "high" : "medium",
      finding: "The work request may be unclear, stale, overloaded, or missing critical information.",
      impact: "Bad input can make a reasonable agent repeat the wrong action or optimize for stale context.",
      evidence: issueEvidence(lineRows, "request"),
      suggestedActions: [
        "Rewrite the next request with purpose, current evidence, expected output, constraints, and verification.",
        "Remove stale references and separate durable project context from the immediate ask.",
        "Ask the human for a missing decision when the agent cannot infer it safely.",
      ],
    });
  }

  if (materialOutput && ["unknown", "check", "issue"].includes(String(targetBreakdown.verification))) {
    findings.push({
      id: "weak-verification",
      scope: "verification",
      owner: agentOwner(params),
      ownerReason: "The session agent is responsible for proving its claimed output before handoff.",
      severity: blockedOrWaiting ? "high" : "medium",
      finding: "The session appears to produce material output without strong verification evidence.",
      impact: "The project may accept a change or conclusion before the changed artifact, served behavior, or test result was actually proven.",
      evidence: issueEvidence(lineRows, "verification"),
      suggestedActions: [
        "Run the relevant build/test/API/browser check and attach the evidence.",
        "State remaining uncertainty explicitly if verification cannot be completed.",
        "Do not report completion from file edits or self-claims alone.",
      ],
    });
  }

  if (params.heuristic.verdict !== "good" || targetBreakdown.execution === "issue" || targetBreakdown.result === "issue") {
    findings.push({
      id: "execution-quality",
      scope: "agent_behavior",
      owner: agentOwner(params),
      ownerReason: "The acting agent can repair its approach, ask for help, or capture a learning item for its own workflow.",
      severity: blockedOrWaiting ? "high" : "medium",
      finding: "Execution/result quality needs owner review; the session did not clearly turn the request into useful progress.",
      impact: "Without owner review, the same agent may repeat weak tool choices, shallow recovery, or unsupported conclusions.",
      evidence: issueEvidence(lineRows).length ? issueEvidence(lineRows) : [{ source: params.transcriptSource, line: null, target: "session", issues: params.heuristic.issues }],
      suggestedActions: [
        "Decide whether to rerun a narrow repair session, update agent guidance, or ask a human for missing context.",
        "If the issue repeats across sessions, fork or update the owning agent workflow with evidence.",
        "If the issue is project-specific, update the project context instead of changing global agent behavior.",
      ],
    });
  }

  return findings.filter((finding, index, all) => index === all.findIndex((other) => other.id === finding.id));
}

function buildNotificationDecision(params: SessionEvalTrailParams, findings: OwnerFinding[]): Record<string, unknown> {
  const blockedOrWaiting = isBlockedOrWaitingStatus(params.session?.status);
  const immediate = findings.filter((finding) => finding.severity === "high" || blockedOrWaiting);
  return {
    policy: "persist_all_notify_actionable",
    notifyNow: immediate.length > 0,
    reason: immediate.length > 0
      ? "High-severity or blocked/waiting finding should be sent to the concrete owner now."
      : "No immediate owner notification; keep findings in the eval trail for digest/review.",
    immediateFindingIds: immediate.map((finding) => finding.id),
    batchedFindingIds: findings.filter((finding) => !immediate.includes(finding)).map((finding) => finding.id),
  };
}

export function ownerEventTarget(owner: unknown): string {
  const text = String(owner ?? "");
  if (text.startsWith("agent:")) return text.slice("agent:".length) || "may";
  if (text.startsWith("human:")) return "may";
  return text || "may";
}

function findingNeedsHuman(owner: unknown): boolean {
  return String(owner ?? "").startsWith("human:");
}

function learningFeedbackSummary(finding: OwnerFinding): string {
  const severity = String(finding.severity || "medium");
  const scope = String(finding.scope || "unknown");
  const id = String(finding.id || "finding");
  const text = String(finding.finding || "").replace(/\s+/g, " ").trim();
  const action = Array.isArray(finding.suggestedActions) && finding.suggestedActions.length
    ? ` -> ${String(finding.suggestedActions[0]).replace(/\s+/g, " ").trim()}`
    : "";
  return `[${severity}] ${scope}/${id}: ${text}${action}`.slice(0, 500);
}

export function learningFeedbackEventPayload(params: {
  sessionId: string;
  agent: unknown;
  projectId?: unknown;
  workflowRunId?: unknown;
  evalTrailPath: string;
  finding: OwnerFinding;
}): Record<string, unknown> {
  return {
    type: "learning.feedback",
    source: "evaluator-aftermath",
    owner: ownerEventTarget(params.finding.owner),
    kind: "owner_finding",
    needsHuman: findingNeedsHuman(params.finding.owner),
    sessionId: params.sessionId,
    agent: params.agent,
    projectId: params.projectId ?? null,
    workflowRunId: params.workflowRunId ?? null,
    evalTrailPath: params.evalTrailPath,
    summary: learningFeedbackSummary(params.finding),
    finding: params.finding,
  };
}

function buildRepairDecision(params: SessionEvalTrailParams, lineRows: Record<string, unknown>[]): Record<string, unknown> {
  const targetBreakdown = {
    request: summarizeTargetQuality(lineRows, "request"),
    execution: summarizeTargetQuality(lineRows, "execution"),
    result: summarizeTargetQuality(lineRows, "result"),
    verification: summarizeTargetQuality(lineRows, "verification"),
  };
  const materialOutput = hasMaterialOutputSignal(params.route.signals);
  const requestHasStaleRisk = hasIssue(lineRows, "request", "misleading_or_stale_risk");
  const requestHasIntegrityRisk = hasIssue(lineRows, "request", "information_integrity");
  const requestHasPurposeIssue = hasIssue(lineRows, "request", "purpose_clarity");
  const ownerFindings = buildOwnerFindings(params, lineRows, targetBreakdown);
  const notificationDecision = buildNotificationDecision(params, ownerFindings);
  let action: RepairAction = "none";
  let reason = "No immediate repair is required from the seeded evaluation.";

  if (targetBreakdown.request === "issue" && requestHasIntegrityRisk) {
    action = "ask_human_or_owner";
    reason = "The work request appears incomplete or corrupted; route the finding to the requester/human owner before continuing.";
  } else if (requestHasPurposeIssue || requestHasStaleRisk || (targetBreakdown.request === "issue" && params.heuristic.verdict !== "good")) {
    action = "clarify_request";
    reason = "The work request is a likely root cause or contributor; route it to the owner for clarification or rewrite.";
  } else if (materialOutput && ["unknown", "check", "issue"].includes(targetBreakdown.verification)) {
    action = "repair_verification";
    reason = "The session appears to produce material output but lacks strong verification evidence; route verification critique to the owner.";
  } else if (params.heuristic.verdict !== "good" || targetBreakdown.execution === "issue" || targetBreakdown.result === "issue") {
    action = "repair_execution";
    reason = "The request is usable, but execution or result evidence needs owner review.";
  } else if (params.route.lane === "success_candidate") {
    action = "extract_evolution_candidate";
    reason = "The session looks useful enough to mine for reusable learning after review.";
  }

  return {
    action,
    reason,
    targetBreakdown,
    ownerChoosesAction: true,
    ownerFindings,
    notificationDecision,
    suggestedActions: uniqueStrings(ownerFindings.flatMap((finding) => finding.suggestedActions)),
  };
}

export function normalizeEvaluationState(params: {
  heuristic: HeuristicVerdict;
  route: EvaluationRoute;
  repairDecision: Record<string, unknown>;
}): NormalizedEvaluationState {
  const heuristic = { ...params.heuristic };
  const route = {
    lane: params.route.lane,
    reason: params.route.reason,
    signals: [...params.route.signals],
  };
  const repairAction = String(params.repairDecision?.action ?? "none");

  if (repairAction === "repair_execution" && heuristic.verdict === "good") {
    return {
      heuristic: {
        ...heuristic,
        verdict: "acceptable",
        quality: Math.min(heuristic.quality, 0.65),
      },
      route: {
        lane: "needs_triage",
        reason: `downgraded unresolved repair_execution from good: ${route.reason}`,
        signals: uniqueStrings([...route.signals, "repair_execution unresolved"]),
      },
      downgradedFromRepairExecution: true,
    };
  }

  return {
    heuristic,
    route,
    downgradedFromRepairExecution: false,
  };
}

function buildUserTurnEvaluation(text: string): { score: "ok" | "check" | "issue" | "context"; issues: string[]; checks: EvalCheck[]; comment: string; improvement: string } {
  const normalized = text.replace(/\s+/g, " ").trim();
  const length = normalized.length;
  const hasPurpose = hasAny(normalized, [/\bgoal\b/i, /\btask\b/i, /\brequest\b/i, /\bimplement\b/i, /\bfix\b/i, /\bbuild\b/i, /\breview\b/i, /\bmaintain\b/i, /\bupdate\b/i, /\bimprove\b/i, /\bchange\b/i]);
  const hasContext = hasAny(normalized, [/\bcontext\b/i, /\bproject\b/i, /\biteration\b/i, /\bcurrent state\b/i, /\bconstraint/i, /\bgoal\b/i]);
  const hasAction = hasAny(normalized, [/\bdo\b/i, /\bmake\b/i, /\bimplement\b/i, /\bfix\b/i, /\breview\b/i, /\bupdate\b/i, /\bverify\b/i, /\bcontinue\b/i]);
  const staleRisk = hasAny(normalized, [/\b(current|latest|today|yesterday|now)\b/i, /comments\.md/i, /shared\/projects/i]);
  const noisy = length > 1200 || /\bstanding platform project\b/i.test(normalized);

  const checks: EvalCheck[] = [
    makeCheck("purpose_clarity", hasPurpose && hasAction ? "good" : hasPurpose ? "mixed" : "weak", hasPurpose && hasAction ? "The request exposes a purpose and an expected action." : "The immediate action is not explicit enough."),
    makeCheck("necessary_context", hasContext ? "good" : "mixed", hasContext ? "The message carries relevant project/task context." : "The message has limited context, so the agent may need to infer intent."),
    makeCheck("information_integrity", looksTruncated(normalized) ? "risk" : "good", looksTruncated(normalized) ? "The message appears truncated or abbreviated." : "No obvious truncation marker is present."),
    makeCheck("simplicity", length > 1800 ? "weak" : length > 700 ? "mixed" : "good", length > 1800 ? "The request is overloaded and hard to scan." : length > 700 ? "The request is understandable but mixes durable context with the immediate ask." : "The request is compact enough for the agent to act on."),
    makeCheck("misleading_or_stale_risk", staleRisk ? "mixed" : "good", staleRisk ? "The message contains relative/current or legacy-looking references that should be verified against files/state." : "No obvious stale-reference risk is visible from the text alone."),
  ];

  const score = evalScoreFromChecks(checks);
  const issues = evalIssuesFromChecks(checks);
  const improvement = noisy || length > 700
    ? "Separate stable project context from the immediate request; keep the turn to the concrete ask, acceptance criteria, and changed constraints."
    : "Keep the request as a short ask plus only the context required for the next action.";
  const comment = score === "ok"
    ? "User request is clear, sufficiently contextual, and concise enough to guide the next agent turn."
    : score === "check"
      ? "User request is actionable but could be cleaner; it mixes useful context with extra or potentially stale detail."
      : "User request needs cleanup before it is a strong work instruction; clarify the immediate ask and remove misleading or overloaded context.";

  return { score: score === "ok" ? "context" : score, issues, checks, comment, improvement };
}

function buildAssistantTurnEvaluation(text: string, calls: any[]): { score: "ok" | "check" | "issue"; issues: string[]; checks: EvalCheck[]; comment: string; improvement: string } {
  const toolNames = calls.map((call) => String(call?.name ?? "")).filter(Boolean);
  const callCount = calls.length;
  const hasText = text.trim().length > 0;
  const hasConcreteTools = toolNames.length === callCount;
  const broadShell = calls.some((call) => String(call?.name ?? "") === "bash" && /\b(find|grep|rg)\b[\s\S]{0,80}\b\/app\b/.test(String(call?.arguments?.command ?? call?.input?.command ?? "")));

  const checks: EvalCheck[] = [
    makeCheck("purpose_clarity", callCount > 0 || hasText ? "good" : "weak", callCount > 0 ? "The assistant chose concrete actions for the turn." : hasText ? "The assistant responded in text without tool work." : "No visible response or action is present."),
    makeCheck("tool_necessity", callCount === 0 ? "not_applicable" : callCount <= 3 ? "good" : callCount <= 6 ? "mixed" : "weak", callCount === 0 ? "No tool calls to judge." : callCount <= 3 ? "Tool call count is modest for one turn." : "Tool call count is high; inspect whether the calls should have been split or narrowed."),
    makeCheck("grounding", hasConcreteTools ? "good" : callCount ? "mixed" : "not_applicable", hasConcreteTools ? "Tool requests name concrete tools and arguments." : callCount ? "Some tool request metadata is incomplete." : "No tool grounding needed for this turn."),
    makeCheck("simplicity", broadShell ? "mixed" : "good", broadShell ? "The command looks broad; a narrower repository/file target would be cleaner if known." : "The turn is not obviously over-broad from the request alone."),
    makeCheck("misleading_or_stale_risk", "good", "No misleading claim is visible in the assistant request itself; verify against tool output."),
  ];
  const score = evalScoreFromChecks(checks) === "context" ? "check" : evalScoreFromChecks(checks) as "ok" | "check" | "issue";
  const issues = evalIssuesFromChecks(checks);
  const improvement = callCount > 3
    ? "Batch only tightly related tool calls and explain the purpose if the next step is not obvious from the call."
    : "Keep each tool request tied to the next needed evidence or change.";
  const comment = score === "ok"
    ? "Assistant turn is purposeful and reasonably scoped; judge final value against the following tool output."
    : score === "check"
      ? "Assistant turn is plausible but should be checked for scope and necessity against the surrounding context."
      : "Assistant turn is weakly formed or over-broad; it needs clearer purpose and tighter evidence gathering.";
  return { score, issues, checks, comment, improvement };
}

function buildToolOutputEvaluation(output: string, isError: boolean): { score: "ok" | "check" | "issue"; issues: string[]; checks: EvalCheck[]; comment: string; improvement: string } {
  const empty = output.trim().length === 0;
  const failureText = isError || /\b(?:error|failed|not found|no such file|permission denied)\b/i.test(output);
  const checks: EvalCheck[] = [
    makeCheck("evidence_value", empty ? "weak" : failureText ? "mixed" : "good", empty ? "The tool returned no usable evidence." : failureText ? "The output is useful mainly as failure evidence." : "The output provides usable evidence for the next step."),
    makeCheck("integrity", /\.\.\.|truncated/i.test(output) ? "mixed" : "good", /\.\.\.|truncated/i.test(output) ? "Output may be truncated; inspect raw line if exact content matters." : "No obvious truncation marker is visible."),
    makeCheck("actionability", failureText ? "mixed" : "good", failureText ? "The next turn should recover from or explain this failure." : "The next turn can use this output directly."),
  ];
  const score = failureText || empty ? (empty ? "issue" : "check") : "ok";
  const issues = failureText ? ["tool_output_failure_or_mismatch"] : empty ? ["empty_tool_output"] : [];
  const improvement = failureText
    ? "Use the failure as evidence, adjust the path/query/assumption, and avoid claiming success from this output alone."
    : "Cite the relevant part of the output in the next judgment or action.";
  const comment = failureText
    ? "Tool output shows a failure or mismatch; the agent should recover before relying on this step."
    : empty
      ? "Tool output is empty, so it provides weak evidence unless emptiness was expected."
      : "Tool output provides usable evidence for the session.";
  return { score, issues, checks, comment, improvement };
}

export function buildSessionEvalTrailRows(params: SessionEvalTrailParams): Record<string, unknown>[] {
  const createdAt = params.createdAt ?? Date.now();
  const source = params.source ?? "evaluator-heuristic";
  const opCount = Number(params.session?.opCount ?? 0);
  const rows: Record<string, unknown>[] = [
    {
      type: "summary",
      target: "session",
      schemaVersion: 1,
      sessionId: params.sessionId,
      source,
      author: "evaluator",
      createdAt,
      transcriptSource: params.transcriptSource,
      verdict: params.heuristic.verdict,
      quality: params.heuristic.quality,
      efficiency: params.heuristic.efficiency,
      productiveCalls: Math.max(0, opCount - params.heuristic.issues.length),
      wastedCalls: params.heuristic.issues.length,
      issues: params.heuristic.issues,
      lane: params.route.lane,
      routeReason: params.route.reason,
      signals: params.route.signals,
      heuristicVersion: HEURISTIC_VERSION,
      summary: {
        status: params.session?.status ?? "unknown",
        agent: params.session?.agent ?? "unknown",
        projectId: params.session?.projectId ?? null,
        workflowRunId: params.session?.workflowRunId ?? null,
        opCount,
      },
      comment: params.heuristic.issues.length
        ? `Session ${params.heuristic.verdict}: ${params.heuristic.issues.join("; ")}`
        : `Session ${params.heuristic.verdict}; route=${params.route.lane}.`,
    },
  ];

  const rawLines = params.transcript.split(/\n/);
  const toolCallTargets = new Map<string, EvalTarget>();
  for (let idx = 0; idx < rawLines.length; idx += 1) {
    const raw = rawLines[idx];
    if (!raw.trim()) continue;
    const line = idx + 1;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      rows.push({
        type: "line",
        schemaVersion: 1,
        sessionId: params.sessionId,
        line,
        source,
        author: "evaluator",
        createdAt,
        rawSource: params.transcriptSource,
        rawRole: "unparsed",
        target: "execution",
        score: "issue",
        issues: ["unparsed_jsonl"],
        purpose: "unknown",
        rawPreview: compactEvalText(raw),
        comment: "Raw session record is not valid JSONL; inspect manually.",
      });
      continue;
    }

    const rawRole = String(parsed?.role ?? "unknown");
    const role = rawRole.toLowerCase();
    const base = {
      type: "line",
      schemaVersion: 1,
      sessionId: params.sessionId,
      line,
      source,
      author: "evaluator",
      createdAt,
      rawSource: params.transcriptSource,
      rawRole,
      rawPreview: compactEvalText(raw),
    };

    if (role === "user") {
      const userText = lineContentText(parsed.content);
      const evaluation = buildUserTurnEvaluation(userText);
      rows.push({
        ...base,
        target: "request",
        score: evaluation.score,
        issues: evaluation.issues,
        purpose: "work_request_or_context",
        actor: "user",
        contentPreview: compactEvalText(userText),
        checks: evaluation.checks,
        improvement: evaluation.improvement,
        comment: evaluation.comment,
      });
      continue;
    }

    if (role === "assistant") {
      const blocks = Array.isArray(parsed.content) ? parsed.content : [];
      const textBlocks = blocks.filter((block: any) => block?.type === "text").map((block: any) => block.text || "").join(" ");
      const calls = blocks.filter((block: any) => block?.type === "tool_use" || block?.type === "toolCall");
      const toolTargets = calls.map(classifyToolCallTarget);
      calls.forEach((call: any, idx: number) => {
        if (call?.id) toolCallTargets.set(String(call.id), toolTargets[idx] ?? "execution");
      });
      const rowTarget: EvalTarget = calls.length > 0 && toolTargets.every((target) => target === "verification") ? "verification" : "execution";
      const evaluation = buildAssistantTurnEvaluation(textBlocks, calls);
      rows.push({
        ...base,
        target: rowTarget,
        score: evaluation.score,
        issues: evaluation.issues,
        purpose: calls.length ? "assistant_tool_planning" : "assistant_response",
        actor: "assistant",
        toolCallIds: calls.map((call: any) => call.id).filter(Boolean),
        tools: calls.map((call: any) => call.name).filter(Boolean),
        toolTargets,
        model: parsed.model ?? parsed.api?.model ?? null,
        provider: parsed.provider ?? parsed.api?.provider ?? null,
        usage: parsed.usage ?? null,
        stopReason: parsed.stopReason ?? null,
        contentPreview: compactEvalText(textBlocks),
        checks: evaluation.checks,
        improvement: evaluation.improvement,
        comment: evaluation.comment,
      });
      continue;
    }

    if (role === "toolresult" || role === "tool_result") {
      const output = lineContentText(parsed.content);
      const isError = Boolean(parsed.isError) || /\b(?:error|failed|not found|no such file|permission denied)\b/i.test(output);
      const evaluation = buildToolOutputEvaluation(output, isError);
      const callTarget = toolCallTargets.get(String(parsed.toolCallId ?? ""));
      const target: EvalTarget = callTarget === "verification" || parsed.toolName === "finish" ? "verification" : "result";
      rows.push({
        ...base,
        target,
        score: evaluation.score,
        issues: evaluation.issues,
        purpose: target === "verification" ? "verification_output" : "tool_output",
        actor: "tool",
        toolCallId: parsed.toolCallId ?? null,
        toolName: parsed.toolName ?? null,
        outputPreview: compactEvalText(output),
        checks: evaluation.checks,
        improvement: evaluation.improvement,
        comment: evaluation.comment,
      });
      continue;
    }

    rows.push({
      ...base,
      target: "execution",
      score: "unknown",
      issues: [],
      purpose: "unknown_record",
      comment: "Unrecognized session record role; inspect manually.",
    });
  }

  const lineRows = rows.filter((row) => row.type === "line");
  const repairDecision = buildRepairDecision(params, lineRows);
  const normalized = normalizeEvaluationState({
    heuristic: params.heuristic,
    route: params.route,
    repairDecision,
  });
  Object.assign(rows[0], {
    verdict: normalized.heuristic.verdict,
    quality: normalized.heuristic.quality,
    efficiency: normalized.heuristic.efficiency,
    productiveCalls: Math.max(0, opCount - normalized.heuristic.issues.length),
    wastedCalls: normalized.heuristic.issues.length,
    issues: normalized.heuristic.issues,
    lane: normalized.route.lane,
    routeReason: normalized.route.reason,
    signals: normalized.route.signals,
    comment: normalized.heuristic.issues.length
      ? `Session ${normalized.heuristic.verdict}: ${normalized.heuristic.issues.join("; ")}`
      : `Session ${normalized.heuristic.verdict}; route=${normalized.route.lane}.`,
    downgradedFromRepairExecution: normalized.downgradedFromRepairExecution,
    targetBreakdown: repairDecision.targetBreakdown,
    repairDecision,
    workRequest: {
      source: params.session?.source ?? null,
      projectId: params.session?.projectId ?? null,
      parentSessionId: params.session?.parentSessionId ?? null,
    },
  });
  return rows;
}

export function appendSessionEvalTrail(evalPath: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  mkdirSync(dirname(evalPath), { recursive: true });
  appendFileSync(evalPath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function writeSessionEvalTrail(transcriptPath: string, params: SessionEvalTrailParams): { evalPath: string; rows: Record<string, unknown>[] } {
  const evalPath = sessionEvalTrailPath(transcriptPath);
  const rows = buildSessionEvalTrailRows(params);
  appendSessionEvalTrail(evalPath, rows);
  return { evalPath, rows };
}

function summaryRow(rows: Record<string, unknown>[]): Record<string, unknown> | undefined {
  return rows.find((row) => row.type === "summary");
}

function summaryOwnerFindings(rows: Record<string, unknown>[]): OwnerFinding[] {
  const summary = summaryRow(rows) as any;
  const findings = summary?.repairDecision?.ownerFindings;
  return Array.isArray(findings) ? findings as OwnerFinding[] : [];
}

function summaryImmediateFindingIds(rows: Record<string, unknown>[]): string[] {
  const summary = summaryRow(rows) as any;
  const ids = summary?.repairDecision?.notificationDecision?.immediateFindingIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}

function normalizedSummaryState(rows: Record<string, unknown>[]): NormalizedEvaluationState | null {
  const summary = summaryRow(rows) as any;
  if (!summary) return null;
  return {
    heuristic: {
      verdict: String(summary.verdict ?? "needs_improvement"),
      quality: Number(summary.quality ?? 0),
      efficiency: Number(summary.efficiency ?? 0),
      issues: Array.isArray(summary.issues) ? summary.issues.map(String) : [],
    },
    route: {
      lane: (summary.lane ?? "needs_triage") as EvaluationLane,
      reason: String(summary.routeReason ?? ""),
      signals: Array.isArray(summary.signals) ? summary.signals.map(String) : [],
    },
    downgradedFromRepairExecution: Boolean(summary.downgradedFromRepairExecution),
  };
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

function shouldOverrideWithReview(storedVerdict: string, reviewedVerdict: string | null): boolean {
  if (!reviewedVerdict) return false;
  if (storedVerdict === "good") return ["needs_improvement", "acceptable"].includes(reviewedVerdict);
  if (storedVerdict === "acceptable") return reviewedVerdict === "needs_improvement";
  return false;
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
  evalTrailPath?: string;
}): string {
  const { sessionId, session, transcriptPath, artifactPath, workflowCollectedFacts, route, evalTrailPath } = params;
  const lanePurpose = route.lane === "needs_triage"
    ? "Find the root cause, classify scope, assign a concrete agent/human owner, and route evidence-backed findings."
    : "Judge why this good session produced real value, inspect the actual output, and extract reusable learning if present.";

  return [
    `Review session aftermath for ${sessionId}.`,
    ``,
    `Session: ${JSON.stringify(session, null, 2)}`,
    `Transcript path: ${transcriptPath}`,
    ...(evalTrailPath ? [`Session eval trail: ${evalTrailPath}`] : []),
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
    ...(evalTrailPath ? [
      `Also append JSONL evidence rows to ${evalTrailPath} when your review finds session-level or line-level judgments beyond the heuristic seed.`,
      `Think hard and write actual critique, not transcript captions: judge user request quality, assistant decisions, tool-call necessity, evidence quality, recovery, verification, finish honesty, and what should be done better.`,
      `Use free-form JSON fields when useful. Keep only minimal mapping fields stable: type, sessionId, source, author, createdAt, and line/rawSource/rawRole for line-level rows. Do not rewrite existing rows.`,
    ] : []),
    ``,
    `Do exactly this loop:`,
    `1. Evaluate outcome quality: did this session produce real value for its task/project goal?`,
    `2. Check the actual output artifacts/diffs/files when the route signals material output.`,
    `3. Write the concise review to the artifact path above.`,
    `4. Immediately call read() on that same artifact path and confirm the file contains the required sections.`,
    `5. For needs_triage: do not silently fix the project as evaluator. Classify each important issue by scope, assign owner as agent:<name> or human:<role>, and suggest possible actions for that owner.`,
    `6. Notify immediately only for high-severity or blocked/waiting findings; routine critique belongs in the eval trail or digest.`,
    `7. For success_candidate: extract why it worked. If there is reusable learning, record the candidate with evidence instead of promoting a global rule from one session.`,
    `8. Only then call finish(success) or finish(partial); the verify-after-write guard rejects success if the artifact was written but not read back.`,
    ``,
    `Keep the artifact short with sections: Verdict, Evidence, Output Quality, Root Cause, Owner Findings, Learning, Learning Created: yes|no.`,
  ].join("\n");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const trigger = extractTrigger(String(ctx.task ?? ""));
  const sessionId = getSessionIdFromTrigger(trigger);
  const mode = getModeFromTrigger(trigger);

  if (!sessionId) {
    return ctx.escalate("evaluator-aftermath requires a sessionId", { trigger });
  }

  const loadedData = ctx.query.evaluatorAftermathContext({ sessionId }) as any;
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
  const transcriptSource = displayPath(projectRoot, transcriptPath);
  const skipAftermath = shouldSkipAftermathAmplification(session, transcript);
  if (skipAftermath.skip) {
    if (String(evaluation?.verdict ?? "") === "skipped" && evaluationHeuristicVersion(evaluation) >= HEURISTIC_VERSION) {
      return ctx.done(`Session ${sessionId} already skipped (${skipAftermath.reason}).`);
    }

    const skippedHeuristic: HeuristicVerdict = {
      quality: 0,
      efficiency: 0,
      verdict: "skipped",
      issues: [skipAftermath.reason],
    };
    const skippedRoute: EvaluationRoute = { lane: "routine_ok", reason: skipAftermath.reason, signals: [] };
    const skippedTrail = writeSessionEvalTrail(transcriptPath, {
      sessionId,
      session,
      transcript,
      transcriptSource,
      heuristic: skippedHeuristic,
      route: skippedRoute,
      source: "evaluator-skipped",
    });
    const evalTrailDisplayPath = displayPath(projectRoot, skippedTrail.evalPath);
    await (ctx as any).runFunction("record-skipped-evaluation", async () => {
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
          0,
          0,
          0,
          0,
          "skipped",
          JSON.stringify([skipAftermath.reason]),
          JSON.stringify({
            verdict: "skipped",
            status: session.status,
            aftermathWorkflow: true,
            heuristicVersion: HEURISTIC_VERSION,
            skipReason: skipAftermath.reason,
            evalTrailPath: evalTrailDisplayPath,
            opCount: Number(session.opCount ?? 0),
          }),
          null,
          JSON.stringify([]),
          1,
          1,
          Date.now(),
        ],
      );
      return `skipped aftermath for ${sessionId}: ${skipAftermath.reason}`;
    });

    ctx.emit({
      type: "evaluation.skipped",
      source: "evaluator-aftermath",
      owner: "evaluator",
      sessionId,
      agent: session.agent,
      reason: skipAftermath.reason,
      opCount: Number(session.opCount ?? 0),
      heuristicVersion: HEURISTIC_VERSION,
    } as any);

    return ctx.done(`Skipped aftermath for ${sessionId}: ${skipAftermath.reason}.`);
  }

  const heuristic = classifyVerdict(session, transcript);
  const route = classifyEvaluationLane(session, transcript, heuristic);
  const workflowCollectedFacts = formatWorkflowCollectedFacts(session, transcript, heuristic);
  const artifactPath = `agents/evaluator/workspace/aftermath/${sessionId}.md`;
  const artifactAbsPath = join(projectRoot, artifactPath);

  if (!shouldRefreshEvaluation(evaluation, heuristic)) {
    return ctx.done(`Session ${sessionId} already evaluated (${evaluation.verdict}).`);
  }

  const evalTrail = writeSessionEvalTrail(transcriptPath, {
    sessionId,
    session,
    transcript,
    transcriptSource,
    heuristic,
    route,
  });
  const evalTrailDisplayPath = displayPath(projectRoot, evalTrail.evalPath);
  const normalized = normalizedSummaryState(evalTrail.rows) ?? {
    heuristic,
    route,
    downgradedFromRepairExecution: false,
  };

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
        normalized.heuristic.quality,
        normalized.heuristic.efficiency,
        Math.max(0, Number(session.opCount ?? 0) - normalized.heuristic.issues.length),
        normalized.heuristic.issues.length,
        normalized.heuristic.verdict,
        JSON.stringify(normalized.heuristic.issues),
        JSON.stringify({
          verdict: normalized.heuristic.verdict,
          status: session.status,
          aftermathWorkflow: true,
          heuristicVersion: HEURISTIC_VERSION,
          lane: normalized.route.lane,
          routeReason: normalized.route.reason,
          outputSignals: normalized.route.signals,
          downgradedFromRepairExecution: normalized.downgradedFromRepairExecution,
          evalTrailPath: evalTrailDisplayPath,
          ...(evaluation ? { refreshedFrom: evaluation.verdict } : {}),
          ...(normalized.route.lane === "routine_ok" ? {} : { artifactPath }),
        }),
        null,
        JSON.stringify([]),
        1,
        0,
        Date.now(),
      ],
    );
    return `recorded ${normalized.heuristic.verdict} evaluation for ${sessionId}`;
  });

  ctx.emit({
    type: "evaluation.routed",
    source: "evaluator-aftermath",
    owner: "evaluator",
    sessionId,
    agent: session.agent,
    lane: normalized.route.lane,
    verdict: normalized.heuristic.verdict,
    reason: normalized.route.reason,
    signals: normalized.route.signals,
    projectId: session.projectId ?? null,
    workflowRunId: session.workflowRunId ?? null,
    heuristicVersion: HEURISTIC_VERSION,
    downgradedFromRepairExecution: normalized.downgradedFromRepairExecution,
  } as any);

  const immediateFindingIds = new Set(summaryImmediateFindingIds(evalTrail.rows));
  for (const finding of summaryOwnerFindings(evalTrail.rows)) {
    if (!immediateFindingIds.has(finding.id)) continue;
    ctx.emit(learningFeedbackEventPayload({
      sessionId,
      agent: session.agent,
      projectId: session.projectId ?? null,
      workflowRunId: session.workflowRunId ?? null,
      evalTrailPath: evalTrailDisplayPath,
      finding,
    }) as any);
  }

  if (normalized.route.lane === "routine_ok") {
    return ctx.done(`Evaluated ${sessionId}: ${normalized.heuristic.verdict} (${normalized.route.lane}). No review needed.`);
  }

  mkdirSync(join(projectRoot, "agents/evaluator/workspace/aftermath"), { recursive: true });

  const reviewTask = buildReviewTask({
    sessionId,
    session,
    transcriptPath,
    artifactPath,
    workflowCollectedFacts,
    route: normalized.route,
    evalTrailPath: evalTrailDisplayPath,
  });

  const review = await ctx.runAgent("evaluator", reviewTask);

  if ((review as any).status === "error") {
    return ctx.escalate(`Evaluator review failed for ${sessionId}`, { reviewSessionId: (review as any).sessionId });
  }

  const artifactText = readArtifact(artifactAbsPath);
  const reviewedVerdict = artifactVerdict(artifactText);
  if (shouldOverrideWithReview(normalized.heuristic.verdict, reviewedVerdict)) {
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
          JSON.stringify([...(normalized.heuristic.issues ?? []), `review override: ${reviewedVerdict}`]),
          JSON.stringify(overall),
          sessionId,
        ],
      );
      return `review override ${normalized.heuristic.verdict} -> ${reviewedVerdict}`;
    });
    if (normalized.heuristic.verdict === "good") {
      ctx.emit({
        type: "evaluation.false_good",
        ...falseGoodEventPayload({
          sessionId,
          heuristicVerdict: normalized.heuristic.verdict,
          reviewedVerdict,
          reviewSessionId: (review as any).sessionId,
          artifactPath,
          agent: session.agent,
        }),
      } as any);
    }
  }

  ctx.emit({
    type: "evaluation.reviewed",
    source: "evaluator-aftermath",
    owner: "evaluator",
    sessionId,
    agent: session.agent,
    lane: normalized.route.lane,
    verdict: normalized.heuristic.verdict,
    reviewedVerdict,
    reviewSessionId: (review as any).sessionId,
    artifactPath,
    artifactFound: artifactText.length > 0,
    downgradedFromRepairExecution: normalized.downgradedFromRepairExecution,
  } as any);

  if (normalized.route.lane === "success_candidate") {
    ctx.emit({
      type: "evaluation.success_candidate",
      source: "evaluator-aftermath",
      owner: "evaluator",
      sessionId,
      agent: session.agent,
      reason: normalized.route.reason,
      signals: normalized.route.signals,
      reviewSessionId: (review as any).sessionId,
      artifactPath,
    } as any);
  }

  if (normalized.route.lane === "needs_triage") {
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
      lane: normalized.route.lane,
      reviewSessionId: (review as any).sessionId,
      artifactPath,
    } as any);
  }

  return ctx.done(`Evaluated ${sessionId}: ${normalized.heuristic.verdict} (${normalized.route.lane}). Review session: ${(review as any).sessionId}. Artifact: ${artifactPath}`);
}
