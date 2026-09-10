import { spawnSync } from "node:child_process";

export interface HashFence {
  path: string;
  requiredSha256: string;
}

export interface HashFenceReceipt {
  sessionId: string;
  command: readonly string[];
  path: string;
  computedSha256?: string;
  requiredSha256: string;
  comparison: "match" | "mismatch" | "not-computed";
  exitStatus: number | null;
}

export interface HashCommandResult {
  exitStatus: number | null;
  stdout: string;
}

export type HashCommandRunner = (
  command: readonly string[],
) => HashCommandResult;

export type HashFenceEvidence =
  | {
      state: "converged";
      executingSessionId: string;
      activationPermitted: true;
      disposition: "same-session-checksum-proof-sufficient";
      receipts: HashFenceReceipt[];
    }
  | {
      state: "non-converged";
      executingSessionId: string;
      activationPermitted: false;
      decision: "HASH_GATE_REJECTED";
      disposition: "same-session-checksum-proof-insufficient";
      disclosure: string;
      receipts: HashFenceReceipt[];
    };

function canonicalCommand(path: string): readonly string[] {
  return ["sha256sum", "--", path];
}

const defaultRunner: HashCommandRunner = (command) => {
  const result = spawnSync(command[0], [...command.slice(1)], {
    encoding: "utf8",
  });
  return {
    exitStatus: result.status,
    stdout: result.stdout ?? "",
  };
};

function normalizedSha256(value: string): string {
  return value.replace(/^sha256:/, "").toLowerCase();
}

/**
 * Execute every hash fence inside the activation-review session and preserve
 * one complete receipt per exact path. No caller-supplied digest is trusted.
 */
export function computeHashFenceReceipts(
  executingSessionId: string,
  fences: readonly HashFence[],
  runner: HashCommandRunner = defaultRunner,
): HashFenceReceipt[] {
  return fences.map((fence) => {
    const command = canonicalCommand(fence.path);
    const result = runner(command);
    const computedSha256 = result.stdout.match(
      /^([a-fA-F0-9]{64})(?:\s|$)/,
    )?.[1];
    const requiredSha256 = normalizedSha256(fence.requiredSha256);
    const comparison =
      computedSha256 === undefined
        ? "not-computed"
        : normalizedSha256(computedSha256) === requiredSha256
          ? "match"
          : "mismatch";
    return {
      sessionId: executingSessionId,
      command,
      path: fence.path,
      ...(computedSha256 === undefined
        ? {}
        : { computedSha256: normalizedSha256(computedSha256) }),
      requiredSha256,
      comparison,
      exitStatus: result.exitStatus,
    };
  });
}

/**
 * Fail-closed convergence boundary. A copied receipt from another session, an
 * inexact path/command/fence, a missing or duplicate receipt, a failed command,
 * or a digest mismatch can never authorize activation.
 */
export function evaluateHashFenceReceipts(
  executingSessionId: string,
  fences: readonly HashFence[],
  receipts: readonly HashFenceReceipt[],
): HashFenceEvidence {
  const reject = (disclosure: string): HashFenceEvidence => ({
    state: "non-converged",
    executingSessionId,
    activationPermitted: false,
    decision: "HASH_GATE_REJECTED",
    disposition: "same-session-checksum-proof-insufficient",
    disclosure,
    receipts: [...receipts],
  });

  if (!executingSessionId.trim())
    return reject("Executing session ID is missing");
  if (fences.length === 0)
    return reject("No current candidate hash fences supplied");
  if (new Set(fences.map(({ path }) => path)).size !== fences.length) {
    return reject("Current candidate hash fence paths are not unique");
  }
  if (receipts.length !== fences.length) {
    return reject("Missing or extra same-session checksum receipt");
  }

  for (const fence of fences) {
    const matches = receipts.filter(({ path }) => path === fence.path);
    if (matches.length !== 1) {
      return reject(
        `Missing or duplicate receipt for exact path: ${fence.path}`,
      );
    }
    const receipt = matches[0];
    const requiredSha256 = normalizedSha256(fence.requiredSha256);
    if (receipt.sessionId !== executingSessionId) {
      return reject(`Receipt was copied from another session: ${fence.path}`);
    }
    if (
      receipt.command.length !== 3 ||
      receipt.command.some(
        (value, index) => value !== canonicalCommand(fence.path)[index],
      )
    ) {
      return reject(`Receipt lacks the exact checksum command: ${fence.path}`);
    }
    if (receipt.requiredSha256 !== requiredSha256) {
      return reject(
        `Receipt does not preserve the required fence: ${fence.path}`,
      );
    }
    if (receipt.exitStatus !== 0) {
      return reject(`Checksum command did not exit zero: ${fence.path}`);
    }
    if (
      receipt.computedSha256 === undefined ||
      !/^[a-f0-9]{64}$/.test(receipt.computedSha256)
    ) {
      return reject(`Receipt lacks a computed SHA-256: ${fence.path}`);
    }
    if (
      receipt.comparison !== "match" ||
      receipt.computedSha256 !== requiredSha256
    ) {
      return reject(`Checksum mismatch: ${fence.path}`);
    }
  }

  return {
    state: "converged",
    executingSessionId,
    activationPermitted: true,
    disposition: "same-session-checksum-proof-sufficient",
    receipts: [...receipts],
  };
}

export function reviewHashFences(
  executingSessionId: string,
  fences: readonly HashFence[],
  runner: HashCommandRunner = defaultRunner,
): HashFenceEvidence {
  const receipts = computeHashFenceReceipts(executingSessionId, fences, runner);
  return evaluateHashFenceReceipts(executingSessionId, fences, receipts);
}
