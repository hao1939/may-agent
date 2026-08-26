import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexGoalProtocolDrift,
  hashCodexGoalProtocolSchemas,
  parseCodexCliVersion,
  type CodexGoalProtocolSnapshot,
} from "./codex-goal-protocol.js";

describe("Codex goal protocol drift", () => {
  it("keeps the container Codex version aligned with the protocol snapshot", () => {
    const dockerfile = readFileSync(new URL("../../container/Dockerfile", import.meta.url), "utf8");
    const snapshot = JSON.parse(
      readFileSync(new URL("./codex-goal-protocol.snapshot.json", import.meta.url), "utf8"),
    ) as CodexGoalProtocolSnapshot;

    expect(dockerfile).toContain(`ARG CODEX_VERSION=${snapshot.codexVersion}`);
  });

  it("parses only the expected Codex CLI version shape", () => {
    expect(parseCodexCliVersion("codex-cli 1.2.3\n")).toBe("1.2.3");
    expect(parseCodexCliVersion("codex 1.2.3")).toBeNull();
  });

  it("hashes the selected generated schemas", () => {
    const root = mkdtempSync(join(tmpdir(), "codex-goal-protocol-test-"));
    try {
      mkdirSync(join(root, "v2"));
      writeFileSync(join(root, "v2", "TurnSteerParams.json"), "steer-schema");
      expect(hashCodexGoalProtocolSchemas(root, ["v2/TurnSteerParams.json"])).toEqual({
        "v2/TurnSteerParams.json": "56f81b23e57f4e377f740677d8b1147f8dafd0fdcb10fe8da5d9bcf9e41f3da5",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports version, missing, changed, and unexpected schema drift", () => {
    const snapshot: CodexGoalProtocolSnapshot = {
      codexVersion: "1.2.3",
      generator: "generator",
      schemas: { "v2/a.json": "aaa", "v2/b.json": "bbb" },
    };
    expect(
      codexGoalProtocolDrift({
        snapshot,
        installedVersion: "1.2.4",
        generatedHashes: { "v2/a.json": "changed", "v2/c.json": "ccc" },
      }),
    ).toEqual([
      "Codex CLI version changed: expected 1.2.3, got 1.2.4",
      "generated schema changed: v2/a.json",
      "generated schema is missing: v2/b.json",
      "unexpected generated schema fingerprint: v2/c.json",
    ]);
  });
});
