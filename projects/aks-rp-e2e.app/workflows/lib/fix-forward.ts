export type FixForwardFailureClass =
  | "vm-size-unavailable"
  | "vm-architecture-incompatible"
  | "api-version-incompatible"
  | "request-shape-invalid"
  | "feature-flag-missing"
  | "permission-denied"
  | "capacity-exhausted"
  | "product-behavior-mismatch"
  | "scenario-test-not-standalone"
  | "test-code-bug"
  | "compact-plan-conflict"
  | "pipeline-infrastructure"
  | "missing-result-artifact"
  | "needs-diagnosis";

const fixForwardFailureClasses = new Set<FixForwardFailureClass>([
  "vm-size-unavailable",
  "vm-architecture-incompatible",
  "api-version-incompatible",
  "request-shape-invalid",
  "feature-flag-missing",
  "permission-denied",
  "capacity-exhausted",
  "product-behavior-mismatch",
  "scenario-test-not-standalone",
  "test-code-bug",
  "compact-plan-conflict",
  "pipeline-infrastructure",
  "missing-result-artifact",
  "needs-diagnosis",
]);

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, "<id>")
    .replace(/\b\d{6,}\b/g, "<number>")
    .replace(/\s+/g, " ")
    .slice(0, 600);
}

export function classifyFixForwardFailure(input: {
  status?: string | null;
  reason?: string | null;
  category?: string | null;
}): FixForwardFailureClass {
  const category = input.category?.trim() as FixForwardFailureClass | undefined;
  if (category && fixForwardFailureClasses.has(category)) return category;
  return "needs-diagnosis";
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

export function fixForwardInputFingerprint(value: unknown): string {
  return normalizeText(stableJson(value));
}

export function fixForwardErrorFingerprint(input: {
  status?: string | null;
  failureClass?: string | null;
  reason?: string | null;
  resultPath?: string | null;
}): string {
  return fixForwardInputFingerprint({
    status: input.status ?? "",
    failureClass: input.failureClass ?? "",
    reason: normalizeText(input.reason ?? ""),
    resultPath: input.resultPath ?? "",
  });
}
