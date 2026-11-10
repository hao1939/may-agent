/** Stable installation owner, independent of call alias and source release. */
export type ExecutionRecipient = { kind: "directory" | "programmatic"; id: string };

export function executionRecipientKey(recipient: ExecutionRecipient): string {
  if (
    typeof recipient.id !== "string" ||
    !recipient.id ||
    recipient.id !== recipient.id.trim() ||
    Buffer.byteLength(recipient.id) > 1024
  )
    throw new Error("Execution recipient requires an exact bounded identity");
  if (recipient.kind !== "directory" && recipient.kind !== "programmatic")
    throw new Error("Unknown recipient identity");
  if (
    recipient.kind === "directory" &&
    (recipient.id.startsWith("/") || recipient.id.split("/").some((part) => !part || part === "." || part === ".."))
  )
    throw new Error("Recipient directory must be installation-relative");
  return JSON.stringify([recipient.kind, recipient.id]);
}

/** Use the already resolved definition. An alias, App name or absolute release
 * path cannot stand in for an installation owner. Programmatic definitions
 * without an explicit Host identity remain unknown for capacity admission. */
export function resolvedExecutionRecipient(definition: {
  agentRelativeDir?: string;
  hostIdentity?: string;
}): ExecutionRecipient | null {
  const recipient: ExecutionRecipient | null =
    definition.agentRelativeDir !== undefined
      ? { kind: "directory", id: definition.agentRelativeDir }
      : definition.hostIdentity !== undefined
        ? { kind: "programmatic", id: definition.hostIdentity }
        : null;
  if (recipient) executionRecipientKey(recipient);
  return recipient;
}
