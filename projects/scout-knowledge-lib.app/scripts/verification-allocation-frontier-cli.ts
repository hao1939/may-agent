export type IdentityRobustFrontierCliInput = {
  policyCandidate: unknown;
  evidenceManifestCandidate: unknown;
  evidenceRoot: string;
  freezeBundleRoot: string;
};

export type IdentityRobustSnapshotFrontierCliInput =
  IdentityRobustFrontierCliInput & {
    snapshotRoot: string;
    snapshotArtifact: string;
    snapshotSha256: string;
  };

export function parseIdentityRobustFrontierCliInput(
  args: string[],
): IdentityRobustFrontierCliInput | null {
  if (args.length === 0) return null;
  if (
    args.length !== 8 ||
    args[0] !== "--policy-json" ||
    args[2] !== "--evidence-manifest-json" ||
    args[4] !== "--evidence-root" ||
    args[6] !== "--freeze-bundle-root"
  ) {
    throw new Error(
      "optional usage: --policy-json '<single JSON policy object>' --evidence-manifest-json '<single JSON manifest object>' --evidence-root '<explicit absolute directory>' --freeze-bundle-root '<explicit absolute directory>'",
    );
  }
  let policyCandidate: unknown;
  let evidenceManifestCandidate: unknown;
  try {
    policyCandidate = JSON.parse(args[1]!);
    evidenceManifestCandidate = JSON.parse(args[3]!);
  } catch {
    throw new Error(
      "policy and evidence manifest arguments must contain valid JSON",
    );
  }
  return {
    policyCandidate,
    evidenceManifestCandidate,
    evidenceRoot: args[5]!,
    freezeBundleRoot: args[7]!,
  };
}

export function parseIdentityRobustSnapshotFrontierCliInput(
  args: string[],
): IdentityRobustSnapshotFrontierCliInput {
  if (
    args.length !== 14 ||
    args[0] !== "--snapshot-root" ||
    args[2] !== "--snapshot-artifact" ||
    args[4] !== "--snapshot-sha256"
  ) {
    throw new Error(
      "snapshot usage: snapshot --snapshot-root '<explicit absolute directory>' --snapshot-artifact '<canonical relative JSON path>' --snapshot-sha256 '<exact SHA-256>' --policy-json '<single JSON policy object>' --evidence-manifest-json '<single JSON manifest object>' --evidence-root '<explicit absolute directory>' --freeze-bundle-root '<explicit absolute directory>'",
    );
  }
  const policyInput = parseIdentityRobustFrontierCliInput(args.slice(6));
  if (!policyInput) throw new Error("snapshot usage requires policy input");
  return {
    snapshotRoot: args[1]!,
    snapshotArtifact: args[3]!,
    snapshotSha256: args[5]!,
    ...policyInput,
  };
}
