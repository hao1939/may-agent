import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd().endsWith("/agents") ? process.cwd() : join(process.cwd(), "agents");
const CRON_PATH = join(ROOT, "may", "cron.json");
const HANDLER_PATH = join(ROOT, "may", "handlers", "eval-llm-scan.ts");

describe("eval-llm-scan durable non-heuristic lane", () => {
  it("has an enabled cron entry wired to the tracked handler with a valid interval", () => {
    expect(existsSync(CRON_PATH), "agents/may/cron.json should exist").toBe(true);
    expect(existsSync(HANDLER_PATH), "agents/may/handlers/eval-llm-scan.ts should exist").toBe(true);

    const cron = JSON.parse(readFileSync(CRON_PATH, "utf8"));
    const entry = cron.find((item: any) => item?.name === "eval-llm-scan");

    expect(entry, "cron entry named eval-llm-scan should exist").toBeTruthy();
    expect(entry.enabled).toBe(true);
    expect(entry.handler).toBe("eval-llm-scan");
    expect(entry.agent).toBe("evaluator");
    expect(entry.intervalMs).toBeGreaterThan(0);
  });

  it("keeps bounded dispatch, active-child suppression, and validated non-heuristic writes in source", () => {
    const src = readFileSync(HANDLER_PATH, "utf8");

    expect(src).toContain("function readValidArtifact");
    expect(src).toContain("parseDeepEvaluationArtifact(readFileSync");
    expect(src).toContain("function recordDeepEvaluation");
    expect(src).toContain("evaluatedByHeuristic, skippedByJs, createdAt");
    expect(src).toContain("0,\n      0,");
    expect(src).toContain("source: \"eval-llm-scan\"");
  });
});
