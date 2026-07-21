import { describe, expect, it, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cron } from "../cron";
import { EVENT_ROW_ID, EventBus } from "../event-bus";
import { closeDb } from "../../lib/requests";
import { projectRuntimePaths } from "@may-agent/sdk";
import {
  inferProjectAppOwner,
  installProjectApps,
  invokeLoadedProjectAppAction,
  listProjectAppDirs,
  normalizeTaskHandlerResult,
  projectAppHostFingerprint,
} from "./project-app-loader";

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

  it("rejects waiting without an exact Condition", () => {
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
      state: "error",
      summary: "Handler result was rejected: waiting requires at least one exact Condition",
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
         export const workspace = "task";
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
      expect(workspace).toMatchObject({ kind: "task-worktree", disposition: "branch-retained" });
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

  it("reloads for lifecycle and workflow changes but not ordinary task-state writes", () => {
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

      writeFileSync(
        join(f.appDir, "agents", "owner", "workflows", "worker.ts"),
        `export const name = "worker"; export const description = "changed"; export async function execute(ctx) { return ctx.blocked("changed"); }`,
      );
      expect(projectAppHostFingerprint(f.projectsRoot)).not.toBe(active);
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
      expect(ownerCalls[0]).toContain('Conditions belong only to the current task when you return state "waiting"');
      expect(ownerCalls[0]).toContain('If you return state "converged" with a successor wait task action');
      expect(ownerCalls[0]).toContain("Parent relationships express containment and decomposition only");
      expect(ownerCalls[0]).toContain("Use dependsOn for execution ordering");
      expect(ownerCalls[0]).toContain("Do not close an achieve task while it still contains live child tasks");
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
      });
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

  it("releases previous-runtime active tasks without trigger packets on startup", async () => {
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
      const state = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "state.json"), "utf8"));
      const tree = JSON.parse(readFileSync(join(f.appDir, ".state", "tasks", "tree.json"), "utf8"));
      expect(tree.tasks["work/orphan"]).toMatchObject({
        phase: "pending",
        summary:
          "Interrupted reconciliation work/orphan cannot resume because its previous runtime did not persist the trigger packet; retrying from current task evidence",
      });
      expect(state.resources["work/orphan"].status.phase).toBe("pending");
      expect(state.resources["work/orphan"].status.currentAttemptId).toBeUndefined();
      expect(tree.active_task_ids).not.toContain("work/orphan");
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
        params: { itemId: "action" },
      });
      expect(receipt).toEqual({ eventId: 1, eventType: "sample.work" });
      expect(events.some((event) => event.type === "sample.work" && event.data?.itemId === "action")).toBe(true);
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

  it("isolates app selectors and closes owner inbox work only after successful handling", async () => {
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
          ) &&
          events.some(
            (event) =>
              event.type === "owner.inbox.reviewed" && event.data?.openEventId === (handled as any)[EVENT_ROW_ID],
          ),
      );

      const reviewedIds = events
        .filter((event) => event.type === "owner.inbox.reviewed")
        .map((event) => event.data?.openEventId);
      expect(reviewedIds).toContain((handled as any)[EVENT_ROW_ID]);
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
});
