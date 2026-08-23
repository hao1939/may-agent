import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexGoalProtocolDrift,
  hashCodexGoalProtocolSchemas,
  parseCodexCliVersion,
  type CodexGoalProtocolSnapshot,
} from "./codex-goal-protocol.js";

describe("Codex goal protocol drift", () => {
  it("parses only the expected Codex CLI version shape", () => {
    expect(parseCodexCliVersion("codex-cli 0.147.0\n")).toBe("0.147.0");
    expect(parseCodexCliVersion("codex 0.147.0")).toBeNull();
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
      codexVersion: "0.147.0",
      generator: "generator",
      schemas: { "v2/a.json": "aaa", "v2/b.json": "bbb" },
    };
    expect(
      codexGoalProtocolDrift({
        snapshot,
        installedVersion: "0.148.0",
        generatedHashes: { "v2/a.json": "changed", "v2/c.json": "ccc" },
      }),
    ).toEqual([
      "Codex CLI version changed: expected 0.147.0, got 0.148.0",
      "generated schema changed: v2/a.json",
      "generated schema is missing: v2/b.json",
      "unexpected generated schema fingerprint: v2/c.json",
    ]);
  });
});
