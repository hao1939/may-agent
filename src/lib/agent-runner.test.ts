import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("agent runner infrastructure boundary", () => {
  test("depends only on the model runtime", () => {
    const source = readFileSync(new URL("./agent-runner.ts", import.meta.url), "utf8");
    const imports = source
      .split(/\r?\n/)
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).toContain("@earendil-works/pi-agent-core");
    for (const forbidden of [
      "event-bus",
      "bun:sqlite",
      "requests.js",
      "persistence.js",
      "app-task",
      "metrics",
      "cron",
    ]) {
      expect(imports).not.toContain(forbidden);
    }
  });

  test("the durable manager delegates preparation to the neutral boundary", () => {
    const source = readFileSync(new URL("./manager.ts", import.meta.url), "utf8");
    expect(source).toContain('import { prepareAgentExecution } from "./agent-execution.js"');
    expect(source).not.toContain("private resolveSessionSystemPrompt(");
    expect(source).not.toContain("private buildGuards(");
  });
});
