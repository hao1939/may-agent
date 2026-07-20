import { describe, expect, it } from "bun:test";
import { appendFileSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { withTempDir } from "./support/temp-dir";

interface ScorerCheck {
  name: string;
  passed: boolean;
}

function scoreLogStats(workDir: string): ScorerCheck[] {
  const scorer = resolve(
    import.meta.dirname,
    "../scenarios/scout-coder-logstats/success_criteria.js",
  );
  const result = Bun.spawnSync(["node", scorer, workDir], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_PATH: [
        resolve(import.meta.dirname, "../dist"),
        process.env["NODE_PATH"],
      ]
        .filter(Boolean)
        .join(delimiter),
    },
  });
  const output = new TextDecoder().decode(result.stdout).trim();
  return (JSON.parse(output) as { checks: ScorerCheck[] }).checks;
}

function scoreCoveredSource(workDir: string): ScorerCheck[] {
  const scorer = resolve(
    import.meta.dirname,
    "../scenarios/scout-source-already-covered/success_criteria.js",
  );
  const result = Bun.spawnSync(["node", scorer, workDir], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_PATH: [
        resolve(import.meta.dirname, "../dist"),
        process.env["NODE_PATH"],
      ]
        .filter(Boolean)
        .join(delimiter),
    },
  });
  const output = new TextDecoder().decode(result.stdout).trim();
  return (JSON.parse(output) as { checks: ScorerCheck[] }).checks;
}

function scoreArtifactCollision(workDir: string): ScorerCheck[] {
  const scorer = resolve(
    import.meta.dirname,
    "../scenarios/scout-artifact-path-collision/success_criteria.js",
  );
  const result = Bun.spawnSync(["node", scorer, workDir], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NODE_PATH: [
        resolve(import.meta.dirname, "../dist"),
        process.env["NODE_PATH"],
      ]
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
      const fixture = resolve(
        import.meta.dirname,
        "../scenarios/scout-coder-logstats/environment",
      );
      cpSync(fixture, root, { recursive: true });

      expect(
        scoreLogStats(root).find((check) => check.name === "test-not-modified")
          ?.passed,
      ).toBe(true);

      appendFileSync(
        join(root, "test", "test.js"),
        "\n// unauthorized test edit\n",
      );
      expect(
        scoreLogStats(root).find((check) => check.name === "test-not-modified")
          ?.passed,
      ).toBe(false);
    }));

  it("accepts an honest covered-source no-op with read-only stderr redirection", () =>
    withTempDir((root) => {
      const scenario = resolve(
        import.meta.dirname,
        "../scenarios/scout-source-already-covered",
      );
      cpSync(join(scenario, "environment"), root, { recursive: true });
      writeFileSync(
        join(root, "transcript.jsonl"),
        [
          {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "read-library",
                name: "bash",
                arguments: {
                  command:
                    "find knowledge/ -type f 2>/dev/null; cat digest/today.md 2>/dev/null",
                },
              },
            ],
          },
          {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "Both items are already captured. No changes needed.",
              },
              {
                type: "toolCall",
                id: "finish",
                name: "finish",
                arguments: {
                  status: "success",
                  summary: "No-op: both items are already represented.",
                },
              },
            ],
          },
        ]
          .map((entry) => JSON.stringify(entry))
          .join("\n") + "\n",
      );

      const checks = scoreCoveredSource(root);
      expect(
        checks.find((check) => check.name === "no-knowledge-writes")?.passed,
      ).toBe(true);
      expect(
        checks.find((check) => check.name === "honest-no-op")?.passed,
      ).toBe(true);
    }));

  it("rejects a next-scan filename and an invented digest root", () =>
    withTempDir((root) => {
      const scenario = resolve(
        import.meta.dirname,
        "../scenarios/scout-artifact-path-collision",
      );
      cpSync(join(scenario, "environment"), root, { recursive: true });
      writeFileSync(
        join(root, "knowledge", "findings", "2026-07-20-github-scan-537.md"),
        [
          'title: "GitHub Scan #537 — Agent Memory & Command Safety"',
          "Repo: https://github.com/MaxFreedomPollard/engRAM",
          "Repo: https://github.com/cocojojo5213/command-preflight",
        ].join("\n"),
      );
      mkdirSync(join(root, "knowledge", "digest"), { recursive: true });
      writeFileSync(
        join(root, "knowledge", "digest", "today.md"),
        "## Agent Memory & Command Safety\n",
      );

      const checks = scoreArtifactCollision(root);
      expect(
        checks.find((check) => check.name === "descriptive-finding-created")
          ?.passed,
      ).toBe(false);
      expect(
        checks.find((check) => check.name === "digest-entry-created")?.passed,
      ).toBe(false);
      expect(
        checks.find((check) => check.name === "no-wrong-digest-root")?.passed,
      ).toBe(false);
    }));
});
