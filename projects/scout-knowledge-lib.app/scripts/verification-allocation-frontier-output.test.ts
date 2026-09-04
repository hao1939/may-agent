import { describe, expect, it } from "bun:test";
import {
  IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
  IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
  assessIdentityRobustOutputForConsumption,
  identifyIdentityRobustOutputSchema,
  matchesIdentityRobustOutputComputationIdentity,
  verifyIdentityRobustOutputProviderDenial,
  withIdentityRobustFrontierOutputSchema,
  withIdentityRobustSnapshotSelectionOutputSchema,
} from "./verification-allocation-frontier-output";
import { identityRobustFrontierSnapshotReference } from "./verification-allocation-frontier-snapshot";

const expectedIdentity = {
  rowSha256: "a".repeat(64),
  resultSha256: "b".repeat(64),
  frontierSha256: "c".repeat(64),
  frontierCount: 2,
};

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

  it("matches direct-output identity without calling it recomputation", () => {
    const output = {
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: expectedIdentity.rowSha256,
      resultSha256: expectedIdentity.resultSha256,
      frontierCount: expectedIdentity.frontierCount,
      frontierSnapshot: {
        rowSha256: expectedIdentity.rowSha256,
        resultSha256: expectedIdentity.resultSha256,
        frontierSha256: expectedIdentity.frontierSha256,
        frontier: [{ unverified: 1 }, { unverified: 2 }],
      },
    };
    expect(
      matchesIdentityRobustOutputComputationIdentity(
        JSON.stringify(output),
        expectedIdentity,
      ),
    ).toBe(true);
    expect(
      matchesIdentityRobustOutputComputationIdentity(
        JSON.stringify({ ...output, frontierCount: 3 }),
        expectedIdentity,
      ),
    ).toBe(false);
    expect(
      matchesIdentityRobustOutputComputationIdentity(
        JSON.stringify({
          ...output,
          frontierSnapshot: {
            ...output.frontierSnapshot,
            frontierSha256: "d".repeat(64),
          },
        }),
        expectedIdentity,
      ),
    ).toBe(false);
  });

  it("matches snapshot-output identity and its derived reference", () => {
    const snapshot = {
      ...expectedIdentity,
      frontierSnapshotReference:
        identityRobustFrontierSnapshotReference(expectedIdentity),
      providerCallsAuthorized: true,
    };
    const output = {
      schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
      snapshotVerification: { snapshot },
    };
    expect(
      matchesIdentityRobustOutputComputationIdentity(
        JSON.stringify(output),
        expectedIdentity,
      ),
    ).toBe(true);
    expect(
      matchesIdentityRobustOutputComputationIdentity(
        JSON.stringify({
          ...output,
          snapshotVerification: {
            snapshot: {
              ...snapshot,
              frontierSnapshotReference: `frontier-snapshot-sha256:${"d".repeat(64)}`,
            },
          },
        }),
        expectedIdentity,
      ),
    ).toBe(false);
    expect(
      matchesIdentityRobustOutputComputationIdentity(JSON.stringify(output), {
        ...expectedIdentity,
        frontierCount: 0,
      }),
    ).toBe(false);
  });

  it("requires every direct-output consumer check for the all-of result", () => {
    const output = {
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: expectedIdentity.rowSha256,
      resultSha256: expectedIdentity.resultSha256,
      frontierCount: expectedIdentity.frontierCount,
      frontierSnapshot: {
        rowSha256: expectedIdentity.rowSha256,
        resultSha256: expectedIdentity.resultSha256,
        frontierSha256: expectedIdentity.frontierSha256,
        frontier: [{ unverified: 1 }, { unverified: 2 }],
        providerCallsAuthorized: false,
      },
      freezeVerification: null,
    };

    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify(output),
        expectedIdentity,
      ),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      providerDenialVerified: true,
      computationIdentityMatched: true,
      scopedChecksPass: true,
    });
    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify({
          ...output,
          frontierSnapshot: {
            ...output.frontierSnapshot,
            providerCallsAuthorized: true,
          },
        }),
        expectedIdentity,
      ),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      providerDenialVerified: false,
      computationIdentityMatched: true,
      scopedChecksPass: false,
    });
    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify({ ...output, resultSha256: "d".repeat(64) }),
        expectedIdentity,
      ),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      providerDenialVerified: true,
      computationIdentityMatched: false,
      scopedChecksPass: false,
    });
  });

  it("composes the same all-of boundary for snapshot output", () => {
    const output = {
      schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
      providerCallsAuthorized: false,
      snapshotVerification: {
        providerCallsAuthorized: false,
        snapshot: {
          ...expectedIdentity,
          frontierSnapshotReference:
            identityRobustFrontierSnapshotReference(expectedIdentity),
          providerCallsAuthorized: false,
        },
      },
      frozenSelection: null,
    };
    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify(output),
        expectedIdentity,
      ),
    ).toEqual({
      schema: IDENTITY_ROBUST_SNAPSHOT_SELECTION_OUTPUT_SCHEMA,
      providerDenialVerified: true,
      computationIdentityMatched: true,
      scopedChecksPass: true,
    });
    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify({ ...output, providerCallsAuthorized: true }),
        expectedIdentity,
      ).scopedChecksPass,
    ).toBe(false);
  });

  it("does not name unchecked payload claims as full acceptance", () => {
    const raw = JSON.stringify({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: expectedIdentity.rowSha256,
      resultSha256: expectedIdentity.resultSha256,
      frontierCount: expectedIdentity.frontierCount,
      frontierSnapshot: {
        rowSha256: expectedIdentity.rowSha256,
        resultSha256: expectedIdentity.resultSha256,
        frontierSha256: expectedIdentity.frontierSha256,
        frontier: [{ unverified: 1 }, { unverified: 2 }],
        providerCallsAuthorized: false,
      },
      freezeVerification: null,
      policyApproved: true,
      selection: { ok: true, selected: "unverified" },
    });

    expect(
      assessIdentityRobustOutputForConsumption(raw, expectedIdentity),
    ).toEqual({
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      providerDenialVerified: true,
      computationIdentityMatched: true,
      scopedChecksPass: true,
    });
  });

  it("rejects excessive nesting before recursive consumer scans", () => {
    const output = {
      schema: IDENTITY_ROBUST_FRONTIER_OUTPUT_SCHEMA,
      rowSha256: expectedIdentity.rowSha256,
      resultSha256: expectedIdentity.resultSha256,
      frontierCount: expectedIdentity.frontierCount,
      frontierSnapshot: {
        rowSha256: expectedIdentity.rowSha256,
        resultSha256: expectedIdentity.resultSha256,
        frontierSha256: expectedIdentity.frontierSha256,
        frontier: [{ unverified: 1 }, { unverified: 2 }],
        providerCallsAuthorized: false,
      },
      freezeVerification: null,
      quotedBraces: "{".repeat(300),
    };
    expect(
      assessIdentityRobustOutputForConsumption(
        JSON.stringify(output),
        expectedIdentity,
      ).scopedChecksPass,
    ).toBe(true);

    const prefix = `${JSON.stringify(output).slice(0, -1)},"nested":`;
    const excessiveDepth = 1_000;
    const deeplyNested =
      prefix +
      '{"value":'.repeat(excessiveDepth) +
      "null" +
      "}".repeat(excessiveDepth) +
      "}";
    expect(
      assessIdentityRobustOutputForConsumption(deeplyNested, expectedIdentity),
    ).toEqual({
      schema: null,
      providerDenialVerified: false,
      computationIdentityMatched: false,
      scopedChecksPass: false,
    });
  });
});
