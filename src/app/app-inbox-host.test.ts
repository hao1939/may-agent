import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  Type,
  defineApp,
  type AppConversationResource,
  type AppDefinition,
  type AppRequest,
  type AppTaskAttachment,
} from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import { readAppConversationResource } from "./app-inbox-store.js";
import { APP_REQUEST_CONVERSATION_MAX_BYTES, AppInboxHost, boundedAppRequestConversation } from "./app-inbox-host.js";

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

function app(id = "evaluation"): AppDefinition {
  return defineApp({
    id,
    version: 1,
    owner: `${id}-owner`,
    inputSchema: probeInput,
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
      kind: "probe",
      data: { value: "ready" },
    });
  });

  it("atomically replaces exact inbox subscription routes", () => {
    const routed: string[] = [];
    const subscribed = (eventType: string) =>
      defineApp({
        ...app(),
        subscriptions: [
          {
            id: eventType,
            event: eventType,
            toInput: (event) => {
              routed.push(event.type);
              return { kind: "probe", data: { value: event.type } };
            },
          },
        ],
      });
    const host = new AppInboxHost({ db, apps: [subscribed("old.event")] });

    expect(host.subscriptionInputs({ type: "old.event", data: {} })).toHaveLength(1);
    expect(host.subscriptionInputs({ type: "unrelated.event", data: {} })).toEqual([]);
    host.replaceApps([subscribed("new.event")]);
    expect(host.subscriptionInputs({ type: "old.event", data: {} })).toEqual([]);
    expect(host.subscriptionInputs({ type: "new.event", data: {} })).toHaveLength(1);
    expect(routed).toEqual(["old.event", "new.event"]);
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

  it("attaches typed follow-up input to one exact existing Task", async () => {
    const attachments: Array<{ attachment: AppTaskAttachment; request: Readonly<AppRequest> }> = [];
    const host = new AppInboxHost({
      db,
      apps: [app()],
      attachTask: async ({ attachment, request }) => {
        attachments.push({ attachment, request });
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
    });
    host.admit({
      id: "feedback",
      appId: "evaluation",
      targetTaskId: "probe/current",
      source: { kind: "app", id: "may" },
      input: { kind: "probe", data: { value: "human correction" } },
    });

    expect(await host.reconcileOnce("evaluation")).toEqual({ claimed: 1, admitted: 1, released: 0, errors: [] });
    expect(attachments).toEqual([
      {
        attachment: { kind: "existing", taskId: "probe/current" },
        request: expect.objectContaining({
          id: "feedback",
          input: { kind: "probe", data: { value: "human correction" } },
        }),
      },
    ]);
    expect(host.get("feedback")).toMatchObject({
      targetTaskId: "probe/current",
      waitingOn: { kind: "task", id: "probe/current" },
    });
  });

  it("wakes an attention Task but does not silently apply input to a terminal Task", async () => {
    const attachments: AppTaskAttachment[] = [];
    const completed: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app()],
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: dependency.id === "probe/attention" ? "attention" : "done",
      }),
      attachTask: async ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      onRequestCompleted: (item, result) => completed.push({ id: item.id, result }),
    });
    for (const [id, taskId] of [
      ["feedback-attention", "probe/attention"],
      ["feedback-done", "probe/done"],
    ] as const) {
      host.admit({
        id,
        appId: "evaluation",
        targetTaskId: taskId,
        source: { kind: "app", id: "may" },
        input: { kind: "probe", data: { value: "human correction" } },
      });
    }

    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1, errors: [] });
    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1, errors: [] });
    expect(attachments).toEqual([{ kind: "existing", taskId: "probe/attention" }]);
    expect(host.get("feedback-attention")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "probe/attention" },
    });
    expect(host.get("feedback-done")).toMatchObject({
      status: "done",
      result: { summary: expect.stringContaining("new input was not applied") },
    });
    expect(completed).toEqual([
      {
        id: "feedback-done",
        result: { summary: expect.stringContaining("must be reconsidered as distinct follow-up work") },
      },
    ]);
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

  it("reads the captured May attention result without reattaching or mutating its existing Task", async () => {
    const fixtureUrl = new URL("./fixtures/may-inbox-existing-task-correlation-20260818.json", import.meta.url);
    const fixtureBytes = readFileSync(fixtureUrl);
    expect(createHash("sha256").update(fixtureBytes).digest("hex")).toBe(
      "478b54c083fa4fa53dc61b83ef57565c59a31a85827d1a722527ebcb0118e508",
    );
    const capture = JSON.parse(fixtureBytes.toString("utf8")) as {
      provenance: {
        kind: string;
        sourceSession: { id: string; requestId: string; resultSha256: string };
        taskStateCapture: { sha256: string };
      };
      request: {
        id: string;
        appId: string;
        parentId: string;
        source: { kind: "app"; id: string };
      };
      dependencyObservation: {
        kind: "task";
        id: string;
        status: "attention";
        summary: string;
      };
      ownerResult: {
        requestId: string;
        disposition: { type: "task"; task: { kind: "existing"; taskId: string } };
      };
      taskResource: {
        id: string;
        generation: number;
        resourceVersion: number;
        phase: string;
        completionReceipts: unknown[];
      };
      existingTaskAdmission: {
        idempotencyKey: string;
        taskId: string;
        taskGeneration: number;
        specHash: string;
      };
    };
    expect(capture.provenance).toMatchObject({
      kind: "immutable-runtime-capture",
      sourceSession: {
        id: "s_1787048407052_294",
        requestId: "app-inbox:app_7ae28c2c-3058-499c-a749-84a4ffa04100",
        resultSha256: "7f05f1cb19f13f7ee5e6e103e14e107436ab7fca014855003097a35d174ee785",
      },
      taskStateCapture: { sha256: "df7c20eb72128281fdc06e0c08fd4fe58a74c9a508ee66ecac1eec872104d00c" },
    });

    const requestId = capture.request.id;
    const taskId = capture.ownerResult.disposition.task.taskId;
    expect(capture.request.appId).toBe("may-agent");
    expect(capture.ownerResult.requestId).toBe(requestId);
    expect(capture.dependencyObservation.id).toBe(taskId);
    expect(capture.existingTaskAdmission).toMatchObject({
      idempotencyKey: `task:${requestId}:existing:${taskId}`,
      taskId,
      taskGeneration: 2,
    });

    const attachments: Array<{ appId: string; taskId: string; idempotencyKey: string }> = [];
    const completed: Array<{ requestId: string; summary?: string }> = [];
    let dependencyReady = false;
    const readCapturedTaskResource = () => {
      const readback = JSON.parse(readFileSync(fixtureUrl, "utf8")) as typeof capture;
      return structuredClone(readback.taskResource);
    };
    const taskResourceBeforeReview = readCapturedTaskResource();
    const mayApp = defineApp({
      ...app("may-agent"),
      task: () => capture.ownerResult.disposition.task,
    });
    const host = new AppInboxHost({
      db,
      apps: [mayApp],
      attachTask: async ({ appId, attachment, idempotencyKey }) => {
        const attachedTaskId = attachment.kind === "existing" ? attachment.taskId : attachment.intent.id;
        attachments.push({ appId, taskId: attachedTaskId, idempotencyKey });
        return { taskId: attachedTaskId };
      },
      readDependency: async ({ dependency }) => {
        if (!dependencyReady) return { kind: dependency.kind, id: dependency.id, status: "running" };
        const authoritativeReadback = JSON.parse(readFileSync(fixtureUrl, "utf8")) as typeof capture;
        expect(authoritativeReadback.dependencyObservation.id).toBe(dependency.id);
        return authoritativeReadback.dependencyObservation;
      },
      onRequestCompleted: (item, result) => completed.push({ requestId: item.id, summary: result.summary }),
    });
    host.admit({
      id: requestId,
      appId: capture.request.appId,
      parentId: capture.request.parentId,
      source: capture.request.source,
      input: { kind: "probe", data: { value: capture.provenance.sourceSession.id } },
    });

    await host.reconcileOnce(capture.request.appId);
    expect(attachments).toEqual([
      {
        appId: capture.request.appId,
        taskId,
        idempotencyKey: capture.existingTaskAdmission.idempotencyKey,
      },
    ]);
    expect(host.get(requestId)).toMatchObject({
      id: requestId,
      appId: "may-agent",
      status: "handling",
      waitingOn: { kind: "task", id: taskId },
    });

    dependencyReady = true;
    expect(host.wake({ kind: "task", id: taskId })).toBe(1);
    expect(await host.reconcileOnce(capture.request.appId)).toEqual({
      claimed: 1,
      admitted: 1,
      released: 0,
      errors: [],
    });

    expect(host.get(requestId)).toMatchObject({
      id: requestId,
      appId: "may-agent",
      parentId: capture.request.parentId,
      status: "done",
      result: { summary: capture.dependencyObservation.summary },
    });
    expect(completed).toEqual([{ requestId, summary: capture.dependencyObservation.summary }]);
    expect(attachments).toHaveLength(1);
    expect(readCapturedTaskResource()).toEqual(taskResourceBeforeReview);
    expect(readCapturedTaskResource()).toEqual({
      id: taskId,
      generation: 3,
      resourceVersion: 10,
      phase: "attention",
      completionReceipts: [],
    });
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

  it("re-observes each canonical Task dependency once and wakes only its App", async () => {
    const constantTaskApp = (id: string) =>
      defineApp({
        ...app(id),
        task: () => ({ kind: "existing" as const, taskId: "runtime/owner-review" }),
      });
    const reads: string[] = [];
    const host = new AppInboxHost({
      db,
      apps: [constantTaskApp("evaluation"), constantTaskApp("aks-rp-e2e")],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      readDependency: async ({ appId, dependency }) => {
        reads.push(`${appId}/${dependency.id}`);
        return {
          kind: "task",
          id: dependency.id,
          status: appId === "evaluation" ? "done" : "running",
          summary: appId === "evaluation" ? "Review complete" : "Review running",
        };
      },
    });
    admit(host, "evaluation-1", "evaluation");
    admit(host, "evaluation-2", "evaluation");
    admit(host, "aks-1", "aks-rp-e2e");
    await host.reconcileOnce("evaluation");
    await host.reconcileOnce("evaluation");
    await host.reconcileOnce("aks-rp-e2e");

    expect(await host.recoverTaskDependencies()).toEqual({
      linked: 0,
      woken: 2,
      wokenAppIds: ["evaluation"],
      errors: [],
    });
    expect(reads).toEqual(["aks-rp-e2e/runtime/owner-review", "evaluation/runtime/owner-review"]);
    expect(host.get("evaluation-1")?.availableAt).toBeDefined();
    expect(host.get("evaluation-2")?.availableAt).toBeDefined();
    expect(host.get("aks-1")?.availableAt).toBeUndefined();
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
    const conversation = readAppConversationResource(db, "may", "may:primary");
    expect(conversation.messages).toEqual([]);
    expect(conversation).not.toHaveProperty("work");
  });

  it("projects one exact focused Task observation without making focus an action", async () => {
    let request: AppRequest | undefined;
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          id: "may",
          version: 1,
          owner: "may",
          inputSchema: Type.Object({
            kind: Type.Literal("probe"),
            data: Type.Object({
              value: Type.String(),
              context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            }),
          }),
          task: (input) => desiredTask(input.id),
          tasks: {},
        }),
      ],
      readDependency: async ({ appId, dependency }) => ({
        kind: "task",
        id: dependency.id,
        status: "waiting",
        summary: `${appId} is waiting for verified evidence`,
      }),
      attachTask: async (input) => {
        request = input.request;
        return { taskId: input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id };
      },
    });
    host.admit({
      id: "turn-focused",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-focused" },
      input: {
        kind: "probe",
        data: {
          value: "why is this waiting?",
          context: { focusedTask: { appId: "evaluation", taskId: "review/docs" } },
        },
      },
    });

    await host.reconcileOnce("may");

    expect(request?.focusedTask).toEqual({
      appId: "evaluation",
      task: {
        kind: "task",
        id: "review/docs",
        status: "waiting",
        summary: "evaluation is waiting for verified evidence",
      },
    });
    expect(request?.input).toMatchObject({
      data: { context: { focusedTask: { appId: "evaluation", taskId: "review/docs" } } },
    });
  });

  it("bounds owner Conversation context by bytes instead of retained message count", () => {
    const conversation: AppConversationResource = {
      id: "may:primary",
      owner: "may",
      version: 30,
      current: { messageId: "message-30" },
      messages: Array.from({ length: 30 }, (_, index) => ({
        id: `message-${index + 1}`,
        sequence: index + 1,
        author: { kind: "human" as const, id: `human-${index + 1}` },
        text: `${index + 1}:${"界".repeat(4_000)}`,
        metadata: { requestId: index === 29 ? "current" : `request-${index + 1}` },
        createdAt: index + 1,
      })),
    };

    const bounded = boundedAppRequestConversation(conversation, "current");

    expect(Buffer.byteLength(JSON.stringify(bounded), "utf8")).toBeLessThanOrEqual(APP_REQUEST_CONVERSATION_MAX_BYTES);
    expect(bounded.messages.at(-1)?.id).toBe("message-29");
    expect(bounded.messages.length).toBeLessThan(conversation.messages.length);
    expect(bounded).not.toHaveProperty("work");
  });

  it("continues with the next request after one Task resolver fails", async () => {
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation"),
          task: ({ id }) => {
            if (id === "bad") throw new Error("bad input");
            return desiredTask(id);
          },
        }),
      ],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      retryAfterMs: 10_000,
    });
    admit(host, "bad");
    admit(host, "good");

    const failed = await host.reconcileOnce("evaluation");
    const admitted = await host.reconcileOnce("evaluation");

    expect(failed).toMatchObject({ claimed: 1, admitted: 0, released: 1 });
    expect(failed.errors).toEqual(["Request bad: bad input"]);
    expect(admitted).toMatchObject({ claimed: 1, admitted: 1, released: 0, errors: [] });
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
