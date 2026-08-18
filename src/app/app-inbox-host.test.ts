import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Type, defineApp, type AppDefinition, type AppRequest } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { applyDbSchema } from "../lib/db/schema.js";
import {
  associateAppInboxClaimSession,
  claimAppInboxItem,
  listAppWork,
  listAppInboxDeliveries,
  readAppConversationResource,
  waitAppInboxClaim,
} from "./app-inbox-store.js";
import {
  completeAppEventAdmissionPlan,
  createAppEventAdmissionPlan,
  markAppEventAdmissionCommandAdmitted,
} from "./app-event-admission-store.js";
import { AppInboxHost, type AppOwnerInvoker } from "./app-inbox-host.js";

const probeInput = Type.Object({
  kind: Type.Literal("probe"),
  data: Type.Object({ value: Type.String() }),
});

function app(id: string, batch: "single" | "coalesce-compatible" = "single", tasks = false): AppDefinition {
  return defineApp({
    id,
    version: 1,
    owner: `${id}-owner`,
    inputSchema: probeInput,
    inbox: { batch },
    ...(tasks ? { tasks: { attach: true as const } } : {}),
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
    expect(host.acceptsInput("evaluation", { kind: "probe", data: { value: "valid" } })).toBe(true);
    expect(host.acceptsInput("evaluation", { kind: "message", data: { message: "unsupported" } })).toBe(false);
    expect(host.acceptsInput("unknown", { kind: "probe", data: { value: "valid" } })).toBe(false);
    expect(() =>
      host.admit({
        id: "invalid-item",
        appId: "evaluation",
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: 42 } },
      }),
    ).toThrow("Invalid input for App evaluation");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 0 });

    expect(
      () =>
        new AppInboxHost({
          db,
          apps: [{ ...app("malformed"), tasks: { attach: false } } as unknown as AppDefinition],
          invokeOwner: async () => [],
        }),
    ).toThrow("App malformed tasks attach must be true");
  });

  it("discovers typed actions and translates them into validated App input", () => {
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation"),
          actions: {
            probe: {
              description: "Submit a typed probe",
              inputSchema: Type.Object({ value: Type.String({ minLength: 1 }) }),
              toInput: ({ value }) => ({ kind: "probe", data: { value } }),
            },
          },
        }),
      ],
      invokeOwner: async () => [],
    });

    expect(host.hasApp("evaluation.app")).toBe(true);
    expect(host.describeActions("evaluation")).toEqual([
      {
        id: "probe",
        description: "Submit a typed probe",
        inputSchema: expect.objectContaining({ type: "object" }),
      },
    ]);
    expect(() => host.actionInput("evaluation", "probe", { value: "" })).toThrow("Invalid input for evaluation.probe");
    expect(host.actionInput("evaluation.app", "probe", { value: "ready" })).toEqual({
      kind: "probe",
      data: { value: "ready" },
    });
  });

  it("replaces the live App registry atomically without orphaning unfinished work", () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      invokeOwner: async () => [],
    });

    expect(() => host.replaceApps([app("next"), app("next")])).toThrow("Duplicate App id: next");
    expect(host.appIds()).toEqual(["evaluation"]);

    admit(host, "evaluation", "still-owned");
    expect(() => host.replaceApps([app("next")])).toThrow(
      "Cannot remove App evaluation while it owns unfinished inbox items",
    );
    expect(host.appIds()).toEqual(["evaluation"]);

    host.replaceApps([app("evaluation"), app("next")]);
    expect(host.appIds()).toEqual(["evaluation", "next"]);
  });

  it("rejects reloads incompatible with frozen event admission commands", () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation", "single", true)],
      invokeOwner: async () => [],
    });
    db.prepare(
      `INSERT INTO events (id, event_type, data, timestamp)
       VALUES (41, 'review.requested', '{}', 100),
              (42, 'task.requested', '{}', 100)`,
    ).run();
    createAppEventAdmissionPlan(db, {
      eventId: 41,
      registrySnapshotId: "boot-a:1",
      registryGeneration: 1,
      routes: [
        {
          appId: "evaluation",
          kind: "inbox",
          routeId: "review",
          input: { kind: "probe", data: { value: "current" } },
          conditionTaskIds: ["work/review"],
        },
      ],
    });

    expect(() => host.replaceApps([])).toThrow(
      "Cannot remove App evaluation while it owns pending event admission commands",
    );
    expect(() =>
      host.replaceApps([
        defineApp({
          id: "evaluation",
          version: 1,
          owner: "evaluation-owner",
          inputSchema: Type.Object({
            kind: Type.Literal("different"),
            data: Type.Object({}),
          }),
        }),
      ]),
    ).toThrow("input schema incompatible with pending event admission commands");
    expect(() => host.replaceApps([app("evaluation")])).toThrow("pending inbox admission includes Condition wakes");
    markAppEventAdmissionCommandAdmitted(db, { eventId: 41, appId: "evaluation" });
    expect(completeAppEventAdmissionPlan(db, 41)).toBeTrue();

    createAppEventAdmissionPlan(db, {
      eventId: 42,
      registrySnapshotId: "boot-a:1",
      registryGeneration: 1,
      routes: [
        {
          appId: "evaluation",
          kind: "task",
          routeId: "work/current",
          intent: null,
          conditionTaskIds: ["work/current"],
        },
      ],
    });
    expect(() => host.replaceApps([app("evaluation")])).toThrow(
      "Cannot remove task capability from App evaluation while it owns pending event admission commands",
    );
    expect(host.appIds()).toEqual(["evaluation"]);
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

  it("routes deterministic requests without invoking the owner", async () => {
    let ownerInvocations = 0;
    let routedRequest: Readonly<AppRequest> | undefined;
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation"),
          route: (request) => {
            routedRequest = request;
            return {
              type: "complete",
              summary: `routed ${(request.input.data as { value: string }).value}`,
              evidence: ["route:deterministic"],
            };
          },
        }),
      ],
      invokeOwner: async () => {
        ownerInvocations += 1;
        return [];
      },
    });
    admit(host, "evaluation", "probe-routed");

    expect(await host.reconcileOnce("evaluation")).toEqual({ claimed: 1, admitted: 1, released: 0, errors: [] });
    expect(ownerInvocations).toBe(0);
    expect(Object.isFrozen(routedRequest)).toBe(true);
    expect(Object.isFrozen(routedRequest?.input)).toBe(true);
    expect(Object.isFrozen((routedRequest?.input as { data: unknown }).data)).toBe(true);
    expect(host.get("probe-routed")).toMatchObject({
      status: "done",
      sessionId: undefined,
      result: { summary: "routed probe-routed", evidence: ["route:deterministic"] },
    });
  });

  it("sends only unresolved requests in a routed batch to the owner", async () => {
    const ownerRequests: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation", "coalesce-compatible"),
          route: (request) =>
            (request.input.data as { value: string }).value === "automatic"
              ? { type: "complete", summary: "handled by policy" }
              : null,
        }),
      ],
      invokeOwner: async ({ requests, onSessionStarted }) => {
        ownerRequests.push(...requests);
        onSessionStarted("session-judgment");
        return requests.map((request) => ({
          requestId: request.id,
          disposition: { type: "complete", summary: "handled by owner" },
        }));
      },
    });
    host.admit({
      id: "automatic",
      appId: "evaluation",
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { value: "automatic" } },
    });
    host.admit({
      id: "judgment",
      appId: "evaluation",
      source: { kind: "system", id: "test" },
      input: { kind: "probe", data: { value: "judgment" } },
    });

    expect(await host.reconcileOnce("evaluation")).toEqual({ claimed: 2, admitted: 2, released: 0, errors: [] });
    expect(ownerRequests).toMatchObject([{ id: "judgment" }]);
    expect(host.get("automatic")).toMatchObject({ status: "done", sessionId: undefined });
    expect(host.get("judgment")).toMatchObject({ status: "done", sessionId: "session-judgment" });
  });

  it("routes stable desired work into the task reconciler and reviews its dependency", async () => {
    let ownerInvocations = 0;
    let routedRequest: Readonly<AppRequest> | null = null;
    const attachments: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation", "single", true),
          route: (request) => {
            routedRequest = request;
            return request.dependency?.status === "done"
              ? { type: "complete", summary: "scheduled task converged" }
              : {
                  type: "task",
                  task: {
                    kind: "desired",
                    intent: {
                      id: "scheduled-review",
                      parentId: "runtime",
                      outcome: "Keep the scheduled review current",
                      acceptance: ["The review is current"],
                      mode: "maintain",
                    },
                  },
                };
          },
        }),
      ],
      attachTask: async (input) => {
        expect(input.request).toBe(routedRequest);
        attachments.push(input);
        return { taskId: "task-scheduled-review" };
      },
      readDependency: async ({ dependency }) => ({ ...dependency, status: "done" }),
      invokeOwner: async () => {
        ownerInvocations += 1;
        return [];
      },
    });
    admit(host, "evaluation", "scheduled-input");

    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(host.get("scheduled-input")?.waitingOn).toEqual({ kind: "task", id: "task-scheduled-review" });
    expect(attachments).toMatchObject([
      {
        appId: "evaluation",
        idempotencyKey: "task:scheduled-input:desired:scheduled-review",
        request: {
          id: "scheduled-input",
          source: { kind: "system", id: "test" },
          input: { kind: "probe", data: { value: "scheduled-input" } },
        },
      },
    ]);

    host.wake({ kind: "task", id: "task-scheduled-review" });
    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(host.get("scheduled-input")).toMatchObject({
      status: "done",
      result: { summary: "scheduled task converged" },
    });
    expect(ownerInvocations).toBe(0);
  });

  it("releases a routed batch when deterministic policy throws", async () => {
    const host = new AppInboxHost({
      db,
      apps: [
        defineApp({
          ...app("evaluation", "coalesce-compatible"),
          route: () => {
            throw new Error("invalid domain configuration");
          },
        }),
      ],
      retryAfterMs: 0,
      invokeOwner: async () => {
        throw new Error("owner must not run");
      },
    });
    admit(host, "evaluation", "probe-1");
    admit(host, "evaluation", "probe-2");

    expect(await host.reconcileOnce("evaluation")).toEqual({
      claimed: 2,
      admitted: 0,
      released: 2,
      errors: ["App routing failed: invalid domain configuration"],
    });
  });

  it("passes exact bounded conversation links without exposing transport lifecycle fields", async () => {
    const invocations: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      invokeOwner: async (input) => {
        input.onSessionStarted("session-human-1");
        invocations.push(input);
        return input.requests.map((request) => ({
          requestId: request.id,
          disposition: { type: "complete", summary: "done", response: "Hello" },
        }));
      },
    });
    host.admit({
      id: "background-human",
      appId: "may",
      source: { kind: "human", id: "event:40" },
      input: { kind: "probe", data: { value: "background" } },
      conversationId: "web-ui:human",
      conversationSequence: 40,
      channel: "telegram",
    });
    const background = claimAppInboxItem(db, "background-human", "background-worker", 1_000)!;
    expect(waitAppInboxClaim(db, background, { kind: "analysis", id: "analysis-background" })).toBe(true);
    host.admit({
      id: "selected-human",
      appId: "may",
      source: { kind: "human", id: "event:41" },
      input: { kind: "probe", data: { value: "selected" } },
      conversationId: "web-ui:human",
      conversationSequence: 41,
      channel: "web-ui",
    });
    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    invocations.length = 0;
    db.run(
      `INSERT INTO events (id, event_type, source, owner, data, timestamp)
       VALUES (?, 'conversation.message.created', 'telegram', 'app:may', ?, ?)`,
      [
        40,
        JSON.stringify({
          appId: "may",
          conversationId: "may:primary",
          author: { kind: "command", id: "telegram" },
          text: "Work 1:\n  Result: Hello",
          metadata: { channel: "telegram", command: "/work 1" },
        }),
        40,
      ],
    );
    host.admit({
      id: "human-1",
      appId: "may",
      source: { kind: "human", id: "event:42" },
      input: {
        kind: "probe",
        data: { value: "hello" },
      },
      conversationId: "may:primary",
      conversationSequence: 42,
      channel: "may-console",
      channelThreadId: "local-terminal",
      replyToSourceId: "event:41",
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    expect(invocations).toMatchObject([
      {
        transport: {
          channel: "may-console",
          channelThreadId: "local-terminal",
          conversationId: "may:primary",
        },
        requests: [
          {
            id: "human-1",
            source: { kind: "human", id: "event:42" },
            input: {
              kind: "probe",
              data: { value: "hello" },
            },
            conversation: {
              id: "may:primary",
              owner: "may",
              version: 40,
              current: { messageId: "event:42", replyTo: "event:41" },
              work: [
                expect.objectContaining({
                  requestId: "background-human",
                  message: "probe request",
                  state: "analyzing",
                }),
              ],
              messages: [
                {
                  id: "event:40",
                  sequence: 40,
                  author: { kind: "command", id: "telegram" },
                  text: "Work 1:\n  Result: Hello",
                  metadata: { channel: "telegram", command: "/work 1" },
                  createdAt: 40,
                },
              ],
            },
          },
        ],
      },
    ]);
    expect((invocations[0] as { requests: Array<Record<string, unknown>> }).requests[0]).not.toHaveProperty("channel");
    expect(host.get("human-1")).toMatchObject({
      status: "done",
      sessionId: "session-human-1",
      result: { summary: "done", response: "Hello" },
    });
  });

  it("applies human feedback to represented work in the same May owner turn", async () => {
    let ownerCalls = 0;
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      now: () => 200,
      invokeOwner: async ({ requests, onSessionStarted }) => {
        ownerCalls += 1;
        onSessionStarted("session-feedback");
        expect(requests).toHaveLength(1);
        expect(requests[0]?.conversation?.work).toEqual([
          expect.objectContaining({
            requestId: "original-work",
            state: "waiting",
            dependency: { kind: "request", id: "old-child" },
          }),
        ]);
        return [
          {
            requestId: requests[0]!.id,
            disposition: {
              type: "continue",
              requestId: "original-work",
              disposition: {
                type: "complete",
                summary: "Reload no longer needs to wait",
                response: "I closed the stale reload request instead of leaving it waiting.",
              },
            },
          },
        ];
      },
    });
    host.admit({
      id: "original-work",
      appId: "may",
      source: { kind: "human", id: "console:1" },
      input: { kind: "probe", data: { value: "/reload" } },
      conversationId: "may:primary",
      conversationSequence: 1,
      channel: "may-console",
    });
    const original = claimAppInboxItem(db, "original-work", "old-owner", 1_000, 200)!;
    expect(waitAppInboxClaim(db, original, { kind: "app", id: "old-child" }, { now: 200 })).toBe(true);
    host.admit({
      id: "feedback-turn",
      appId: "may",
      source: { kind: "human", id: "console:2" },
      input: { kind: "probe", data: { value: "work 1 should not still be waiting" } },
      conversationId: "may:primary",
      conversationSequence: 2,
      channel: "may-console",
    });

    expect(await host.reconcileOnce("may")).toEqual({
      claimed: 1,
      admitted: 1,
      released: 0,
      errors: [],
      conversationIds: ["may:primary"],
    });
    expect(ownerCalls).toBe(1);
    expect(host.get("original-work")).toMatchObject({
      status: "done",
      result: {
        summary: "Reload no longer needs to wait",
        response: "I closed the stale reload request instead of leaving it waiting.",
      },
    });
    expect(host.get("feedback-turn")).toMatchObject({
      status: "done",
      continuesRequestId: "original-work",
      result: { summary: "Continued request original-work" },
    });
    expect(listAppWork(db, "may", { all: true })).toEqual([
      expect.objectContaining({ requestId: "original-work", state: "done" }),
    ]);
    const conversation = readAppConversationResource(db, "may", "may:primary", { allWork: true });
    expect(conversation.messages.map((message) => message.text)).toEqual([
      "I closed the stale reload request instead of leaving it waiting.",
    ]);
    expect(conversation.messages.some((message) => message.text.includes("Continued request"))).toBe(false);
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
    expect(host.pendingDelegations()).toEqual([
      {
        appId: "child",
        parentId: "parent-1",
        source: { kind: "app", id: "parent" },
        input: { kind: "probe", data: { value: "delegated" } },
        idempotencyKey: "delegate:parent-1:1",
      },
    ]);
    expect(
      host.admit({
        appId: "child",
        parentId: "parent-1",
        source: { kind: "app", id: "parent" },
        input: { kind: "probe", data: { value: "delegated" } },
        originEventId: 73,
        idempotencyKey: "delegate:parent-1:1",
      }),
    ).toMatchObject({ created: false, item: { id: childRow.id, originEventId: 73 } });
    expect(host.pendingDelegations()).toEqual([]);

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
      apps: [app("evaluation", "single", true)],
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

  it("recovers an associated Runtime session as an exact dependency observation", async () => {
    let sessionStatus: "running" | "done" = "running";
    const ownerRequests: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      now: () => 100,
      readDependency: async ({ dependency }) =>
        dependency.id === "session-unknown"
          ? null
          : {
              ...dependency,
              status: sessionStatus,
              summary: sessionStatus === "done" ? "Recovered owner execution completed" : "Owner execution is running",
            },
      invokeOwner: async ({ requests }) => {
        ownerRequests.push(...requests);
        return requests.map((request) => ({
          requestId: request.id,
          disposition: { type: "complete", summary: "recovered session reviewed" },
        }));
      },
    });
    admit(host, "evaluation", "session-recovery");
    const oldClaim = claimAppInboxItem(db, "session-recovery", "old-runtime", 1_000, 100)!;
    expect(associateAppInboxClaimSession(db, oldClaim, "session-exact", 100)).toBe(true);
    admit(host, "evaluation", "unknown-session-recovery");
    const unknownClaim = claimAppInboxItem(db, "unknown-session-recovery", "old-runtime", 1_000, 100)!;
    expect(associateAppInboxClaimSession(db, unknownClaim, "session-unknown", 100)).toBe(true);

    expect(await host.recoverSessionDependencies({ includeAssociatedClaims: true })).toEqual({
      linked: 1,
      woken: 0,
      wokenAppIds: [],
      errors: [],
    });
    expect(host.get("session-recovery")).toMatchObject({
      waitingOn: { kind: "session", id: "session-exact" },
      availableAt: undefined,
      lease: undefined,
    });
    expect(host.get("unknown-session-recovery")).toMatchObject({
      sessionId: "session-unknown",
      waitingOn: undefined,
      lease: { generation: 1, owner: "old-runtime" },
    });
    expect(host.wake({ kind: "session", id: "session-unrelated" })).toBe(0);

    sessionStatus = "done";
    expect(await host.recoverSessionDependencies()).toEqual({
      linked: 0,
      woken: 1,
      wokenAppIds: ["evaluation"],
      errors: [],
    });
    expect(await host.recoverSessionDependencies()).toMatchObject({ woken: 0 });
    expect(await host.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });
    expect(ownerRequests).toMatchObject([
      {
        id: "session-recovery",
        dependency: {
          kind: "session",
          id: "session-exact",
          status: "done",
          summary: "Recovered owner execution completed",
        },
      },
    ]);
  });

  it("rejects task work when the App did not opt into task attachment", async () => {
    const attachments: unknown[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      retryAfterMs: 0,
      now: () => 100,
      attachTask: async (input) => {
        attachments.push(input);
        return { taskId: "must-not-exist" };
      },
      invokeOwner: async ({ requests }) =>
        requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "task",
            task: { kind: "existing", taskId: "legacy-may-task" },
          },
        })),
    });
    admit(host, "may", "may-message");

    const outcome = await host.reconcileOnce("may");

    expect(outcome).toMatchObject({ claimed: 1, admitted: 0, released: 1 });
    expect(outcome.errors).toEqual(["Request may-message: App may does not allow task attachment"]);
    expect(attachments).toEqual([]);
    expect(host.get("may-message")?.status).toBe("pending");
  });

  it("checks task completion after linking the durable wait", async () => {
    let attempts = 0;
    let sawWaitLink = false;
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation", "single", true)],
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

  it("lets only May attach one exact bounded analysis and observe its result", async () => {
    let attempts = 0;
    const attachments: unknown[] = [];
    const requests: AppRequest[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app("may"), app("evaluation")],
      now: () => 100,
      attachAnalysis: async (input) => {
        attachments.push(input);
        return { analysisId: "analysis-exact" };
      },
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: "done",
        summary: "The repository evidence answers the question",
        evidence: ["result.md"],
      }),
      invokeOwner: async ({ app: ownerApp, requests: ownerRequests }) => {
        requests.push(...ownerRequests);
        attempts += 1;
        return ownerRequests.map((request) => ({
          requestId: request.id,
          disposition:
            ownerApp.id === "may" && attempts === 1
              ? {
                  type: "analyze" as const,
                  analysis: { tool: "codex" as const, question: "Inspect this design", timeoutMs: 30_000 },
                }
              : { type: "complete" as const, summary: "reviewed exact analysis" },
        }));
      },
    });
    admit(host, "may", "may-analysis");

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    expect(host.get("may-analysis")?.waitingOn).toEqual({ kind: "analysis", id: "analysis-exact" });
    expect(attachments).toMatchObject([
      {
        appId: "may",
        analysis: { tool: "codex", question: "Inspect this design", timeoutMs: 30_000 },
        idempotencyKey: expect.stringContaining("analysis:may-analysis:root:"),
      },
    ]);

    host.wake({ kind: "analysis", id: "analysis-exact" });
    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    expect(requests[1]).toMatchObject({
      dependency: {
        kind: "analysis",
        id: "analysis-exact",
        status: "done",
        summary: "The repository evidence answers the question",
        evidence: ["result.md"],
      },
    });
    expect(host.get("may-analysis")?.status).toBe("done");
  });

  it("rejects analysis from non-May Apps", async () => {
    const host = new AppInboxHost({
      db,
      apps: [app("evaluation")],
      retryAfterMs: 0,
      attachAnalysis: async () => ({ analysisId: "must-not-run" }),
      invokeOwner: async ({ requests }) =>
        requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "analyze" as const,
            analysis: { tool: "claude" as const, question: "Inspect", timeoutMs: 1_000 },
          },
        })),
    });
    admit(host, "evaluation", "invalid-analysis");

    expect(await host.reconcileOnce("evaluation")).toMatchObject({
      admitted: 0,
      released: 1,
      errors: ["Request invalid-analysis: Only the canonical May App may request bounded analysis"],
    });
  });

  it("stages human analysis acknowledgement only after the exact wait is durable", async () => {
    let sawLinkedWait = false;
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      now: () => 100,
      attachAnalysis: async () => ({ analysisId: "analysis-human" }),
      invokeOwner: async ({ requests, onSessionStarted }) => {
        onSessionStarted("session-human-analysis");
        return requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "analyze" as const,
            analysis: { tool: "codex" as const, question: "Review", timeoutMs: 1_000 },
            acknowledgement: "I’ll review this and return with the evidence.",
          },
        }));
      },
    });
    host.admit({
      id: "human-analysis",
      appId: "may",
      source: { kind: "human", id: "telegram:123:42" },
      input: { kind: "probe", data: { value: "review" } },
      conversationId: "telegram:123",
      conversationSequence: 42,
      channel: "telegram",
      channelMessageId: 42,
    });

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    const item = host.get("human-analysis")!;
    sawLinkedWait = item.waitingOn?.kind === "analysis" && item.waitingOn.id === "analysis-human";
    expect(sawLinkedWait).toBe(true);
    expect(listAppInboxDeliveries(db, item.id)).toMatchObject([
      {
        kind: "progress",
        status: "pending",
        text: "I’ll review this and return with the evidence.",
        sessionId: "session-human-analysis",
      },
    ]);
    const delivery = host.claimDelivery()!;
    expect(delivery.text).toBe("I’ll review this and return with the evidence.");
    expect(
      host.recordDelivery({
        operationId: delivery.delivery.operationId,
        itemId: item.id,
        sessionId: delivery.delivery.sessionId,
        requestId: delivery.delivery.requestId,
        channel: "telegram",
        status: "delivered",
      }),
    ).toEqual({ matched: true, completed: false, status: "delivered" });
    expect(host.get(item.id)).toMatchObject({
      status: "handling",
      waitingOn: { kind: "analysis", id: "analysis-human" },
    });
  });

  it("wakes an analysis that completes before or while its exact wait is linked", async () => {
    let attempts = 0;
    let linked = false;
    const host = new AppInboxHost({
      db,
      apps: [app("may")],
      now: () => 100,
      attachAnalysis: async () => ({
        analysisId: "analysis-fast",
        isComplete: async () => {
          const row = db
            .prepare("SELECT waiting_on_kind, waiting_on_id FROM app_inbox_items WHERE id = ?")
            .get("fast-analysis") as { waiting_on_kind: string | null; waiting_on_id: string | null };
          linked = row.waiting_on_kind === "analysis" && row.waiting_on_id === "analysis-fast";
          return true;
        },
      }),
      readDependency: async ({ dependency }) => ({ ...dependency, status: "done" }),
      invokeOwner: async ({ requests }) => {
        attempts += 1;
        return requests.map((request) => ({
          requestId: request.id,
          disposition:
            attempts === 1
              ? {
                  type: "analyze" as const,
                  analysis: { tool: "codex" as const, question: "Fast", timeoutMs: 1_000 },
                }
              : { type: "complete" as const, summary: "fast analysis observed" },
        }));
      },
    });
    admit(host, "may", "fast-analysis");

    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    expect(linked).toBe(true);
    expect(host.get("fast-analysis")?.availableAt).toBe(100);
    expect(await host.reconcileOnce("may")).toMatchObject({ admitted: 1 });
    expect(host.get("fast-analysis")?.status).toBe("done");
  });

  it("re-observes terminal analysis waits after restart", async () => {
    let terminal = false;
    const first = new AppInboxHost({
      db,
      apps: [app("may")],
      now: () => 100,
      attachAnalysis: async () => ({ analysisId: "analysis-offline" }),
      invokeOwner: async ({ requests }) =>
        requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "analyze" as const,
            analysis: { tool: "codex" as const, question: "Offline", timeoutMs: 1_000 },
          },
        })),
    });
    admit(first, "may", "offline-analysis");
    expect(await first.reconcileOnce("may")).toMatchObject({ admitted: 1 });

    const recovered = new AppInboxHost({
      db,
      apps: [app("may")],
      now: () => 200,
      readDependency: async ({ dependency }) => ({ ...dependency, status: terminal ? "done" : "running" }),
      invokeOwner: async () => [],
    });
    expect(await recovered.recoverAnalysisDependencies()).toMatchObject({ woken: 0 });
    terminal = true;
    expect(await recovered.recoverAnalysisDependencies()).toEqual({
      linked: 0,
      woken: 1,
      wokenAppIds: ["may"],
      errors: [],
    });
  });

  it("re-observes task attention after restart instead of leaving the request waiting", async () => {
    const first = new AppInboxHost({
      db,
      apps: [app("evaluation", "single", true)],
      now: () => 100,
      attachTask: async () => ({ taskId: "task-needs-review" }),
      invokeOwner: async ({ requests }) =>
        requests.map((request) => ({
          requestId: request.id,
          disposition: {
            type: "task" as const,
            task: { kind: "existing" as const, taskId: "task-needs-review" },
          },
        })),
    });
    admit(first, "evaluation", "waiting-task-request");
    expect(await first.reconcileOnce("evaluation")).toMatchObject({ admitted: 1 });

    const recovered = new AppInboxHost({
      db,
      apps: [app("evaluation", "single", true)],
      now: () => 200,
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: "attention",
        summary: "Resolved owner is not runnable",
      }),
      invokeOwner: async () => [],
    });
    expect(await recovered.recoverTaskDependencies()).toEqual({
      linked: 0,
      woken: 1,
      wokenAppIds: ["evaluation"],
      errors: [],
    });
    expect(recovered.get("waiting-task-request")).toMatchObject({ availableAt: 200 });
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
