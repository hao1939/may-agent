import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("May Gym adapter boundary", () => {
  test("uses direct prepared execution instead of the hosted runtime", () => {
    const source = readFileSync(
      new URL("../src/cli.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("runDirectAgent");
    expect(source).toContain("toolDenials: gymToolDenials(agentDir)");
    expect(source).toContain("execution_manifest");
    expect(source).toContain("tools: configured");
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

  test("the direct adapter does not import hosted infrastructure", () => {
    const source = readFileSync(
      new URL("../../may-agent/src/app/direct-agent.ts", import.meta.url),
      "utf8",
    );
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
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });
});
