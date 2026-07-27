import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { artifactProvesCleanup } from "./spec-live-reconciliation.js";

describe("spec live cleanup artifact collection", () => {
  test("accepts a passing top-level cleanup assertion", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-live-cleanup-"));
    try {
      const artifactPath = join(root, "spec.json");
      writeFileSync(
        artifactPath,
        JSON.stringify({
          specId: "spec.sample.live",
          status: "pass",
          raw: {
            probeEvidence: { mode: "live" },
          },
          assertions: [
            {
              name: "cleanup.resource-group-deleted",
              verdictImpact: "cleanup",
              ok: true,
            },
          ],
        }),
      );

      expect(artifactProvesCleanup(artifactPath, "spec.sample.live")).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
