import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("May cron config design alignment", () => {
  it("uses workflow-backed handler objects instead of the legacy run-workflow handler", () => {
    const cronPath = "/app/agents/may/cron.json";
    if (!existsSync(cronPath)) return;

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{
      handler?: string | { workflow?: string; agent?: string; task?: string };
    }>;
    const legacy = entries.filter((entry) => entry.handler === "run-workflow");
    const invalidWorkflowHandlers = entries.filter(
      (entry) => typeof entry.handler === "object" && (!entry.handler.workflow || !entry.handler.task),
    );

    expect(legacy).toEqual([]);
    expect(invalidWorkflowHandlers).toEqual([]);
  });

  it("routes session recovery through session.completed, not only legacy session.failed", () => {
    const cronPath = "/app/agents/may/cron.json";
    if (!existsSync(cronPath)) return;

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const recovery = entries.find((entry) => entry.name === "session-recovery");

    expect(recovery).toBeDefined();
    expect(recovery?.on).toContain("session.completed");
    expect(recovery?.on ?? []).not.toEqual(["session.failed"]);
  });

  it("routes escalations through canonical escalation.created events", () => {
    const cronPath = "/app/agents/may/cron.json";
    if (!existsSync(cronPath)) return;

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const escalation = entries.find((entry) => entry.name === "escalation");

    expect(escalation).toBeDefined();
    expect(escalation?.on).toContain("escalation.created");
    expect(escalation?.on ?? []).not.toContain("session.escalated");
  });

  it("keeps manual trigger shortcuts out of subscription lists", () => {
    const cronPath = "/app/agents/may/cron.json";
    if (!existsSync(cronPath)) return;

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const triggerSubscriptions = entries.flatMap((entry) =>
      (entry.on ?? [])
        .filter((eventType) => eventType.startsWith("trigger."))
        .map((eventType) => ({ entry: entry.name, eventType })),
    );

    expect(triggerSubscriptions).toEqual([]);
  });
});
