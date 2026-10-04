import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type FindingDeliveryMaterial = {
  targetAppId: string;
  severity: string;
  summary: string;
  message: string;
  evidence: string[];
  dedupeKey: string;
  requestedHumanAction: string;
};

type DeliveryVariant = {
  materialFingerprint: string;
  sourceSessionId: string;
  ownerDeliveredAt: string;
  humanDeliveredAt?: string;
  severity: string;
  requestedHumanAction: string;
  artifactAndVerificationContext: string[];
};

export type FindingDeliveryReceipt = {
  version: 1;
  stableIdentity: { targetAppId: string; dedupeKey: string };
  disposition: "delivered";
  variants: DeliveryVariant[];
};

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identityHash(finding: FindingDeliveryMaterial): string {
  return hash(`${finding.targetAppId.trim()}\n${finding.dedupeKey.trim()}`);
}

function materialFingerprint(finding: FindingDeliveryMaterial): string {
  return hash(
    JSON.stringify({
      targetAppId: finding.targetAppId.trim(),
      severity: finding.severity,
      requestedHumanAction: finding.requestedHumanAction,
      summary: finding.summary.trim(),
      message: finding.message.trim(),
    }),
  );
}

function receiptPath(
  appRoot: string,
  finding: FindingDeliveryMaterial,
): string {
  return join(
    appRoot,
    ".state",
    "finding-delivery",
    "receipts",
    `${identityHash(finding)}.json`,
  );
}

function readReceipt(path: string): FindingDeliveryReceipt | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const candidate = JSON.parse(readFileSync(path, "utf8"));
    if (
      candidate?.version === 1 &&
      candidate?.disposition === "delivered" &&
      Array.isArray(candidate?.variants)
    ) {
      return candidate as FindingDeliveryReceipt;
    }
  } catch {
    // A corrupt receipt must not silently suppress owner-visible work.
  }
  return undefined;
}

function findReceipt(
  appRoot: string,
  finding: FindingDeliveryMaterial,
): { path: string; receipt?: FindingDeliveryReceipt } {
  const directPath = receiptPath(appRoot, finding);
  const directReceipt = readReceipt(directPath);
  return directReceipt
    ? { path: directPath, receipt: directReceipt }
    : { path: directPath };
}

function writeReceipt(path: string, receipt: FindingDeliveryReceipt): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  renameSync(temporary, path);
}

export type FindingDeliveryDecision = {
  deliver: boolean;
  ownerNeeded: boolean;
  humanNeeded: boolean;
  receiptPath: string;
  materialFingerprint: string;
  matchedVariant?: number;
};

/**
 * Compare exact structured material under the LLM-selected stable identity.
 * Code never guesses semantic equivalence from prose or keywords.
 */
export function decideFindingDelivery(
  appRoot: string,
  finding: FindingDeliveryMaterial,
): FindingDeliveryDecision {
  const fingerprint = materialFingerprint(finding);
  const family = findReceipt(appRoot, finding);
  const path = family.path;
  const receipt = family.receipt;
  const matchedVariant = receipt?.variants.findIndex(
    (variant) =>
      variant.severity === finding.severity &&
      variant.requestedHumanAction === finding.requestedHumanAction &&
      variant.materialFingerprint === fingerprint,
  );
  const existingVariant =
    matchedVariant !== undefined && matchedVariant >= 0
      ? receipt?.variants[matchedVariant]
      : undefined;
  const ownerNeeded = !existingVariant;
  const humanRequested = ["decide", "approve", "provide-input"].includes(
    finding.requestedHumanAction,
  );
  const humanNeeded = humanRequested && !existingVariant?.humanDeliveredAt;
  return {
    deliver: ownerNeeded || humanNeeded,
    ownerNeeded,
    humanNeeded,
    receiptPath: path,
    materialFingerprint: fingerprint,
    ...(matchedVariant !== undefined && matchedVariant >= 0
      ? { matchedVariant }
      : {}),
  };
}

export function recordFindingDelivery(
  decision: FindingDeliveryDecision,
  finding: FindingDeliveryMaterial,
  sourceSessionId: string,
  phase: "owner" | "human",
  now = new Date().toISOString(),
): FindingDeliveryReceipt {
  const existing = readReceipt(decision.receiptPath);
  const receipt: FindingDeliveryReceipt = existing ?? {
    version: 1,
    stableIdentity: {
      targetAppId: finding.targetAppId,
      dedupeKey: finding.dedupeKey,
    },
    disposition: "delivered",
    variants: [],
  };
  let variant =
    decision.matchedVariant !== undefined
      ? receipt.variants[decision.matchedVariant]
      : receipt.variants.find(
          (candidate) =>
            candidate.materialFingerprint === decision.materialFingerprint,
        );
  if (!variant) {
    variant = {
      materialFingerprint: decision.materialFingerprint,
      sourceSessionId,
      ownerDeliveredAt: now,
      severity: finding.severity,
      requestedHumanAction: finding.requestedHumanAction,
      artifactAndVerificationContext: [...finding.evidence],
    };
    receipt.variants.push(variant);
  }
  if (phase === "human") variant.humanDeliveredAt = now;
  writeReceipt(decision.receiptPath, receipt);
  return receipt;
}
