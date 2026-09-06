import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP_ROOT } from "./installation.js";

const cronPath = resolve(APP_ROOT, "agents/may/cron.json");

// Newer App installations no longer have this legacy optional cron file.
// Report that contract as skipped rather than seven successful no-op tests.
describe.skipIf(!existsSync(cronPath))("May cron config design alignment", () => {
  it("uses workflow-backed handler objects instead of the legacy run-workflow handler", () => {

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

  it("does not use detached agent-message jobs for active May triggers", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{
      name?: string;
      enabled?: boolean;
      handler?: unknown;
      agent?: string;
      message?: string;
    }>;
    const detached = entries
      .filter((entry) => entry.enabled !== false)
      .filter((entry) => !entry.handler && (entry.agent || entry.message))
      .map((entry) => entry.name);

    expect(detached).toEqual([]);
  });

  it("routes session recovery through canonical session.end", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const recovery = entries.find((entry) => entry.name === "session-recovery");

    expect(recovery).toBeDefined();
    expect(recovery?.on).toContain("session.end");
    expect(recovery?.on ?? []).not.toContain("session.completed");
    expect(recovery?.on ?? []).not.toContain("session.failed");
  });

  it("routes escalations through canonical escalation.created events", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const escalation = entries.find((entry) => entry.name === "escalation");

    expect(escalation).toBeDefined();
    expect(escalation?.on).toContain("escalation.created");
    expect(escalation?.on ?? []).not.toContain("session.escalated");
  });

  it("keeps manual trigger shortcuts out of subscription lists", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    const triggerSubscriptions = entries.flatMap((entry) =>
      (entry.on ?? [])
        .filter((eventType) => eventType.startsWith("trigger."))
        .map((eventType) => ({ entry: entry.name, eventType })),
    );

    expect(triggerSubscriptions).toEqual([]);
  });

  it("does not retain the legacy project scheduler or steward", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; on?: string[] }>;
    expect(entries.some((entry) => entry.name === "project")).toBe(false);
    expect(entries.some((entry) => entry.name === "project-steward")).toBe(false);
    expect(entries.flatMap((entry) => entry.on ?? [])).not.toContain("project.task.finished");
  });

  it("declares reachable maintenance context for every trigger entry", () => {

    const entries = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{ name?: string; context?: string[] }>;
    const invalid = entries.flatMap((entry) => {
      const context = entry.context ?? [];
      if (!Array.isArray(context) || context.length === 0) {
        return [{ entry: entry.name, reason: "missing context" }];
      }
      return context
        .filter(
          (contextPath) =>
            typeof contextPath !== "string" ||
            contextPath.trim() === "" ||
            contextPath.startsWith("/") ||
            contextPath.includes("..") ||
            !existsSync(resolve(APP_ROOT, contextPath)),
        )
        .map((contextPath) => ({ entry: entry.name, reason: `invalid context path: ${String(contextPath)}` }));
    });

    expect(invalid).toEqual([]);
  });
});
