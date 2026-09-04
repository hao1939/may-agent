import { isAbsolute } from "node:path";
import {
  hasDuplicateJsonObjectKeys,
  hasExcessiveJsonNesting,
} from "./json-object-key-exactness";
import { isCanonicalRelativeEvidenceName } from "./descriptor-safe-local-evidence";
import type { IdentityRobustLocalManifestInput } from "./verification-allocation-frontier-policy";

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

function requireExplicitAbsoluteRoot(value: string, label: string): void {
  if (!isAbsolute(value) || value.includes("\0")) {
    throw new Error(`${label} must be an explicit absolute path`);
  }
}

function validateFilesystemRoots(
  evidenceRoot: string,
  freezeBundleRoot: string,
): void {
  requireExplicitAbsoluteRoot(evidenceRoot, "evidence root");
  requireExplicitAbsoluteRoot(freezeBundleRoot, "freeze bundle root");
}

function rejectExcessiveJsonNesting(source: string, label: string): void {
  if (hasExcessiveJsonNesting(source)) {
    throw new Error(`${label} exceeds the supported JSON nesting limit`);
  }
}

export function parseIdentityRobustFrontierCliInput(
  args: string[],
): IdentityRobustFrontierCliInput | null {
  if (args.length === 0) return null;
  const localManifestMode =
    args.length === 10 &&
    args[0] === "--policy-json" &&
    args[2] === "--evidence-manifest-artifact" &&
    args[4] === "--evidence-manifest-sha256" &&
    args[6] === "--evidence-root" &&
    args[8] === "--freeze-bundle-root";
  if (localManifestMode) {
    rejectExcessiveJsonNesting(args[1]!, "policy argument");
    let policyCandidate: unknown;
    try {
      policyCandidate = JSON.parse(args[1]!);
    } catch {
      throw new Error("policy argument must contain valid JSON");
    }
    if (hasDuplicateJsonObjectKeys(args[1]!)) {
      throw new Error(
        "policy argument must not contain duplicate JSON object keys",
      );
    }
    if (!isCanonicalRelativeEvidenceName(args[3]!)) {
      throw new Error(
        "evidence manifest artifact must be a canonical relative path",
      );
    }
    if (!/^[0-9a-f]{64}$/.test(args[5]!)) {
      throw new Error(
        "evidence manifest SHA-256 must be 64 lowercase hex digits",
      );
    }
    const evidenceManifestCandidate: IdentityRobustLocalManifestInput = {
      schema: "scout.verification-allocation-local-policy-manifest-input/v1",
      manifestArtifact: args[3]!,
      manifestSha256: args[5]!,
    };
    validateFilesystemRoots(args[7]!, args[9]!);
    return {
      policyCandidate,
      evidenceManifestCandidate,
      evidenceRoot: args[7]!,
      freezeBundleRoot: args[9]!,
    };
  }
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
  rejectExcessiveJsonNesting(args[1]!, "policy argument");
  rejectExcessiveJsonNesting(args[3]!, "evidence manifest argument");
  try {
    policyCandidate = JSON.parse(args[1]!);
    evidenceManifestCandidate = JSON.parse(args[3]!);
  } catch {
    throw new Error(
      "policy and evidence manifest arguments must contain valid JSON",
    );
  }
  if (
    hasDuplicateJsonObjectKeys(args[1]!) ||
    hasDuplicateJsonObjectKeys(args[3]!)
  ) {
    throw new Error(
      "policy and evidence manifest arguments must not contain duplicate JSON object keys",
    );
  }
  validateFilesystemRoots(args[5]!, args[7]!);
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
    (args.length !== 14 && args.length !== 16) ||
    args[0] !== "--snapshot-root" ||
    args[2] !== "--snapshot-artifact" ||
    args[4] !== "--snapshot-sha256"
  ) {
    throw new Error(
      "snapshot usage: snapshot --snapshot-root '<explicit absolute directory>' --snapshot-artifact '<canonical relative JSON path>' --snapshot-sha256 '<exact SHA-256>' followed by either inline or descriptor-safe local policy input",
    );
  }
  requireExplicitAbsoluteRoot(args[1]!, "snapshot root");
  if (!isCanonicalRelativeEvidenceName(args[3]!)) {
    throw new Error("snapshot artifact must be a canonical relative path");
  }
  if (!/^[0-9a-f]{64}$/.test(args[5]!)) {
    throw new Error("snapshot SHA-256 must be 64 lowercase hex digits");
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
