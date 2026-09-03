import { hasDuplicateJsonObjectKeys } from "./json-object-key-exactness";
import {
  identityRobustFrontierSnapshotReference,
  type IdentityRobustFrontierSnapshotExpectation,
} from "./verification-allocation-frontier-snapshot";

export const IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA =
  "scout.verification-allocation-robust-frontier-output/v1" as const;
export const IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA =
  "scout.verification-allocation-snapshot-selection-output/v1" as const;

export type IdentityRobustOutputSchema =
  | typeof IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA
  | typeof IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA;

export type IdentityRobustOutputConsumptionAssessment = {
  schema: IdentityRobustOutputSchema | null;
  providerDenialVerified: boolean;
  computationIdentityMatched: boolean;
  scopedChecksPass: boolean;
};

type ParsedIdentityRobustOutput = {
  schema: IdentityRobustOutputSchema;
  output: Record<string, unknown>;
};

const MAX_IDENTITY_ROBUST_OUTPUT_JSON_DEPTH = 256;

function exceedsJsonNestingLimit(source: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of source) {
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > MAX_IDENTITY_ROBUST_OUTPUT_JSON_DEPTH) return true;
    } else if (character === "}" || character === "]") {
      depth -= 1;
    }
  }
  return false;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseIdentityRobustOutput(
  raw: string,
): ParsedIdentityRobustOutput | null {
  if (exceedsJsonNestingLimit(raw)) return null;
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
    if (hasDuplicateJsonObjectKeys(raw)) return null;
  } catch {
    return null;
  }
  if (!record(candidate)) return null;
  const schema = candidate.schema;
  return schema === IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA ||
    schema === IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA
    ? { schema, output: candidate }
    : null;
}

/**
 * Identify only the outer serialization contract. Callers must validate every
 * nested field separately before using it as computation, policy, or authority
 * evidence.
 */
export function identifyIdentityRobustOutputSchema(
  raw: string,
): IdentityRobustOutputSchema | null {
  return parseIdentityRobustOutput(raw)?.schema ?? null;
}

function hasOnlyProviderDenials(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasOnlyProviderDenials);
  if (!record(value)) return true;
  return Object.entries(value).every(
    ([key, nested]) =>
      (key !== "providerCallsAuthorized" || nested === false) &&
      hasOnlyProviderDenials(nested),
  );
}

/**
 * Validate only the provider-call denial fields required by each recognized
 * v1 shape. This does not validate any computation, evidence, selection, or
 * policy field.
 */
export function verifyIdentityRobustOutputProviderDenial(raw: string): boolean {
  const parsed = parseIdentityRobustOutput(raw);
  if (!parsed || !hasOnlyProviderDenials(parsed.output)) return false;

  if (parsed.schema === IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA) {
    const snapshot = parsed.output.frontierSnapshot;
    const freeze = parsed.output.freezeVerification;
    return (
      record(snapshot) &&
      snapshot.providerCallsAuthorized === false &&
      (freeze === null ||
        (record(freeze) && freeze.providerCallsAuthorized === false))
    );
  }

  const snapshotVerification = parsed.output.snapshotVerification;
  const snapshot = record(snapshotVerification)
    ? snapshotVerification.snapshot
    : undefined;
  const frozenSelection = parsed.output.frozenSelection;
  const freeze = record(frozenSelection)
    ? frozenSelection.freezeVerification
    : undefined;
  return (
    parsed.output.providerCallsAuthorized === false &&
    record(snapshotVerification) &&
    snapshotVerification.providerCallsAuthorized === false &&
    (snapshot === null ||
      (record(snapshot) && snapshot.providerCallsAuthorized === false)) &&
    (frozenSelection === null ||
      (record(frozenSelection) &&
        record(freeze) &&
        freeze.providerCallsAuthorized === false))
  );
}

function validExpectedIdentity(
  expected: IdentityRobustFrontierSnapshotExpectation,
): boolean {
  return (
    /^[0-9a-f]{64}$/.test(expected.rowSha256) &&
    /^[0-9a-f]{64}$/.test(expected.resultSha256) &&
    /^[0-9a-f]{64}$/.test(expected.frontierSha256) &&
    Number.isSafeInteger(expected.frontierCount) &&
    expected.frontierCount > 0
  );
}

function matchesExpectedIdentity(
  candidate: Record<string, unknown>,
  expected: IdentityRobustFrontierSnapshotExpectation,
): boolean {
  return (
    matchesExpectedRowAndResult(candidate, expected) &&
    candidate.frontierSha256 === expected.frontierSha256
  );
}

function matchesExpectedRowAndResult(
  candidate: Record<string, unknown>,
  expected: IdentityRobustFrontierSnapshotExpectation,
): boolean {
  return (
    candidate.rowSha256 === expected.rowSha256 &&
    candidate.resultSha256 === expected.resultSha256
  );
}

/**
 * Match only the serialized computation identity fields against an explicit
 * expectation. This does not recompute or authenticate any result.
 */
export function matchesIdentityRobustOutputComputationIdentity(
  raw: string,
  expected: IdentityRobustFrontierSnapshotExpectation,
): boolean {
  if (!validExpectedIdentity(expected)) return false;
  const parsed = parseIdentityRobustOutput(raw);
  if (!parsed) return false;

  if (parsed.schema === IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA) {
    const snapshot = parsed.output.frontierSnapshot;
    return (
      matchesExpectedRowAndResult(parsed.output, expected) &&
      parsed.output.frontierCount === expected.frontierCount &&
      record(snapshot) &&
      matchesExpectedIdentity(snapshot, expected) &&
      Array.isArray(snapshot.frontier) &&
      snapshot.frontier.length === expected.frontierCount
    );
  }

  const verification = parsed.output.snapshotVerification;
  const snapshot = record(verification) ? verification.snapshot : undefined;
  return (
    record(snapshot) &&
    matchesExpectedIdentity(snapshot, expected) &&
    snapshot.frontierCount === expected.frontierCount &&
    snapshot.frontierSnapshotReference ===
      identityRobustFrontierSnapshotReference(expected)
  );
}

/**
 * Compose the three independently scoped consumer checks without promoting
 * their conjunction to recomputation, policy, provenance, or authority.
 */
export function assessIdentityRobustOutputForConsumption(
  raw: string,
  expected: IdentityRobustFrontierSnapshotExpectation,
): IdentityRobustOutputConsumptionAssessment {
  const schema = identifyIdentityRobustOutputSchema(raw);
  const providerDenialVerified = verifyIdentityRobustOutputProviderDenial(raw);
  const computationIdentityMatched =
    matchesIdentityRobustOutputComputationIdentity(raw, expected);
  return {
    schema,
    providerDenialVerified,
    computationIdentityMatched,
    scopedChecksPass:
      schema !== null && providerDenialVerified && computationIdentityMatched,
  };
}

export function withIdentityRobustFrontierOutputSchema<
  Output extends Record<string, unknown>,
>(
  output: Output,
): Output & {
  schema: typeof IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA;
} {
  return {
    ...output,
    schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
  };
}

export function withIdentityRobustSnapshotSelectionOutputSchema<
  Output extends Record<string, unknown>,
>(
  output: Output,
): Output & {
  schema: typeof IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA;
} {
  return {
    ...output,
    schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
  };
}
