import { hasDuplicateJsonObjectKeys } from "./json-object-key-exactness";

export const IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA =
  "scout.verification-allocation-robust-frontier-output/v1" as const;
export const IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA =
  "scout.verification-allocation-snapshot-selection-output/v1" as const;

export type IdentityRobustOutputSchema =
  | typeof IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA
  | typeof IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA;

/**
 * Identify only the outer serialization contract. Callers must validate every
 * nested field separately before using it as computation, policy, or authority
 * evidence.
 */
export function identifyIdentityRobustOutputSchema(
  raw: string,
): IdentityRobustOutputSchema | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    hasDuplicateJsonObjectKeys(raw) ||
    !candidate ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return null;
  }
  const schema = (candidate as Record<string, unknown>).schema;
  return schema === IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA ||
    schema === IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA
    ? schema
    : null;
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
