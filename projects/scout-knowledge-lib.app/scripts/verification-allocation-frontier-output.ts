export const IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA =
  "scout.verification-allocation-robust-frontier-output/v1" as const;

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
