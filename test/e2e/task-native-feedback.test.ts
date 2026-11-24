import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sendSocketCommand } from "../../packages/control/src/client.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { buildSandbox } from "./lib/sandbox.js";
import { openSandboxDb, pollUntil } from "./lib/live-daemon.js";

test("mapped feedback crosses daemon, worker and native protocol before scoped result admission", async () => {
  const observed: Array<any> = [];
  const ready: Array<any> = [];
  const publications: Array<any> = [];
  const release = Promise.withResolvers<void>();
  const service = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/finish") {
        await release.promise;
        return new Response("released");
      }
      const value = await request.json();
      if (path === "/ready") ready.push(value);
      else if (path === "/observed") observed.push(value);
      else if (path === "/publish") publications.push(value);
      else return new Response("unknown endpoint", { status: 404 });
      return new Response("recorded");
    },
  });
  const sb = await buildSandbox({
    fixtureAgents: ["may"],
    daemonArgs: ["--socket"],
    env: {
      DAEMON_HTTP_PORT: "",
      MAY_CODEX_GOAL_COMMAND: fileURLToPath(new URL("../fixtures/codex-feedback-server.mjs", import.meta.url)),
      MAY_TEST_FEEDBACK_SERVICE: `http://127.0.0.1:${service.port}`,
    },
    prepare({ projectsRoot }) {
      const appDir = join(projectsRoot, "sample.app");
      mkdirSync(join(appDir, "tasks"), { recursive: true });
      writeFileSync(
        join(appDir, "tasks/seed.json"),
        JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
      );
      writeFileSync(
        join(appDir, "app.js"),
        `export default {
        id:'sample',version:1,agent:'may',inputSchema:{type:'object'},
        workspace:{kind:'local',localPath:'.'},tasks:{maxConcurrent:1},
        task({input}) { if(input.data.context.taskId!=='work/current') throw Error('Wrong mapped Task');
          return {kind:'desired',intent:{id:'work/current',parentId:'root',agent:'may',executor:'codex-goal',
            outcome:'Publish one verified change after permission',acceptance:['Verified publication and exact input coverage']}}; }
      };`,
      );
    },
  });
  const publish = (id: string, message: string, targeted = false) =>
    sendSocketCommand(sb.socketPath, {
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "sample" },
        idempotencyKey: `transport:${id}`,
        data: {
          requestId: id,
          ...(targeted ? { targetTaskId: "work/current" } : {}),
          source: { kind: "human", id: "fixture-human" },
          input: { kind: "message", data: { message, context: { taskId: "work/current" } } },
        },
      },
    });
  let db: ReturnType<typeof openSandboxDb> | undefined;
  try {
    await sb.daemonReady;
    await publish("start", "Prepare the change. Publication permission is pending.");
    await pollUntil(() => ready[0], {
      timeoutMs: 15_000,
      intervalMs: 20,
      description: "native turn is active before follow-up ingress",
    });
    expect(JSON.stringify(ready[0].packet)).not.toContain("task:permission");
    db = openSandboxDb(sb.dbPath);
    const store = AppTaskResourceStore.activeFromDb(db, "sample")!;
    const first = store.readTask("work/current")!;
    const attemptId = first.status.currentAttemptId!;
    expect(first.metadata.generation).toBe(1);
    expect(ready[0].nativePid).not.toBe(sb.daemonPid);
    expect(ready[0].parentPid).not.toBe(sb.daemonPid); // Native peer is owned by a separate Task worker.
    const receipt = await publish("permission", "Publish the verified change now.");
    const permission = await pollUntil(
      () => observed.find((item) => item.event?.data?.idempotencyKey === "task:permission"),
      { timeoutMs: 5_000, intervalMs: 20, description: "mapped permission reaches active native turn" },
    );
    expect(permission.event).toMatchObject({
      type: "app.task.requested",
      target: { project: "sample", taskId: "work/current" },
      data: {
        idempotencyKey: "task:permission",
        request: { id: "permission", source: { kind: "human", id: "fixture-human" } },
      },
    });
    expect(permission.turnId).toBe(ready[0].turnId);
    await publish("unrelated", "Retain the additional requirement for later.", true);
    await pollUntil(() => observed.find((item) => item.event?.data?.idempotencyKey === "task:unrelated"), {
      timeoutMs: 5_000,
      intervalMs: 20,
      description: "unrelated input reaches native worker",
    });
    expect(store.readTask("work/current")?.status.currentAttemptId).toBe(attemptId);
    expect(db.query("SELECT status FROM app_inbox_items WHERE id='permission'").get()).toEqual({ status: "handling" });
    expect(publications).toEqual([]);
    expect(await publish("permission", "Publish the verified change now.")).toEqual(receipt);
    release.resolve();
    const accepted = await pollUntil(() => store.readAttempt(attemptId)?.acceptedResult, {
      timeoutMs: 10_000,
      intervalMs: 20,
      description: "native result accepted for the original attempt",
    });
    expect(accepted.state).toBe("converged");
    expect(accepted.inputKeys).toEqual(["task:start", "task:permission"]);
    expect(publications).toEqual([{ inputKey: "task:permission", pid: ready[0].nativePid }]);
    expect(observed.filter((item) => item.event?.data?.idempotencyKey === "task:permission")).toHaveLength(1);
    const admissions = store.readTaskContext({
      taskIds: [],
      admissionIds: ["task:permission", "task:unrelated"],
    }).appTaskAdmissions!;
    expect(admissions["task:permission"]?.resultAttemptId).toBe(attemptId);
    expect(admissions["task:unrelated"]?.resultAttemptId).toBeUndefined();
    expect(db.query("SELECT status FROM app_inbox_items WHERE id='unrelated'").get()).toEqual({ status: "handling" });
    expect(store.readTask("work/current")?.metadata.generation).toBe(1);
  } catch (error) {
    console.error(sb.getLogs().slice(-8000));
    throw error;
  } finally {
    release.resolve();
    db?.close();
    await sb.close();
    service.stop(true);
  }
}, 40_000);
