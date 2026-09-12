import { expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { buildSandbox } from "./lib/sandbox.js";
import { openSandboxDb, pollUntil, socketEmit, socketStatus } from "./lib/live-daemon.js";

// Real daemon, socket, durable admission and isolated workflow workers. No model
// requests or production installation; restart reuses only this temporary state.
test.each(["waiting", "running"] as const)(
  "Tasks recover from %s after restart without optional schedules",
  async (phase) => {
    const sb = await buildSandbox({
      fixtureAgents: ["may"],
      fixtureWorkflows: { may: ["task-startup-probe"] },
      cronJson: { may: [] },
      daemonArgs: ["--socket"],
      env: { MAY_TEST_HOLD_STARTUP_ATTEMPT: phase === "running" ? "1" : "0" },
    });
    let restarted: ChildProcess | undefined;
    let restartLog = "";
    try {
      await sb.daemonReady;
      const appDir = join(sb.projectsRoot, "sample.app");
      mkdirSync(join(appDir, "tasks"), { recursive: true });
      writeFileSync(
        join(appDir, "tasks", "seed.json"),
        JSON.stringify({
          root_task_id: "sample",
          groups: { sample: { id: "sample", parent_id: null, agent: "may", children: [] } },
        }),
      );
      writeFileSync(
        join(appDir, "app.js"),
        `export default {
      id: "sample", version: 1, agent: "may", inputSchema: { type: "object" },
      workspace: { kind: "local", localPath: "." }, tasks: {},
      task() { return { kind: "desired", intent: {
        id: "work/main", parentId: "sample", workflow: "task-startup-probe",
        outcome: "Wait for the exact fixture fact", acceptance: ["Fact observed and result accepted"]
      } }; },
      schedules: [{ id: "disabled", intervalMs: 1000, input: { kind: "probe", data: {} } }]
    };`,
      );
      const publish = (event: Record<string, unknown>) => socketEmit(sb.socketPath, "publish", { event });
      expect(await publish({ type: "runtime.reload.requested", data: { reason: "install fixture" } })).toMatchObject({
        type: "ok",
      });
      await pollUntil(() => sb.getLogs().includes("[reload]"), { timeoutMs: 5000, description: "fixture reload" });
      expect(
        await publish({
          type: "app.input.requested",
          target: { appId: "sample" },
          idempotencyKey: "startup-probe",
          data: { input: { kind: "probe", data: {} } },
        }),
      ).toMatchObject({ type: "ok" });
      const db = openSandboxDb(sb.dbPath);
      try {
        const task = () =>
          db
            .prepare("SELECT generation, phase FROM app_tasks WHERE app_id = 'sample' AND task_id = 'work/main'")
            .get() as { generation: number; phase: string } | undefined;
        const beforeRestart = await pollUntil(
          () => {
            const row = task();
            return row?.phase === phase ? row : null;
          },
          { timeoutMs: 10000, description: `real worker reaches ${phase}` },
        );
        if (phase === "running") {
          await pollUntil(() => sb.getLogs().includes("task-startup-probe: holding active attempt"), {
            timeoutMs: 10000,
            description: "workflow execution before interrupting the daemon",
          });
        }

        // Crash an active attempt without graceful cleanup, or stop a settled
        // wait normally. Both restarts retain exactly the same durable Task.
        process.kill(sb.daemonPid!, phase === "running" ? "SIGKILL" : "SIGTERM");
        await pollUntil(
          () => {
            try {
              process.kill(sb.daemonPid!, 0);
              return false;
            } catch {
              return true;
            }
          },
          { timeoutMs: 5000, description: "fixture daemon exit" },
        );
        restarted = spawn(
          process.execPath,
          [fileURLToPath(new URL("../../src/app/may.ts", import.meta.url)), "--socket"],
          {
            cwd: fileURLToPath(new URL("../../", import.meta.url)),
            env: {
              ...process.env,
              APP_ROOT: sb.root,
              PROJECT_ROOT: sb.root,
              AGENTS_ROOT: sb.agentsRoot,
              PROJECTS_ROOT: sb.projectsRoot,
              SHARED_ROOT: join(sb.root, "shared"),
              STATE_DIR: sb.stateDir,
              INSTANCE: sb.instance,
              DAEMON_INSTANCE: sb.instance,
              AGENT: "may",
              DAEMON_AGENT: "may",
              TELEGRAM_BOT_TOKEN: "",
              TELEGRAM_CHAT_ID: "",
              MAY_TEST_HOLD_STARTUP_ATTEMPT: "0",
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        restarted.stdout!.on("data", (chunk) => {
          restartLog += chunk;
        });
        restarted.stderr!.on("data", (chunk) => {
          restartLog += chunk;
        });
        await pollUntil(() => socketStatus(sb.socketPath), {
          timeoutMs: 5000,
          description: "restarted fixture socket",
        });
        const waiting = await pollUntil(
          () => {
            const row = task();
            return row?.phase === "waiting" ? row : null;
          },
          { timeoutMs: 10000, description: "recovered Task reaches its exact wait" },
        );
        expect(waiting.generation).toBe(beforeRestart.generation);
        if (phase === "running") {
          const attempts = db
            .prepare("SELECT state FROM app_task_attempts WHERE app_id = 'sample' AND task_id = 'work/main'")
            .all();
          expect(attempts.length).toBeGreaterThanOrEqual(2);
          expect(attempts.some((attempt: { state: string }) => attempt.state === "running")).toBe(false);
        }
        expect(
          await publish({
            type: "project.approval.submitted",
            target: { appId: "sample" },
            data: { artifact: "fixture", status: "ready", decision: "approved" },
          }),
        ).toMatchObject({ type: "ok" });
        const completed = await pollUntil(
          async () => {
            const result = (await socketEmit(sb.socketPath, "app.task.get", {
              appId: "sample",
              taskId: "work/main",
            })) as {
              task?: { id: string; status: string; summary: string };
            };
            return result.task?.status === "done" ? result.task : null;
          },
          {
            timeoutMs: 10000,
            description: "same Task accepts an outcome after restart",
          },
        );
        expect(completed).toMatchObject({ id: "work/main", summary: "Exact fact observed" });
        const store = AppTaskResourceStore.activeFromDb(db, "sample")!;
        const retained = store.readTask("work/main")!;
        expect(retained.metadata).toMatchObject({
          id: "work/main",
          generation: waiting.generation,
        });
        expect(store.readAttempt(retained.status.observedAttemptId!)).toMatchObject({
          taskId: "work/main",
          taskGeneration: waiting.generation,
          state: "completed",
          acceptedResult: {
            state: "converged",
            summary: "Exact fact observed",
            facts: ["project.approval.submitted"],
          },
        });
        expect(retained.status.currentAttemptId).toBeUndefined();
        expect(store.isCancelled("work/main")).toBe(false);
        expect(store.readReceipt("work/main")).toBeNull();
        expect(db.prepare("SELECT COUNT(*) AS count FROM app_tasks WHERE app_id = 'sample'").get()).toEqual({
          count: 1,
        });
        expect(
          db.prepare("SELECT COUNT(*) AS count FROM events WHERE source = 'app:sample:schedule:disabled'").get(),
        ).toEqual({ count: 0 });
      } finally {
        db.close();
      }
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : error}\n${sb.getLogs()}\n${restartLog}`);
    } finally {
      if (restarted && restarted.exitCode === null && restarted.signalCode === null) {
        const child = restarted;
        const stopped = new Promise<void>((resolve) => {
          child.once("exit", () => resolve());
        });
        child.kill("SIGTERM");
        const force = setTimeout(() => child.kill("SIGKILL"), 3000);
        await stopped;
        clearTimeout(force);
      }
      await sb.close();
    }
  },
  40000,
);
