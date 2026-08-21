import { describe, expect, it } from "bun:test";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PersistedSession } from "../lib/persistence";
import { shouldResumeStartupSession } from "./cron-startup";

function session(appDir: string, source: string, recoveryOwner?: string): PersistedSession {
  return {
    agent: "owner",
    task: `App: ${appDir}\nContinue project work`,
    status: "running",
    startedAt: Date.now(),
    source,
    ...(recoveryOwner ? { recoveryOwner } : {}),
    projectId: "sample",
    kind: "call",
  };
}

describe("cron startup recovery", () => {
  it("runs installed App task recovery before generic stale-session resumption", () => {
    const source = readFileSync(new URL("./cron-startup.ts", import.meta.url), "utf8");
    const recoveryImport = source.indexOf('recoverInstalledAppTasks } from "./app-task-runtime.js";');
    const recoveryCall = source.indexOf("recoverInstalledAppTasks(bus);");
    const staleResume = source.indexOf("manager.resumeStaleSessions(");

    expect(recoveryImport).toBeGreaterThan(-1);
    expect(recoveryCall).toBeGreaterThan(-1);
    expect(recoveryCall).toBeLessThan(staleResume);
  });

  it("never resumes task-bound execution outside bounded Task recovery", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-claimed-task-app-"));
    try {
      const persisted = session(appDir, "app-task-owner");
      expect(shouldResumeStartupSession("task-session", persisted)).toEqual({
        resume: false,
        reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("leaves the exact stale parent and completing child sessions to App task recovery", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-active-task-app-"));
    try {
      for (const sessionId of ["s_1786376766268_235", "s_1786376881309_240"]) {
        const persisted = session(appDir, "workflow:task-handler", "app-task-reconciler");
        persisted.task +=
          '\n\n## Reconciliation Task\n```json\n{"appId":"sample","taskId":"work/legacy","generation":1}\n```';
        expect(
          shouldResumeStartupSession(sessionId, persisted),
        ).toEqual({
          resume: false,
          reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
        });
      }
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("resumes an unbound typed owner-review workflow without losing its decision contract", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-owner-review-app-"));
    try {
      const outputSchema = Type.Object({
        state: Type.Union([Type.Literal("converged"), Type.Literal("waiting")]),
        summary: Type.String({ minLength: 1 }),
        evidence: Type.Array(Type.String({ minLength: 1 })),
      });
      const persisted: PersistedSession = {
        ...session(appDir, "workflow:platform-owner-review", "project-app-task-reconciler"),
        taskId: null,
        projectTaskId: null,
        requireFinish: true,
        outputSchema,
      };

      expect(shouldResumeStartupSession("owner-review-session", persisted)).toEqual({ resume: true });
      expect({ requireFinish: persisted.requireFinish, outputSchema: persisted.outputSchema }).toEqual({
        requireFinish: true,
        outputSchema,
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("lets the App inbox fence and replace an interrupted owner attempt", () => {
    expect(shouldResumeStartupSession("app-owner-session", session("/tmp/evaluation.app", "app-inbox-owner"))).toEqual({
      resume: false,
      reason: "Legacy App inbox owner sessions are replaced by Task reconciliation",
    });
    expect(shouldResumeStartupSession("human-app-owner", session("/tmp/may.app", "telegram", "app-inbox"))).toEqual({
      resume: false,
      reason: "Legacy App inbox owner sessions are replaced by Task reconciliation",
    });
  });

  it("does not resume any background project session while its task tree is paused", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-paused-app-"));
    try {
      const treeDir = join(appDir, ".state", "tasks");
      mkdirSync(treeDir, { recursive: true });
      writeFileSync(
        join(treeDir, "state.json"),
        `${JSON.stringify({ project_lifecycle: "paused", groups: {}, resources: {} }, null, 2)}\n`,
      );

      for (const source of ["workflow:project-planner", "workflow:focus-plan"]) {
        expect(shouldResumeStartupSession("session-1", session(appDir, source))).toEqual({
          resume: false,
          reason: expect.stringContaining("Project sample is paused"),
        });
      }
      expect(shouldResumeStartupSession("session-1", session(appDir, "app-task-owner"))).toEqual({
        resume: false,
        reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("leaves non-project sessions unaffected", () => {
    expect(
      shouldResumeStartupSession("session-1", {
        agent: "may",
        task: "background runtime work",
        status: "running",
        startedAt: Date.now(),
        source: "workflow:runtime",
        kind: "call",
      }),
    ).toEqual({ resume: true });
  });

  it("does not create task state while checking an app without a task attachment", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-owner-only-app-"));
    try {
      expect(shouldResumeStartupSession("session-1", session(appDir, "app-owner"))).toEqual({ resume: true });
      expect(existsSync(join(appDir, ".state", "tasks"))).toBe(false);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
