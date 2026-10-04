import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifyTerminalArtifactClaim } from "./terminal-artifact-evidence";

const frozenSessionId = "s_1787638709029_0";
const roots: string[] = [];

function controlPath(): string {
  const root = mkdtempSync(join(tmpdir(), "gym-terminal-artifact-control-"));
  roots.push(root);
  return join(
    root,
    "may-agent-gym-overlay-activation-outcome-appdep_609e92a1ec77f907040cf161.md",
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe(`terminal artifact convergence controls frozen from ${frozenSessionId}`, () => {
  test("discloses ENOENT and cannot converge on a missing preservation claim", () => {
    const path = controlPath();

    const evidence = verifyTerminalArtifactClaim({
      path,
      sessionId: frozenSessionId,
      requiredContent: [
        "HASH_GATE_REJECTED",
        "Runtime mutation performed: **no**",
      ],
    });

    expect(evidence).toEqual({
      state: "non-converged",
      path,
      sessionId: frozenSessionId,
      readback: "fresh-failed",
      disclosure: `Current artifact readback failed (ENOENT): ${path}`,
    });
  });

  test("converges only after restoration, fresh content readback, and an independent SHA-256 match", () => {
    const path = controlPath();
    const restored = [
      "# Gym App Overlay Activation Outcome",
      "Terminal status: `HASH_GATE_REJECTED`",
      "Runtime mutation performed: **no**",
      "Fresh Gym regression requests admitted: **0**",
    ].join("\n");
    writeFileSync(path, restored, "utf8");
    const independentlyComputed = createHash("sha256")
      .update(Buffer.from(restored, "utf8"))
      .digest("hex");

    const evidence = verifyTerminalArtifactClaim({
      path,
      sessionId: frozenSessionId,
      requiredContent: [
        "HASH_GATE_REJECTED",
        "Runtime mutation performed: **no**",
        "Fresh Gym regression requests admitted: **0**",
      ],
      claimedSha256: `sha256:${independentlyComputed}`,
    });

    expect(evidence).toEqual({
      state: "converged",
      path,
      sessionId: frozenSessionId,
      readback: "fresh-success",
      verifiedContent: [
        "HASH_GATE_REJECTED",
        "Runtime mutation performed: **no**",
        "Fresh Gym regression requests admitted: **0**",
      ],
      computedSha256: independentlyComputed,
      fingerprint: "independently-computed",
    });
  });

  test("cannot converge when restored content or the claimed fingerprint is wrong", () => {
    const path = controlPath();
    writeFileSync(path, "HASH_GATE_REJECTED\n", "utf8");

    const missingContent = verifyTerminalArtifactClaim({
      path,
      sessionId: frozenSessionId,
      requiredContent: ["Runtime mutation performed: **no**"],
    });
    const wrongFingerprint = verifyTerminalArtifactClaim({
      path,
      sessionId: frozenSessionId,
      requiredContent: ["HASH_GATE_REJECTED"],
      claimedSha256: "0".repeat(64),
    });

    expect(missingContent.state).toBe("non-converged");
    expect(wrongFingerprint).toMatchObject({
      state: "non-converged",
      readback: "fresh-success",
      disclosure: expect.stringContaining("does not match claimed SHA-256"),
    });
  });
});
