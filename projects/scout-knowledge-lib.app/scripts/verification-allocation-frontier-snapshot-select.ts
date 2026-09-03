import {
  selectIdentityRobustFrontierPointFromFreezeBundle,
  type IdentityRobustFrozenFrontierSelection,
} from "./verification-allocation-frontier-freeze";
import {
  identityRobustFrontierSnapshotReference,
  loadIdentityRobustFrontierSnapshot,
  type IdentityRobustFrontierSnapshotExpectation,
  type IdentityRobustLocalFrontierSnapshotVerification,
} from "./verification-allocation-frontier-snapshot";

export type IdentityRobustSnapshotFrontierSelection = {
  snapshotVerification: IdentityRobustLocalFrontierSnapshotVerification;
  frozenSelection: IdentityRobustFrozenFrontierSelection | null;
  providerCallsAuthorized: false;
};

export function summarizeIdentityRobustSnapshotFrontierSelection(
  result: IdentityRobustSnapshotFrontierSelection,
) {
  const snapshot = result.snapshotVerification.snapshot;
  return {
    ...result,
    snapshotVerification: {
      ...result.snapshotVerification,
      snapshot: snapshot
        ? {
            schema: snapshot.schema,
            evidenceClass: snapshot.evidenceClass,
            generatorReference: snapshot.generatorReference,
            rowSha256: snapshot.rowSha256,
            resultSha256: snapshot.resultSha256,
            frontierSha256: snapshot.frontierSha256,
            frontierCount: snapshot.frontier.length,
            providerCallsAuthorized: snapshot.providerCallsAuthorized,
          }
        : null,
    },
  };
}

/**
 * Load one byte- and computation-bound frontier before composing it with the
 * existing freeze and local decision verification. No failure path grants
 * provider authority or returns a partial selection.
 */
export async function selectIdentityRobustFrontierPointFromSnapshot(
  snapshotRoot: string,
  snapshotArtifact: string,
  snapshotSha256: string,
  expectedSnapshot: IdentityRobustFrontierSnapshotExpectation,
  policyCandidate: unknown,
  evidenceManifestCandidate: unknown,
  evidenceRoot: string,
  freezeBundleRoot: string,
): Promise<IdentityRobustSnapshotFrontierSelection> {
  const snapshotVerification = await loadIdentityRobustFrontierSnapshot(
    snapshotRoot,
    snapshotArtifact,
    snapshotSha256,
    expectedSnapshot,
  );
  if (!snapshotVerification.ok || !snapshotVerification.snapshot) {
    return {
      snapshotVerification,
      frozenSelection: null,
      providerCallsAuthorized: false,
    };
  }
  const frozenSelection =
    await selectIdentityRobustFrontierPointFromFreezeBundle(
      snapshotVerification.snapshot.frontier,
      policyCandidate,
      evidenceManifestCandidate,
      evidenceRoot,
      freezeBundleRoot,
      identityRobustFrontierSnapshotReference({
        rowSha256: snapshotVerification.snapshot.rowSha256,
        resultSha256: snapshotVerification.snapshot.resultSha256,
        frontierSha256: snapshotVerification.snapshot.frontierSha256,
        frontierCount: snapshotVerification.snapshot.frontier.length,
      }),
    );
  return {
    snapshotVerification,
    frozenSelection,
    providerCallsAuthorized: false,
  };
}
