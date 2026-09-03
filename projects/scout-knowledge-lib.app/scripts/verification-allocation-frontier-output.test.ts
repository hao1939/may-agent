import { describe, expect, it } from "bun:test";
import {
  IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
  IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
  identifyIdentityRobustOutputSchema,
  withIdentityRobustFrontierOutputSchema,
  withIdentityRobustSnapshotSelectionOutputSchema,
} from "./verification-allocation-frontier-output";

describe("identity-robust frontier output", () => {
  it("pins one top-level serialization schema over payload claims", () => {
    expect(
      withIdentityRobustFrontierOutputSchema({
        schema: "caller-supplied",
        rowSha256: "a".repeat(64),
      }),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: "a".repeat(64),
    });
  });

  it("keeps snapshot-selection serialization distinct and immutable", () => {
    expect(
      withIdentityRobustSnapshotSelectionOutputSchema({
        schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
        providerCallsAuthorized: false,
      }),
    ).toEqual({
      schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
      providerCallsAuthorized: false,
    });
  });

  it("identifies only exact unambiguous output schemas", () => {
    expect(
      identifyIdentityRobustOutputSchema(
        JSON.stringify({ schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA }),
      ),
    ).toBe(IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA);
    expect(
      identifyIdentityRobustOutputSchema(
        JSON.stringify({
          schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
        }),
      ),
    ).toBe(IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA);

    for (const raw of [
      "not-json",
      "null",
      "[]",
      "{}",
      '{"schema":"scout.verification-allocation-robust-frontier-output/v2"}',
      `{"schema":"${IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA}","schema":"${IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA}"}`,
      `{"schema":"${IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA}","sch\\u0065ma":"${IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA}"}`,
    ]) {
      expect(identifyIdentityRobustOutputSchema(raw)).toBeNull();
    }
  });

  it("does not promote schema identity into nested authority", () => {
    expect(
      identifyIdentityRobustOutputSchema(
        JSON.stringify({
          schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
          providerCallsAuthorized: true,
        }),
      ),
    ).toBe(IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA);
  });
});
