import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Type, defineApp, type AppDefinition } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { claimAppInboxItem } from "./app-inbox-store.js";
import { AppInboxHost, type AppOwnerInvoker } from "./app-inbox-host.js";

const probeInput = Type.Object({
  kind: Type.Literal("probe"),
  data: Type.Object({ value: Type.String() }),
});

function app(id: string, batch: "single" | "coalesce-compatible" = "single"): AppDefinition {
  return defineApp({
    id,
    version: 1,
    owner: `${id}-owner`,
    inputSchema: probeInput,
    inbox: { batch },
  });
}

describe("App inbox host", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

  function admit(host: AppInboxHost, appId: string, id: string) {
    return host.admit({
      id,
      appId,
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { value: id } },
    }).item;
  }

  it("rejects unknown Apps and invalid input before persistence", () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      invokeOwner: async () => [],
    });

    expect(() => admit(host, "unknown", "unknown-item")).toThrow("Unknown App");
    expect(() =>
      host.admit({
        id: "invalid-item",
        appId: "evaluation",
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: 42 } },
      }),
    ).toThrow("Invalid input for App evaluation");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });
  });

  it("completes a bounded request without exposing host lifecycle fields", async () => {
    const requests: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      now: () => 100,
      invokeOwner: async ({ requests: batch, onSessionStarted }) => {
        onSessionStarted("session-1");
        requests.push(...batch);
        return batch.map((request) => ({
          requestId: request.id,
          disposition: { type: "complete", summary: "Canary passed", evidence: ["probe:ok"] },
        }));
      },
    });
    admit(host, "evaluation", "probe-1");

    const outcome = await host.reconcileOnce("evaluation");

    expect(outcome).toEqual({ claimed: 1, admitted: 1, released: 0, errors: [] });
    expect(requests).toEqual([
      {
        id: "probe-1",
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: "probe-1" } },
      },
    ]);
    expect(host.get("probe-1")).toMatchObject({
      status: "done",
      sessionId: "session-1",
      result: { summary: "Canary passed", evidence: ["probe:ok"] },
    });
  });

  it("releases the whole batch when the owner result is not usable", async () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation", "coalesce-compatible")],
      retryAfterMs: 0,
      now: () => 100,
      invokeOwner: async () => [],
    });
    admit(host, "evaluation", "probe-1");
    admit(host, "evaluation", "probe-2");

    const outcome = await host.reconcileOnce("evaluation");

    expect(outcome).toMatchObject({ claimed: 2, admitted: 0, released: 2 });
    expect(outcome.errors[0]).toContain("0 disposition(s) for 2 request(s)");
    expect(host.get("probe-1")?.status).toBe("pending");
    expect(host.get("probe-2")?.status).toBe("pending");
  });

  it("admits valid batch items independently from an invalid disposition", async () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation", "coalesce-compatible")],
      retryAfterMs: 0,
      now: () => 100,
      invokeOwner: async ({ requests }) => [
        {
          requestId: requests[0]!.id,
          disposition: { type: "complete", summary: "first complete" },
        },
        {
          requestId: requests[1]!.id,
          disposition: {
            type: "delegate",
            appId: "missing-app",
            input: { kind: "probe", data: { value: "child" } },
          },
        },
      ],
    });
    admit(host, "evaluation", "probe-1");
    admit(host, "evaluation", "probe-2");

    const outcome = await host.reconcileOnce("evaluation");

    expect(outcome).toMatchObject({ claimed: 2, admitted: 1, released: 1 });
    expect(outcome.errors[0]).toContain("Unknown App: missing-app");
    expect(host.get("probe-1")?.status).toBe("done");
    expect(host.get("probe-2")?.status).toBe("pending");
  });

  it("creates a delegated child and wakes the parent when the child completes", async () => {
    let parentAttempts = 0;
    const parentRequests: unknown[] = [];
    const invokeOwner: AppOwnerInvoker = async ({ app: definition, requests }) => {
      if (definition.id === "child") {
        return requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "complete",
            summary: "child complete",
            response: "child response",
            evidence: ["child:evidence"],
          },
        }));
      }
      parentAttempts += 1;
      parentRequests.push(...requests);
      return requests.map((request) => ({
        requestId: request.id,
        disposition:
          parentAttempts === 1
            ? {
                type: "delegate",
                appId: "child",
                input: { kind: "probe", data: { value: "delegated" } },
                reviewAfterMs: 1_000,
              }
            : { type: "complete", summary: "parent reviewed child" },
      }));
    };
    let now = 100;
    const host = new AppInboxHost({ db, apps: [app("parent"), app("child")], invokeOwner, now: () => now });
    admit(host, "parent", "parent-1");

    expect(await host.reconcileOnce("parent")).toMatchObject({ admitted: 1 });
    const childRow = db.prepare("SELECT id FROM app_inbox_items WHERE parent_id = ?").get("parent-1") as { id: string };
    expect(host.get("parent-1")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "app", id: childRow.id },
    });

    now = 200;
    expect(await host.reconcileOnce("child")).toMatchObject({ admitted: 1 });
    expect(host.get("parent-1")?.availableAt).toBe(200);
    expect(await host.reconcileOnce("parent")).toMatchObject({ admitted: 1 });
    expect(host.get("parent-1")?.result?.summary).toBe("parent reviewed child");
    expect(parentRequests[1]).toMatchObject({
      id: "parent-1",
      dependency: {
        kind: "app",
        id: childRow.id,
        status: "done",
        summary: "child complete",
        response: "child response",
        evidence: ["child:evidence"],
      },
    });
  });

  it("links task work idempotently and wakes on explicit task completion", async () => {
    let attempts = 0;
    const attachments: unknown[] = [];
    const ownerRequests: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      retryAfterMs: 0,
      now: () => 100,
      attachTask: async (input) => {
        attachments.push(input);
        return { taskId: "task-1" };
      },
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: "done",
        summary: "task complete",
        evidence: ["task:receipt"],
      }),
      invokeOwner: async ({ requests }) => {
        attempts += 1;
        ownerRequests.push(...requests);
        return requests.map((request) => ({
          requestId: request.id,
          disposition:
            attempts === 1
              ? {
                  type: "task",
                  task: {
                    kind: "desired",
                    intent: {
                      id: "evaluate-canary",
                      parentId: "runtime",
                      outcome: "Evaluate the canary",
                      acceptance: ["A result exists"],
                      mode: "achieve",
                      workflow: "canary",
                    },
                  },
                }
              : { type: "complete", summary: "task reviewed" },
        }));
      },
    });
    admit(host, "evaluation", "probe-1");

    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(attachments).toMatchObject([
      { appId: "evaluation", idempotencyKey: "task:probe-1:desired:evaluate-canary" },
    ]);
    expect(host.get("probe-1")?.waitingOn).toEqual({ kind: "task", id: "task-1" });
    expect(host.wake({ kind: "task", id: "task-1" })).toBe(1);
    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(host.get("probe-1")?.status).toBe("done");
    expect(ownerRequests[1]).toMatchObject({
      id: "probe-1",
      dependency: {
        kind: "task",
        id: "task-1",
        status: "done",
        summary: "task complete",
        evidence: ["task:receipt"],
      },
    });
  });

  it("checks task completion after linking the durable wait", async () => {
    let attempts = 0;
    let sawWaitLink = false;
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      now: () => 100,
      attachTask: async () => ({
        taskId: "task-fast",
        isComplete: async () => {
          const linked = db
            .prepare(
              `SELECT waiting_on_kind, waiting_on_id, lease_owner
               FROM app_inbox_items
               WHERE id = ?`,
            )
            .get("probe-fast") as {
            waiting_on_kind: string | null;
            waiting_on_id: string | null;
            lease_owner: string | null;
          };
          sawWaitLink =
            linked.waiting_on_kind === "task" && linked.waiting_on_id === "task-fast" && linked.lease_owner === null;
          return true;
        },
      }),
      invokeOwner: async ({ requests }) => {
        attempts += 1;
        return requests.map((request) => ({
          requestId: request.id,
          disposition:
            attempts === 1
              ? { type: "task", task: { kind: "existing", taskId: "task-fast" } }
              : { type: "complete", summary: "observed fast task completion" },
        }));
      },
    });
    admit(host, "evaluation", "probe-fast");

    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(sawWaitLink).toBe(true);
    expect(host.get("probe-fast")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "task-fast" },
      availableAt: 100,
    });
    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(host.get("probe-fast")?.status).toBe("done");
  });

  it("renews claims while an owner invocation is still running", async () => {
    let now = 100;
    let finish: (() => void) | undefined;
    const ownerFinished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      workerId: "host-worker",
      leaseMs: 30,
      now: () => now,
      invokeOwner: async ({ requests }) => {
        await ownerFinished;
        return [{ requestId: requests[0]!.id, disposition: { type: "complete", summary: "done" } }];
      },
    });
    admit(host, "evaluation", "probe-1");

    const running = host.reconcileOnce("evaluation");
    now = 125;
    await Bun.sleep(30);

    expect(claimAppInboxItem(db, "probe-1", "competitor", 30, 140)).toBeNull();
    finish!();
    expect(await running).toMatchObject({ admitted: 1 });
  });
});
