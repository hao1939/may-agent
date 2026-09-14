import type { AgentContextPreparer } from "@may-agent/sdk";

/** Synthetic App policy, deliberately outside generic execution code. */
const prepare: AgentContextPreparer = ({ task }) => {
  let packet: Record<string, unknown>;
  try {
    packet = JSON.parse(task);
  } catch {
    return task;
  }
  if (!packet || packet.contract !== "review-brief/v1") return task;
  const log = packet.log as { ref?: unknown; content?: unknown } | undefined;
  // Keep every current field. Only the duplicated log body moves behind its
  // existing reference. Without that reference the full brief is the fallback.
  if (!log || typeof log.ref !== "string" || !log.ref.trim() || typeof log.content !== "string") return task;
  return JSON.stringify({ ...packet, log: { ...log, content: undefined } });
};

export default prepare;
