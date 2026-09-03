import { createHash } from "node:crypto";
import {
  isCanonicalRelativeEvidenceName,
  readDescriptorSafeLocalEvidence,
} from "./descriptor-safe-local-evidence";

export type IdentityRobustPolicyEvidenceManifest = {
  schema: "scout.verification-allocation-policy-evidence/v2";
  evidenceClass: "caller-supplied-policy-provenance";
  policySha256: string;
  evidenceReference: string;
  decisionOwner: string;
  decisionRevision: string;
  observedAt: string;
  decisionRecordArtifact: string;
  decisionRecordSha256: string;
  policyEvidenceApplicability: IdentityRobustPolicyEvidenceApplicability;
  independentEvidenceStatus: "not-provided" | "provided-unverified";
  independentEvidenceReference?: string;
};

export type IdentityRobustPolicyEvidenceApplicability = {
  schema: "scout.verification-allocation-policy-applicability/v1";
  evidenceKind:
    | "uniform-marginal-drift-reserve"
    | "complete-factorial-episode-ceiling";
  evidenceUnit: "probability-per-model" | "complete-factorial-episodes";
  protocolReference: string;
  modelScopeReference: string;
  applicabilityStatus: "protocol-matched-unverified" | "not-established";
};

export type IdentityRobustPolicyEvidenceBinding = {
  ok: boolean;
  manifestSha256: string;
  evidenceStatus: "caller-supplied-unverified" | "";
  errors: string[];
  scopeLimit: string;
};

export type IdentityRobustVerifiedPolicyScope = {
  schema: "scout.verification-allocation-freeze-policy-scope/v1";
  protocolReference: string;
  modelScopeReference: string;
};

export type IdentityRobustLocalPolicyEvidenceBinding =
  IdentityRobustPolicyEvidenceBinding & {
    decisionRecordSha256: string;
    decisionRecordByteLength: number;
    decisionRecordEvidenceStatus: "local-byte-match-unverified" | "";
    decisionRecordContentStatus: "local-content-match-unverified" | "";
  };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 500 &&
    Boolean(value.trim()) &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function exactUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (record(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function expectedApplicability(
  policyCandidate: unknown,
): Pick<
  IdentityRobustPolicyEvidenceApplicability,
  "evidenceKind" | "evidenceUnit"
> | null {
  if (!record(policyCandidate)) return null;
  if (policyCandidate.selectionBasis === "minimum-uniform-drift-reserve") {
    return {
      evidenceKind: "uniform-marginal-drift-reserve",
      evidenceUnit: "probability-per-model",
    };
  }
  if (policyCandidate.selectionBasis === "maximum-episode-count") {
    return {
      evidenceKind: "complete-factorial-episode-ceiling",
      evidenceUnit: "complete-factorial-episodes",
    };
  }
  return null;
}

function applicabilityMatches(
  candidate: unknown,
  expectedPolicyCandidate: unknown,
): candidate is IdentityRobustPolicyEvidenceApplicability {
  if (!record(candidate)) return false;
  const expected = expectedApplicability(expectedPolicyCandidate);
  const establishedReferencesMatch =
    candidate.applicabilityStatus !== "protocol-matched-unverified" ||
    (typeof candidate.protocolReference === "string" &&
      /^freeze-protocol-sha256:[0-9a-f]{64}$/.test(
        candidate.protocolReference,
      ) &&
      typeof candidate.modelScopeReference === "string" &&
      /^freeze-model-scope-sha256:[0-9a-f]{64}$/.test(
        candidate.modelScopeReference,
      ));
  return (
    Boolean(expected) &&
    JSON.stringify(Object.keys(candidate).sort()) ===
      JSON.stringify(
        [
          "schema",
          "evidenceKind",
          "evidenceUnit",
          "protocolReference",
          "modelScopeReference",
          "applicabilityStatus",
        ].sort(),
      ) &&
    candidate.schema ===
      "scout.verification-allocation-policy-applicability/v1" &&
    candidate.evidenceKind === expected!.evidenceKind &&
    candidate.evidenceUnit === expected!.evidenceUnit &&
    nonempty(candidate.protocolReference) &&
    nonempty(candidate.modelScopeReference) &&
    establishedReferencesMatch &&
    (candidate.applicabilityStatus === "protocol-matched-unverified" ||
      candidate.applicabilityStatus === "not-established")
  );
}

function verifiedPolicyScopeMatches(
  candidate: unknown,
  applicability: IdentityRobustPolicyEvidenceApplicability,
): candidate is IdentityRobustVerifiedPolicyScope {
  return (
    record(candidate) &&
    JSON.stringify(Object.keys(candidate).sort()) ===
      JSON.stringify(
        ["schema", "protocolReference", "modelScopeReference"].sort(),
      ) &&
    candidate.schema ===
      "scout.verification-allocation-freeze-policy-scope/v1" &&
    candidate.protocolReference === applicability.protocolReference &&
    candidate.modelScopeReference === applicability.modelScopeReference
  );
}

function decisionRecordMatches(
  candidate: unknown,
  expectedPolicyCandidate: unknown,
  manifest: IdentityRobustPolicyEvidenceManifest,
): boolean {
  if (!record(candidate)) return false;
  const independentEvidenceStatus = manifest.independentEvidenceStatus;
  const expectedKeys = [
    "schema",
    "decisionId",
    "decisionOwner",
    "decisionRevision",
    "observedAt",
    "policy",
    "policyEvidenceApplicability",
    "rationale",
    "independentEvidenceStatus",
    ...(independentEvidenceStatus === "provided-unverified"
      ? ["independentEvidenceReference"]
      : []),
    "scopeLimit",
  ].sort();
  return (
    JSON.stringify(Object.keys(candidate).sort()) ===
      JSON.stringify(expectedKeys) &&
    candidate.schema === "scout.verification-allocation-policy-decision/v2" &&
    nonempty(candidate.decisionId) &&
    manifest.evidenceReference === `decision-record:${candidate.decisionId}` &&
    candidate.decisionOwner === manifest.decisionOwner &&
    candidate.decisionRevision === manifest.decisionRevision &&
    candidate.observedAt === manifest.observedAt &&
    canonicalJson(candidate.policy) ===
      canonicalJson(expectedPolicyCandidate) &&
    canonicalJson(candidate.policyEvidenceApplicability) ===
      canonicalJson(manifest.policyEvidenceApplicability) &&
    candidate.independentEvidenceStatus === independentEvidenceStatus &&
    (independentEvidenceStatus !== "provided-unverified" ||
      candidate.independentEvidenceReference ===
        manifest.independentEvidenceReference) &&
    nonempty(candidate.rationale) &&
    nonempty(candidate.scopeLimit)
  );
}

export function bindIdentityRobustPolicyEvidence(
  expectedPolicySha256: string,
  expectedEvidenceReference: string,
  expectedPolicyCandidate: unknown,
  candidate: unknown,
  verifiedPolicyScopeCandidate: unknown = null,
): IdentityRobustPolicyEvidenceBinding {
  const scopeLimit =
    "The manifest binds caller-supplied provenance and applicability fields to an exact policy hash and matching verified-freeze scope identifiers. The scope result remains caller-supplied to this function and is not reverified here; this does not authenticate the owner, timestamp, revision, reference, independent evidence, cost, drift estimate, or provider behavior.";
  const independentEvidenceStatus = record(candidate)
    ? candidate.independentEvidenceStatus
    : undefined;
  const expectedKeys = [
    "schema",
    "evidenceClass",
    "policySha256",
    "evidenceReference",
    "decisionOwner",
    "decisionRevision",
    "observedAt",
    "decisionRecordArtifact",
    "decisionRecordSha256",
    "policyEvidenceApplicability",
    "independentEvidenceStatus",
    ...(independentEvidenceStatus === "provided-unverified"
      ? ["independentEvidenceReference"]
      : []),
  ].sort();
  if (
    !record(candidate) ||
    JSON.stringify(Object.keys(candidate).sort()) !==
      JSON.stringify(expectedKeys) ||
    candidate.schema !== "scout.verification-allocation-policy-evidence/v2" ||
    candidate.evidenceClass !== "caller-supplied-policy-provenance" ||
    !/^[0-9a-f]{64}$/.test(expectedPolicySha256) ||
    candidate.policySha256 !== expectedPolicySha256 ||
    !nonempty(expectedEvidenceReference) ||
    candidate.evidenceReference !== expectedEvidenceReference ||
    !nonempty(candidate.decisionOwner) ||
    !nonempty(candidate.decisionRevision) ||
    !exactUtcTimestamp(candidate.observedAt) ||
    !isCanonicalRelativeEvidenceName(candidate.decisionRecordArtifact) ||
    typeof candidate.decisionRecordSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.decisionRecordSha256) ||
    !applicabilityMatches(
      candidate.policyEvidenceApplicability,
      expectedPolicyCandidate,
    ) ||
    (independentEvidenceStatus !== "not-provided" &&
      independentEvidenceStatus !== "provided-unverified") ||
    (independentEvidenceStatus === "provided-unverified" &&
      !nonempty(candidate.independentEvidenceReference))
  ) {
    return {
      ok: false,
      manifestSha256: "",
      evidenceStatus: "",
      errors: [
        "an exact caller-supplied policy provenance manifest is required",
      ],
      scopeLimit,
    };
  }
  if (
    candidate.policyEvidenceApplicability.applicabilityStatus !==
    "protocol-matched-unverified"
  ) {
    return {
      ok: false,
      manifestSha256: "",
      evidenceStatus: "",
      errors: [
        "policy evidence applicability is not established for this protocol and model scope",
      ],
      scopeLimit,
    };
  }
  if (
    !verifiedPolicyScopeMatches(
      verifiedPolicyScopeCandidate,
      candidate.policyEvidenceApplicability,
    )
  ) {
    return {
      ok: false,
      manifestSha256: "",
      evidenceStatus: "",
      errors: [
        "a matching verified freeze policy scope is required for applicability",
      ],
      scopeLimit,
    };
  }
  return {
    ok: true,
    manifestSha256: createHash("sha256")
      .update(JSON.stringify(candidate))
      .digest("hex"),
    evidenceStatus: "caller-supplied-unverified",
    errors: [],
    scopeLimit,
  };
}

export async function bindIdentityRobustPolicyEvidenceFromLocalRecord(
  expectedPolicySha256: string,
  expectedEvidenceReference: string,
  expectedPolicyCandidate: unknown,
  candidate: unknown,
  evidenceRoot: string,
  verifiedPolicyScopeCandidate: unknown = null,
): Promise<IdentityRobustLocalPolicyEvidenceBinding> {
  const structural = bindIdentityRobustPolicyEvidence(
    expectedPolicySha256,
    expectedEvidenceReference,
    expectedPolicyCandidate,
    candidate,
    verifiedPolicyScopeCandidate,
  );
  if (!structural.ok) {
    return {
      ...structural,
      decisionRecordSha256: "",
      decisionRecordByteLength: 0,
      decisionRecordEvidenceStatus: "",
      decisionRecordContentStatus: "",
    };
  }
  const manifest = candidate as IdentityRobustPolicyEvidenceManifest;
  const localEvidence = await readDescriptorSafeLocalEvidence(
    evidenceRoot,
    manifest.decisionRecordArtifact,
    manifest.decisionRecordSha256,
  );
  if (!localEvidence.ok) {
    return {
      ...structural,
      ok: false,
      errors: localEvidence.errors,
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit: localEvidence.scopeLimit,
    };
  }
  let decisionRecordCandidate: unknown;
  try {
    decisionRecordCandidate = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(localEvidence.bytes!),
    );
  } catch {
    return {
      ...structural,
      ok: false,
      errors: ["local decision record must contain valid UTF-8 JSON"],
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit:
        "The local bytes match their declared hash but do not form a valid decision record. No authorship, authority, independence, timestamp validity, or substantive correctness is established.",
    };
  }
  if (
    !decisionRecordMatches(
      decisionRecordCandidate,
      expectedPolicyCandidate,
      manifest,
    )
  ) {
    return {
      ...structural,
      ok: false,
      errors: [
        "local decision record does not match the provenance manifest and policy",
      ],
      decisionRecordSha256: localEvidence.sha256,
      decisionRecordByteLength: localEvidence.byteLength,
      decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
      decisionRecordContentStatus: "",
      scopeLimit:
        "The local bytes match their declared hash but their content does not match the expected policy and manifest. No authorship, authority, independence, timestamp validity, or substantive correctness is established.",
    };
  }
  return {
    ...structural,
    ok: true,
    errors: [],
    decisionRecordSha256: localEvidence.sha256,
    decisionRecordByteLength: localEvidence.byteLength,
    decisionRecordEvidenceStatus: localEvidence.evidenceStatus,
    decisionRecordContentStatus: "local-content-match-unverified",
    scopeLimit:
      "The manifest, one descriptor-safe local byte read, the record's content, and caller-supplied verified-freeze scope identifiers agree. This proves local consistency for those inputs; this function does not reverify the freeze bundle, and no authorship, authority, independence, timestamp validity, or substantive correctness is established.",
  };
}
