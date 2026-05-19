import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("May cron config design alignment", () => {
  it("routes session recovery through session.completed, not only legacy session.failed", () => {
    const cronPath = "/app/agents/may/cron.json";
    if (!existsSync(cronPath)) return;

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const recovery = entries.find((entry) => entry.name === "session-recovery");

    expect(recovery).toBeDefined();
    expect(recovery?.on).toContain("session.completed");
    expect(recovery?.on ?? []).not.toEqual(["session.failed"]);
  });
});
