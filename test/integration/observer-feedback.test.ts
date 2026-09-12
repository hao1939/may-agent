import { expect, it } from "bun:test";
import type { AppDefinition, AppObserver, TaskReconcileResult } from "@may-agent/sdk";
import { observerFeedbackFixture } from "../fixtures/observer-feedback.js";
import { readHostHealth } from "../../src/app/adapters/reporting/host-health.js";

const app: AppDefinition = { id: "sample", version: 1, agent: "worker", inputSchema: { type: "object" }, tasks: {} };
const observer: AppObserver = {
  id: "provider",
  intervalMs: 100,
  async run({ previousObservation }) {
    return {
      events: previousObservation
        ? []
        : [
            {
              type: "provider.observed",
              target: { appId: "sample", taskId: "work/42" },
              data: { revision: "r1", facts: ["https://example.org/pull/42"] },
            },
          ],
      nextObservation: "r1",
    };
  },
};

it("the reusable observer fixture rejects absent health reporting and accepts an explicit reader", async () => {
  const f = await observerFeedbackFixture(app, {
    id: "health",
    intervalMs: 100,
    async run(ctx) {
      return [{ type: "sample.health.observed", data: await ctx.read.hostHealth() }];
    },
  });
  try {
    await f.scan();
    const failure = f.db.prepare("SELECT data FROM events WHERE event_type = 'app.observer.failed'").get() as {
      data: string;
    };
    expect(JSON.parse(failure.data).error).toBe("Host health reporting is not installed");
    expect(
      f.db.prepare("SELECT count(*) AS count FROM events WHERE event_type = 'sample.health.observed'").get(),
    ).toEqual({ count: 0 });
    f.read.hostHealth = async (options) => readHostHealth(f.db, options);
    await f.scan();
    expect(
      f.db.prepare("SELECT count(*) AS count FROM events WHERE event_type = 'sample.health.observed'").get(),
    ).toEqual({ count: 1 });
  } finally {
    await f.close();
  }
});

it("recovers persisted-but-unadmitted observer input on its original event and exact Task", async () => {
  const f = await observerFeedbackFixture(app, observer);
  try {
    f.createTask("work/42");
    f.createTask("unrelated");
    f.admissionUnavailable(true);
    await f.scan();
    const row = f.db.prepare("SELECT id, delivery_status FROM events WHERE event_type = 'provider.observed'").get() as {
      id: number;
      delivery_status: string;
    };
    expect(row.id).toBeGreaterThan(0);
    expect(row.delivery_status).not.toBe("accepted");
    expect(f.snapshot().taskTriggers?.["work/42"]).toBeUndefined();
    f.admissionUnavailable(false);
    await f.scan(); // Snapshot advanced on persistence: observer does not duplicate it.
    expect(f.db.prepare("SELECT count(*) AS count FROM events WHERE event_type = 'provider.observed'").get()).toEqual({
      count: 1,
    });
    await f.inbox.reload(); // Existing frozen-plan recovery, no alternate retry route.
    const deadline = Date.now() + 2000;
    while (
      Date.now() < deadline &&
      (f.db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(row.id) as { delivery_status: string })
        .delivery_status !== "accepted"
    )
      await Bun.sleep(5);
    expect(f.db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(row.id)).toEqual({
      delivery_status: "accepted",
    });
    await f.runTask("work/42");
    expect(f.attempts.map((attempt) => attempt.task.id)).toEqual(["work/42"]);
    expect(f.attempts[0]!.events.items.map((item) => item.eventId)).toEqual([row.id]);
    expect(f.attempts[0]!.events.items[0]!.event.data).toMatchObject({ facts: ["https://example.org/pull/42"] });
  } finally {
    await f.close();
  }
});

it("retains a new observer revision for a busy Task instead of starting a second attempt", async () => {
  let revision = "r1";
  const f = await observerFeedbackFixture(app, {
    ...observer,
    async run({ previousObservation }) {
      return {
        events:
          previousObservation === revision
            ? []
            : [{ type: "provider.observed", target: { appId: "sample", taskId: "work/42" }, data: { revision } }],
        nextObservation: revision,
      };
    },
  });
  const started = Promise.withResolvers<void>(),
    finish = Promise.withResolvers<TaskReconcileResult>();
  try {
    f.createTask("work/42");
    await f.scan();
    f.executeWith(async () => {
      started.resolve();
      return finish.promise;
    });
    const active = f.runTask("work/42");
    await started.promise;
    revision = "r2";
    await f.scan();
    await f.runTask("work/42");
    expect(f.attempts).toHaveLength(1);
    finish.resolve({ state: "converged", summary: "Reviewed first revision", facts: ["fixture:r1"] });
    await active;
    await f.runTask("work/42");
    expect(f.attempts).toHaveLength(2);
    expect(f.attempts[1]!.events.items.map((item) => item.event.data.revision)).toEqual(["r2"]);
    expect(Object.keys(f.snapshot().resources ?? {})).toEqual(["work/42"]);
  } finally {
    finish.resolve({ state: "converged", summary: "Fixture teardown", facts: [] });
    await f.close();
  }
});
