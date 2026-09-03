import { describe, expect, it } from "bun:test";
import {
  IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
  IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
  identifyIdentityRobustOutputSchema,
  verifyIdentityRobustOutputProviderDenial,
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

  it("validates direct-output provider denial without validating other fields", () => {
    const output = {
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      frontierSnapshot: { providerCallsAuthorized: false },
      freezeVerification: null,
      unverifiedComputationClaim: "not-checked",
    };
    expect(
      verifyIdentityRobustOutputProviderDenial(JSON.stringify(output)),
    ).toBe(true);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({
          ...output,
          frontierSnapshot: { providerCallsAuthorized: true },
        }),
      ),
    ).toBe(false);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({ ...output, frontierSnapshot: {} }),
      ),
    ).toBe(false);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({
          ...output,
          freezeVerification: { providerCallsAuthorized: false },
        }),
      ),
    ).toBe(true);
  });

  it("validates every snapshot-output provider denial", () => {
    const output = {
      schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
      providerCallsAuthorized: false,
      snapshotVerification: {
        providerCallsAuthorized: false,
        snapshot: { providerCallsAuthorized: false },
      },
      frozenSelection: {
        freezeVerification: { providerCallsAuthorized: false },
        selection: { selected: null },
      },
    };
    expect(
      verifyIdentityRobustOutputProviderDenial(JSON.stringify(output)),
    ).toBe(true);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({
          ...output,
          frozenSelection: {
            freezeVerification: { providerCallsAuthorized: false },
            selection: { providerCallsAuthorized: true },
          },
        }),
      ),
    ).toBe(false);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({
          ...output,
          snapshotVerification: { providerCallsAuthorized: false },
        }),
      ),
    ).toBe(false);
    expect(
      verifyIdentityRobustOutputProviderDenial(
        JSON.stringify({
          ...output,
          snapshotVerification: {
            providerCallsAuthorized: false,
            snapshot: null,
          },
          frozenSelection: null,
        }),
      ),
    ).toBe(true);
  });
});
