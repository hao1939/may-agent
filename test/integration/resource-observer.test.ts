import { afterEach, expect, test } from "bun:test";
import { fixture, until } from "../fixtures/resource-observer.js";
import { defineObserver } from "@may-agent/sdk";
import { recordAppTaskTrigger } from "../../src/app/core/tasks/app-task-reconciler.js";

function buildDetector(read: (resource: string, signal: AbortSignal) => Promise<{ state: string; revision: number }>) {
  return defineObserver({
    id: "build-status",
    type: "build.state",
    description: "Read build state and revision",
    intervalMs: 60_000,
    timeoutMs: 100,
    inspect: (resource, { signal }) => read(resource, signal),
  });
}

const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.close();
});
const terminal = { field: "state", anyOf: ["passed", "failed", "cancelled"] };
async function setup(read: Parameters<typeof buildDetector>[0]) {
  const f = await fixture(buildDetector(read));
  fixtures.push(f);
  return f;
}

test("one source read serves two Apps; quiet polls use no Task attempts; unrelated wait/output survive", async () => {
  let state = "running",
    reads = 0;
  const f = await setup(async () => {
    reads++;
    return { state, revision: state === "running" ? 1 : 2 };
  });
  const wait = f.capability.waitFor("build", "acme/widget/42", terminal);
  const approval = {
    id: "approval",
    type: "human.decision",
    subject: "approval:v1",
    expected: { field: "decision", equals: "approve" },
    owner: "human:operator",
    reviewAfterMs: 3_600_000,
  };
  f.add("a", [wait, approval]);
  f.add("b", [wait], "peer");
  await f.scan();
  expect(reads).toBe(1);
  expect(f.runnable()).toEqual([]);
  expect(f.runnable("peer")).toEqual([]);
  for (let i = 0; i < 4; i++) await f.scan();
  expect(reads).toBe(5);
  expect(f.events()).toHaveLength(1);
  expect((f.db.prepare("SELECT count(*) AS n FROM app_task_attempts").get() as { n: number }).n).toBe(2);
  state = "failed";
  await f.scan();
  expect(reads).toBe(6);
  expect(f.runnable()).toEqual(["a"]);
  expect(f.runnable("peer")).toEqual(["b"]);
  expect(f.view("a").result).toEqual({ prepared: true });
  expect(f.view("a").conditions.find((c) => c.id === "approval")?.observation?.state).toBe("unknown");
  const claim = f.claim("a");
  expect(claim.events.at(-1)?.event.data).toMatchObject({ resource: "acme/widget/42", state: "failed" });
  f.defer(claim);
  expect(f.view("a").conditions.map((c) => c.id)).toEqual(["approval"]);
  f.complete("b", "peer");
  await f.scan();
  expect(reads).toBe(6);
  expect(f.events()).toHaveLength(2);
});

test("installed detector needs no authored event routes; exact App reads distinguish quiet success from failure", async () => {
  let fail = false;
  const f = await setup(async () => {
    if (fail) throw new Error("source format changed");
    return { state: "running", revision: 1 };
  });
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  await f.useHostObserver();
  const first = f.appHealth();
  expect(first.observations?.[0]).toMatchObject({ id: "build-status", appId: "builds" });
  const firstSuccess = first.observerHealth![0].resources![0].lastSuccessAt!;
  expect(typeof firstSuccess).toBe("number");
  await f.scanHost();
  expect(f.events()).toHaveLength(1);
  expect(f.appHealth().observerHealth![0].resources![0].lastSuccessAt).toBeGreaterThan(firstSuccess);
  fail = true;
  await f.scanHost();
  expect(f.appHealth().observerHealth![0].resources![0].error).toBe("source format changed");
  expect(f.events("app.observer.failed")).toHaveLength(1);
  expect(f.runnable()).toEqual([]);
});

test("reload aborts a hung read, retains its occupied slot, and fences its late result", async () => {
  let calls = 0;
  let release!: (value: { state: string; revision: number }) => void;
  const f = await setup(async () => {
    calls++;
    if (calls > 1) return { state: "passed", revision: 2 };
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  await f.useHostObserver();
  await f.useHostObserver();
  expect(calls).toBe(1);
  expect(f.appHealth().observerHealth![0].resources![0].error).toContain("has not settled");
  release({ state: "passed", revision: 1 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(f.events()).toHaveLength(0);
  await f.scanHost();
  await until(() => f.runnable().includes("a"), "repaired observation delivery");
  expect(calls).toBe(2);
  expect(f.events()).toHaveLength(1);
});

test("an already-ready source satisfies new interests, even without a source transition", async () => {
  let reads = 0;
  const f = await setup(async () => {
    reads++;
    return { state: "passed", revision: 1 };
  });
  for (const id of ["first", "later"]) {
    f.add(id, [f.capability.waitFor("build", "42", terminal)]);
    await f.scan();
    expect(f.runnable()).toEqual([id]);
    f.complete(id);
  }
  expect(reads).toBe(2);
  expect(f.events()).toHaveLength(2);
});

test("publication failure retries unchanged data; persisted admission failure recovers without another read", async () => {
  let reads = 0;
  const f = await setup(async () => {
    reads++;
    return { state: "passed", revision: 1 };
  });
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  f.publicationFails = true;
  await f.scan();
  expect(f.events()).toHaveLength(0);
  expect(f.runnable()).toEqual([]);
  f.publicationFails = false;
  f.admissionFails = true;
  await f.scan(false);
  expect(f.events()).toHaveLength(1);
  await until(
    () =>
      (
        f.db.prepare("SELECT count(*) AS n FROM app_event_admission_commands WHERE last_error IS NOT NULL").get() as {
          n: number;
        }
      ).n > 0,
    "failed route evidence",
  );
  f.admissionFails = false;
  await f.recover();
  expect(f.runnable()).toEqual(["a"]);
  expect(f.events()).toHaveLength(1);
  expect(reads).toBe(2);
});

test("new evidence survives an active attempt; there is no second simultaneous claim", async () => {
  const f = await setup(async () => ({ state: "passed", revision: 1 }));
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  recordAppTaskTrigger(f.config(), "a", { type: "trial.steering", eventId: 8001, data: { prepare: true } });
  const active = f.claim("a");
  await f.scan();
  expect(() => f.claim("a")).toThrow("busy");
  f.defer(active, undefined, true);
  expect(f.runnable()).toEqual(["a"]);
  const next = f.claim("a");
  expect(next.events.some((e) => e.event.type === "build.state")).toBe(true);
  f.defer(next, [
    {
      id: "independent",
      type: "human.decision",
      subject: "approval:v2",
      expected: "approved",
      owner: "human:operator",
      reviewAfterMs: 3_600_000,
    },
  ]);
});

test("closing the Task removes demand; reopen of the actual SQLite database reobserves remaining work", async () => {
  let reads = 0;
  const f = await setup(async () => {
    reads++;
    return { state: "running", revision: 1 };
  });
  f.add("cancelled", [f.capability.waitFor("one", "41", terminal)]);
  f.add("retained", [f.capability.waitFor("two", "42", terminal)]);
  f.cancel("cancelled");
  await f.scan();
  expect(reads).toBe(1);
  await f.restart();
  await f.scan();
  expect(reads).toBe(2);
  expect(f.view("cancelled").closed).toBe(true);
  expect(f.view("retained").conditions).toHaveLength(1);
  expect(f.runnable()).toEqual([]);
});

test("a hung read is recorded, signals abort, does not overlap, and leaves another resource usable", async () => {
  let hangCalls = 0;
  let aborted = false;
  let release!: (value: { state: string; revision: number }) => void;
  const f = await setup(async (resource, signal) => {
    if (resource !== "hung") return { state: "passed", revision: 1 };
    hangCalls++;
    signal.addEventListener("abort", () => {
      aborted = true;
    });
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  f.add("bad", [f.capability.waitFor("one", "hung", terminal)]);
  f.add("good", [f.capability.waitFor("two", "ready", terminal)]);
  await f.scan();
  expect(aborted).toBe(true);
  expect(f.events("app.observer.failed")).toHaveLength(1);
  expect(f.runnable()).toEqual(["good"]);
  await f.scan();
  expect(hangCalls).toBe(1);
  release({ state: "passed", revision: 9 });
  await Promise.resolve();
  await Promise.resolve();
  expect(f.runnable()).toEqual(["good"]); // Late timed-out evidence is not published.
  expect(f.view("bad").conditions[0]?.observation?.state).toBe("unknown");
});

test("stopping observation entirely still leaves a due same-Task recovery review", async () => {
  const f = await setup(async () => ({ state: "running", revision: 1 }));
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  f.stopObserver();
  expect(f.events()).toHaveLength(0);
  f.due("a");
  expect(f.recoveryCandidates()).toContain("a");
  const recovery = f.claim("a");
  expect(f.config().resourceStore.readTaskContext({ taskIds: ["a"] }).attempts?.[recovery.attemptId]?.reason).toBe(
    "condition-review-checkpoint-missed",
  );
  expect(f.view("a").conditions[0]?.observation?.state).toBe("unknown");
  f.defer(recovery);
});

test("unknown detector failure retains the wait; repaired code resumes the same Task", async () => {
  let repaired = false;
  const f = await setup(async () => {
    if (!repaired) throw new Error("Unexpected provider response format");
    return { state: "passed", revision: 2 };
  });
  f.add("a", [f.capability.waitFor("build", "42", terminal)]);
  await f.scan();
  await f.scan();
  expect(f.events("app.observer.failed")).toHaveLength(1);
  expect(f.events()).toHaveLength(0);
  expect(f.view("a").result).toEqual({ prepared: true });
  expect(f.view("a").conditions[0]?.observation?.state).toBe("unknown");
  f.due("a");
  expect(f.recoveryCandidates()).toContain("a");
  f.defer(f.claim("a"));
  repaired = true; // Simulates a reviewed repair; no model diagnosis is claimed.
  await f.scan();
  expect(f.runnable()).toEqual(["a"]);
  f.complete("a");
  expect(f.view("a").status).toBe("done");
  expect((f.db.prepare("SELECT count(*) AS n FROM app_tasks WHERE task_id='a'").get() as { n: number }).n).toBe(1);
});

test("bounded subject paging is fair, and generated waits reject a different source's fact", async () => {
  const read: string[] = [];
  const f = await setup(async (resource) => {
    read.push(resource);
    return { state: "running", revision: 1 };
  });
  for (const resource of ["a", "b", "c", "d", "e"])
    f.add(resource, [f.capability.waitFor(`build-${resource}`, resource, terminal)]);
  for (let i = 0; i < 4; i++) await f.scan();
  expect(read).toEqual(["a", "b", "c", "d", "e", "a", "b", "c", "d", "e"]);
  f.bus.emit({
    type: "build.state",
    source: "app:builds:observer:another-source",
    owner: "app:builds",
    data: { resource: "a", state: "passed" },
  } as never);
  await f.recover();
  expect(f.runnable()).toEqual([]);
  expect(f.view("a").conditions[0]?.observation?.state).toBe("unknown");
});
