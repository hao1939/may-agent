import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("runs installed project-app recovery before generic stale-session resumption", () => {
    const source = readFileSync(new URL("./cron-startup.ts", import.meta.url), "utf8");
    const recoveryImport = source.indexOf(
      'import { recoverInstalledProjectAppTasks } from "./loader/project-app-loader.js";',
    );
    const recoveryCall = source.indexOf(
      "const claimedProjectTaskSessionIds = recoverInstalledProjectAppTasks({",
    );
    const staleResume = source.indexOf("manager.resumeStaleSessions(");

    expect(recoveryImport).toBeGreaterThan(-1);
    expect(recoveryCall).toBeGreaterThan(-1);
    expect(recoveryCall).toBeLessThan(staleResume);
  });

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

  it("resumes only a task-bound session atomically claimed by project-app recovery", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-claimed-task-app-"));
    try {
      const persisted = session(appDir, "project-app-task-owner");
      expect(shouldResumeStartupSession("claimed-session", persisted, new Set(["claimed-session"]))).toEqual({
        resume: true,
      });
      expect(shouldResumeStartupSession("different-session", persisted, new Set(["claimed-session"]))).toEqual({
        resume: false,
        reason: "Task-bound project session was not claimed by project-app recovery during startup",
      });
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("leaves the exact stale parent and completing child sessions to project-app recovery", () => {
    const appDir = mkdtempSync(join(tmpdir(), "may-active-task-app-"));
    try {
      for (const sessionId of ["s_1786376766268_235", "s_1786376881309_240"]) {
        expect(
          shouldResumeStartupSession(
            sessionId,
            session(appDir, "workflow:task-handler", "project-app-task-reconciler"),
          ),
        ).toEqual({
          resume: false,
          reason: "Task-bound project session was not claimed by project-app recovery during startup",
        });
      }
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });

  it("lets the App inbox fence and replace an interrupted owner attempt", () => {
    expect(shouldResumeStartupSession("app-owner-session", session("/tmp/evaluation.app", "app-inbox-owner"))).toEqual({
      resume: false,
      reason: "App inbox host reclaims the fenced request with a fresh bounded owner attempt",
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
      expect(shouldResumeStartupSession("session-1", session(appDir, "project-app-task-owner"))).toEqual({
        resume: false,
        reason: "Task-bound project session was not claimed by project-app recovery during startup",
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
