import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Type, defineApp, type AppDefinition, type AppTaskAttachment } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { readAppConversationResource } from "./app-inbox-store.js";
import { AppInboxHost } from "./app-inbox-host.js";

const probeInput = Type.Object({
  kind: Type.Literal("probe"),
  data: Type.Object({ value: Type.String() }),
});

function desiredTask(id: string): AppTaskAttachment {
  return {
    kind: "desired",
    intent: {
      id: `probe/${id}`,
      parentId: "probes",
      outcome: `Handle ${id}`,
      acceptance: ["Probe handled"],
      mode: "achieve",
    },
  };
}

function app(id = "evaluation", batch: "single" | "coalesce-compatible" = "single"): AppDefinition {
  return defineApp({
    id,
    version: 1,
    owner: `${id}-owner`,
    inputSchema: probeInput,
    inbox: { batch },
    task: (input) => desiredTask(input.id),
    tasks: {},
  });
}

describe("App inbox host", () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = openDatabase(":memory:");
    applyDbSchema(db);
  });

  afterEach(() => db.close());

  function admit(host: AppInboxHost, id: string, appId = "evaluation") {
    return host.admit({
      id,
      appId,
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { value: id } },
    }).item;
  }

  it("validates input and exposes typed actions without lifecycle machinery", () => {
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app(),
          actions: {
            probe: {
              description: "Submit a typed probe",
              inputSchema: Type.Object({ value: Type.String({ minLength: 1 }) }),
              toInput: ({ value }) => ({ kind: "probe", data: { value } }),
            },
          },
        }),
      ],
    });

    expect(() => admit(host, "unknown", "unknown")).toThrow("Unknown App");
    expect(() =>
      host.admit({
        id: "invalid",
        appId: "evaluation",
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: 42 } },
      }),
    ).toThrow("Invalid input for App evaluation");
    expect(host.describeActions("evaluation.app")).toEqual([
      expect.objectContaining({ id: "probe", description: "Submit a typed probe" }),
    ]);
    expect(host.invokeAction("evaluation", "probe", { value: "ready" })).toEqual({
      kind: "input",
      input: { kind: "probe", data: { value: "ready" } },
    });
  });

  it("resolves every admitted input to exactly one durable Task", async () => {
    const attachments: Array<{ appId: string; idempotencyKey: string; attachment: AppTaskAttachment }> = [];
    const host = new AppInboxHost({
      db,
      apps: [app()],
      attachTask: async ({ appId, attachment, idempotencyKey }) => {
        attachments.push({ appId, attachment, idempotencyKey });
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
    });
    admit(host, "one");

    expect(await host.reconcileOnce("evaluation")).toEqual({ claimed: 1, admitted: 1, released: 0, errors: [] });
    expect(attachments).toEqual([
      {
        appId: "evaluation",
        idempotencyKey: "task:one:desired:probe/one",
        attachment: desiredTask("one"),
      },
    ]);
    expect(host.get("one")?.waitingOn).toEqual({ kind: "task", id: "probe/one" });
  });

  it("projects the Task semantic result to the correlated request", async () => {
    const completed: unknown[] = [];
    let done = false;
    const host = new AppInboxHost({
      db,
      apps: [app()],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      readDependency: async ({ dependency }) =>
        dependency.kind === "task" && done
          ? {
              kind: "task",
              id: dependency.id,
              status: "done",
              summary: "Probe passed",
              response: "Everything is healthy.",
              evidence: ["probe:ok"],
            }
          : { kind: dependency.kind, id: dependency.id, status: "running" },
      onRequestCompleted: (item, result) => completed.push({ id: item.id, result }),
    });
    admit(host, "result");
    await host.reconcileOnce("evaluation");

    done = true;
    host.wake({ kind: "task", id: "probe/result" });
    await host.reconcileOnce("evaluation");

    expect(host.get("result")).toMatchObject({
      status: "done",
      result: { summary: "Probe passed", response: "Everything is healthy.", evidence: ["probe:ok"] },
    });
    expect(completed).toEqual([
      {
        id: "result",
        result: { summary: "Probe passed", response: "Everything is healthy.", evidence: ["probe:ok"] },
      },
    ]);
  });

  it("returns an unrunnable-owner attention result without reattaching the existing Task", async () => {
    const sourceSessionId = "s_1787048407052_294";
    const requestId = "app_7ae28c2c-3058-499c-a749-84a4ffa04100";
    const taskId = "runtime/restore-runnable-owner-for-checkpoint-recovery-repair";
    const immutableTaskResource = {
      taskId,
      generation: 3,
      resourceVersion: 10,
      phase: "attention",
      completionReceipts: ["checkpoint-recovery-proof:immutable"],
    } as const;
    const attachments: Array<{ appId: string; taskId: string; idempotencyKey: string }> = [];
    const completed: Array<{ requestId: string; summary?: string }> = [];
    let dependencyStatus: "running" | "attention" = "running";
    const mayApp = defineApp({
      ...app("may"),
      task: () => ({ kind: "existing", taskId }),
    });
    const host = new AppInboxHost({
      db,
      apps: [mayApp],
      attachTask: async ({ appId, attachment, idempotencyKey }) => {
        const attachedTaskId = attachment.kind === "existing" ? attachment.taskId : attachment.intent.id;
        attachments.push({ appId, taskId: attachedTaskId, idempotencyKey });
        return { taskId: attachedTaskId };
      },
      readDependency: async ({ dependency }) => ({
        kind: "task",
        id: dependency.id,
        status: dependencyStatus,
        ...(dependencyStatus === "attention"
          ? {
              summary: "Resolved owner tech-lead is not a runnable agent",
              evidence: [
                `source-session:${sourceSessionId}`,
                `canonical-task:${immutableTaskResource.taskId}@${immutableTaskResource.generation}/${immutableTaskResource.resourceVersion}`,
              ],
            }
          : {}),
      }),
      onRequestCompleted: (item, result) => completed.push({ requestId: item.id, summary: result.summary }),
    });
    host.admit({
      id: requestId,
      appId: "may",
      parentId: "app_6e1aea80-892e-4e87-9f9f-14acde1bc40d",
      source: { kind: "app", id: "may-agent" },
      input: { kind: "probe", data: { value: sourceSessionId } },
    });

    await host.reconcileOnce("may");
    expect(attachments).toEqual([
      {
        appId: "may",
        taskId,
        idempotencyKey: `task:${requestId}:existing:${taskId}`,
      },
    ]);
    const taskResourceBeforeReview = structuredClone(immutableTaskResource);

    dependencyStatus = "attention";
    expect(host.wake({ kind: "task", id: taskId })).toBe(1);
    expect(await host.reconcileOnce("may")).toEqual({ claimed: 1, admitted: 1, released: 0, errors: [] });

    expect(host.get(requestId)).toMatchObject({
      id: requestId,
      parentId: "app_6e1aea80-892e-4e87-9f9f-14acde1bc40d",
      status: "done",
      result: {
        summary: "Resolved owner tech-lead is not a runnable agent",
        evidence: [`source-session:${sourceSessionId}`, `canonical-task:${taskId}@3/10`],
      },
    });
    expect(completed).toEqual([{ requestId, summary: "Resolved owner tech-lead is not a runnable agent" }]);
    expect(attachments).toHaveLength(1);
    expect(immutableTaskResource).toEqual(taskResourceBeforeReview);
  });

  it("closes completion-before-link races without creating a second Task", async () => {
    let attachments = 0;
    const host = new AppInboxHost({
      db,
      apps: [app()],
      attachTask: async ({ attachment }) => {
        attachments += 1;
        return {
          taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
          isComplete: async () => true,
        };
      },
      readDependency: async ({ dependency }) => ({
        kind: dependency.kind,
        id: dependency.id,
        status: "done",
        summary: "Already complete",
      }),
    });
    admit(host, "fast");

    await host.reconcileOnce("evaluation");
    expect(host.get("fast")?.availableAt).toBeLessThanOrEqual(Date.now());
    await host.reconcileOnce("evaluation");

    expect(attachments).toBe(1);
    expect(host.get("fast")).toMatchObject({ status: "done", result: { summary: "Already complete" } });
  });

  it("passes bounded Conversation context to the Task Event", async () => {
    let request: unknown;
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      attachTask: async (input) => {
        request = input.request;
        return { taskId: input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id };
      },
    });
    host.admit({
      id: "turn-1",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-1" },
      input: { kind: "probe", data: { value: "review" } },
    });

    await host.reconcileOnce("may");

    expect(request).toMatchObject({
      id: "turn-1",
      conversation: { id: "may:primary", current: { messageId: "message-1" } },
    });
    expect(readAppConversationResource(db, "may", "may:primary").work).toEqual([
      expect.objectContaining({ requestId: "turn-1", dependency: { kind: "task", id: "probe/turn-1" } }),
    ]);
  });

  it("retries independent batch items independently when one Task resolver fails", async () => {
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation", "coalesce-compatible"),
          task: ({ id }) => {
            if (id === "bad") throw new Error("bad input");
            return desiredTask(id);
          },
        }),
      ],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      retryAfterMs: 0,
      maxBatchSize: 2,
    });
    admit(host, "bad");
    admit(host, "good");

    const outcome = await host.reconcileOnce("evaluation");

    expect(outcome).toMatchObject({ claimed: 2, admitted: 1, released: 1 });
    expect(outcome.errors).toEqual(["Request bad: bad input"]);
    expect(host.get("good")?.waitingOn).toEqual({ kind: "task", id: "probe/good" });
    expect(host.get("bad")?.status).toBe("pending");
  });

  it("does not remove an App while it owns unfinished requests", () => {
    const host = new AppInboxHost({ db, apps: [app()] });
    admit(host, "owned");
    expect(() => host.replaceApps([])).toThrow("Cannot remove App evaluation while it owns unfinished inbox items");
    host.replaceApps([app(), app("next")]);
    expect(host.appIds()).toEqual(["evaluation", "next"]);
  });
});
