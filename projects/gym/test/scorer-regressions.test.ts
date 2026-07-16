import { describe, expect, it } from "bun:test";
import { appendFileSync, cpSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { withTempDir } from "./support/temp-dir";

interface ScorerCheck {
  name: string;
  passed: boolean;
}

function scoreLogStats(workDir: string): ScorerCheck[] {
  const scorer = resolve(import.meta.dirname, "../scenarios/scout-coder-logstats/success_criteria.js");
  const result = Bun.spawnSync(["node", scorer, workDir], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_PATH: [resolve(import.meta.dirname, "../dist"), process.env["NODE_PATH"]]
        .filter(Boolean)
        .join(delimiter),
    },
  });
  const output = new TextDecoder().decode(result.stdout).trim();
  return (JSON.parse(output) as { checks: ScorerCheck[] }).checks;
}

describe("legacy scorer regressions", () => {
  it("fails closed when the evaluated agent modifies protected test data", () =>
    withTempDir((root) => {
      const fixture = resolve(import.meta.dirname, "../scenarios/scout-coder-logstats/environment");
      cpSync(fixture, root, { recursive: true });

      expect(scoreLogStats(root).find((check) => check.name === "test-not-modified")?.passed).toBe(true);

      appendFileSync(join(root, "test", "test.js"), "\n// unauthorized test edit\n");
      expect(scoreLogStats(root).find((check) => check.name === "test-not-modified")?.passed).toBe(false);
    }));
});
