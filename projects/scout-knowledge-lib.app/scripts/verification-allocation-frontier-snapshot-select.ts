import {
  selectIdentityRobustFrontierPointFromFreezeBundle,
  type IdentityRobustFrozenFrontierSelection,
} from "./verification-allocation-frontier-freeze";
import {
  loadIdentityRobustFrontierSnapshot,
  type IdentityRobustFrontierSnapshotExpectation,
  type IdentityRobustLocalFrontierSnapshotVerification,
} from "./verification-allocation-frontier-snapshot";

export type IdentityRobustSnapshotFrontierSelection = {
  snapshotVerification: IdentityRobustLocalFrontierSnapshotVerification;
  frozenSelection: IdentityRobustFrozenFrontierSelection | null;
  providerCallsAuthorized: false;
};

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
    );
  return {
    snapshotVerification,
    frozenSelection,
    providerCallsAuthorized: false,
  };
}
