import { createAppInboxItem } from "../state/app-inbox-store.js";
import { fakeTaskAttacher } from "../../../../test/fixtures/task-attachment.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Type, defineApp, type AppDefinition, type AppInputContext, type AppTaskAttachment } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { conversationTaskSuccessorId } from "../state/conversation-identity.js";
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

  it("accepting a schema requires a declared handler for that input kind", () => {
    const input = { kind: "probe", data: { value: "work" } };
    for (const tasks of [undefined, {}]) {
      const host = new AppInboxHost({ db, apps: [{ ...app(), task: undefined, tasks }] });
      expect(() => host.assertAcceptsInput("evaluation", input)).toThrow(
        "App evaluation has no handler for input kind probe",
      );
    }
    const host = new AppInboxHost({ db, apps: [app()] });
    expect(() => host.assertAcceptsInput("missing", input)).toThrow("Unknown App: missing");
    expect(() => host.assertAcceptsInput("evaluation", input)).not.toThrow();
    expect(() => host.assertAcceptsInput("evaluation", { kind: "probe", data: { value: 1 } })).toThrow(
      "/data/value: must be string",
    );
    const conversation = new AppInboxHost({
      db,
      apps: [{ ...app(), task: undefined, conversation: { mode: "agent", inputKinds: ["probe"] } }],
    });
    expect(() => conversation.assertAcceptsInput("evaluation", input)).not.toThrow();
    conversation.replaceApps([{ ...app(), task: undefined, conversation: { mode: "agent", inputKinds: ["message"] } }]);
    expect(() => conversation.assertAcceptsInput("evaluation", input)).toThrow(
      "App evaluation has no handler for input kind probe",
    );
  });

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
    expect(() => host.invokeAction("evaluation", "probe", { value: "" })).toThrow(
      "Invalid input for evaluation.probe at /value: must not have fewer than 1 characters",
    );
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

  it("admits directly, preserves identity, and never remaps an attached input on reload", async () => {
    const attachments: AppTaskAttachment[] = [];
    let mappings = 0;
    const initial = defineApp({
      ...app(),
      task: (input) => {
        mappings++;
        return desiredTask(input.id);
      },
    });
    const host = new AppInboxHost({
      db,
      apps: [initial],
      attachTask: fakeTaskAttacher(db, ({ attachment }) => {
        attachments.push(attachment);
        return { taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id };
      }),
    });
    expect(admit(host, "one")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "probe/one" },
      taskAdmissionKey: "task:one",
    });
    expect(host.get("one")?.lease).toBeUndefined();
    host.replaceApps([
      {
        ...initial,
        task: () => {
          throw new Error("must not remap");
        },
      },
    ]);
    admit(host, "one");
    await host.recoverAdmissions();
    await host.recoverTaskResults();
    expect(mappings).toBe(1);
    expect(attachments).toHaveLength(1);
    expect(() =>
      host.admit({
        id: "one",
        appId: "evaluation",
        source: { kind: "system", id: "test" },
        input: { kind: "probe", data: { value: "changed" } },
      }),
    ).toThrow("different input");
  });

  it("uses the exact target before Conversation routing and recovers that same attachment", async () => {
    let received: Readonly<AppInputContext> | undefined;
    let available = false;
    let now = 1_000;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [
        {
          ...app(),
          conversation: { mode: "agent", inputKinds: ["probe"] },
          task: () => {
            throw new Error("exact target bypasses mapping");
          },
        },
      ],
      admitConversation: () => {
        throw new Error("explicit Task input must not enter Conversation");
      },
      attachTask: fakeTaskAttacher(db, ({ attachment, inputContext }) => {
        if (!available) throw new Error("temporarily unavailable");
        expect(attachment).toEqual({ kind: "existing", taskId: "existing" });
        received = inputContext;
        return { taskId: "existing" };
      }),
    });
    host.admit({
      id: "feedback",
      appId: "evaluation",
      targetTaskId: "  existing  ",
      source: { kind: "human", id: "operator" },
      input: { kind: "probe", data: { value: "correction" } },
    });
    expect(host.get("feedback")).toMatchObject({ status: "pending", targetTaskId: "existing" });
    available = true;
    now = 1_250;
    await host.recoverAdmissions();
    expect(host.get("feedback")?.waitingOn).toEqual({ kind: "task", id: "existing" });
    expect(received).toMatchObject({ id: "feedback", humanRequested: true });
    expect(Object.isFrozen(received?.input.data)).toBe(true);
  });

  it("does not admit a Conversation executor target without Conversation identity", () => {
    const executionTaskId = conversationTaskSuccessorId("evaluation", "primary", 2);
    const original = createAppInboxItem(db, {
      id: "original-turn",
      appId: "evaluation",
      conversationId: "primary",
      conversationSequence: 1,
      source: { kind: "human", id: "original-message" },
      input: { kind: "probe", data: { value: "original" } },
      now: 1,
    });
    db.prepare("UPDATE app_inbox_items SET execution_task_id = ? WHERE id = ?").run(executionTaskId, original.item.id);
    const routed: Array<Record<string, unknown>> = [];
    const host = new AppInboxHost({
      db,
      apps: [{ ...app(), conversation: { mode: "agent", inputKinds: ["probe"] } }],
      admitConversation: (input) => {
        routed.push(input);
        return createAppInboxItem(db, input);
      },
      attachTask: fakeTaskAttacher(db),
    });

    expect(() =>
      host.admit({
        id: "malformed-feedback",
        appId: "evaluation",
        parentId: "caller-request",
        targetTaskId: `  ${executionTaskId}\t`,
        source: { kind: "app", id: "caller" },
        input: { kind: "probe", data: { value: "feedback" } },
        idempotencyKey: "feedback:malformed",
      }),
    ).toThrow("Conversation Task input must use conversationId without targetTaskId");
    expect(host.get("malformed-feedback")).toBeNull();
    expect(() =>
      host.admit({
        id: "stale-target-feedback",
        appId: "evaluation",
        parentId: "caller-request",
        targetTaskId: executionTaskId,
        conversationId: "primary",
        source: { kind: "app", id: "caller" },
        input: { kind: "probe", data: { value: "feedback" } },
        idempotencyKey: "feedback:stale-target",
      }),
    ).toThrow("Conversation Task input must use conversationId without targetTaskId");
    expect(host.get("stale-target-feedback")).toBeNull();
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items").get()).toEqual({ count: 1 });
    expect(routed).toHaveLength(0);

    const untargeted = host.admit({
      id: "conversation-message",
      appId: "evaluation",
      parentId: "caller-request",
      conversationId: "primary",
      source: { kind: "app", id: "caller" },
      input: { kind: "probe", data: { value: "new message" } },
      idempotencyKey: "message:new",
    });
    expect(untargeted.item).toMatchObject({
      id: "conversation-message",
      parentId: "caller-request",
      conversationId: "primary",
      source: { kind: "app", id: "caller" },
    });
    expect(routed).toHaveLength(1);
  });

  it("contains mapping failure, admits unrelated input, and retries the saved input after repair", async () => {
    const failures: unknown[] = [];
    let repaired = false;
    let failedMappings = 0;
    let now = 1_000;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [
        {
          ...app(),
          task: (input) => {
            if (input.id === "broken") {
              failedMappings++;
              if (!repaired) throw new Error("App mapping unavailable");
            }
            return desiredTask(input.id);
          },
        },
      ],
      attachTask: fakeTaskAttacher(db, ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      })),
      onFailure: (failure) => {
        failures.push(failure);
        throw new Error("diagnostic failed too");
      },
    });
    expect(admit(host, "broken").status).toBe("pending");
    expect(admit(host, "unrelated").waitingOn?.id).toBe("probe/unrelated");
    expect(failedMappings).toBe(1);
    expect(failures).toMatchObject([{ stage: "input-admission", error: "App mapping unavailable" }]);
    repaired = true;
    now = 1_250;
    await host.recoverAdmissions();
    expect(host.get("broken")?.waitingOn?.id).toBe("probe/broken");
    expect(failedMappings).toBe(2);
  });

  it("returns pre-Task admission failure to the exact App caller and replays lost publication", async () => {
    let now = 1_000;
    let repaired = false;
    let answerAvailable = false;
    let loseFirstPublication = true;
    const notifications: Array<{ status: "done" | "blocked"; summary: string }> = [];
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [app()],
      attachTask: fakeTaskAttacher(db, () => {
        if (!repaired) throw new Error("mapping service unavailable");
        return { taskId: "probe/caller-recovery" };
      }),
      readDependency: async ({ dependency }) => ({
        ...dependency,
        status: answerAvailable ? "done" : "pending",
        summary: answerAvailable ? "Recovered exact answer" : "Still working",
        ...(answerAvailable ? { result: { value: 42 } } : {}),
      }),
      onRequestUpdated: (_item, result, status) => {
        notifications.push({ status, summary: result.summary });
        if (status === "blocked" && loseFirstPublication) {
          loseFirstPublication = false;
          throw new Error("synthetic lost publication");
        }
        return true;
      },
    });

    const item = host.admit({
      id: "caller-recovery",
      appId: "evaluation",
      source: { kind: "app", id: "may" },
      input: { kind: "probe", data: { value: "caller-recovery" } },
    }).item;
    expect(item).toMatchObject({
      id: "caller-recovery",
      status: "pending",
      recovery: { "input-admission": { failures: 1, retryAt: 1_250 } },
    });
    expect(notifications).toEqual([
      { status: "blocked", summary: expect.stringContaining("mapping service unavailable") },
    ]);
    expect(host.get(item.id)?.recovery?.["input-admission"]?.reportedAt).toBeUndefined();

    now = 1_250;
    await host.recoverAdmissions();
    expect(notifications).toHaveLength(2);
    expect(notifications[1]).toEqual({
      status: "blocked",
      summary: expect.stringContaining("mapping service unavailable"),
    });
    expect(host.get(item.id)).toMatchObject({
      recovery: { "input-admission": { failures: 2, firstFailedAt: 1_000, reportedAt: 1_250, retryAt: 1_750 } },
    });

    now = 1_750;
    await host.recoverAdmissions();
    expect(notifications).toHaveLength(2);
    const retryAt = host.get(item.id)!.recovery!["input-admission"]!.retryAt;
    repaired = true;
    now = retryAt;
    await host.recoverAdmissions();
    expect(host.get(item.id)).toMatchObject({
      id: "caller-recovery",
      status: "handling",
      waitingOn: { kind: "task", id: "probe/caller-recovery" },
      taskAdmissionKey: "task:caller-recovery",
      recovery: { "input-admission": { failures: 3, reportedAt: 1_250, recoveredAt: retryAt } },
    });

    answerAvailable = true;
    await host.refreshTaskResults("evaluation", "probe/caller-recovery");
    expect(host.get(item.id)).toMatchObject({
      id: "caller-recovery",
      status: "done",
      result: { summary: "Recovered exact answer", result: { value: 42 } },
    });
    expect(notifications.at(-1)).toEqual({ status: "done", summary: "Recovered exact answer" });
  });

  it("paces failed admission at the row boundary while unrelated input and same-input repair continue", async () => {
    let now = 1_000;
    let repaired = false;
    let brokenMappings = 0;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [
        {
          ...app(),
          task: (input) => {
            if (input.id === "paced-admission") {
              brokenMappings++;
              if (!repaired) throw new Error("mapping temporarily unavailable");
            }
            return desiredTask(input.id);
          },
        },
      ],
      attachTask: fakeTaskAttacher(db, ({ attachment }) => ({
        taskId: attachment.kind === "existing" ? attachment.taskId : attachment.intent.id,
      })),
    });

    expect(admit(host, "paced-admission")).toMatchObject({
      status: "pending",
      availableAt: 1_250,
      recovery: {
        "input-admission": {
          failures: 1,
          error: "mapping temporarily unavailable",
          firstFailedAt: 1_000,
          lastFailedAt: 1_000,
          retryAt: 1_250,
        },
      },
    });
    expect(admit(host, "paced-admission").status).toBe("pending");
    await host.recoverAdmissions();
    expect(brokenMappings).toBe(1);

    expect(admit(host, "unrelated-during-admission-retry").waitingOn?.id).toBe(
      "probe/unrelated-during-admission-retry",
    );
    now = 1_250;
    await host.recoverAdmissions();
    expect(brokenMappings).toBe(2);
    expect(host.get("paced-admission")).toMatchObject({
      availableAt: 1_750,
      recovery: { "input-admission": { failures: 2, firstFailedAt: 1_000, retryAt: 1_750 } },
    });

    repaired = true;
    await host.recoverAdmissions();
    expect(brokenMappings).toBe(2);
    now = 1_750;
    await host.recoverAdmissions();
    expect(brokenMappings).toBe(3);
    expect(host.get("paced-admission")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "probe/paced-admission" },
      taskAdmissionKey: "task:paced-admission",
      recovery: { "input-admission": { failures: 2, recoveredAt: 1_750 } },
    });
    expect(host.get("unrelated-during-admission-retry")?.status).toBe("handling");
  });

  it("paces failed exact-result projection without replacing the saved link or unrelated results", async () => {
    let now = 2_000;
    let reads = 0;
    let projectionState: "throw" | "missing" | "done" = "throw";
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [app()],
      attachTask: fakeTaskAttacher(db, ({ inputContext }) => ({ taskId: `work/${inputContext.id}` })),
      readDependency: async ({ dependency, admissionKey }) => {
        if (dependency.id === "work/paced-result") {
          reads++;
          if (projectionState === "throw") throw new Error("result store temporarily unavailable");
          if (projectionState === "missing") return null;
        }
        return { ...dependency, status: "done", summary: `answer for ${admissionKey}` };
      },
    });
    admit(host, "paced-result");
    admit(host, "unrelated-result");

    await host.refreshTaskResults("evaluation", "work/paced-result");
    expect(host.get("paced-result")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "work/paced-result" },
      taskAdmissionKey: "task:paced-result",
      reviewAt: 2_250,
      recovery: {
        "input-result": {
          failures: 1,
          error: "result store temporarily unavailable",
          firstFailedAt: 2_000,
          retryAt: 2_250,
        },
      },
    });
    await host.refreshTaskResults("evaluation", "work/paced-result");
    await host.recoverTaskResults();
    expect(reads).toBe(2);
    expect(host.get("paced-result")?.recovery?.["input-result"]?.failures).toBe(1);
    expect(host.get("unrelated-result")?.result?.summary).toBe("answer for task:unrelated-result");

    projectionState = "missing";
    await host.recoverTaskResults();
    expect(reads).toBe(2);
    now = 2_250;
    await host.refreshTaskResults("evaluation", "work/paced-result");
    expect(reads).toBe(3);
    expect(host.get("paced-result")).toMatchObject({
      status: "handling",
      reviewAt: 2_750,
      recovery: {
        "input-result": {
          failures: 2,
          error: "Task dependency evidence is unavailable",
          firstFailedAt: 2_000,
          retryAt: 2_750,
        },
      },
    });
    await host.recoverTaskResults();
    expect(reads).toBe(3);

    projectionState = "done";
    now = 2_251;
    await host.refreshTaskResults("evaluation", "work/paced-result");
    expect(reads).toBe(4);
    expect(host.get("paced-result")).toMatchObject({
      status: "done",
      result: { summary: "answer for task:paced-result" },
      waitingOn: { kind: "task", id: "work/paced-result" },
      taskAdmissionKey: "task:paced-result",
      recovery: { "input-result": { failures: 2, recoveredAt: 2_251 } },
    });
  });

  it("keeps consecutive pacing until a pending report is actually delivered", async () => {
    let now = 3_000;
    let reads = 0;
    let deliveryAvailable = false;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [app()],
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "reported-work" })),
      readDependency: async ({ dependency }) => {
        reads++;
        return {
          ...dependency,
          status: "pending",
          report: { summary: "Worker is waiting on a legitimate dependency", facts: ["wait:valid"] },
        };
      },
      onRequestUpdated: (_item, _result, status) => {
        expect(status).toBe("blocked");
        if (!deliveryAvailable) throw new Error("caller feedback temporarily unavailable");
      },
    });
    admit(host, "paced-report");

    await host.refreshTaskResults("evaluation", "reported-work");
    expect(host.get("paced-report")).toMatchObject({
      status: "handling",
      reviewAt: 3_250,
      recovery: { "input-result": { failures: 1, firstFailedAt: 3_000, retryAt: 3_250 } },
    });
    await host.refreshTaskResults("evaluation", "reported-work");
    expect(reads).toBe(2);
    expect(host.get("paced-report")?.recovery?.["input-result"]?.failures).toBe(1);

    now = 3_250;
    await host.refreshTaskResults("evaluation", "reported-work");
    expect(host.get("paced-report")).toMatchObject({
      status: "handling",
      reviewAt: 3_750,
      recovery: { "input-result": { failures: 2, firstFailedAt: 3_000, retryAt: 3_750 } },
    });
    expect(reads).toBe(3);

    deliveryAvailable = true;
    now = 3_750;
    await host.refreshTaskResults("evaluation", "reported-work");
    expect(reads).toBe(4);
    expect(host.get("paced-report")).toMatchObject({
      status: "handling",
      waitingOn: { kind: "task", id: "reported-work" },
      recovery: { "input-result": { failures: 2, firstFailedAt: 3_000, recoveredAt: 3_750 } },
    });
  });

  it("considers fresh exact evidence promptly while pacing an unchanged failed report delivery", async () => {
    let now = 4_000;
    let answerAvailable = false;
    let reads = 0;
    let deliveries = 0;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [app()],
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "fresh-work" })),
      readDependency: async ({ dependency }) => {
        reads++;
        return answerAvailable
          ? { ...dependency, status: "done", summary: "Fresh exact answer", result: { value: 42 } }
          : {
              ...dependency,
              status: "pending",
              report: { attemptId: "r_report", summary: "Useful unchanged report" },
            };
      },
      onRequestUpdated: (_item, _result, status) => {
        deliveries++;
        if (status === "blocked") throw new Error("old report delivery failed");
      },
    });
    admit(host, "fresh-answer");

    await host.refreshTaskResults("evaluation", "fresh-work");
    expect(host.get("fresh-answer")?.reviewAt).toBe(4_250);
    expect(deliveries).toBe(1);

    now++;
    await host.refreshTaskResults("evaluation", "fresh-work");
    expect(host.get("fresh-answer")?.status).toBe("handling");
    expect(deliveries).toBe(1);

    answerAvailable = true;
    now++;
    await host.refreshTaskResults("evaluation", "fresh-work");
    expect(host.get("fresh-answer")).toMatchObject({
      status: "done",
      result: { summary: "Fresh exact answer", result: { value: 42 } },
      recovery: { "input-result": { failures: 1, recoveredAt: 4_002 } },
    });
    expect(deliveries).toBe(2);
    expect(reads).toBe(3);
  });

  it("projects exact answers once and scopes result notifications by App", async () => {
    let done = false;
    const completed: string[] = [];
    const host = new AppInboxHost({
      db,
      apps: [app(), app("other")],
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "shared-id" })),
      readDependency: async ({ dependency, admissionKey }) => {
        expect(admissionKey).toMatch(/^task:/);
        return { ...dependency, status: done ? "done" : "pending", summary: "Exact answer", response: admissionKey };
      },
      onRequestUpdated: (item) => {
        completed.push(item.id);
      },
    });
    admit(host, "first");
    admit(host, "second", "other");
    await host.refreshTaskResults("evaluation", "shared-id");
    expect(host.get("first")?.status).toBe("handling");
    done = true;
    await Promise.all([
      host.refreshTaskResults("evaluation", "shared-id"),
      host.refreshTaskResults("evaluation", "shared-id"),
    ]);
    expect(host.get("first")?.result).toMatchObject({ response: "task:first" });
    expect(host.get("second")?.status).toBe("handling");
    expect(completed).toEqual(["first"]);
    await host.recoverTaskResults();
    expect(completed).toEqual(["first", "second"]);
  });

  it("keeps an accepted answer when notification fails and rejects mismatched observations", async () => {
    let mismatch = true;
    let now = 1_000;
    const failures: unknown[] = [];
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [app()],
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "work" })),
      readDependency: async () => ({
        kind: "task",
        id: mismatch ? "wrong" : "work",
        status: "done",
        summary: "Verified",
      }),
      onRequestUpdated: () => {
        throw new Error("notification lost");
      },
      onFailure: (failure) => failures.push(failure),
    });
    admit(host, "one");
    await host.recoverTaskResults();
    expect(host.get("one")?.status).toBe("handling");
    expect(failures).toHaveLength(1);
    mismatch = false;
    now = 1_250;
    await host.recoverTaskResults();
    expect(host.get("one")?.result?.summary).toBe("Verified");
  });

  it("retires an expired ordinary projection claim without remapping its Task", async () => {
    let now = 100;
    let mappings = 0;
    const host = new AppInboxHost({
      db,
      now: () => now,
      apps: [
        {
          ...app(),
          task: (input) => {
            mappings++;
            return desiredTask(input.id);
          },
        },
      ],
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "work" })),
      readDependency: async ({ dependency }) => ({ ...dependency, status: "done", summary: "Verified" }),
    });
    admit(host, "old-projection");
    db.prepare(
      "UPDATE app_inbox_items SET lease_owner = 'old-host', lease_generation = 7, lease_expires_at = 150 WHERE id = ?",
    ).run("old-projection");
    await host.recoverAdmissions();
    await host.recoverTaskResults();
    expect(host.get("old-projection")?.lease?.owner).toBe("old-host");
    now = 200;
    await host.recoverAdmissions();
    await host.recoverTaskResults();
    expect(host.get("old-projection")?.status).toBe("done");
    expect(host.get("old-projection")?.lease).toBeUndefined();
    expect(mappings).toBe(1);
  });

  it("does not remove an App while it owns unfinished inputs", () => {
    const host = new AppInboxHost({ db, apps: [app()] });
    admit(host, "one");
    expect(() => host.replaceApps([])).toThrow("unfinished inbox items");
  });
});

it("recovery advances past a page of disabled Apps without claiming input", async () => {
  const db = openDatabase(":memory:");
  applyDbSchema(db);
  try {
    for (let n = 0; n < 70; n++)
      createAppInboxItem(db, {
        id: `disabled-${n}`,
        appId: "disabled",
        source: { kind: "system", id: "fixture" },
        input: { kind: "probe", data: { value: "old" } },
        now: 1,
      });
    createAppInboxItem(db, {
      id: "z-ready",
      appId: "evaluation",
      source: { kind: "system", id: "fixture" },
      input: { kind: "probe", data: { value: "ready" } },
      now: 1,
    });
    const host = new AppInboxHost({
      db,
      apps: [app()],
      now: () => 1,
      attachTask: fakeTaskAttacher(db, () => ({ taskId: "ready" })),
    });
    await host.recoverAdmissions();
    expect(host.get("z-ready")?.status).toBe("pending");
    await host.recoverAdmissions();
    expect(host.get("z-ready")?.waitingOn?.id).toBe("ready");
    expect(db.prepare("SELECT COUNT(*) AS count FROM app_inbox_items WHERE lease_owner IS NOT NULL").get()).toEqual({
      count: 0,
    });
    host.close();
    db.close();
    await host.recoverAdmissions();
    await host.recoverTaskResults();
  } finally {
    db.close();
  }
});
