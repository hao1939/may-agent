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
import {
  createConversationTopic,
  linkConversationTopicTask,
  listAppInboxChildren,
  readAppConversationResource,
} from "./app-inbox-store.js";
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

  it("answers a human turn directly without creating a May Task", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const attachments: AppTaskAttachment[] = [];
    const host = new AppInboxHost({
      db,
      apps: [may],
      resolveRequest: async () => ({
        summary: "Greeted Hao.",
        response: "Hello!",
        topic: { kind: "none" },
      }),
      attachTask: async ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: "unexpected" };
      },
    });
    host.admit({
      id: "turn-hello",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-hello" },
      input: { kind: "probe", data: { value: "hello" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(host.get("turn-hello")).toMatchObject({
      status: "done",
      result: { summary: "Greeted Hao.", response: "Hello!" },
    });
    expect(attachments).toEqual([]);
    expect(readAppConversationResource(db, "may", "may:primary").topics).toEqual([]);
  });

  it("finishes the frontend request after one durable follow-up handoff", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent", inputKinds: ["probe"] },
      task: (input) => desiredTask(input.id),
      tasks: {},
    });
    const handoffs: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [may, app("evaluation")],
      resolveRequest: async () => ({
        summary: "The review needs durable work.",
        response: "I’ll keep this review moving and bring the result back here.",
        topic: { kind: "new", title: "Review the design" },
        followUp: {
          outcome: "Review the design",
          acceptance: ["Return evidence-backed suggestions"],
          appId: "evaluation",
          input: { kind: "probe", data: { value: "review-design" } },
        },
      }),
      onRequestFollowUp: (item, followUp, topicId) => handoffs.push({ item: item.id, followUp, topicId }),
    });
    host.admit({
      id: "turn-review",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-review" },
      input: { kind: "probe", data: { value: "review the design" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(host.get("turn-review")).toMatchObject({
      status: "done",
      result: { response: expect.stringContaining("keep this review moving") },
    });
    expect(listAppInboxChildren(db, "turn-review")).toEqual([]);
    expect(handoffs).toEqual([
      expect.objectContaining({
        item: "turn-review",
        followUp: expect.objectContaining({ appId: "evaluation", outcome: "Review the design" }),
        topicId: expect.stringMatching(/^topic_/),
      }),
    ]);
  });

  it("reconsiders a terminal historical Task before promising to reuse it", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent", inputKinds: ["probe"] },
      task: (input) => desiredTask(input.id),
      tasks: {},
    });
    createConversationTopic(db, {
      id: "topic-backlog",
      appId: "may",
      conversationId: "may:primary",
      title: "Gym backlog",
      openedBy: "human",
      originMessageId: "message-old",
      now: 1,
    });
    linkConversationTopicTask(db, "topic-backlog", "evaluation", "probe/old-review", 1);

    let calls = 0;
    const handoffs: Array<{ task?: { appId: string; taskId: string }; outcome: string }> = [];
    const host = new AppInboxHost({
      db,
      apps: [may, app()],
      readDependency: async ({ dependency }) => ({ ...dependency, status: "done" }),
      resolveRequest: async ({ request }) => {
        calls += 1;
        if (calls === 1) {
          return {
            summary: "Reuse the earlier review.",
            response: "I will continue the earlier review.",
            topic: { kind: "existing", id: "topic-backlog" },
            followUp: {
              outcome: "Review the current backlog",
              acceptance: ["Return one proposal"],
              appId: "evaluation",
              task: { appId: "evaluation", taskId: "probe/old-review" },
              input: { kind: "probe", data: { value: "review" } },
            },
          };
        }
        expect(request.referencedTasks).toContainEqual({
          appId: "evaluation",
          task: { kind: "task", id: "probe/old-review", status: "done" },
        });
        return {
          summary: "The old review is complete, so this is new work.",
          response: "The earlier review is complete. I am starting this current review as new work.",
          topic: { kind: "existing", id: "topic-backlog" },
          followUp: {
            outcome: "Review the current backlog",
            acceptance: ["Return one proposal"],
            appId: "evaluation",
            input: { kind: "probe", data: { value: "review" } },
          },
        };
      },
      onRequestFollowUp: (_item, followUp) => handoffs.push(followUp),
    });
    host.admit({
      id: "turn-review-current",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 2,
      topicId: "topic-backlog",
      source: { kind: "human", id: "message-current" },
      input: { kind: "probe", data: { value: "review the current backlog" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(calls).toBe(2);
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]).toMatchObject({ outcome: "Review the current backlog" });
    expect(handoffs[0]?.task).toBeUndefined();
    expect(host.get("turn-review-current")).toMatchObject({
      status: "done",
      result: { response: expect.stringContaining("starting this current review") },
    });
  });

  it("uses a focused Task as evidence for advice without mutating it", async () => {
    const conversationalInput = Type.Object({
      kind: Type.Literal("probe"),
      data: Type.Object({
        value: Type.String(),
        context: Type.Object({
          focusedTask: Type.Object({ appId: Type.String(), taskId: Type.String() }),
        }),
      }),
    });
    const attachments: AppTaskAttachment[] = [];
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          id: "may",
          version: 1,
          agent: "may",
          inputSchema: conversationalInput,
          requests: { mode: "agent" },
        }),
      ],
      readDependency: async ({ appId, dependency }) => ({
        ...dependency,
        status: "waiting",
        summary: `${appId} is waiting for a build result`,
      }),
      resolveRequest: async ({ request }) => {
        expect(request.focusedTask).toEqual({
          appId: "evaluation",
          task: {
            kind: "task",
            id: "review/docs",
            status: "waiting",
            summary: "evaluation is waiting for a build result",
          },
        });
        return {
          summary: "The wait is supported by a live build.",
          response: "Yes. This wait makes sense because the required build is still running.",
          topic: { kind: "none" },
        };
      },
      attachTask: async ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: "unexpected" };
      },
    });
    host.admit({
      id: "turn-ask-about-task",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-ask-about-task" },
      input: {
        kind: "probe",
        data: {
          value: "does this wait make sense?",
          context: { focusedTask: { appId: "evaluation", taskId: "review/docs" } },
        },
      },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(host.get("turn-ask-about-task")).toMatchObject({
      status: "done",
      result: { response: expect.stringContaining("wait makes sense") },
    });
    expect(listAppInboxChildren(db, "turn-ask-about-task")).toEqual([]);
    expect(attachments).toEqual([]);
  });

  it("puts an event request and its direct answer in the App's default Conversation", async () => {
    const changed: string[] = [];
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent", conversationId: "may:primary" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may],
      resolveRequest: async ({ request }) => {
        expect(request.source.kind).toBe("system");
        expect(request.conversation?.id).toBe("may:primary");
        return {
          summary: "The decision needs Hao.",
          response: "Please approve the production rollout.",
          topic: { kind: "none" },
        };
      },
      onConversationChanged: (appId, conversationId) => changed.push(`${appId}/${conversationId}`),
    });
    const admitted = host.admit({
      id: "evaluation-decision",
      appId: "may",
      source: { kind: "system", id: "event:77" },
      input: { kind: "probe", data: { value: "approve production rollout" } },
      originEventId: 77,
    });

    expect(admitted.item).toMatchObject({ conversationId: "may:primary", conversationSequence: 77 });
    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(readAppConversationResource(db, "may", "may:primary").messages).toEqual([
      expect.objectContaining({
        id: "result:evaluation-decision",
        sequence: 77,
        author: { kind: "agent", id: "may" },
        text: "Please approve the production rollout.",
      }),
    ]);
    expect(changed).toEqual(["may/may:primary"]);
  });

  it("links one Topic to real App Tasks and reviews their results without a May wrapper Task", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const worker = app("worker");
    const attachments: Array<{ appId: string; attachment: AppTaskAttachment }> = [];
    const attachedRequests: Readonly<AppRequest>[] = [];
    const delegated: string[] = [];
    let workerDone = false;
    let mayCalls = 0;
    const host = new AppInboxHost({
      db,
      apps: [may, worker],
      resolveRequest: async ({ request }) => {
        mayCalls += 1;
        if (request.dependencies?.[0]?.status === "done") {
          return {
            summary: "The review is complete.",
            response: request.dependencies[0].response ?? "The review passed.",
            topic: { kind: "existing", id: request.conversation!.topics![0]!.id },
          };
        }
        return {
          summary: "The worker owns the review.",
          topic: { kind: "new", title: "Review the design" },
          dependencies: [
            {
              id: "design-review",
              appId: "worker",
              input: { kind: "probe", data: { value: "review the design" } },
            },
          ],
        };
      },
      attachTask: async ({ appId, attachment, request }) => {
        attachments.push({ appId, attachment });
        attachedRequests.push(request);
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: workerDone ? "done" : "running",
        ...(workerDone ? { summary: "Review passed", response: "The design review passed." } : {}),
      }),
      onRequestDelegated: (item) => delegated.push(item.appId),
    });
    host.admit({
      id: "turn-review",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-review" },
      input: { kind: "probe", data: { value: "review the design" } },
    });

    await host.reconcileOnce("may");
    const children = listAppInboxChildren(db, "turn-review");
    expect(children).toHaveLength(1);
    expect(delegated).toEqual(["worker"]);
    expect(children[0]).toMatchObject({ appId: "worker", status: "pending", topicId: expect.any(String) });
    expect(host.get("turn-review")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "app", id: "children:turn-review" },
    });
    expect(attachments).toEqual([]);

    await host.reconcileOnce("worker");
    const topic = readAppConversationResource(db, "may", "may:primary").topics![0]!;
    const workerTaskId = topic.taskRefs[0]!.taskId;
    expect(topic).toMatchObject({
      title: "Review the design",
      openedBy: "human",
      originMessageId: "message-review",
      taskRefs: [{ appId: "worker", taskId: expect.any(String) }],
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.appId).toBe("worker");
    expect(attachedRequests[0]?.humanRequested).toBe(true);

    workerDone = true;
    expect(host.wake({ kind: "task", id: workerTaskId })).toBe(1);
    await host.reconcileOnce("worker");
    await host.reconcileOnce("may");

    expect(host.get("turn-review")).toMatchObject({
      status: "done",
      topicId: topic.id,
      result: { response: "The design review passed." },
    });
    expect(mayCalls).toBe(2);
    expect(attachments.every((entry) => entry.appId !== "may")).toBeTrue();
  });

  it("emits one immediate explanation while delegated work continues", async () => {
    const messages: unknown[] = [];
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may, app("worker")],
      resolveRequest: async () => ({
        summary: "Started the exact review.",
        response: "I’ll check the existing evidence first and report the result here.",
        topic: { kind: "new", title: "Review the evidence" },
        dependencies: [
          { id: "review", appId: "worker", input: { kind: "probe", data: { value: "review evidence" } } },
        ],
      }),
      onRequestMessage: (item, text, topicId) => messages.push({ item: item.id, text, topicId }),
    });
    host.admit({
      id: "turn-explain-and-work",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-explain-and-work" },
      input: { kind: "probe", data: { value: "review it and tell me what you are doing" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(messages).toEqual([
      {
        item: "turn-explain-and-work",
        text: "I’ll check the existing evidence first and report the result here.",
        topicId: expect.stringMatching(/^topic_/),
      },
    ]);
    expect(host.get("turn-explain-and-work")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "app", id: "children:turn-explain-and-work" },
    });
  });

  it("publishes a direct conversational answer instead of only storing its receipt", async () => {
    const messages: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          id: "may",
          version: 1,
          agent: "may",
          inputSchema: probeInput,
          requests: { mode: "agent" },
        }),
      ],
      resolveRequest: async () => ({
        summary: "The review is complete.",
        response: "The review is complete; no action is needed from you.",
        topic: { kind: "new", title: "Review progress" },
      }),
      onRequestMessage: (item, text, topicId) => messages.push({ item: item.id, text, topicId }),
    });
    host.admit({
      id: "turn-progress",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-progress" },
      input: { kind: "probe", data: { value: "what is the current progress?" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(messages).toEqual([
      {
        item: "turn-progress",
        text: "The review is complete; no action is needed from you.",
        topicId: expect.stringMatching(/^topic_/),
      },
    ]);
    expect(host.get("turn-progress")).toMatchObject({
      status: "done",
      result: { response: "The review is complete; no action is needed from you." },
    });
  });

  it("answers a mixed request now and steers the exact focused Task", async () => {
    const conversationalInput = Type.Object({
      kind: Type.Literal("probe"),
      data: Type.Object({
        value: Type.String(),
        context: Type.Object({
          focusedTask: Type.Object({ appId: Type.String(), taskId: Type.String() }),
        }),
      }),
    });
    const attachments: Array<{ appId: string; attachment: AppTaskAttachment }> = [];
    const messages: string[] = [];
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          id: "may",
          version: 1,
          agent: "may",
          inputSchema: conversationalInput,
          requests: { mode: "agent" },
        }),
        app("evaluation"),
      ],
      readDependency: async ({ dependency }) => ({ ...dependency, status: "waiting" }),
      resolveRequest: async () => ({
        summary: "The wait lacks a live blocker, so the existing Task should reconsider it.",
        response: "The wait does not make sense. I’m asking the same Evaluation Task to re-check it now.",
        topic: { kind: "new", title: "Review the invalid wait" },
        dependencies: [
          {
            id: "reconsider-wait",
            appId: "evaluation",
            taskId: "review/docs",
            input: { kind: "probe", data: { value: "Reconsider the wait from current evidence." } },
          },
        ],
      }),
      attachTask: async ({ appId, attachment }) => {
        attachments.push({ appId, attachment });
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      onRequestMessage: (_item, text) => messages.push(text),
    });
    host.admit({
      id: "turn-challenge-wait",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-challenge-wait" },
      input: {
        kind: "probe",
        data: {
          value: "does this wait make sense? if not, fix it",
          context: { focusedTask: { appId: "evaluation", taskId: "review/docs" } },
        },
      },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(messages).toEqual(["The wait does not make sense. I’m asking the same Evaluation Task to re-check it now."]);
    expect(listAppInboxChildren(db, "turn-challenge-wait")).toHaveLength(1);
    await host.reconcileOnce("evaluation");
    expect(attachments).toEqual([{ appId: "evaluation", attachment: { kind: "existing", taskId: "review/docs" } }]);
  });

  it("reviews each completed child once while other delegated work keeps running", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const completedTasks = new Set<string>();
    let mayCalls = 0;
    const host = new AppInboxHost({
      db,
      apps: [may, app("worker")],
      resolveRequest: async ({ request }) => {
        mayCalls += 1;
        const topic = request.conversation?.topics?.[0];
        return {
          summary: "Both checks must finish.",
          topic: topic ? { kind: "existing", id: topic.id } : { kind: "new", title: "Run both checks" },
          dependencies: [
            { id: "first", appId: "worker", input: { kind: "probe", data: { value: "first" } } },
            { id: "second", appId: "worker", input: { kind: "probe", data: { value: "second" } } },
          ],
        };
      },
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: completedTasks.has(dependency.id) ? "done" : "running",
        ...(completedTasks.has(dependency.id) ? { summary: `${dependency.id} finished` } : {}),
      }),
    });
    host.admit({
      id: "turn-two-checks",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-two-checks" },
      input: { kind: "probe", data: { value: "run two checks" } },
    });

    await host.reconcileOnce("may");
    await host.reconcileOnce("worker");
    await host.reconcileOnce("worker");
    const [first, second] = listAppInboxChildren(db, "turn-two-checks");
    expect(first?.waitingOn?.kind).toBe("task");
    expect(second?.waitingOn?.kind).toBe("task");

    completedTasks.add(first!.waitingOn!.id);
    expect(host.wake({ kind: "task", id: first!.waitingOn!.id })).toBe(1);
    await host.reconcileOnce("worker");
    await host.reconcileOnce("may");

    expect(host.get("turn-two-checks")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "app", id: "children:turn-two-checks" },
      availableAt: undefined,
    });
    expect(host.readyCount("may")).toBe(0);
    expect(host.get(second!.id)?.status).toBe("handling");
    expect(mayCalls).toBe(2);
  });

  it("lets a later natural turn reuse a Topic and steer its exact unfinished Task", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const worker = app("worker");
    const attachments: Array<{ appId: string; attachment: AppTaskAttachment }> = [];
    let first = true;
    const host = new AppInboxHost({
      db,
      apps: [may, worker],
      resolveRequest: async ({ request }) => {
        const existing = request.conversation?.topics?.[0];
        const dependency = first
          ? {
              id: "initial",
              appId: "worker",
              input: { kind: "probe", data: { value: "start" } },
            }
          : {
              id: "feedback",
              appId: "worker",
              taskId: existing!.taskRefs[0]!.taskId,
              input: { kind: "probe", data: { value: "focus on simplicity" } },
            };
        first = false;
        return {
          summary: "Worker owns the request.",
          topic: existing ? { kind: "existing", id: existing.id } : { kind: "new", title: "Improve design" },
          dependencies: [dependency],
        };
      },
      attachTask: async ({ appId, attachment }) => {
        attachments.push({ appId, attachment });
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      readDependency: async ({ dependency }) => ({ ...dependency, status: "running" }),
    });
    for (const [id, sequence, value] of [
      ["turn-1", 1, "improve the design"],
      ["turn-2", 2, "keep it simple"],
    ] as const) {
      host.admit({
        id,
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: sequence,
        source: { kind: "human", id: `message-${sequence}` },
        input: { kind: "probe", data: { value } },
      });
      await host.reconcileOnce("may");
      await host.reconcileOnce("worker");
    }

    const topic = readAppConversationResource(db, "may", "may:primary").topics![0]!;
    expect(topic.taskRefs).toHaveLength(1);
    expect(attachments).toHaveLength(2);
    expect(attachments[1]).toEqual({
      appId: "worker",
      attachment: { kind: "existing", taskId: topic.taskRefs[0]!.taskId },
    });
    expect(host.get("turn-2")?.topicId).toBe(topic.id);
  });

  it("reconsiders a rapid follow-up and continues the open Topic request instead of creating a sibling Task", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const attachments: AppTaskAttachment[] = [];
    let releaseFollowUp!: () => void;
    let followUpStarted!: () => void;
    const followUpGate = new Promise<void>((resolve) => (releaseFollowUp = resolve));
    const followUpEntered = new Promise<void>((resolve) => (followUpStarted = resolve));
    let firstCalls = 0;
    let secondCalls = 0;
    const host = new AppInboxHost({
      db,
      apps: [may, app("worker")],
      resolveRequest: async ({ request }) => {
        if (request.id === "topic-seed") {
          return {
            summary: "Started a Topic.",
            response: "What should we review?",
            topic: { kind: "new", title: "Review the backlog" },
          };
        }
        const topicId = request.conversation!.topics![0]!.id;
        const open = request.openRequests?.[0];
        if (open) {
          secondCalls += 1;
          if (!open.dependencies[0]?.taskId) {
            followUpStarted();
            await followUpGate;
            return {
              summary: "Worker owns the backlog review.",
              topic: { kind: "existing", id: topicId },
              dependencies: [
                {
                  id: "backlog-review",
                  appId: "worker",
                  input: { kind: "probe", data: { value: "review and retire obsolete work" } },
                },
              ],
            };
          }
          return {
            summary: "The existing review already covers this follow-up.",
            response: "It is already underway; I will return the recommendations here.",
            topic: { kind: "existing", id: topicId },
          };
        }
        if (request.id === "review-one") {
          firstCalls += 1;
        } else {
          secondCalls += 1;
        }
        return {
          summary: "Worker owns the backlog review.",
          topic: { kind: "existing", id: topicId },
          dependencies: [
            {
              id: "backlog-review",
              appId: "worker",
              input: { kind: "probe", data: { value: "review and retire obsolete work" } },
            },
          ],
        };
      },
      attachTask: async ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      readDependency: async ({ dependency }) => ({ ...dependency, status: "running" }),
    });
    host.admit({
      id: "topic-seed",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 1,
      source: { kind: "human", id: "message-seed" },
      input: { kind: "probe", data: { value: "review the backlog" } },
    });
    await host.reconcileOnce("may");

    for (const [id, sequence, value] of [
      ["review-one", 2, "systematically review every task and retire obsolete work"],
      ["review-two", 3, "please do it for me and suggest"],
    ] as const) {
      host.admit({
        id,
        appId: "may",
        conversationId: "may:primary",
        conversationSequence: sequence,
        source: { kind: "human", id: `message-${sequence}` },
        input: { kind: "probe", data: { value } },
      });
    }

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    const followUp = host.reconcileOnce("may");
    await followUpEntered;
    await host.reconcileOnce("worker");
    releaseFollowUp();
    expect(await followUp).toMatchObject({ admitted: 1, errors: [] });

    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(2);
    expect(listAppInboxChildren(db, "review-one")).toHaveLength(1);
    expect(listAppInboxChildren(db, "review-two")).toHaveLength(0);
    expect(host.get("review-two")).toMatchObject({
      status: "done",
      result: { response: "It is already underway; I will return the recommendations here." },
    });
    expect(attachments).toHaveLength(1);
    expect(readAppConversationResource(db, "may", "may:primary").topics![0]!.taskRefs).toHaveLength(1);
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

  it("yields control traffic between dependency recovery items from one App", async () => {
    let reads = 0;
    const host = new AppInboxHost({
      db,
      apps: [app()],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      readDependency: async ({ dependency }) => {
        reads += 1;
        return { ...dependency, status: "running" };
      },
    });
    for (const [id, taskId] of [
      ["first", "probe/first"],
      ["second", "probe/second"],
    ] as const) {
      host.admit({
        id,
        appId: "evaluation",
        targetTaskId: taskId,
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: id } },
      });
      await host.reconcileOnce("evaluation");
    }
    reads = 0;

    const recovery = host.recoverTaskDependencies();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(reads).toBe(1);
    await recovery;
    expect(reads).toBe(2);
  });

  it("revisits a nonterminal dependency when repaired App policy assigns request-specific achieve work", async () => {
    const legacy = defineApp({
      ...app("may-agent"),
      task: () => ({ kind: "existing" as const, taskId: "runtime/platform-owner-review" }),
    });
    const legacyHost = new AppInboxHost({
      db,
      apps: [legacy],
      attachTask: async ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      }),
      readDependency: async ({ dependency }) => ({ ...dependency, status: "waiting" }),
    });
    admit(legacyHost, "addressed-review", "may-agent");
    await legacyHost.reconcileOnce("may-agent");
    expect(legacyHost.get("addressed-review")?.waitingOn).toEqual({
      kind: "task",
      id: "runtime/platform-owner-review",
    });

    const attachments: AppTaskAttachment[] = [];
    const repairedHost = new AppInboxHost({
      db,
      apps: [app("may-agent")],
      attachTask: async ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      },
      readDependency: async ({ dependency }) => ({ ...dependency, status: "waiting" }),
    });

    expect(await repairedHost.recoverTaskDependencies()).toEqual({
      linked: 1,
      woken: 1,
      wokenAppIds: ["may-agent"],
      errors: [],
    });
    await repairedHost.reconcileOnce("may-agent");

    expect(attachments).toEqual([
      expect.objectContaining({
        kind: "desired",
        intent: expect.objectContaining({ id: "probe/addressed-review", mode: "achieve" }),
      }),
    ]);
    expect(repairedHost.get("addressed-review")?.waitingOn).toEqual({
      kind: "task",
      id: "probe/addressed-review",
    });
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

  it("resolves exact Tasks from recent command views into bounded canonical request context", async () => {
    let request: AppRequest | undefined;
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may],
      readDependency: async ({ appId, dependency }) => ({
        ...dependency,
        status: "waiting",
        summary: `${appId}/${dependency.id} is still waiting`,
      }),
      resolveRequest: async (input) => {
        request = input.request;
        return { summary: "Explained current state", response: "It is still waiting.", topic: { kind: "none" } };
      },
    });
    db.prepare(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', ?, 'app:may', ?, ?)`,
    ).run(
      10,
      "may-console",
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "command", id: "may-console" },
        text: "Active Tasks for may: legacy wrapper",
        metadata: {
          channel: "may-console",
          command: "/tasks",
          taskRefs: [{ appId: "may", taskId: "conversation/legacy" }],
        },
      }),
      10,
    );
    host.admit({
      id: "turn-reference",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 11,
      source: { kind: "human", id: "message-reference" },
      input: { kind: "probe", data: { value: "why is it still there?" } },
    });

    await host.reconcileOnce("may");

    expect(request?.referencedTasks).toEqual([
      {
        appId: "may",
        ref: expect.stringMatching(/^[0-9a-f]{8}$/),
        task: {
          kind: "task",
          id: "conversation/legacy",
          status: "waiting",
          summary: "may/conversation/legacy is still waiting",
        },
      },
    ]);
  });

  it("lets a direct human May turn cancel one exact referenced Task through the Host capability", async () => {
    const controls: unknown[] = [];
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may],
      readDependency: async ({ dependency }) => ({ ...dependency, status: "waiting" }),
      resolveRequest: async () => ({
        summary: "Removed the obsolete legacy Task.",
        response: "The stale legacy Task has been removed.",
        topic: { kind: "none" },
        taskControls: [
          { kind: "cancel", appId: "may", taskId: "conversation/legacy", reason: "obsolete legacy wrapper" },
        ],
      }),
      controlTask: async (input) => {
        controls.push(input);
      },
    });
    db.prepare(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', ?, 'app:may', ?, ?)`,
    ).run(
      20,
      "may-console",
      JSON.stringify({
        appId: "may",
        conversationId: "may:primary",
        author: { kind: "command", id: "may-console" },
        text: "Task legacy wrapper is waiting",
        metadata: { taskRefs: [{ appId: "may", taskId: "conversation/legacy" }] },
      }),
      20,
    );
    host.admit({
      id: "turn-cancel",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 21,
      source: { kind: "human", id: "message-cancel" },
      input: { kind: "probe", data: { value: "please remove it" } },
    });

    await host.reconcileOnce("may");

    expect(controls).toEqual([
      {
        requestId: "turn-cancel",
        control: { kind: "cancel", appId: "may", taskId: "conversation/legacy", reason: "obsolete legacy wrapper" },
      },
    ]);
    expect(host.get("turn-cancel")).toMatchObject({
      status: "done",
      result: { response: "The stale legacy Task has been removed." },
    });
  });

  it("rejects conversational Task control when the exact Task is absent from human context", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may],
      retryAfterMs: 0,
      resolveRequest: async () => ({
        summary: "Tried an unavailable control.",
        response: "Removed it.",
        topic: { kind: "none" },
        taskControls: [{ kind: "cancel", appId: "may", taskId: "invented", reason: "not in context" }],
      }),
      controlTask: async () => undefined,
    });
    host.admit({
      id: "turn-invalid-control",
      appId: "may",
      source: { kind: "human", id: "message-invalid-control" },
      input: { kind: "probe", data: { value: "remove it" } },
    });

    const result = await host.reconcileOnce("may");

    expect(result.errors).toEqual([expect.stringContaining("cannot control unavailable Task may/invented")]);
    expect(host.get("turn-invalid-control")?.status).toBe("pending");
  });

  it("rejects an existing Task target that was not supplied in exact request context", async () => {
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may, app("worker")],
      retryAfterMs: 0,
      resolveRequest: async () => ({
        summary: "Tried an unavailable continuation.",
        topic: { kind: "new", title: "Unavailable work" },
        dependencies: [
          {
            id: "continue-invented",
            appId: "worker",
            taskId: "probe/invented",
            input: { kind: "probe", data: { value: "continue it" } },
          },
        ],
      }),
    });
    host.admit({
      id: "turn-invalid-target",
      appId: "may",
      source: { kind: "human", id: "message-invalid-target" },
      input: { kind: "probe", data: { value: "continue it" } },
    });

    const result = await host.reconcileOnce("may");

    expect(result.errors).toEqual([
      expect.stringContaining("cannot continue unavailable Task worker/probe/invented"),
    ]);
    expect(host.get("turn-invalid-target")?.status).toBe("pending");
  });

  it("accepts an exact Task linked by a canonically selected old Topic", async () => {
    for (let index = 0; index < 13; index += 1) {
      createConversationTopic(db, {
        id: `topic_${index.toString(16).padStart(8, "0")}abcdef0123456789`,
        appId: "may",
        conversationId: "may:primary",
        title: `Topic ${index}`,
        openedBy: "human",
        originMessageId: `message-${index}`,
        now: index,
      });
    }
    const oldTopicId = "topic_00000000abcdef0123456789";
    linkConversationTopicTask(db, oldTopicId, "worker", "probe/old-review", 1);
    const may = defineApp({
      id: "may",
      version: 1,
      agent: "may",
      inputSchema: probeInput,
      requests: { mode: "agent" },
    });
    const host = new AppInboxHost({
      db,
      apps: [may, app("worker")],
      resolveRequest: async () => ({
        summary: "Continued the old review.",
        topic: { kind: "existing", id: "00000000" },
        dependencies: [
          {
            id: "continue-old-review",
            appId: "worker",
            taskId: "probe/old-review",
            input: { kind: "probe", data: { value: "include Telegram" } },
          },
        ],
      }),
    });
    host.admit({
      id: "turn-old-topic",
      appId: "may",
      conversationId: "may:primary",
      conversationSequence: 20,
      source: { kind: "human", id: "message-old-topic" },
      input: { kind: "probe", data: { value: "continue the old review" } },
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1, errors: [] });
    expect(listAppInboxChildren(db, "turn-old-topic")).toMatchObject([
      { appId: "worker", targetTaskId: "probe/old-review", topicId: oldTopicId },
    ]);
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
