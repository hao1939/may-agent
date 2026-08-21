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
  materialTokens: string[];
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

const STOP_WORDS = new Set(
  "a an and are as at be but by for from has have in into is it its of on or that the their them these this to was were with which exact".split(
    " ",
  ),
);

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function identityHash(finding: FindingDeliveryMaterial): string {
  return hash(`${finding.targetAppId.trim()}\n${finding.dedupeKey.trim()}`);
}

function materialTokens(finding: FindingDeliveryMaterial): string[] {
  const normalized = `${finding.summary} ${finding.message}`
    .toLowerCase()
    .replace(/non[- ]canonical/g, "noncanonical")
    .replace(/s_\d+(?:_\d+)?/g, " ")
    .replace(/\/[^\s`]+/g, " ");
  return [
    ...new Set(
      normalized
        .match(/[a-z0-9]+/g)
        ?.filter(
          (token) =>
            token.length > 2 && !STOP_WORDS.has(token) && !/^\d+$/.test(token),
        ) ?? [],
    ),
  ].sort();
}

function materialFingerprint(
  finding: FindingDeliveryMaterial,
  tokens: string[],
): string {
  return hash(
    JSON.stringify({
      targetAppId: finding.targetAppId.trim(),
      dedupeKey: finding.dedupeKey.trim(),
      severity: finding.severity,
      requestedHumanAction: finding.requestedHumanAction,
      tokens,
    }),
  );
}

function dice(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const intersection = left.filter((token) => rightSet.has(token)).length;
  return (2 * intersection) / (left.length + right.length);
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
  materialTokens: string[];
  matchedVariant?: number;
};

/**
 * Compare against all durable material variants for one stable finding identity.
 * Evidence/session references are retained in receipts but excluded from material
 * comparison so a new transcript path alone cannot create duplicate owner work.
 */
export function decideFindingDelivery(
  appRoot: string,
  finding: FindingDeliveryMaterial,
): FindingDeliveryDecision {
  const path = receiptPath(appRoot, finding);
  const tokens = materialTokens(finding);
  const fingerprint = materialFingerprint(finding, tokens);
  const receipt = readReceipt(path);
  const matchedVariant = receipt?.variants.findIndex(
    (variant) =>
      variant.severity === finding.severity &&
      variant.requestedHumanAction === finding.requestedHumanAction &&
      (variant.materialFingerprint === fingerprint ||
        dice(variant.materialTokens, tokens) >= 0.55),
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
    materialTokens: tokens,
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
      materialTokens: decision.materialTokens,
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
