import { describe, expect, it, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cron } from "../cron";
import { EVENT_ROW_ID, EventBus } from "../event-bus";
import { closeDb, getDb, upsertSession } from "../../lib/requests";
import { readSessionMeta, writeSessionMeta } from "../../lib/persistence";
import { projectRuntimePaths } from "@may-agent/sdk";
import { prepareProjectTaskWorkspace } from "../project-task-workspace";
import {
  inferProjectAppOwner,
  installProjectApps,
  invokeLoadedProjectAppAction,
  listProjectAppDirs,
  normalizeTaskHandlerResult,
  parseProjectAppTaskSessionBinding,
  projectAppGlobalConcurrency,
  projectAppHostFingerprint,
} from "./project-app-loader";

describe("project app host backpressure", () => {
  it("uses a safe convention while allowing one explicit override", () => {
    expect(projectAppGlobalConcurrency(undefined)).toBe(6);
    expect(projectAppGlobalConcurrency("3")).toBe(3);
    expect(projectAppGlobalConcurrency("0")).toBe(6);
    expect(projectAppGlobalConcurrency("invalid")).toBe(6);
  });
});

function fixture() {
  const root = join(tmpdir(), `project-app-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "sample.app");
  const persistDir = join(root, ".state");
  mkdirSync(join(appDir, "agents", "owner"), { recursive: true });
  writeFileSync(
    join(appDir, "agents", "owner", "agent.json"),
    JSON.stringify({ name: "sample-owner", description: "owner", model: "test", tools: [] }),
  );
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: {
        root: { id: "root", parent_id: null, state: "backlog", owner: "sample-owner", children: ["operations"] },
        operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
      },
    }),
  );
  return { root, projectsRoot, appDir, persistDir };
}

function writeApp(appDir: string, extra = "") {
  writeFileSync(
    join(appDir, "app.ts"),
    `export default {
      id: "sample",
      version: 1,
      owner: "sample-owner",
      description: "sample",
      workspace: { kind: "local", localPath: "." },
      budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 2 },
      schedules: [{ id: "pulse", enabled: true, intervalMs: 60000, emits: [{ type: "sample.work", project: "sample", itemId: "scheduled" }] }],
      tasks: {
        accepts: [
          { type: "sample.work", project: "sample" },
          { type: "project.owner.requested", project: "sample" }
        ],
        resolve(event) {
          const itemId = event.itemId || (event.type === "project.owner.requested" ? "owner-review" : "unknown");
          return {
            id: "work/" + itemId,
            parentId: "operations",
            outcome: "Process " + event.itemId,
            acceptance: ["Work converges"],
            mode: event.mode || "achieve",
            ...(event.ownerOnly ? {} : { workflow: event.workflow || "worker" }),
            ...(event.taskOwner ? { owner: event.taskOwner } : {}),
            ...(event.priority ? { priority: event.priority } : {}),
            input: { itemId, ...(event.revision ? { revision: event.revision } : {}) },
            outputs: event.outputs || []
          };
        }
      },
      events: [{ type: "sample.note", project: "sample" }],
      actions: {
        run: {
          type: "async",
          description: "run work",
          inputSchema: { type: "object", additionalProperties: true },
          event(params) { return { type: "sample.work", project: "sample", ...params }; }
        }
      },
      onEvent(ctx, event) {
        if (event.type === "sample.note" && event.fail) throw new Error("sample handler failed");
        if (event.type === "sample.note") return ctx.noop("seen");
      },
      ${extra}
    };\n`,
  );
  mkdirSync(join(appDir, "agents", "owner", "workflows"), { recursive: true });
  writeFileSync(
    join(appDir, "agents", "owner", "workflows", "worker.ts"),
    `export const name = "worker";
     export const description = "sample worker";
     export async function execute(ctx) {
       if (!ctx.task.includes("app: ${appDir}") || !ctx.task.includes("project: ${appDir}")) {
         return ctx.blocked("canonical app/workspace paths are missing");
       }
       if (ctx.appDir !== "${appDir}" || ctx.projectDir !== "${appDir}" || ctx.workspaceDir !== "${appDir}") {
         return ctx.blocked("resolved workflow context paths are missing");
       }
       return ctx.done("done", { state: "converged", summary: "workflow done", evidence: ["proof"], actions: [] });
     }`,
  );
}

function manager(ownerCalls: string[], ownerOptions: Array<Record<string, unknown>> = []) {
  return {
    hasAgent: () => true,
    async callAgent(_agent: string, task: string, options: Record<string, unknown>) {
      ownerCalls.push(task);
      ownerOptions.push(options);
      return {
        sessionId: "owner-session",
        status: "done",
        structuredResult: { state: "converged", summary: "owner done", evidence: ["owner proof"], actions: [] },
        lastAssistantText: "owner done",
        messages: [],
        duration: "0s",
        outputDir: "",
      };
    },
  } as any;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}

describe("project app loader handler result normalization", () => {
  it("preserves exact valid Conditions", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "wait for session terminal event",
          evidence: ["owner named the external wait"],
          actions: [],
          conditions: [
            {
              id: "session-terminal-s_1",
              type: "event-observed",
              subject: "session:s_1",
              expected: { status: "done" },
              owner: "agent:evaluator",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "waiting",
      conditions: [
        {
          id: "session-terminal-s_1",
          type: "event-observed",
          subject: "session:s_1",
          expected: { status: "done" },
          owner: "agent:evaluator",
        },
      ],
    });
  });

  it("rejects malformed Conditions instead of absorbing unfinished work", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "malformed wait",
          evidence: ["condition identity was blank"],
          actions: [],
          conditions: [
            {
              id: "",
              type: "event-observed",
              subject: "session:s_1",
              expected: { status: "done" },
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary: expect.stringContaining("Handler result was rejected:"),
      actions: [],
    });
  });

  it("leaves contextual waiting validation to the task reconciler", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "waiting",
          summary: "wait later",
          evidence: [],
          actions: [],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "waiting",
      summary: "wait later",
      actions: [],
    });
  });

  it("rejects a done owner session without a schema-backed task result", () => {
    expect(
      normalizeTaskHandlerResult(
        undefined,
        { type: "done", summary: "owner said done without result", runId: "s_owner" },
        { allowNeedsOwner: false },
      ),
    ).toMatchObject({
      state: "error",
      summary: expect.stringContaining("Handler result was rejected:"),
      evidence: ["workflow-run:s_owner"],
      actions: [],
    });
  });

  it("rejects failed as a removed handler decision state", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "failed",
          summary: "no exact machine-observable wait exists",
          evidence: ["owner inspected current facts and found no event source"],
          actions: [],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary: "Handler result was rejected: state must be converged, waiting, or needs-owner",
      actions: [],
    });
  });

  it("does not apply task actions from the removed failed result state", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "failed",
          summary: "the attempt could not complete",
          evidence: ["command exited 1"],
          actions: [
            {
              kind: "create-task",
              id: "must-not-apply",
              parentId: "operations",
              outcome: "This action is not authoritative",
              mode: "achieve",
              outputs: ["proof.md"],
              acceptance: ["Never applied"],
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary: "Handler result was rejected: state must be converged, waiting, or needs-owner",
      actions: [],
    });
  });

  it("rejects the removed progressing result state", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "progressing",
          summary: "standing monitor observed unchanged work",
          evidence: ["no task-tree mutation is needed"],
          actions: [],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary: "Handler result was rejected: state must be converged, waiting, or needs-owner",
      actions: [],
    });
  });

  it("rejects owner-style prose action names instead of applying them", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "dispatch an existing review task",
          evidence: ["owner inspected the stalled review queue"],
          actions: [
            {
              type: "task.dispatch-existing-review",
              taskId: "domain/wait-ado-run-123",
              reason: "fallback passed",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary: expect.stringContaining("Handler result was rejected:"),
      actions: [],
    });
  });

  it("rejects project as a fake workflow name", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "create owner-handled domain work",
          evidence: ["owner named the exact next task"],
          actions: [
            {
              kind: "create-task",
              id: "domain/fix-one-spec",
              parentId: "domain/root",
              outcome: "Fix one spec",
              mode: "achieve",
              outputs: ["evidence/archive/fix-one-spec.json"],
              acceptance: ["The exact spec has a live pass or exact blocker."],
              owner: "aks-explorer",
              workflow: "project",
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "error",
      summary:
        "Handler result was rejected: actions[0].workflow must name a real workflow; omit workflow for owner-handled project work",
      actions: [],
    });
  });

  it("accepts the supported task action shape", () => {
    expect(
      normalizeTaskHandlerResult(
        {
          state: "converged",
          summary: "create bounded follow-up",
          evidence: ["owner named the exact next task"],
          actions: [
            {
              kind: "create-task",
              id: "domain/fix-one-spec",
              parentId: "domain/root",
              outcome: "Fix one spec",
              mode: "achieve",
              outputs: ["evidence/archive/fix-one-spec.json"],
              acceptance: ["The exact spec has a live pass or exact blocker."],
              priority: "P1",
              owner: "aks-explorer",
              workflow: "default-task-worker",
              input: { specId: "spec.example" },
            },
          ],
        },
        { type: "done", summary: "fallback", runId: "s_owner" },
      ),
    ).toMatchObject({
      state: "converged",
      actions: [
        {
          kind: "create-task",
          id: "domain/fix-one-spec",
        },
      ],
    });
  });
});

describe("project app loader", () => {
  it("reads task bindings from reconciliation prompts only", () => {
    expect(
      parseProjectAppTaskSessionBinding(`Nested workflow step

## Reconciliation Task
\`\`\`json
{"appId":"sample.app","taskId":"work/current","generation":3}
\`\`\``),
    ).toEqual({ appId: "sample", taskId: "work/current", generation: 3 });
    expect(parseProjectAppTaskSessionBinding("ordinary agent work")).toBeNull();
    expect(parseProjectAppTaskSessionBinding("## Reconciliation Task\n```json\n{not-json}\n```")).toBeNull();
  });

  it("interrupts a workflow session that starts for a superseded task generation", async () => {
    const f = fixture();
    const canceled: string[] = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          ...manager([]),
          hasActiveSession: (sessionId: string) => sessionId === "stale-workflow-session",
          cancel: (sessionId: string) => canceled.push(sessionId),
        } as any,
        bus,
        agentCrons: new Map(),
      });

      const statePath = projectRuntimePaths(f.appDir).taskStatePath;
      const state = JSON.parse(readFileSync(statePath, "utf8"));
      state.groups.operations.children = ["work/current"];
      state.resources = {
        ...(state.resources ?? {}),
        "work/current": {
          metadata: { id: "work/current", generation: 2, resourceVersion: 2 },
          spec: {
            parentId: "operations",
            outcome: "Current work",
            acceptance: ["Current generation converges"],
            mode: "achieve",
            workflow: "worker",
          },
          status: {
            observedGeneration: 1,
            phase: "pending",
            updatedAt: "2026-07-25T00:00:00.000Z",
          },
        },
      };
      writeFileSync(statePath, JSON.stringify(state));

      bus.emit({
        type: "session.start",
        source: "workflow:worker",
        owner: "agent:sample-owner",
        data: {
          sessionId: "stale-workflow-session",
          agent: "sample-owner",
          task: `Run stale work

## Reconciliation Task
\`\`\`json
{"appId":"sample","taskId":"work/current","generation":1}
\`\`\``,
          trigger: "call",
          firedAt: Date.now(),
          projectId: "sample",
        },
      } as any);

      expect(canceled).toEqual(["stale-workflow-session"]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("rechecks a failed task workspace on reload and requeues the same generation when it becomes recoverable", async () => {
    const f = fixture();
    const projectDir = join(f.projectsRoot, "sample");
    try {
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      execFileSync("git", ["-C", projectDir, "config", "user.email", "test@example.com"]);
      execFileSync("git", ["-C", projectDir, "config", "user.name", "Test"]);
      writeFileSync(join(projectDir, "README.md"), "base\n");
      execFileSync("git", ["-C", projectDir, "add", "README.md"]);
      execFileSync("git", ["-C", projectDir, "commit", "-m", "base"]);
      writeFileSync(
        join(f.appDir, "app.ts"),
        `export default {
          id: "sample", version: 1, owner: "sample-owner", description: "sample",
          workspace: { kind: "git", localPath: "../sample", branch: "dev" },
          budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 1 },
          tasks: {
            accepts: [{ type: "sample.work", project: "sample" }],
            resolve() { return { id: "work/workspace-recovery", parentId: "operations", outcome: "resume exact task workspace", acceptance: ["workflow sees the recovered workspace"], mode: "achieve", workflow: "workspace-recovery", outputs: ["handled.txt"] }; }
          }
        };\n`,
      );
      mkdirSync(join(f.appDir, "agents", "owner", "workflows"), { recursive: true });
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "workspace-recovery.ts"),
        `import { writeFileSync } from "node:fs";
         import { join } from "node:path";
         export const name = "workspace-recovery";
         export const description = "observe recovered task workspace";
         export const workspace = { kind: "task", baseBranch: "dev" };
         export async function execute(ctx) {
           writeFileSync(join(ctx.workspaceDir, "handled.txt"), "handled\\n");
           return ctx.done("workspace workflow ran", { state: "needs-owner", summary: "workspace workflow ran", evidence: ["handled.txt"], actions: [] });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      const installOptions = {
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      };
      await installProjectApps(installOptions);

      const prepared = prepareProjectTaskWorkspace({
        repoDir: projectDir,
        workspaceRoot: join(f.root, "worktrees", "sample"),
        taskId: "work/workspace-recovery",
        generation: 1,
        baseBranch: "dev",
        refreshRemote: false,
      });
      execFileSync("git", ["-C", prepared.metadata.path, "checkout", "--detach"]);

      bus.emit({ type: "sample.work", project: "sample" } as any);
      await waitUntil(() => {
        const state = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
        return state.resources["work/workspace-recovery"]?.status.phase === "attention";
      });
      const failedState = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
      expect(Object.values(failedState.attempts)).toContainEqual(
        expect.objectContaining({
          taskId: "work/workspace-recovery",
          taskGeneration: 1,
          failureReason: "WorkspacePreparationFailed",
        }),
      );

      const attemptCount = Object.keys(failedState.attempts).length;
      await installProjectApps(installOptions);
      const stillRejected = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
      expect(stillRejected.resources["work/workspace-recovery"].status.phase).toBe("attention");
      expect(Object.keys(stillRejected.attempts)).toHaveLength(attemptCount);

      const rebaseDir = execFileSync("git", ["-C", prepared.metadata.path, "rev-parse", "--git-path", "rebase-merge"], {
        encoding: "utf8",
      }).trim();
      mkdirSync(rebaseDir, { recursive: true });
      writeFileSync(join(rebaseDir, "head-name"), `refs/heads/${prepared.metadata.branch}\n`);

      await installProjectApps(installOptions);
      await waitUntil(() => existsSync(join(prepared.metadata.path, "handled.txt")));
      const recoveredState = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
      expect(recoveredState.resources["work/workspace-recovery"].metadata.generation).toBe(1);
      expect(recoveredState.resources["work/workspace-recovery"].status.phase).toBe("attention");
      expect(Object.keys(recoveredState.attempts).length).toBeGreaterThan(attemptCount);
      expect(readFileSync(join(prepared.metadata.path, "handled.txt"), "utf8")).toBe("handled\n");
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "project.task.handler.recovered",
          data: expect.objectContaining({
            taskId: "work/workspace-recovery",
            reason: "task-workspace-preparation-succeeded-after-app-reload",
          }),
        }),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("lets a replacement controller use remaining app capacity while an old attempt drains", async () => {
    const f = fixture();
    const releasePath = join(f.root, "release-blocker");
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "blocker.ts"),
        `import { existsSync } from "node:fs";
         export const name = "blocker";
         export const description = "hold one app slot across reload";
         export async function execute(ctx) {
           while (!existsSync(${JSON.stringify(releasePath)})) {
             await new Promise((resolve) => setTimeout(resolve, 5));
           }
           return ctx.done("blocker done", { state: "converged", summary: "blocker done", evidence: ["proof"], actions: [] });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      const installOptions = {
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      };
      await installProjectApps(installOptions);

      bus.emit({ type: "sample.work", project: "sample", itemId: "blocker", workflow: "blocker" } as any);
      await waitUntil(() =>
        events.some(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/blocker",
        ),
      );

      await installProjectApps(installOptions);
      bus.emit({ type: "sample.work", project: "sample", itemId: "current" } as any);
      await waitUntil(() =>
        events.some(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/current",
        ),
      );
      expect(
        events.some((event) => event.type === "project.task.reconciled" && event.data?.taskId === "work/blocker"),
      ).toBe(false);

      writeFileSync(releasePath, "release\n");
      await waitUntil(() =>
        events.some((event) => event.type === "project.task.reconciled" && event.data?.taskId === "work/blocker"),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("keeps an opted-in mutation task open until its committed branch is integrated", async () => {
    const f = fixture();
    const projectDir = join(f.projectsRoot, "sample");
    try {
      execFileSync("git", ["init", "-b", "dev", projectDir]);
      execFileSync("git", ["-C", projectDir, "config", "user.email", "test@example.com"]);
      execFileSync("git", ["-C", projectDir, "config", "user.name", "Test"]);
      writeFileSync(join(projectDir, "README.md"), "base\n");
      execFileSync("git", ["-C", projectDir, "add", "README.md"]);
      execFileSync("git", ["-C", projectDir, "commit", "-m", "base"]);
      execFileSync("git", ["-C", projectDir, "branch", "main"]);
      writeFileSync(
        join(f.appDir, "app.ts"),
        `export default {
          id: "sample", version: 1, owner: "sample-owner", description: "sample",
          workspace: { kind: "git", localPath: "../sample", branch: "dev" },
          budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 1 },
          tasks: {
            accepts: [{ type: "sample.work", project: "sample" }],
            resolve() { return { id: "work/isolated", parentId: "operations", outcome: "commit isolated change", acceptance: ["change committed"], mode: "achieve", workflow: "isolated", outputs: ["change.txt"] }; }
          }
        };\n`,
      );
      mkdirSync(join(f.appDir, "agents", "owner", "workflows"), { recursive: true });
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "isolated.ts"),
        `import { writeFileSync } from "node:fs";
         import { execFileSync } from "node:child_process";
         import { join } from "node:path";
         export const name = "isolated";
         export const description = "isolated task mutation";
         export const workspace = { kind: "task", baseBranch: "main" };
         export async function execute(ctx) {
           if (ctx.workspaceDir === ctx.projectDir) return ctx.blocked("workspace was not isolated");
           writeFileSync(join(ctx.workspaceDir, "change.txt"), "isolated\\n");
           execFileSync("git", ["-C", ctx.workspaceDir, "add", "change.txt"]);
           execFileSync("git", ["-C", ctx.workspaceDir, "commit", "-m", "isolated change"]);
           return ctx.done("committed", { state: "converged", summary: "committed", evidence: ["change.txt"], actions: [] });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/isolated" &&
            event.data?.disposition === "attention",
        ),
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
      const attempt = Object.values(state.attempts).find((value: any) => value.taskId === "work/isolated") as any;
      const workspace = attempt.workspace;
      expect(workspace).toMatchObject({
        kind: "task-worktree",
        baseRef: "main",
        disposition: "branch-retained",
      });
      expect(state.resources["work/isolated"].status).toMatchObject({
        phase: "attention",
        summary: expect.stringContaining("must wait for integration"),
      });
      expect(state.receipts?.["work/isolated"]).toBeUndefined();
      expect(existsSync(workspace.path)).toBe(false);
      expect(
        execFileSync("git", ["-C", projectDir, "branch", "--list", workspace.branch], { encoding: "utf8" }),
      ).toContain(workspace.branch);
      expect(execFileSync("git", ["-C", projectDir, "status", "--porcelain"], { encoding: "utf8" })).toBe("");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("loads an owner-only app without creating or attaching task runtime state", async () => {
    const f = fixture();
    try {
      writeFileSync(
        join(f.appDir, "app.ts"),
        `export default {
          id: "sample",
          version: 1,
          owner: "sample-owner",
          description: "direct owner-only app"
        };\n`,
      );
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: new Map(),
      });

      expect(result.installed.map((descriptor) => descriptor.id)).toEqual(["sample"]);
      expect(result.entries).toBe(0);
      expect(existsSync(join(f.appDir, ".state", "tasks"))).toBe(false);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("discovers app directories and infers the conventional owner", () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      expect(listProjectAppDirs(f.projectsRoot)).toEqual([f.appDir]);
      expect(inferProjectAppOwner(f.appDir)).toBe("sample-owner");
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("treats a configured app agent named gym as a real local agent", () => {
    const f = fixture();
    try {
      const gymAppDir = join(f.projectsRoot, "gym.app");
      const gymAgentDir = join(gymAppDir, "agents", "gym");
      mkdirSync(gymAgentDir, { recursive: true });
      writeFileSync(
        join(gymAgentDir, "agent.json"),
        JSON.stringify({
          name: "gym",
          description: "Gym owner",
          domain: "evaluation",
          model: "test",
          tools: [],
        }),
      );

      expect(inferProjectAppOwner(gymAppDir)).toBe("gym");
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("validates the complete app cohort before creating state or host attachments", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const invalidDir = join(f.projectsRoot, "z-invalid.app");
      mkdirSync(invalidDir, { recursive: true });
      writeFileSync(
        join(invalidDir, "app.ts"),
        `export default {
          id: "invalid",
          version: 1,
          owner: "invalid-owner",
          description: "invalid",
          budget: { maxConcurrent: 0 }
        };\n`,
      );
      const crons = new Map<string, Cron>();

      await expect(
        installProjectApps({
          projectsRoot: f.projectsRoot,
          projectRoot: f.root,
          persistDir: f.persistDir,
          agentsRoot: join(f.root, "agents"),
          sharedRoot: join(f.root, "shared"),
          manager: manager([]),
          bus: new EventBus(),
          agentCrons: crons,
        }),
      ).rejects.toThrow("Project app invalid maxConcurrent must be a positive integer");

      expect(existsSync(join(f.appDir, ".state"))).toBe(false);
      expect(existsSync(join(invalidDir, ".state"))).toBe(false);
      expect(crons.size).toBe(0);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("reloads for lifecycle, watcher, and workflow changes but not ordinary task-state writes", () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const treeDir = join(f.appDir, ".state", "tasks");
      const treePath = join(treeDir, "state.json");
      mkdirSync(treeDir, { recursive: true });
      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "paused", tasks: {} }));
      const paused = projectAppHostFingerprint(f.projectsRoot);

      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "paused", tasks: { changed: {} } }));
      expect(projectAppHostFingerprint(f.projectsRoot)).toBe(paused);

      writeFileSync(treePath, JSON.stringify({ project_lifecycle: "active", tasks: { changed: {} } }));
      const active = projectAppHostFingerprint(f.projectsRoot);
      expect(active).not.toBe(paused);

      const watcherDir = join(f.appDir, "watchers");
      mkdirSync(watcherDir, { recursive: true });
      writeFileSync(join(watcherDir, "pipeline.ts"), `export const observe = () => "initial";`);
      const watcherAdded = projectAppHostFingerprint(f.projectsRoot);
      expect(watcherAdded).not.toBe(active);

      writeFileSync(join(watcherDir, "pipeline.ts"), `export const observe = () => "changed";`);
      const watcherChanged = projectAppHostFingerprint(f.projectsRoot);
      expect(watcherChanged).not.toBe(watcherAdded);

      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "worker.ts"),
        `export const name = "worker"; export const description = "changed"; export async function execute(ctx) { return ctx.blocked("changed"); }`,
      );
      expect(projectAppHostFingerprint(f.projectsRoot)).not.toBe(watcherChanged);
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("installs no schedules or controller when project lifecycle is paused", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(f.appDir, ".state", "tasks", "state.json"),
        JSON.stringify({
          project_lifecycle: "paused",
          root_task_id: "root",
          groups: {
            root: { id: "root", parent_id: null, state: "backlog", children: ["operations"] },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
          },
          active_task_ids: ["work/orphan"],
          active_task_id: "work/orphan",
          resources: {
            "work/orphan": {
              metadata: { id: "work/orphan", generation: 1, resourceVersion: 1 },
              spec: {
                parentId: "operations",
                outcome: "Process orphan",
                acceptance: ["Work converges"],
                mode: "achieve",
                workflow: "worker",
              },
              status: {
                observedGeneration: 0,
                phase: "running",
                currentAttemptId: "r_orphan",
                updatedAt: "2026-07-19T00:00:00.000Z",
              },
            },
          },
          attempts: {
            r_orphan: {
              metadata: { id: "r_orphan", resourceVersion: 1 },
              taskId: "work/orphan",
              taskGeneration: 1,
              specHash: "old",
              owner: "sample-owner",
              handler: "workflow:worker",
              runtimeId: "previous-runtime",
              state: "running",
              startedAt: "2026-07-19T00:00:00.000Z",
            },
          },
        }),
      );
      const crons = new Map<string, Cron>();
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: crons,
      });
      expect(result.entries).toBe(0);
      expect(result.installed[0].reconciliationPaused).toBe(true);
      expect(crons.get("sample-owner")?.getEntries()).toEqual([]);
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.tasks["work/orphan"].phase).toBe("pending");
      expect(state.resources["work/orphan"].status.phase).toBe("pending");
      expect(tree.active_task_ids).not.toContain("work/orphan");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("reconciles workflows and direct owner tasks through one app controller", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    const ownerOptions: Array<Record<string, unknown>> = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls, ownerOptions),
        bus,
        agentCrons: new Map(),
      });
      bus.emit({ type: "sample.work", project: "sample", itemId: "workflow" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/workflow" &&
            event.data?.disposition === "converged",
        ),
      ).catch((error) => {
        throw new Error(
          `${String(error)} events=${JSON.stringify(events.map((event) => ({ type: event.type, data: event.data })))}`,
        );
      });
      expect(
        events.find(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/workflow" &&
            event.data?.disposition === "converged",
        )?.data?.input,
      ).toEqual({ itemId: "workflow" });
      bus.emit({ type: "sample.work", project: "sample", itemId: "owner", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner" &&
            event.data?.disposition === "converged",
        ),
      ).catch((error) => {
        throw new Error(
          `${String(error)} events=${JSON.stringify(events.map((event) => ({ type: event.type, data: event.data })))}`,
        );
      });
      expect(ownerCalls).toHaveLength(1);
      expect(ownerCalls[0]).not.toContain("persistent-task: skip");
      expect(ownerCalls[0]).toContain("Allowed actions:");
      expect(ownerCalls[0]).toContain('kind: "create-task"');
      expect(ownerCalls[0]).toContain("Do not invent action names");
      expect(ownerCalls[0]).toContain("missing evidence is work to do");
      expect(ownerCalls[0]).not.toContain("absorb the failed carrier");
      expect(ownerCalls[0]).toContain("A sibling successor does not complete the current task");
      expect(ownerCalls[0]).toContain("parentId equal to the current Reconciliation Task taskId");
      expect(ownerCalls[0]).toContain('Conditions belong only to the current task when you return state "waiting"');
      expect(ownerCalls[0]).toContain('type": "pipeline-run.state"');
      expect(ownerCalls[0]).not.toContain('type": "pipeline.run.completed"');
      expect(ownerCalls[0]).toContain("For a decomposition parent that creates child task actions");
      expect(ownerCalls[0]).toContain("A converged task may create only independent successor work");
      expect(ownerCalls[0]).toContain(
        "An executable parent relationship expresses decomposition and aggregate ownership",
      );
      expect(ownerCalls[0]).toContain("Use dependsOn for execution ordering");
      expect(ownerCalls[0]).toContain("Do not close an achieve task while it still contains live child tasks");
      expect(ownerCalls[0]).toContain("A completed task receipt is immutable");
      expect(ownerCalls[0]).toContain("Do not include an action for the current Reconciliation Task taskId");
      expect(ownerOptions[0]).toMatchObject({
        projectId: "sample",
        recoveryOwner: "project-app-task-reconciler",
        source: "project-app-task-owner",
        timeout: 15 * 60_000,
      });
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(state.receipts["work/workflow"].acceptanceBasis.method).toBe("workflow-contract");
      expect(state.receipts["work/workflow"].acceptanceBasis.evidence).toContain("proof");
      expect(state.receipts["work/owner"]).toMatchObject({
        acceptanceBasis: { method: "owner-judgment", evidence: ["owner proof"] },
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("does not let newly declared work overtake an older recovered task", async () => {
    const f = fixture();
    const orderPath = join(f.root, "reconcile-order.json");
    let releaseSeed: (() => void) | undefined;
    try {
      writeApp(f.appDir);
      const appPath = join(f.appDir, "app.ts");
      writeFileSync(
        appPath,
        readFileSync(appPath, "utf8").replace(
          "budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 2 }",
          "budget: { sessionsPerDay: 10, tokensPerDay: 10000, maxConcurrent: 1 }",
        ),
      );
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "flaky.ts"),
        `import { existsSync, readFileSync, writeFileSync } from "node:fs";
         export const name = "flaky";
         export const description = "fail once, then record retry order";
         export async function execute(ctx) {
           const marker = ${JSON.stringify(join(f.root, "flaky-failed"))};
           if (!existsSync(marker)) {
             writeFileSync(marker, "failed");
             return ctx.blocked("transient provider failure");
           }
           const path = ${JSON.stringify(orderPath)};
           const order = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
           order.push("old");
           writeFileSync(path, JSON.stringify(order));
           return ctx.done("retried", { state: "converged", summary: "old task retried", evidence: ["old proof"], actions: [] });
         }`,
      );
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "ordered.ts"),
        `import { existsSync, readFileSync, writeFileSync } from "node:fs";
         export const name = "ordered";
         export const description = "record reconciliation order";
         export async function execute(ctx) {
           const path = ${JSON.stringify(orderPath)};
           const order = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
           order.push("new");
           writeFileSync(path, JSON.stringify(order));
           return ctx.done("new", { state: "converged", summary: "new task ran", evidence: ["new proof"], actions: [] });
         }`,
      );

      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent() {
            await new Promise<void>((resolve) => (releaseSeed = resolve));
            return {
              sessionId: "seed-owner-session",
              status: "done",
              structuredResult: {
                state: "converged",
                summary: "seed declared new work",
                evidence: ["seed proof"],
                actions: [
                  {
                    kind: "create-task",
                    id: "work/new",
                    parentId: "operations",
                    outcome: "Run newly declared work",
                    acceptance: ["New work converges"],
                    mode: "achieve",
                    owner: "sample-owner",
                    workflow: "ordered",
                  },
                ],
              },
              lastAssistantText: "seed done",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "old", workflow: "flaky" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/old" &&
            event.data?.disposition === "attention",
        ),
      );

      bus.emit({ type: "sample.work", project: "sample", itemId: "seed", ownerOnly: true } as any);
      await waitUntil(() => Boolean(releaseSeed));
      bus.emit({
        type: "session.end",
        source: "runtime",
        timestamp: Date.now() + 1_000,
        data: {
          sessionId: "owner-runtime-recovered",
          agent: "sample-owner",
          status: "done",
          outcome: "done",
        },
      } as any);
      await waitUntil(() => {
        const state = JSON.parse(readFileSync(join(f.appDir, ".state/tasks/state.json"), "utf8"));
        return state.resources["work/old"]?.status?.phase === "pending";
      });

      releaseSeed?.();
      await waitUntil(() => existsSync(orderPath) && JSON.parse(readFileSync(orderPath, "utf8")).length === 2);
      expect(JSON.parse(readFileSync(orderPath, "utf8"))).toEqual(["old", "new"]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("marks workflow step sessions as owned by task reconciliation", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    const ownerOptions: Array<Record<string, unknown>> = [];
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "worker.ts"),
        `export const name = "worker";
         export const description = "task-owned workflow step";
         export async function execute(ctx) {
           await ctx.runAgent("sample-owner", "inspect the bounded task");
           return ctx.done("done", { state: "converged", summary: "workflow done", evidence: ["proof"], actions: [] });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls, ownerOptions),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "workflow-owned-step" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/workflow-owned-step" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(ownerCalls).toEqual(["inspect the bounded task"]);
      expect(ownerOptions[0]).toMatchObject({
        projectId: "sample",
        recoveryOwner: "project-app-task-reconciler",
        source: "workflow:worker",
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("records deterministic workflow verification in the completion receipt", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "worker.ts"),
        `export const name = "worker";
         export const description = "verified sample worker";
         export async function execute(ctx) {
           return ctx.done("done", { state: "converged", summary: "workflow done", evidence: ["proof"], actions: [] });
         }
         export async function verify(context, result) {
           return {
             accepted: context.taskId === "work/verified" && result.summary === "workflow done",
             summary: "Verified the workflow postcondition.",
             evidence: ["deterministic:sample-postcondition"]
           };
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "verified" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/verified" &&
            event.data?.disposition === "converged",
        ),
      ).catch((error) => {
        throw new Error(
          `${String(error)} events=${JSON.stringify(events.map((event) => ({ type: event.type, data: event.data })))}`,
        );
      });

      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(tree.receipts["work/verified"].acceptanceBasis).toEqual({
        method: "deterministic",
        verifier: "worker",
        evidence: ["deterministic:sample-postcondition"],
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("keeps a verifier-rejected task live without creating a receipt", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "worker.ts"),
        `export const name = "worker";
         export const description = "rejecting sample worker";
         export async function execute(ctx) {
           return ctx.done("done", { state: "converged", summary: "unverified claim", evidence: ["claim"], actions: [] });
         }
         export async function verify() {
           return { accepted: false, summary: "Required artifact is absent.", evidence: ["artifact:missing"] };
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "rejected" } as any);
      await waitUntil(() =>
        events.some(
          (event) => event.type === "project.task.verification.failed" && event.data?.taskId === "work/rejected",
        ),
      ).catch((error) => {
        throw new Error(
          `${String(error)} events=${JSON.stringify(events.map((event) => ({ type: event.type, data: event.data })))}`,
        );
      });

      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(tree.receipts?.["work/rejected"]).toBeUndefined();
      expect(tree.resources["work/rejected"]).toMatchObject({
        status: { phase: "attention", summary: "Required artifact is absent." },
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("rejects unresolved owners and escaping outputs before an attempt is claimed", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          ...manager(ownerCalls),
          hasAgent: (owner: string) => owner !== "human",
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "human", taskOwner: "human" } as any);
      bus.emit({ type: "sample.work", project: "sample", itemId: "escape", outputs: ["../../outside"] } as any);
      await waitUntil(
        () =>
          events.filter(
            (event) => event.type === "project.task.reconcile.skipped" && event.data?.reason === "attention-required",
          ).length >= 2,
      );

      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(tree.resources["work/human"].status).toMatchObject({
        phase: "attention",
        summary: "Resolved owner human is not a runnable agent",
      });
      expect(tree.resources["work/escape"].status).toMatchObject({
        phase: "attention",
        summary: "Task output admission failed: outputs[0] escapes the app/domain roots: ../../outside",
      });
      expect(
        Object.values(tree.attempts ?? {}).filter((attempt: any) =>
          ["work/human", "work/escape"].includes(attempt.taskId),
        ),
      ).toEqual([]);
      expect(tree.taskTriggers?.["work/human"]).toBeUndefined();
      expect(tree.taskTriggers?.["work/escape"]).toBeUndefined();
      expect(ownerCalls).toEqual([]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("routes an explicitly targeted event only to that task", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "target", mode: "maintain" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/target" &&
            event.data?.disposition === "converged",
        ),
      );

      const completedPasses = events.filter(
        (event) => event.type === "project.task.reconciled" && event.data?.taskId === "work/target",
      ).length;
      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "must-not-resolve",
        mode: "maintain",
        target: { project: "sample", taskId: "work/target" },
      } as any);
      await waitUntil(
        () =>
          events.filter((event) => event.type === "project.task.reconciled" && event.data?.taskId === "work/target")
            .length ===
          completedPasses + 1,
      );
      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "target",
        revision: "v2",
        mode: "maintain",
        target: { project: "sample", taskId: "work/target" },
      } as any);
      await waitUntil(
        () =>
          events.filter((event) => event.type === "project.task.reconciled" && event.data?.taskId === "work/target")
            .length ===
          completedPasses + 2,
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(state.resources["work/target"]).toBeTruthy();
      expect(state.resources["work/target"]).toMatchObject({
        metadata: { generation: 2 },
        spec: { input: { itemId: "target", revision: "v2" } },
        status: { observedGeneration: 2 },
      });
      expect(state.resources["work/must-not-resolve"]).toBeUndefined();
      expect(tree.tasks["work/must-not-resolve"]).toBeUndefined();
      expect(
        events.filter(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/must-not-resolve",
        ),
      ).toHaveLength(0);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("applies structured successor actions only from converged owner results", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    const ownerOptions: Array<Record<string, unknown>> = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent(_agent: string, task: string, options: Record<string, unknown>) {
            ownerCalls.push(task);
            ownerOptions.push(options);
            return {
              sessionId: "owner-converged-with-action",
              status: "done",
              structuredResult: {
                state: "converged",
                summary: "current carrier organized an exact successor",
                evidence: ["owner inspected current facts"],
                actions: [
                  {
                    kind: "create-task",
                    id: "work/followup",
                    parentId: "operations",
                    outcome: "Run the bounded follow-up",
                    mode: "achieve",
                    outputs: ["proof.md"],
                    acceptance: ["The follow-up is represented as durable work"],
                    owner: "sample-owner",
                    dependsOn: ["external-ready"],
                  },
                ],
              },
              lastAssistantText: "owner converged with action",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "owner-failed-action", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-failed-action" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(ownerCalls).toHaveLength(1);
      expect(ownerOptions[0]).toMatchObject({
        projectId: "sample",
        requireFinish: true,
        source: "project-app-task-owner",
      });
      expect(ownerOptions[0]?.outputSchema).toBeTruthy();
      expect(ownerCalls[0]).toContain("## Required final call shape");
      expect(ownerCalls[0]).toContain('"result"');
      expect(ownerCalls[0]).toContain('"state": "converged"');
      expect(ownerCalls[0]).toContain('"state": "waiting"');
      expect(ownerCalls[0]).toContain("A completion without result leaves this task unresolved.");
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(state.receipts["work/owner-failed-action"]).toBeTruthy();
      expect(tree.tasks["work/followup"]).toMatchObject({
        phase: "pending",
        owner: "sample-owner",
        parent_id: "operations",
        depends_on: ["external-ready"],
      });
      expect(tree.tasks.operations.children).toContain("work/followup");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("keeps a waiting parent open while its child work runs", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent(_agent: string, task: string) {
            if (task.includes('"taskId": "work/parent-child-a"')) {
              return {
                sessionId: "owner-child-a",
                status: "done",
                structuredResult: {
                  state: "waiting",
                  summary: "child is waiting on external proof",
                  evidence: ["child proof"],
                  actions: [],
                  conditions: [
                    {
                      id: "child-a-external-proof",
                      type: "session.end",
                      subject: "session:child-a",
                      expected: "done",
                    },
                  ],
                },
                lastAssistantText: "child waiting",
                messages: [],
                duration: "0s",
                outputDir: "",
              };
            }
            return {
              sessionId: "owner-parent-with-child",
              status: "done",
              structuredResult: {
                state: "waiting",
                summary: "selected bounded child work",
                evidence: ["owner selected child-a"],
                actions: [
                  {
                    kind: "create-task",
                    id: "work/parent-child-a",
                    parentId: "work/parent",
                    outcome: "Run child A",
                    mode: "achieve",
                    outputs: [],
                    acceptance: ["Child A converges"],
                    owner: "sample-owner",
                  },
                ],
              },
              lastAssistantText: "owner selected child work",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "parent", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/parent" &&
            event.data?.disposition === "waiting",
        ),
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(state.resources["work/parent"].status).toMatchObject({
        phase: "waiting",
        conditionIds: [],
      });
      expect(state.conditions?.["child-a-external-proof"]).toBeTruthy();
      expect(tree.tasks["work/parent"]).toMatchObject({
        phase: "waiting",
        parent_id: "operations",
      });
      expect(tree.tasks["work/parent-child-a"]).toMatchObject({
        parent_id: "work/parent",
        owner: "sample-owner",
      });
      expect(["pending", "waiting"]).toContain(tree.tasks["work/parent-child-a"].phase);
      expect(state.receipts?.["work/parent"]).toBeUndefined();
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("retries owner results whose dependent task actions are stale", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent(_agent: string, task: string) {
            ownerCalls.push(task);
            const firstAttempt = ownerCalls.length === 1;
            return {
              sessionId: `owner-stale-action-${ownerCalls.length}`,
              status: "done",
              structuredResult: {
                state: "converged",
                summary: firstAttempt ? "owner used stale target evidence" : "owner retried from fresh target evidence",
                evidence: ["owner inspected task state"],
                actions: firstAttempt
                  ? [
                      {
                        kind: "update-task",
                        taskId: "work/target",
                        expectedGeneration: 1,
                        priority: "P1",
                      },
                    ]
                  : [],
              },
              lastAssistantText: "owner result",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "target", mode: "maintain" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/target" &&
            event.data?.disposition === "converged",
        ),
      );
      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "target",
        revision: "v2",
        mode: "maintain",
      } as any);
      await waitUntil(() => {
        const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
        return state.resources["work/target"]?.metadata?.generation === 2;
      });
      await waitUntil(() => {
        const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
        return state.resources["work/target"]?.status?.observedGeneration === 2;
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "owner-stale-action", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-stale-action" &&
            event.data?.disposition === "stale",
        ),
      );
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-stale-action" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(ownerCalls).toHaveLength(2);
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(state.resources["work/target"]).toMatchObject({
        metadata: { generation: 2 },
        status: { observedGeneration: 2 },
      });
      expect(state.receipts["work/owner-stale-action"]).toBeTruthy();
      expect(Object.values(state.attempts)).toContainEqual(
        expect.objectContaining({
          taskId: "work/owner-stale-action",
          state: "interrupted",
          failureReason: "stale-reconciliation-result",
        }),
      );
      expect(state.resources["work/owner-stale-action"]).toBeUndefined();
      expect(
        events.find(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-stale-action" &&
            event.data?.disposition === "stale",
        )?.data,
      ).toMatchObject({ staleRecovery: "released" });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("keeps a missing workflow in attention and retries it only after app reload can resolve the binding", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      const installOptions = {
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls),
        bus,
        agentCrons: new Map(),
      };
      await installProjectApps(installOptions);

      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "missing",
        workflow: "not-installed",
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/missing" &&
            event.data?.disposition === "attention",
        ),
      );

      expect(ownerCalls).toHaveLength(0);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "project.task.handler.unavailable",
          data: expect.objectContaining({
            taskId: "work/missing",
            handler: "workflow:not-installed",
            condition: "HandlerUnavailable",
          }),
        }),
      );
      const attention = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(attention.resources["work/missing"].status.phase).toBe("attention");
      expect(attention.receipts?.["work/missing"]).toBeUndefined();
      expect(Object.values(attention.attempts)).toContainEqual(
        expect.objectContaining({
          taskId: "work/missing",
          handler: "workflow:not-installed",
          state: "failed",
          failureReason: "HandlerUnavailable",
        }),
      );

      const attemptCount = Object.keys(attention.attempts).length;
      await installProjectApps(installOptions);
      const stillAttention = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(stillAttention.resources["work/missing"].status.phase).toBe("attention");
      expect(Object.keys(stillAttention.attempts)).toHaveLength(attemptCount);

      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "not-installed.ts"),
        `export const name = "not-installed";
         export const description = "repaired workflow";
         export async function execute(ctx) {
           return ctx.done("repaired", { state: "converged", summary: "repaired workflow ran", evidence: ["binding repaired"], actions: [] });
         }`,
      );
      await installProjectApps(installOptions);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/missing" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(ownerCalls).toHaveLength(0);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "project.task.handler.recovered",
          data: expect.objectContaining({
            taskId: "work/missing",
            handler: "workflow:not-installed",
          }),
        }),
      );
      const converged = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(converged.receipts["work/missing"]).toMatchObject({
        handler: "workflow:not-installed",
        workflow: "not-installed",
        failureFingerprints: ["HandlerUnavailable"],
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("records failed owner sessions as attention with the runtime error summary", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent(_agent: string, task: string) {
            ownerCalls.push(task);
            if (ownerCalls.length > 1) {
              return {
                sessionId: "owner-recovered-session",
                status: "done",
                structuredResult: {
                  state: "converged",
                  summary: "owner recovered and completed the task",
                  evidence: ["fresh owner decision"],
                  actions: [],
                },
                lastAssistantText: "owner recovered",
                messages: [],
                duration: "0s",
                outputDir: "",
              };
            }
            return {
              sessionId: "owner-error-session",
              status: "error",
              structuredResult: { state: "converged", summary: "", evidence: [], actions: [] },
              error: "provider returned 429",
              lastAssistantText: "",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "owner-error", ownerOnly: true } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-error" &&
            event.data?.disposition === "attention",
        ),
      );

      expect(ownerCalls).toHaveLength(1);
      const attentionEvent = events.find(
        (event) =>
          event.type === "project.task.reconciled" &&
          event.data?.taskId === "work/owner-error" &&
          event.data?.disposition === "attention",
      );
      expect(attentionEvent.data.summary).toBe("provider returned 429");

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(state.resources["work/owner-error"].status).toMatchObject({
        phase: "attention",
        summary: "provider returned 429",
        evidence: ["workflow-run:owner-error-session"],
      });
      expect(Object.values(state.attempts)).toContainEqual(
        expect.objectContaining({
          taskId: "work/owner-error",
          failureReason: "HandlerExecutionFailed",
        }),
      );

      writeSessionMeta(f.persistDir, "owner-error-session", {
        agent: "sample-owner",
        task: "failed owner task",
        status: "error",
        startedAt: Date.now() - 10_000,
        endedAt: Date.now() - 5_000,
        error: "structured test failure",
      });
      bus.emit({
        type: "session.end",
        source: "runtime",
        owner: "agent:sample-owner",
        timestamp: Date.now() + 1_000,
        data: {
          sessionId: "independent-owner-success",
          agent: "sample-owner",
          status: "done",
          outcome: "done",
          summary: "owner runtime is working again",
          durationMs: 1,
        },
      } as any);
      await waitUntil(() => {
        const current = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
        return Boolean(current.receipts?.["work/owner-error"]);
      });
      expect(ownerCalls).toHaveLength(2);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "project.task.handler.recovered",
          data: expect.objectContaining({
            taskId: "work/owner-error",
            reason: "owner-session-succeeded-after-handler-execution-failure",
            evidenceSessionId: "independent-owner-success",
          }),
        }),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("invokes the resolved owner exactly once when a workflow returns needs-owner", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "owner-needed.ts"),
        `export const name = "owner-needed";
         export const description = "request owner judgment";
         export async function execute(ctx) {
           return ctx.done("owner judgment required", {
             state: "needs-owner",
             summary: "workflow needs owner judgment",
             evidence: ["workflow classified the exception"],
           });
         }
         export async function verify(context, result) {
           return {
             accepted: context.taskId === "work/owner-needed" && result.evidence.includes("owner proof"),
             summary: "Verified the owner handoff result against the workflow postcondition.",
             evidence: ["deterministic:owner-handoff-postcondition"]
           };
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "owner-needed",
        workflow: "owner-needed",
      } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-needed" &&
            event.data?.disposition === "converged",
        ),
      );

      expect(ownerCalls).toHaveLength(1);
      expect(ownerCalls[0]).toContain("needs-owner: workflow needs owner judgment");
      expect(ownerCalls[0]).toContain("workflow classified the exception");
      expect(
        events.filter(
          (event) =>
            event.type === "project.task.reconcile.started" &&
            event.data?.taskId === "work/owner-needed" &&
            event.data?.handler === "owner:sample-owner",
        ),
      ).toHaveLength(1);
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(state.receipts["work/owner-needed"]).toMatchObject({
        handler: "owner:sample-owner",
        workflow: "owner-needed",
        failureFingerprints: ["needs-owner"],
        acceptanceBasis: {
          method: "deterministic",
          verifier: "owner-needed",
          evidence: ["deterministic:owner-handoff-postcondition"],
        },
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("runs a same-task owner handoff before unrelated queued backlog", async () => {
    const f = fixture();
    const ownerCalls: string[] = [];
    try {
      writeApp(f.appDir);
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "blocker.ts"),
        `export const name = "blocker";
         export const description = "hold one worker slot";
         export async function execute(ctx) {
           await new Promise((resolve) => setTimeout(resolve, 300));
           return ctx.done("blocker done", { state: "converged", summary: "blocker done", evidence: ["proof"], actions: [] });
         }`,
      );
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "owner-needed.ts"),
        `export const name = "owner-needed";
         export const description = "request owner judgment after queued work exists";
         export async function execute(ctx) {
           await new Promise((resolve) => setTimeout(resolve, 50));
           return ctx.done("owner judgment required", {
             state: "needs-owner",
             summary: "workflow needs owner judgment",
             evidence: ["workflow classified the exception"],
           });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager(ownerCalls),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "blocker", workflow: "blocker" } as any);
      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "owner-needed",
        workflow: "owner-needed",
      } as any);
      bus.emit({ type: "sample.work", project: "sample", itemId: "older" } as any);

      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/older" &&
            event.data?.disposition === "converged",
        ),
      );
      const starts = events.filter((event) => event.type === "project.task.reconcile.started");
      const ownerHandoffIndex = starts.findIndex(
        (event) => event.data?.taskId === "work/owner-needed" && event.data?.handler === "owner:sample-owner",
      );
      const olderIndex = starts.findIndex(
        (event) => event.data?.taskId === "work/older" && event.data?.handler === "workflow:worker",
      );
      expect(ownerHandoffIndex).toBeGreaterThanOrEqual(0);
      expect(olderIndex).toBeGreaterThan(ownerHandoffIndex);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("runs a satisfied Condition continuation before unrelated queued backlog", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const appPath = join(f.appDir, "app.ts");
      writeFileSync(appPath, readFileSync(appPath, "utf8").replace("maxConcurrent: 2", "maxConcurrent: 1"));
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "blocker.ts"),
        `export const name = "blocker";
         export const description = "hold the only worker slot";
         export async function execute(ctx) {
           await new Promise((resolve) => setTimeout(resolve, 300));
           return ctx.done("blocker done", { state: "converged", summary: "blocker done", evidence: ["proof"], actions: [] });
         }`,
      );
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "waiter.ts"),
        `export const name = "waiter";
         export const description = "wait for one exact note";
         export async function execute(ctx) {
           if (ctx.task.includes('"ready": true')) {
             return ctx.done("condition observed", { state: "converged", summary: "condition observed", evidence: ["sample.note"], actions: [] });
           }
           return ctx.done("waiting", {
             state: "waiting",
             summary: "waiting for sample note",
             evidence: ["condition:note-ready"],
             actions: [],
             conditions: [{ id: "note-ready", type: "sample.note", subject: "project:sample", expected: { ready: true } }],
           });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "waiter", workflow: "waiter" } as any);
      await waitUntil(() => {
        const state = JSON.parse(readFileSync(projectRuntimePaths(f.appDir).taskStatePath, "utf8"));
        return state.resources?.["work/waiter"]?.status?.phase === "waiting";
      });
      events.length = 0;
      bus.emit({ type: "sample.work", project: "sample", itemId: "blocker", workflow: "blocker" } as any);
      await waitUntil(() =>
        events.some(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/blocker",
        ),
      );
      bus.emit({ type: "sample.work", project: "sample", itemId: "older" } as any);
      bus.emit({ type: "sample.note", project: "sample", ready: true } as any);

      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/older" &&
            event.data?.disposition === "converged",
        ),
      );
      const starts = events
        .filter((event) => event.type === "project.task.reconcile.started")
        .map((event) => event.data?.taskId);
      expect(starts).toEqual(["work/blocker", "work/waiter", "work/older"]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("preserves declared priority when event wakes enter the controller queue", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const appPath = join(f.appDir, "app.ts");
      writeFileSync(appPath, readFileSync(appPath, "utf8").replace("maxConcurrent: 2", "maxConcurrent: 1"));
      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "blocker.ts"),
        `export const name = "blocker";
         export const description = "hold the only worker slot";
         export async function execute(ctx) {
           await new Promise((resolve) => setTimeout(resolve, 300));
           return ctx.done("blocker done", { state: "converged", summary: "blocker done", evidence: ["proof"], actions: [] });
         }`,
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "blocker", workflow: "blocker" } as any);
      await waitUntil(() =>
        events.some(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/blocker",
        ),
      );
      bus.emit({ type: "sample.work", project: "sample", itemId: "low", priority: "P2" } as any);
      bus.emit({ type: "sample.work", project: "sample", itemId: "high", priority: "P0" } as any);

      await waitUntil(
        () =>
          events.filter(
            (event) =>
              event.type === "project.task.reconciled" &&
              ["work/low", "work/high"].includes(event.data?.taskId) &&
              event.data?.disposition === "converged",
          ).length === 2,
      );
      const starts = events
        .filter((event) => event.type === "project.task.reconcile.started")
        .map((event) => event.data?.taskId);
      expect(starts).toEqual(["work/blocker", "work/high", "work/low"]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("reconciles two maintain tasks through the same workflow independently", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "maintain-a", mode: "maintain" } as any);
      bus.emit({ type: "sample.work", project: "sample", itemId: "maintain-b", mode: "maintain" } as any);
      await waitUntil(
        () =>
          events.filter(
            (event) =>
              event.type === "project.task.reconciled" &&
              ["work/maintain-a", "work/maintain-b"].includes(event.data?.taskId) &&
              event.data?.disposition === "converged",
          ).length === 2,
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      for (const taskId of ["work/maintain-a", "work/maintain-b"]) {
        expect(tree.tasks[taskId]).toMatchObject({ phase: "converged", workflow: "worker" });
        expect(state.resources[taskId]).toMatchObject({
          spec: { mode: "maintain", workflow: "worker" },
          status: { phase: "converged", observedGeneration: 1 },
        });
      }
      const attempts = Object.values(state.attempts).filter((attempt: any) =>
        ["work/maintain-a", "work/maintain-b"].includes(attempt.taskId),
      ) as any[];
      expect(attempts).toHaveLength(2);
      expect(attempts.every((attempt) => attempt.state === "completed")).toBe(true);
      expect(new Set(attempts.map((attempt) => attempt.id ?? attempt.metadata?.id)).size).toBe(2);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("keeps direct task wake events from bypassing open waits unless overrideWait is explicit", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      const deliveries: Array<{ event: any; result: any }> = [];
      bus.subscribe((event) => events.push(event));
      bus.setDeliveryRecorder((event, result) => deliveries.push({ event, result }));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "sample.work", project: "sample", itemId: "maintain-wake", mode: "maintain" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/maintain-wake" &&
            event.data?.disposition === "converged",
        ),
      );

      const treePath = projectRuntimePaths(f.appDir).taskStatePath;
      const waiting = JSON.parse(readFileSync(treePath, "utf8"));
      waiting.conditions = {
        ...(waiting.conditions ?? {}),
        "external-wait": {
          metadata: { id: "external-wait", generation: 1, resourceVersion: 1 },
          spec: {
            type: "external.never",
            subject: "project:sample",
            expected: "done",
          },
          status: { observedGeneration: 1, state: "false" },
        },
      };
      waiting.resources["work/maintain-wake"].status = {
        ...waiting.resources["work/maintain-wake"].status,
        phase: "waiting",
        conditionIds: ["external-wait"],
        currentAttemptId: undefined,
      };
      writeFileSync(treePath, `${JSON.stringify(waiting, null, 2)}\n`);
      events.length = 0;
      deliveries.length = 0;

      bus.emit({
        type: "project.task.tick",
        project: "sample",
        target: { project: "sample", taskId: "work/maintain-wake" },
        reason: "test-direct-wake",
      } as any);

      await waitUntil(() => deliveries.length > 0);
      expect(deliveries.at(-1)?.result).toMatchObject({
        accepted: true,
        note: "existing targeted task remains asleep on open Conditions: work/maintain-wake",
      });
      expect(events.some((event) => event.type === "project.task.reconcile.started")).toBe(false);

      const stillWaiting = JSON.parse(readFileSync(treePath, "utf8"));
      const waitingAttempts = Object.values(stillWaiting.attempts).filter(
        (attempt: any) => attempt.taskId === "work/maintain-wake",
      ) as any[];
      expect(waitingAttempts).toHaveLength(1);
      expect(stillWaiting.resources["work/maintain-wake"].status.phase).toBe("waiting");
      expect(stillWaiting.taskTriggers?.["work/maintain-wake"]).toBeUndefined();

      events.length = 0;
      bus.emit({
        type: "project.task.tick",
        project: "sample",
        target: { project: "sample", taskId: "work/maintain-wake" },
        reason: "test-direct-wake-override",
        data: { overrideWait: true },
      } as any);

      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/maintain-wake" &&
            event.data?.disposition === "converged",
        ),
      );

      const tree = JSON.parse(readFileSync(treePath, "utf8"));
      const attempts = Object.values(tree.attempts).filter(
        (attempt: any) => attempt.taskId === "work/maintain-wake",
      ) as any[];
      expect(attempts.at(-1)).toMatchObject({
        state: "completed",
        trigger: { type: "project.task.tick", reason: "test-direct-wake-override" },
      });
      expect(tree.resources["work/maintain-wake"].status.phase).toBe("converged");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("immediately replays persisted events when a new wait is already true", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      let ownerCalls = 0;
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent() {
            ownerCalls += 1;
            return ownerCalls === 1
              ? {
                  sessionId: "owner-stale-wait-1",
                  status: "done",
                  structuredResult: {
                    state: "waiting",
                    summary: "waiting for the already-recorded note",
                    evidence: ["owner requested an exact stale-true wait"],
                    actions: [],
                    conditions: [
                      {
                        id: "note-ready",
                        type: "sample.note",
                        subject: "project:sample",
                        expected: { itemId: "ready" },
                      },
                    ],
                  },
                  lastAssistantText: "waiting",
                  messages: [],
                  duration: "0s",
                  outputDir: "",
                }
              : {
                  sessionId: "owner-stale-wait-2",
                  status: "done",
                  structuredResult: {
                    state: "converged",
                    summary: "replayed condition woke the same task immediately",
                    evidence: ["replayed:event:sample.note"],
                    actions: [],
                  },
                  lastAssistantText: "converged",
                  messages: [],
                  duration: "0s",
                  outputDir: "",
                };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      const db = getDb(f.persistDir);
      db.run(
        `INSERT INTO events (event_type, data, timestamp, project_id, idempotency_scope, ingress_source)
         VALUES (?, ?, ?, ?, '', '')`,
        [
          "sample.note",
          JSON.stringify({ type: "sample.note", target: { project: "sample" }, project: "sample", itemId: "ready" }),
          Date.now(),
          "sample",
        ],
      );
      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "stale-wait",
        ownerOnly: true,
        mode: "maintain",
      } as any);

      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/stale-wait" &&
            event.data?.disposition === "converged",
        ),
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(ownerCalls).toBe(2);
      expect(state.resources["work/stale-wait"].status.phase).toBe("converged");
      expect(state.conditions?.["note-ready"]).toBeUndefined();
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("replays persisted matching events on startup so waiting tasks do not sleep past true conditions", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const firstEvents: any[] = [];
      bus.subscribe((event) => firstEvents.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent() {
            return {
              sessionId: "owner-startup-wait-1",
              status: "done",
              structuredResult: {
                state: "waiting",
                summary: "waiting for exact startup proof",
                evidence: ["queued exact wait before restart"],
                actions: [],
                conditions: [
                  {
                    id: "startup-note-ready",
                    type: "sample.note",
                    subject: "project:sample",
                    expected: { itemId: "startup-ready" },
                  },
                ],
              },
              lastAssistantText: "waiting",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "startup-wait",
        ownerOnly: true,
        mode: "maintain",
      } as any);
      await waitUntil(() =>
        firstEvents.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/startup-wait" &&
            event.data?.disposition === "waiting",
        ),
      );

      const db = getDb(f.persistDir);
      db.run(
        `INSERT INTO events (event_type, data, timestamp, project_id, idempotency_scope, ingress_source)
         VALUES (?, ?, ?, ?, '', '')`,
        [
          "sample.note",
          JSON.stringify({
            type: "sample.note",
            target: { project: "sample" },
            project: "sample",
            itemId: "startup-ready",
          }),
          Date.now(),
          "sample",
        ],
      );

      const replayBus = new EventBus();
      const replayEvents: any[] = [];
      let replayCalls = 0;
      replayBus.subscribe((event) => replayEvents.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          hasAgent: () => true,
          async callAgent() {
            replayCalls += 1;
            return {
              sessionId: "owner-startup-wait-2",
              status: "done",
              structuredResult: {
                state: "converged",
                summary: "startup replay woke the waiting task",
                evidence: ["replayed:event:sample.note"],
                actions: [],
              },
              lastAssistantText: "converged",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as any,
        bus: replayBus,
        agentCrons: new Map(),
      });

      await waitUntil(() =>
        replayEvents.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/startup-wait" &&
            event.data?.disposition === "converged",
        ),
      );

      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      expect(replayCalls).toBe(1);
      expect(state.resources["work/startup-wait"].status.phase).toBe("converged");
      expect(state.conditions?.["startup-note-ready"]).toBeUndefined();
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("materializes exact targeted task wakes through the app resolver and claims delivery", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      const deliveries: Array<{ event: any; result: any }> = [];
      bus.subscribe((event) => events.push(event));
      bus.setDeliveryRecorder((event, result) => deliveries.push({ event, result }));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "targeted-new",
        mode: "maintain",
        target: { project: "sample", taskId: "work/targeted-new" },
      } as any);

      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/targeted-new" &&
            event.data?.disposition === "converged",
        ),
      );

      const originalDelivery = deliveries.find(
        ({ event }) => event.type === "sample.work" && event.itemId === "targeted-new",
      );
      expect(originalDelivery?.result).toMatchObject({
        accepted: true,
        by: "project-app:sample:task-reconciler",
        route: "direct",
      });

      const tree = JSON.parse(readFileSync(projectRuntimePaths(f.appDir).taskStatePath, "utf8"));
      expect(tree.resources["work/targeted-new"]).toMatchObject({
        spec: { mode: "maintain", workflow: "worker" },
        status: { phase: "converged", observedGeneration: 1 },
      });
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("ignores targeted task events that the app task surface does not accept", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      bus.emit({ type: "project.owner.requested", project: "sample", mode: "maintain" } as any);
      await waitUntil(() =>
        events.some(
          (event) =>
            event.type === "project.task.reconciled" &&
            event.data?.taskId === "work/owner-review" &&
            event.data?.disposition === "converged",
        ),
      );

      const statePath = projectRuntimePaths(f.appDir).taskStatePath;
      const before = JSON.parse(readFileSync(statePath, "utf8"));
      const attemptsBefore = Object.values(before.attempts ?? {}).filter(
        (attempt: any) => attempt.taskId === "work/owner-review",
      ).length;
      events.length = 0;

      bus.emit({
        type: "project.owner.reviewed",
        project: "sample",
        target: { project: "sample", taskId: "work/owner-review" },
        data: {
          taskId: "work/owner-review",
          disposition: "noop",
          summary: "owner review fact should not re-wake the task",
        },
      } as any);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const after = JSON.parse(readFileSync(statePath, "utf8"));
      const attemptsAfter = Object.values(after.attempts ?? {}).filter(
        (attempt: any) => attempt.taskId === "work/owner-review",
      ).length;
      expect(attemptsAfter).toBe(attemptsBefore);
      expect(
        events.filter(
          (event) => event.type === "project.task.reconcile.started" && event.data?.taskId === "work/owner-review",
        ),
      ).toHaveLength(0);
      expect(after.resources["work/owner-review"].status.phase).toBe("converged");
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("installs conventional periodic resync when the app omits an interval", async () => {
    const f = fixture();
    const intervalSpy = spyOn(globalThis, "setInterval");
    try {
      writeApp(f.appDir);
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus: new EventBus(),
        agentCrons: new Map(),
      });
      expect(intervalSpy.mock.calls.some((call) => call[1] === 60_000)).toBe(true);
    } finally {
      intervalSpy.mockRestore();
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("requeues previous-runtime active tasks without trigger packets on startup", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(f.appDir, ".state", "tasks", "state.json"),
        JSON.stringify({
          root_task_id: "root",
          groups: {
            root: {
              id: "root",
              parent_id: null,
              state: "backlog",
              owner: "sample-owner",
              children: ["operations"],
            },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
          },
          active_task_ids: ["work/orphan"],
          active_task_id: "work/orphan",
          resources: {
            "work/orphan": {
              metadata: { id: "work/orphan", generation: 1, resourceVersion: 1 },
              spec: {
                parentId: "operations",
                outcome: "Process orphan",
                acceptance: ["Work converges"],
                mode: "achieve",
                workflow: "worker",
                input: { itemId: "orphan" },
              },
              status: {
                observedGeneration: 0,
                phase: "running",
                currentAttemptId: "r_orphan",
                updatedAt: "2026-07-19T00:00:00.000Z",
              },
            },
          },
          attempts: {
            r_orphan: {
              metadata: { id: "r_orphan", resourceVersion: 1 },
              taskId: "work/orphan",
              taskGeneration: 1,
              specHash: "old",
              owner: "sample-owner",
              handler: "workflow:worker",
              runtimeId: "previous-runtime",
              state: "running",
              startedAt: "2026-07-19T00:00:00.000Z",
            },
          },
        }),
      );
      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });
      await waitUntil(() => {
        const current = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
        return Boolean(current.receipts?.["work/orphan"]);
      });
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(state.receipts["work/orphan"]).toMatchObject({
        summary: "workflow done",
        handler: "workflow:worker",
      });
      expect(state.attempts.r_orphan).toMatchObject({
        state: "interrupted",
        failureReason: "previous-runtime-attempt-requeued",
        summary:
          "Interrupted reconciliation work/orphan belonged to a previous runtime; retrying from current task evidence",
      });
      expect(state.resources?.["work/orphan"]).toBeUndefined();
      expect(tree.tasks["work/orphan"]).toBeUndefined();
      expect(tree.active_task_ids).not.toContain("work/orphan");
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "project.task.reconcile.started",
          data: expect.objectContaining({ taskId: "work/orphan" }),
        }),
      );
      expect(events).not.toContainEqual(
        expect.objectContaining({
          type: "project.owner.requested",
          source: "project-app:sample:task-recovery",
        }),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("interrupts orphaned owner sessions when startup recovery releases a previous-runtime task", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
      writeFileSync(
        join(f.appDir, ".state", "tasks", "state.json"),
        JSON.stringify({
          root_task_id: "root",
          groups: {
            root: {
              id: "root",
              parent_id: null,
              state: "backlog",
              owner: "sample-owner",
              children: ["operations"],
            },
            operations: { id: "operations", parent_id: "root", state: "backlog", children: [] },
          },
          active_task_ids: ["work/orphan-owner"],
          active_task_id: "work/orphan-owner",
          resources: {
            "work/orphan-owner": {
              metadata: { id: "work/orphan-owner", generation: 1, resourceVersion: 1 },
              spec: {
                parentId: "operations",
                outcome: "Process orphan owner session",
                acceptance: ["Work converges"],
                mode: "achieve",
                workflow: "worker",
                input: { itemId: "orphan-owner" },
              },
              status: {
                observedGeneration: 0,
                phase: "running",
                currentAttemptId: "r_orphan_owner",
                updatedAt: "2026-07-19T00:00:00.000Z",
              },
            },
          },
          attempts: {
            r_orphan_owner: {
              metadata: { id: "r_orphan_owner", resourceVersion: 1 },
              taskId: "work/orphan-owner",
              taskGeneration: 1,
              specHash: "old",
              owner: "sample-owner",
              handler: "owner:sample-owner",
              runtimeId: "previous-runtime",
              state: "running",
              startedAt: "2026-07-19T00:00:00.000Z",
              sessionId: "owner-old",
            },
          },
        }),
      );
      writeSessionMeta(f.persistDir, "owner-old", {
        agent: "sample-owner",
        task: "Recover old owner session",
        status: "running",
        startedAt: Date.now() - 60_000,
        source: "project-app-task-owner",
        projectId: "sample",
        recoveryOwner: "project-app-task-reconciler",
        kind: "call",
      });
      upsertSession(f.persistDir, {
        sessionId: "owner-old",
        agent: "sample-owner",
        task: "Recover old owner session",
        status: "running",
        source: "project-app-task-owner",
        projectId: "sample",
        startedAt: Date.now() - 60_000,
      });

      const bus = new EventBus();
      const events: any[] = [];
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: {
          ...manager([]),
          hasActiveSession: () => false,
          cancel: () => {
            throw new Error("startup recovery should reconcile the persisted session directly");
          },
        } as any,
        bus,
        agentCrons: new Map(),
      });

      expect(readSessionMeta(f.persistDir, "owner-old")).toMatchObject({
        status: "interrupted",
        error: "Recovered task work/orphan-owner interrupted an orphaned owner session from a previous runtime",
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "session.end",
          data: expect.objectContaining({
            sessionId: "owner-old",
            status: "interrupted",
          }),
        }),
      );
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("translates declared actions directly and keeps schedules in Cron only", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      let nextEventId = 1;
      bus.setPersistenceSubscriber((event) => {
        (event as any)[EVENT_ROW_ID] = nextEventId++;
      });
      bus.subscribe((event) => events.push(event));
      const crons = new Map<string, Cron>();
      const result = await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        manager: manager([]),
        bus,
        agentCrons: crons,
      });
      expect(result.entries).toBe(1);
      expect(
        crons
          .get("sample-owner")
          ?.getEntries()
          .map((entry) => entry.name),
      ).toEqual(["sample-schedule-pulse"]);
      const receipt = invokeLoadedProjectAppAction({
        bus,
        projectId: "sample",
        actionId: "run",
        params: { itemId: "action", action: "semantic-run" },
      });
      expect(receipt).toEqual({ eventId: 1, eventType: "sample.work" });
      expect(
        events.some(
          (event) =>
            event.type === "sample.work" &&
            event.data?.itemId === "action" &&
            event.action === "semantic-run" &&
            event.data?.action === undefined,
        ),
      ).toBe(true);
      expect(events.some((event) => event.type.startsWith("project.action."))).toBe(false);
      expect(() =>
        invokeLoadedProjectAppAction({
          bus,
          projectId: "sample",
          actionId: "run",
          params: "invalid",
        }),
      ).toThrow("Invalid input");
      expect(events.filter((event) => event.type === "sample.work")).toHaveLength(1);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("isolates direct app selectors without synthesizing owner inbox reviews", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      let nextEventId = 1;
      bus.setPersistenceSubscriber((event) => {
        (event as any)[EVENT_ROW_ID] = nextEventId++;
      });
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      const wrongProject = bus.emit({ type: "sample.note", project: "other" } as any);
      const failed = bus.emit({ type: "sample.note", project: "sample", fail: true } as any);
      const handled = bus.emit({ type: "sample.note", project: "sample" } as any);
      await waitUntil(
        () =>
          events.some(
            (event) => event.type === "handler.failed" && event.data?.handler === "project-app-event-router",
          ),
      );

      const reviewedIds = events
        .filter((event) => event.type === "owner.inbox.reviewed")
        .map((event) => event.data?.openEventId);
      expect(reviewedIds).not.toContain((handled as any)[EVENT_ROW_ID]);
      expect(reviewedIds).not.toContain((wrongProject as any)[EVENT_ROW_ID]);
      expect(reviewedIds).not.toContain((failed as any)[EVENT_ROW_ID]);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("answers each project comment with one result correlated to the comment receipt", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      let nextEventId = 1;
      bus.setPersistenceSubscriber((event) => {
        (event as any)[EVENT_ROW_ID] = nextEventId++;
      });
      bus.subscribe((event) => events.push(event));
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: manager([]),
        bus,
        agentCrons: new Map(),
      });

      const comment = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "Please advance this project" },
      } as any);
      const commentEventId = (comment as any)[EVENT_ROW_ID];
      const secondComment = bus.emit({
        type: "project.comment.created",
        source: "test",
        owner: "agent:sample-owner",
        data: { project: "sample", comment: "And retain the evidence" },
      } as any);
      const secondCommentEventId = (secondComment as any)[EVENT_ROW_ID];
      await waitUntil(
        () =>
          events.filter(
            (event) =>
              event.type === "project.owner.reviewed" &&
              [commentEventId, secondCommentEventId].includes(event.data?.openEventId),
          ).length === 2,
      );

      const results = events.filter(
        (event) => event.type === "project.owner.reviewed" && event.data?.openEventId === commentEventId,
      );
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        data: {
          openEventType: "project.comment.created",
          summary: "workflow done",
          taskRefs: [{ projectId: "sample", taskId: "work/owner-review" }],
        },
      });
      expect(results[0].trace.links).toContainEqual({
        eventId: commentEventId,
        type: "closure",
        label: "project.owner.reviewed",
      });
      expect(
        events.filter(
          (event) => event.type === "project.owner.reviewed" && event.data?.openEventId === secondCommentEventId,
        ),
      ).toHaveLength(1);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });

  it("preserves pending owner instructions across routine task wakes", async () => {
    const f = fixture();
    try {
      writeApp(f.appDir);
      const bus = new EventBus();
      const events: any[] = [];
      const ownerCalls: string[] = [];
      let nextEventId = 1;
      let releaseFirstOwner!: () => void;
      const firstOwnerHeld = new Promise<void>((resolve) => {
        releaseFirstOwner = resolve;
      });
      bus.setPersistenceSubscriber((event) => {
        (event as any)[EVENT_ROW_ID] = nextEventId++;
      });
      bus.subscribe((event) => events.push(event));
      const heldManager = {
        hasAgent: () => true,
        async callAgent(_agent: string, task: string) {
          ownerCalls.push(task);
          if (ownerCalls.length === 1) await firstOwnerHeld;
          return {
            sessionId: `owner-session-${ownerCalls.length}`,
            status: "done",
            structuredResult: {
              state: "converged",
              summary: "owner done",
              evidence: ["owner proof"],
              actions: [],
            },
            lastAssistantText: "owner done",
            messages: [],
            duration: "0s",
            outputDir: "",
          };
        },
      } as any;
      await installProjectApps({
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir: f.persistDir,
        agentsRoot: join(f.root, "agents"),
        sharedRoot: join(f.root, "shared"),
        manager: heldManager,
        bus,
        agentCrons: new Map(),
      });

      const firstRoutineWake = bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "owner-review",
        mode: "maintain",
        ownerOnly: true,
        observation: "first routine pipeline wake",
        target: { project: "sample", taskId: "work/owner-review" },
      } as any);
      const firstRoutineEventId = (firstRoutineWake as any)[EVENT_ROW_ID];
      await waitUntil(() => ownerCalls.length === 1);

      const secondOwnerRequest = bus.emit({
        type: "project.owner.requested",
        project: "sample",
        itemId: "owner-review",
        mode: "maintain",
        ownerOnly: true,
        data: { project: "sample", instruction: "preserve-this-owner-instruction" },
      } as any);
      const secondOwnerEventId = (secondOwnerRequest as any)[EVENT_ROW_ID];
      const thirdOwnerRequest = bus.emit({
        type: "project.owner.requested",
        project: "sample",
        itemId: "owner-review",
        mode: "maintain",
        ownerOnly: true,
        data: { project: "sample", instruction: "latest-owner-instruction" },
      } as any);
      const thirdOwnerEventId = (thirdOwnerRequest as any)[EVENT_ROW_ID];
      const secondRoutineWake = bus.emit({
        type: "sample.work",
        project: "sample",
        itemId: "owner-review",
        mode: "maintain",
        ownerOnly: true,
        observation: "routine pipeline wake",
        target: { project: "sample", taskId: "work/owner-review" },
      } as any);
      const secondRoutineEventId = (secondRoutineWake as any)[EVENT_ROW_ID];

      releaseFirstOwner();
      await waitUntil(
        () =>
          ownerCalls.length >= 2 &&
          events.some(
            (event) => event.type === "project.owner.reviewed" && event.data?.openEventId === secondOwnerEventId,
          ),
      );

      expect(ownerCalls[1]).toContain("preserve-this-owner-instruction");
      expect(ownerCalls[1]).toContain("latest-owner-instruction");
      expect(
        events.filter(
          (event) =>
            event.type === "project.owner.reviewed" &&
            [secondOwnerEventId, thirdOwnerEventId].includes(event.data?.openEventId),
        ),
      ).toHaveLength(2);
      expect(
        events.filter(
          (event) =>
            event.type === "project.owner.reviewed" &&
            [firstRoutineEventId, secondRoutineEventId].includes(event.data?.openEventId),
        ),
      ).toHaveLength(0);
    } finally {
      closeDb(f.persistDir);
      rmSync(f.root, { recursive: true, force: true });
    }
  });
});
