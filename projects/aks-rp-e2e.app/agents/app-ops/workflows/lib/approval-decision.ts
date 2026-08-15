const decisions = ["approve", "adjust", "hold", "decline", "reroute"] as const;

export type ApprovalDecision = (typeof decisions)[number];

export type ParsedApprovalDecision = {
  approvalId: string;
  waitId: string;
  project: string;
  pathId: string;
  packetPath?: string;
  decision: ApprovalDecision;
  message: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseApprovalDecision(
  data: unknown,
): ParsedApprovalDecision | null {
  const details = record(data);
  const message = text(details.content ?? details.message ?? details.text);
  if (!message) return null;
  const decisionText =
    message.match(
      /(?:^|\n)\s*(?:\[approval-decision\]\s*)?Decision:\s*([^\n]+)/i,
    )?.[1] ?? "";
  const decision = decisions.find(
    (candidate) => candidate === decisionText.trim().toLowerCase(),
  );
  const approvalId =
    message.match(/(?:^|\n)\s*Approval id:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const waitId =
    message.match(/(?:^|\n)\s*Wait id:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const project =
    message.match(/(?:^|\n)\s*Project:\s*([^\n]+)/i)?.[1]?.trim() ||
    text(details.project) ||
    "aks-rp-e2e";
  const pathId =
    message.match(/(?:^|\n)\s*Feature path:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  const packetPath =
    message.match(/(?:^|\n)\s*Packet:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
  return decision && approvalId && waitId && pathId
    ? {
        approvalId,
        waitId,
        project,
        pathId,
        ...(packetPath ? { packetPath } : {}),
        decision,
        message,
      }
    : null;
}
