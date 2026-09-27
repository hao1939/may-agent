import { createHash } from "node:crypto";
import type { PublicTaskEvidenceProvider } from "./public-task-evidence.js";

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export type SessionRead = (
  sessionId: string,
  transcript: boolean,
) => Promise<Record<string, unknown>>;

/** Existing public HTTP reads only. The Host currently parses the entire
 * transcript server-side; this bounds client consumption, not Host parsing. */
export const readPublicSession: SessionRead = async (sessionId, transcript) => {
  if (!/^s_[a-zA-Z0-9_-]+$/.test(sessionId))
    throw new Error("unsupported session identity");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(
      `http://localhost:8080/api/sessions/${sessionId}${transcript ? "/transcript" : ""}`,
      { signal: controller.signal, redirect: "error" },
    );
    if (!response.ok || !response.body)
      throw new Error(`session HTTP read unavailable (${response.status})`);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1_000_000)
          throw new Error(
            "session HTTP response truncated: 1000000 byte limit",
          );
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } finally {
    clearTimeout(timer);
  }
};

/** A bounded process window, not a meaningfulness or efficiency classifier.
 * Never follow execution IDs supplied by prose or arbitrary result fields. */
export async function readTaskProcessEvidence(
  appId: string,
  taskId: string,
  detail: Record<string, unknown>,
  provider: Pick<PublicTaskEvidenceProvider, "getEvent" | "readAttempts">,
  readSession: SessionRead = readPublicSession,
) {
  const gaps: string[] = [];
  const attempts: Array<Record<string, unknown>> = [];
  const limits = {
    attempts: 3,
    messages: 96,
    fieldChars: 800,
    projectionBytes: 65536,
    responseBytes: 1_000_000,
  };
  if (appId.toLowerCase().replace(/\.app$/, "") === "evaluation")
    return {
      version: 1,
      limits,
      attempts,
      gaps: ["Evaluation-owned process excluded"],
    };
  const history = Array.isArray(detail.history) ? detail.history : [];
  const seen = new Set<string>();
  const references = history
    .map(object)
    .filter((entry) => entry.eventType === "project.task.reconciled")
    .sort((a, b) => Number(b.eventId) - Number(a.eventId))
    .filter((entry) => {
      if (typeof entry.attemptId !== "string" || seen.has(entry.attemptId))
        return false;
      seen.add(entry.attemptId);
      return true;
    });
  if (!references.length)
    gaps.push("No exact reconciled attempt references; process unassessed");
  if (detail.historyTruncated || references.length > limits.attempts)
    gaps.push(
      "Process window limited to three newest referenced attempts; older execution unassessed",
    );
  for (const ref of references.slice(0, limits.attempts)) {
    const identity = {
      eventId: ref.eventId,
      attemptId: ref.attemptId,
      generation: ref.generation,
    };
    try {
      if (
        !Number.isSafeInteger(ref.eventId) ||
        ref.eventId <= 0 ||
        !Number.isSafeInteger(ref.generation) ||
        ref.generation <= 0
      )
        throw new Error("reconciled reference identity unavailable");
      const event = await provider.getEvent(ref.eventId);
      const data = object(event.data);
      if (
        String(event.id) !== String(ref.eventId) ||
        event.type !== "project.task.reconciled" ||
        data.project !== appId ||
        data.taskId !== taskId ||
        data.generation !== ref.generation ||
        data.attemptId !== ref.attemptId
      )
        throw new Error("reconciled event correlation mismatch");
      const attempt = await provider.readAttempts({ appId, taskId, attemptId: ref.attemptId });
      if (attempt.available !== true || attempt.appId !== appId || attempt.taskId !== taskId ||
          attempt.attemptId !== ref.attemptId || attempt.generation !== ref.generation)
        throw new Error("canonical attempt correlation mismatch");
      const linkedSessions = Array.isArray(attempt.sessions) ? attempt.sessions.map(object) : [];
      const sessionId = typeof attempt.sessionId === "string" && /^s_[a-zA-Z0-9_-]+$/.test(attempt.sessionId)
        ? attempt.sessionId : linkedSessions[0]?.sessionId;
      if (typeof sessionId !== "string" || !/^s_[a-zA-Z0-9_-]+$/.test(sessionId))
        throw new Error("No readable session linked by canonical attempt; workflow-only process unassessed");
      if (linkedSessions.length > 1 || attempt.executionsTruncated)
        gaps.push(`Only one linked session read for ${ref.attemptId}; other workflow/helper execution unassessed`);
      function binding(response: Record<string, unknown>) {
        const session = object(response.session);
        if (
          session.sessionId !== sessionId ||
          session.app_id !== appId ||
          session.task_id !== taskId ||
          session.task_generation !== ref.generation ||
          session.attempt_id !== ref.attemptId
        )
          throw new Error("session Task/attempt correlation mismatch");
        if (typeof session.agent !== "string" || !session.agent.trim())
          throw new Error("session worker identity unavailable");
        if (
          ["evaluator", "evaluator-deepseek", "judge"].includes(
            session.agent.toLowerCase().replace(/^agent:/, ""),
          )
        )
          throw new Error("Evaluation worker process excluded");
        if (!["done", "error", "interrupted"].includes(session.status))
          throw new Error("session is not terminal; process unassessed");
        return {
          sessionId,
          appId,
          taskId,
          generation: session.task_generation,
          attemptId: session.attempt_id,
          agent: session.agent,
          status: session.status,
          endedAt: session.endedAt,
        };
      }
      const before = binding(await readSession(sessionId, false));
      const transcript = await readSession(sessionId, true);
      const after = binding(await readSession(sessionId, false));
      if (hash(before) !== hash(after))
        throw new Error("session binding changed during read");
      const source = `.state/sessions/${sessionId}/session.jsonl`;
      if (
        transcript.sessionId !== sessionId ||
        transcript.source !== source ||
        !Array.isArray(transcript.messages) ||
        transcript.messageCount !== transcript.messages.length
      )
        throw new Error("transcript identity/count mismatch");
      const messages: Array<Record<string, unknown>> = [];
      let bytes = 0;
      let clipped = transcript.messages.length > limits.messages;
      function clip(value: unknown): string {
        const str =
          typeof value === "string" ? value : JSON.stringify(value ?? "");
        if (str.length > limits.fieldChars) clipped = true;
        return str.slice(0, limits.fieldChars);
      }
      for (const raw of transcript.messages.slice(0, limits.messages)) {
        const msg = object(raw);
        if (
          msg.rawSource !== source ||
          !Number.isSafeInteger(msg.rawLine) ||
          msg.rawLine < 1
        )
          throw new Error("transcript message source mismatch");
        const calls = Array.isArray(msg.toolCalls) ? msg.toolCalls : [];
        if (calls.length > 8) clipped = true;
        const projected = {
          role: msg.role,
          rawLine: msg.rawLine,
          rawSource: source,
          text: clip(msg.text ?? msg.content),
          ...(msg.toolCallId
            ? {
                toolCallIdSha256: hash(msg.toolCallId),
                toolName: clip(msg.toolName),
                isError: msg.isError,
              }
            : {}),
          ...(calls.length
            ? {
                toolCalls: calls.slice(0, 8).map((value) => {
                  const call = object(value);
                  return {
                    toolCallIdSha256: hash(call.id),
                    tool: clip(call.tool),
                    args: clip(call.args),
                    rawBlockIndex: call.rawBlockIndex,
                  };
                }),
              }
            : {}),
        };
        const size = Buffer.byteLength(JSON.stringify(projected));
        if (bytes + size > limits.projectionBytes) {
          clipped = true;
          break;
        }
        bytes += size;
        messages.push(projected);
      }
      attempts.push({
        ...identity,
        session: before,
        source,
        transcriptSha256: hash(transcript),
        eventSha256: hash(event),
        executionLinks: attempt,
        status: clipped ? "truncated" : "read",
        messageCount: transcript.messageCount,
        messages,
        coverage:
          "Public transcript projection, not complete raw execution: Host omits some message kinds and caps tool results at 2000 characters; client field/message/byte limits also apply. No child execution is included.",
      });
      if (clipped)
        gaps.push(
          `Process projection truncated: ${ref.attemptId}/${sessionId}; unread scope unassessed`,
        );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempts.push({ ...identity, status: "unavailable", reason });
      gaps.push(`Process unavailable: ${ref.attemptId}: ${reason}`);
    }
  }
  // Hash exactly the JSON-retainable snapshot. Optional public fields may be
  // absent; undefined keys must not change identity after report read-back.
  return {
    version: 1,
    limits,
    attempts: JSON.parse(JSON.stringify(attempts)) as typeof attempts,
    gaps,
    coverage: { requested: Math.min(references.length, limits.attempts), readable: attempts.filter((a) => a.status !== "unavailable").length },
  };
}
