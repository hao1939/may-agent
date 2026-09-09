import { describe, expect, it } from "bun:test";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PersistedSession } from "../lib/persistence";
import { shouldResumeStartupSession } from "./cron-startup";
import { AppTaskResourceStore } from "./app-task-resource-store";
import { closeDb, getDb } from "../lib/requests";

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
  it.each(["resolve", "reject"])(
    "keeps startup available while Task recovery is pending (%s)",
    async (mode) => {
      const { fileURLToPath } = await import("node:url");
      const fixture = fileURLToPath(new URL("../../test/fixtures/cron-startup.ts", import.meta.url));
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [fixture, mode],
        { timeout: 5_000 },
      );
      expect(stdout).toContain("cron-startup-contract-ok");
    },
    10_000,
  );

  it("never resumes task-bound execution outside bounded Task recovery", () => {
    const appDir = "/fixture/sample.app";
    const persisted = session(appDir, "app-task-owner");
    expect(shouldResumeStartupSession("task-session", persisted)).toEqual({
      resume: false,
      reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
    });
  });

  it("leaves the exact stale parent and completing child sessions to App task recovery", () => {
    const appDir = "/fixture/sample.app";
    for (const sessionId of ["s_1786376766268_235", "s_1786376881309_240"]) {
      const persisted = session(appDir, "workflow:task-handler", "app-task-reconciler");
      persisted.task +=
        '\n\n## Reconciliation Task\n```json\n{"appId":"sample","taskId":"work/legacy","generation":1}\n```';
      expect(shouldResumeStartupSession(sessionId, persisted)).toEqual({
        resume: false,
        reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
      });
    }
  });

  it("keeps task-owned workflow workers out of generic resume even when their prompt omits the task block", () => {
    const appDir = "/fixture/sample.app";
    const persisted = session(appDir, "workflow:domain-task-execution", "app-task-reconciler");
    persisted.task = 'Execute the bounded reconciliation task below.\n\n{"appId":"sample","taskId":"work"}';
    expect(shouldResumeStartupSession("task-worker-session", persisted)).toEqual({
      resume: false,
      reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
    });
  });

  it("resumes an unbound typed owner-review workflow without losing its decision contract", () => {
    const appDir = "/fixture/sample.app";
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
  });

  it("lets the App inbox fence and replace an interrupted legacy agent attempt", () => {
    expect(shouldResumeStartupSession("app-agent-session", session("/tmp/evaluation.app", "app-inbox-owner"))).toEqual({
      resume: false,
      reason: "Legacy App inbox agent sessions are replaced by Task reconciliation",
    });
    expect(shouldResumeStartupSession("human-app-owner", session("/tmp/may.app", "telegram", "app-inbox"))).toEqual({
      resume: false,
      reason: "Legacy App inbox agent sessions are replaced by Task reconciliation",
    });
  });

  it("does not resume any background project session while its task tree is paused", () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "may-paused-projects-"));
    const appDir = join(projectsRoot, "sample.app");
    const persistDir = join(projectsRoot, "host-state");
    try {
      const store = AppTaskResourceStore.fromDb(getDb(persistDir), "sample");
      store.bootstrapSnapshot({ project: "sample", project_lifecycle: "paused", groups: {}, resources: {} }, "test");

      for (const source of ["workflow:project-planner", "workflow:focus-plan"]) {
        expect(shouldResumeStartupSession("session-1", session(appDir, source), projectsRoot, persistDir)).toEqual({
          resume: false,
          reason: expect.stringContaining("Project sample is paused"),
        });
      }
      expect(shouldResumeStartupSession("session-1", session(appDir, "app-task-owner"))).toEqual({
        resume: false,
        reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
      });
    } finally {
      closeDb(persistDir);
      rmSync(projectsRoot, { recursive: true, force: true });
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
