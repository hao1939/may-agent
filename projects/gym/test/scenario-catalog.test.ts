import { describe, expect, it } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { listScenarios, matchesFilters } from "../src/scenarios/catalog";
import { validateScenarioCorpus } from "../src/scenarios/validate";
import type { ScenarioMeta } from "../src/scenarios/types";
import { withTempDir } from "./support/temp-dir";

const validMeta: ScenarioMeta = {
  name: "sample",
  categories: ["planning"],
  tags: ["ability"],
  tier: "smoke",
  timeout: 5,
  agent_type: "coder",
  workflow: false,
};

function writeScenario(root: string, name: string, meta: ScenarioMeta = { ...validMeta, name }): void {
  const dir = join(root, name);
  mkdirSync(join(dir, "environment"), { recursive: true });
  writeFileSync(join(dir, "task.md"), "Do the task.\n");
  writeFileSync(join(dir, "success_criteria.js"), "console.log('{}');\n");
  writeFileSync(join(dir, "scenario.json"), JSON.stringify(meta));
}

describe("scenario catalog", () => {
  it("lists only complete direct scenarios", () =>
    withTempDir((root) => {
      writeScenario(root, "sample");
      mkdirSync(join(root, "partial"));
      writeFileSync(join(root, "partial", "task.md"), "Incomplete\n");
      expect(listScenarios(root)).toEqual(["sample"]);
    }));

  it("uses tier hierarchy when filtering", () => {
    expect(matchesFilters(validMeta, "smoke")).toBe(true);
    expect(matchesFilters(validMeta, "standard")).toBe(true);
    expect(matchesFilters(validMeta, "full")).toBe(true);
    expect(matchesFilters(null, "full")).toBe(false);
  });
});

describe("scenario validation", () => {
  it("fails runnable scenarios without metadata", () =>
    withTempDir((root) => {
      writeScenario(root, "missing-meta");
      writeFileSync(join(root, "missing-meta", "scenario.json"), "not json");
      const result = validateScenarioCorpus(root);
      expect(result.passed).toBe(false);
      expect(result.issues.some((issue) => issue.code === "metadata")).toBe(true);
    }));

  it("reports partial scenarios and absolute links as warnings", () =>
    withTempDir((root) => {
      writeScenario(root, "sample");
      symlinkSync("/tmp", join(root, "sample", "environment", "external"));
      mkdirSync(join(root, "partial"));
      writeFileSync(join(root, "partial", "task.md"), "Incomplete\n");
      const result = validateScenarioCorpus(root);
      expect(result.passed).toBe(true);
      expect(result.issues.map((issue) => issue.code)).toContain("absolute-symlink");
      expect(result.issues.map((issue) => issue.code)).toContain("partial-scenario");
    }));
});

