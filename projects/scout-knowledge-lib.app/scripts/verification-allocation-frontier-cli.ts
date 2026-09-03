export type IdentityRobustFrontierCliInput = {
  policyCandidate: unknown;
  evidenceManifestCandidate: unknown;
  evidenceRoot: string;
};

export function parseIdentityRobustFrontierCliInput(
  args: string[],
): IdentityRobustFrontierCliInput | null {
  if (args.length === 0) return null;
  if (
    args.length !== 6 ||
    args[0] !== "--policy-json" ||
    args[2] !== "--evidence-manifest-json" ||
    args[4] !== "--evidence-root"
  ) {
    throw new Error(
      "optional usage: --policy-json '<single JSON policy object>' --evidence-manifest-json '<single JSON manifest object>' --evidence-root '<explicit absolute directory>'",
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
  };
}
