import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("May Gym adapter boundary", () => {
  test("uses direct prepared execution instead of the hosted runtime", () => {
    const source = readFileSync(
      new URL("../src/cli.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("runDirectAgent");
    expect(source).toContain("visibleAgentDir: agentDest");
    expect(source).toContain("systemPrompt: result.systemPrompt");
    expect(source).toContain("toolDenials: gymToolDenials(agentDir)");
    expect(source).toContain("runGymWorkflowEntry");
    expect(source).toContain("execution_manifest");
    expect(source).toContain("tools: configured");
    expect(source).toContain(
      'const DEFAULT_APP_AGENTS_ROOT = join(REPO_ROOT, "agents")',
    );
    expect(source).not.toContain('"projects/may-agent.app/agents"');
    for (const forbidden of [
      "--oneshot",
      "MAY_BIN",
      "SubagentManager",
      "EventBus",
      "getDb(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  test("the direct agent and workflow adapters do not import hosted infrastructure", () => {
    for (const relPath of [
      "../../may-agent/src/app/direct-agent.ts",
      "../../may-agent/src/app/direct-workflow.ts",
      "../src/workflow-adapter.ts",
    ]) {
      const source = readFileSync(new URL(relPath, import.meta.url), "utf8");
      const imports = source
        .split(/\r?\n/)
        .filter((line) => line.startsWith("import "))
        .join("\n");
      for (const forbidden of [
        "event-bus",
        "requests.js",
        "persistence.js",
        "manager.js",
        "project-app",
        "cron",
        "bun:sqlite",
      ]) {
        expect(imports).not.toContain(forbidden);
      }
    }
  });
});
