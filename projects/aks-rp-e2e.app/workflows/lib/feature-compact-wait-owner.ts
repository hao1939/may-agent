type CompactWaitOwnerInput = {
  owner?: unknown;
  waitingFor?: unknown;
  waitingForType?: unknown;
};

function textValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function supportedOwner(value: unknown): string {
  const owner = textValue(value);
  return owner === "operator" ||
    owner === "product-owner" ||
    owner === "aks-explorer"
    ? owner
    : "";
}

export function compactWaitOwner(
  input: CompactWaitOwnerInput | string,
): string {
  if (typeof input === "string") return "aks-explorer";

  const explicitOwner = supportedOwner(input.owner);
  if (explicitOwner) return explicitOwner;

  const waitingFor = recordValue(input.waitingFor);
  const waitingForType =
    textValue(input.waitingForType) || textValue(waitingFor?.type);

  if (waitingForType === "owner.decision") return "product-owner";
  if (
    waitingForType === "azure.capacity.available" ||
    waitingForType === "environment.available" ||
    waitingForType === "environment.prerequisite.ready" ||
    waitingForType === "publish.auth.ready"
  ) {
    return "operator";
  }
  return "aks-explorer";
}
