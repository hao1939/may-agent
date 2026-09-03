import { hasDuplicateJsonObjectKeys } from "./json-object-key-exactness";

export const IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA =
  "scout.verification-allocation-robust-frontier-output/v1" as const;
export const IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA =
  "scout.verification-allocation-snapshot-selection-output/v1" as const;

export type IdentityRobustOutputSchema =
  | typeof IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA
  | typeof IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA;

type ParsedIdentityRobustOutput = {
  schema: IdentityRobustOutputSchema;
  output: Record<string, unknown>;
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseIdentityRobustOutput(
  raw: string,
): ParsedIdentityRobustOutput | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  if (hasDuplicateJsonObjectKeys(raw) || !record(candidate)) return null;
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
