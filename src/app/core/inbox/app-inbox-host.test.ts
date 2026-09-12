import { createAppInboxItem } from "../state/app-inbox-store.js";
import { fakeTaskAttacher } from "../../../../test/fixtures/task-attachment.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Type, defineApp, type AppDefinition, type AppInputContext, type AppTaskAttachment } from "@may-agent/sdk";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
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

  it("uses the exact target and passes immutable typed input with human origin", () => {
    let received: Readonly<AppInputContext> | undefined;
    const host = new AppInboxHost({
      db,
      apps: [
        {
          ...app(),
          task: () => {
            throw new Error("exact target bypasses mapping");
          },
        },
      ],
      attachTask: fakeTaskAttacher(db, ({ attachment, inputContext }) => {
        expect(attachment).toEqual({ kind: "existing", taskId: "existing" });
        received = inputContext;
        return { taskId: "existing" };
      }),
    });
    host.admit({
      id: "feedback",
      appId: "evaluation",
      targetTaskId: "existing",
      source: { kind: "human", id: "operator" },
      input: { kind: "probe", data: { value: "correction" } },
    });
    expect(received).toMatchObject({ id: "feedback", humanRequested: true });
    expect(Object.isFrozen(received?.input.data)).toBe(true);
  });

  it("contains mapping failure, admits unrelated input, and retries the saved input after repair", async () => {
    const failures: unknown[] = [];
    let repaired = false;
    let failedMappings = 0;
    const host = new AppInboxHost({
      db,
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
    await host.recoverAdmissions();
    expect(host.get("broken")?.waitingOn?.id).toBe("probe/broken");
    expect(failedMappings).toBe(2);
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
    const failures: unknown[] = [];
    const host = new AppInboxHost({
      db,
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
      });
    createAppInboxItem(db, {
      id: "z-ready",
      appId: "evaluation",
      source: { kind: "system", id: "fixture" },
      input: { kind: "probe", data: { value: "ready" } },
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
