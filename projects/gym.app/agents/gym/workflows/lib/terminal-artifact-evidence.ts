import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export interface TerminalArtifactClaim {
  path: string;
  sessionId: string;
  requiredContent: readonly string[];
  claimedSha256?: string;
}

export type TerminalArtifactEvidence =
  | {
      state: "converged";
      path: string;
      sessionId: string;
      readback: "fresh-success";
      verifiedContent: string[];
      computedSha256: string;
      fingerprint: "independently-computed";
    }
  | {
      state: "non-converged";
      path: string;
      sessionId: string;
      readback: "fresh-failed" | "fresh-success";
      disclosure: string;
      computedSha256?: string;
    };

/**
 * Fail-closed verification boundary for acceptance-critical terminal artifact
 * claims. The read and digest happen here, at convergence time; callers cannot
 * substitute an earlier session's evidence or a self-reported fingerprint.
 */
export function verifyTerminalArtifactClaim(
  claim: TerminalArtifactClaim,
): TerminalArtifactEvidence {
  let bytes: Buffer;
  try {
    bytes = readFileSync(claim.path);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "READ_FAILED";
    return {
      state: "non-converged",
      path: claim.path,
      sessionId: claim.sessionId,
      readback: "fresh-failed",
      disclosure: `Current artifact readback failed (${code}): ${claim.path}`,
    };
  }

  const text = bytes.toString("utf8");
  const missing = claim.requiredContent.filter(
    (value) => !text.includes(value),
  );
  const computedSha256 = createHash("sha256").update(bytes).digest("hex");

  if (missing.length > 0) {
    return {
      state: "non-converged",
      path: claim.path,
      sessionId: claim.sessionId,
      readback: "fresh-success",
      disclosure: `Fresh artifact readback lacks required content: ${missing.join(", ")}`,
      computedSha256,
    };
  }

  if (
    claim.claimedSha256 !== undefined &&
    claim.claimedSha256.replace(/^sha256:/, "") !== computedSha256
  ) {
    return {
      state: "non-converged",
      path: claim.path,
      sessionId: claim.sessionId,
      readback: "fresh-success",
      disclosure: `Independently computed SHA-256 ${computedSha256} does not match claimed SHA-256 ${claim.claimedSha256}`,
      computedSha256,
    };
  }

  return {
    state: "converged",
    path: claim.path,
    sessionId: claim.sessionId,
    readback: "fresh-success",
    verifiedContent: [...claim.requiredContent],
    computedSha256,
    fingerprint: "independently-computed",
  };
}
