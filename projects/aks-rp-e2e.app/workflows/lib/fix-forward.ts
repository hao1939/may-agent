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
  const status = normalizeText(input.status ?? "");
  const category = normalizeText(input.category ?? "");
  const reason = normalizeText(input.reason ?? "");
  const text = `${status}\n${category}\n${reason}`;

  if (
    text.includes("no parseable result") ||
    text.includes("missing artifact") ||
    text.includes("did not upload") ||
    text.includes("artifact download")
  ) {
    return "missing-result-artifact";
  }
  if (
    text.includes("azure devops") ||
    text.includes("pipeline") ||
    text.includes("workflow") ||
    text.includes("dispatch") ||
    text.includes("run id") ||
    text.includes("ado")
  ) {
    return "pipeline-infrastructure";
  }
  if (
    text.includes("capacity") ||
    text.includes("quota") ||
    text.includes("skunotavailable") ||
    text.includes("managed clusters")
  ) {
    return "capacity-exhausted";
  }
  if (
    text.includes("arm64") ||
    text.includes("x64") ||
    text.includes("cpu architecture")
  ) {
    return "vm-architecture-incompatible";
  }
  if (text.includes("vm size") || text.includes("sku")) {
    return "vm-size-unavailable";
  }
  if (text.includes("api version") || text.includes("apiversion")) {
    return "api-version-incompatible";
  }
  if (
    text.includes("badrequest") ||
    text.includes("invalid request") ||
    text.includes("request shape") ||
    text.includes("property") ||
    text.includes("validation")
  ) {
    return "request-shape-invalid";
  }
  if (
    text.includes("feature flag") ||
    text.includes("not registered") ||
    text.includes("not enabled") ||
    text.includes("preview")
  ) {
    return "feature-flag-missing";
  }
  if (
    text.includes("permission") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("auth failed") ||
    text.includes("token")
  ) {
    return "permission-denied";
  }
  if (
    text.includes("not directly live-executable") ||
    text.includes("existing-cluster carrier") ||
    text.includes("shared-cluster carrier") ||
    text.includes("scenario test is not standalone")
  ) {
    return "scenario-test-not-standalone";
  }
  if (
    text.includes("check-mode") ||
    text.includes("typescript") ||
    text.includes("syntax") ||
    text.includes("assertion") ||
    text.includes("test code")
  ) {
    return "test-code-bug";
  }
  if (
    text.includes("compact") &&
    (text.includes("conflict") ||
      text.includes("coverage") ||
      text.includes("partial") ||
      text.includes("package"))
  ) {
    return "compact-plan-conflict";
  }
  if (
    text.includes("product behavior") ||
    text.includes("product mismatch") ||
    text.includes("behavior mismatch")
  ) {
    return "product-behavior-mismatch";
  }
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
