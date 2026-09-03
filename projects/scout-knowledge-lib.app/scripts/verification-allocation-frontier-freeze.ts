import {
  selectIdentityRobustFrontierPoint,
  selectIdentityRobustFrontierPointFromLocalRecord,
  type IdentityRobustFrontierSelection,
  type IdentityRobustLocalFrontierSelection,
} from "./verification-allocation-frontier-policy";
import { verifyExecutionFreezeBundle } from "./verification-allocation-freeze-bundle";
import type { FreezeVerificationResult } from "./verification-allocation-freeze";

export type IdentityRobustFrozenFrontierSelection = {
  freezeVerification: FreezeVerificationResult;
  selection:
    | IdentityRobustFrontierSelection
    | IdentityRobustLocalFrontierSelection;
};

/**
 * Verify one explicit offline freeze bundle before allowing its derived scope
 * to enter policy selection. This adapter never authorizes provider calls.
 */
export async function selectIdentityRobustFrontierPointFromFreezeBundle(
  frontierCandidate: unknown,
  policyCandidate: unknown,
  evidenceManifestCandidate: unknown,
  evidenceRoot: string,
  freezeBundleRoot: string,
): Promise<IdentityRobustFrozenFrontierSelection> {
  const freezeVerification =
    await verifyExecutionFreezeBundle(freezeBundleRoot);
  const selection =
    freezeVerification.ok && freezeVerification.policyScope
      ? await selectIdentityRobustFrontierPointFromLocalRecord(
          frontierCandidate,
          policyCandidate,
          evidenceManifestCandidate,
          evidenceRoot,
          freezeVerification.policyScope,
        )
      : selectIdentityRobustFrontierPoint(
          frontierCandidate,
          policyCandidate,
          evidenceManifestCandidate,
        );
  return { freezeVerification, selection };
}
