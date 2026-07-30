import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PersistedSession } from "../lib/persistence";
import { shouldResumeStartupChatSession, shouldResumeStartupSession } from "./cron-startup";

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
  it("closes completed idle chat turns instead of replaying them after restart", () => {
    expect(
      shouldResumeStartupChatSession("telegram-turn", {
        agent: "may",
        task: "Completed Telegram request",
        status: "idle",
        startedAt: Date.now(),
        source: "telegram",
        requestId: "telegram:45978",
        kind: "chat",
        autoClose: "never",
      }),
    ).toEqual({
      resume: false,
      reason: "Idle chat turn already completed before restart",
    });
  });

  it("still resumes a running chat turn interrupted by restart", () => {
    expect(
      shouldResumeStartupChatSession("telegram-turn", {
        agent: "may",
        task: "Telegram request still running",
        status: "running",
        startedAt: Date.now(),
        source: "telegram",
        requestId: "telegram:45978",
        kind: "chat",
        autoClose: "never",
      }),
    ).toEqual({ resume: true });
  });

  it("leaves task-bound project session recovery to the app task reconciler", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-active-task-app-"));
    try {
      expect(shouldResumeStartupSession("owner-session", session(appDir, "project-app-task-owner"))).toEqual({
        resume: false,
        reason: "Task-bound project session recovery is owned by the app task reconciler",
      });
      expect(
        shouldResumeStartupSession(
          "workflow-session",
          session(appDir, "workflow:task-handler", "project-app-task-reconciler"),
        ),
      ).toEqual({
        resume: false,
        reason: "Task-bound project session recovery is owned by the app task reconciler",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
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
      expect(shouldResumeStartupSession("session-1", session(appDir, "project-app-task-owner"))).toEqual({
        resume: false,
        reason: "Task-bound project session recovery is owned by the app task reconciler",
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
      expect(shouldResumeStartupSession("session-1", session(appDir, "project-app-owner"))).toEqual({ resume: true });
      expect(existsSync(join(appDir, ".state", "tasks"))).toBe(false);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
