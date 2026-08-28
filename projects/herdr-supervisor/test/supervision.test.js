import assert from "node:assert/strict";
import test from "node:test";
import {
  captureIdentity,
  dueBindings,
  identityMismatch,
  nextReviewDelay,
  registerBinding,
  removeBinding,
  reviewMessage,
  shouldWake,
} from "../src/supervision.js";

function agent(overrides = {}) {
  return {
    pane_id: "w1:p2",
    terminal_id: "term-1",
    agent: "codex",
    agent_status: "working",
    state_change_seq: 10,
    agent_session: { source: "herdr:codex", agent: "codex", kind: "id", value: "session-1" },
    ...overrides,
  };
}

test("registration records the goal and exact worker identity", () => {
  const state = { version: 1, workers: [] };
  const binding = registerBinding(
    state,
    agent(),
    " Fix cancellation ",
    [" test passes "],
    new Date("2026-08-28T00:00:00.000Z"),
  );
  assert.deepEqual(captureIdentity(agent()), {
    paneId: "w1:p2",
    terminalId: "term-1",
    agentSession: { source: "herdr:codex", agent: "codex", kind: "id", value: "session-1" },
  });
  assert.equal(binding.goal, "Fix cancellation");
  assert.deepEqual(binding.acceptance, ["test passes"]);
  assert.equal(binding.nextReviewAt, "2026-08-28T00:10:00.000Z");
  assert.equal(state.workers.length, 1);
});

test("one nearest deadline selects only workers due for review", () => {
  const now = new Date("2026-08-28T00:00:00.000Z");
  const workers = [
    { paneId: "w1:p1", nextReviewAt: "2026-08-28T00:02:00.000Z" },
    { paneId: "w1:p2", nextReviewAt: "2026-08-27T23:59:00.000Z" },
    { paneId: "w1:p3", nextReviewAt: "2026-08-28T00:05:00.000Z" },
  ];
  assert.equal(nextReviewDelay(workers, now), 0);
  assert.deepEqual(dueBindings(workers, now).map((worker) => worker.paneId), ["w1:p2"]);
  assert.equal(nextReviewDelay(workers.filter((worker) => worker.paneId !== "w1:p2"), now), 120_000);
  assert.equal(nextReviewDelay([], now), undefined);
});

test("bindings without a deadline receive one recovery review", () => {
  const workers = [{ paneId: "w1:p1" }];
  assert.equal(nextReviewDelay(workers), 0);
  assert.deepEqual(dueBindings(workers).map((worker) => worker.paneId), ["w1:p1"]);
});

test("registering the same pane updates one binding", () => {
  const state = { version: 1, workers: [] };
  registerBinding(state, agent(), "first");
  state.workers[0].lastReviewStateChangeSeq = 10;
  registerBinding(state, agent(), "refined");
  assert.equal(state.workers.length, 1);
  assert.equal(state.workers[0].goal, "refined");
  assert.equal(state.workers[0].lastReviewStateChangeSeq, 0);
});

test("working is quiet while settled and blocked states wake review", () => {
  const state = { version: 1, workers: [] };
  const binding = registerBinding(state, agent(), "goal");
  assert.equal(shouldWake(binding, agent()).wake, false);
  assert.deepEqual(shouldWake(binding, agent({ agent_status: "idle", state_change_seq: 11 })), {
    wake: true,
    reason: "worker is idle",
    sequence: 11,
    key: "state:11:idle",
  });
  assert.equal(shouldWake(binding, agent({ agent_status: "blocked", state_change_seq: 12 })).wake, true);
  binding.lastReviewStateChangeSeq = 12;
  assert.equal(shouldWake(binding, agent({ agent_status: "blocked", state_change_seq: 12 })).wake, false);
});

test("replaced worker fails closed", () => {
  const state = { version: 1, workers: [] };
  const binding = registerBinding(state, agent(), "goal");
  assert.equal(identityMismatch(binding, agent()), undefined);
  assert.match(identityMismatch(binding, agent({ terminal_id: "term-2" })), /different terminal/);
  assert.match(
    identityMismatch(binding, agent({ agent_session: { ...agent().agent_session, value: "session-2" } })),
    /value changed/,
  );
  assert.equal(shouldWake(binding, undefined).wake, true);
});

test("removal affects only the selected binding", () => {
  const state = { version: 1, workers: [] };
  registerBinding(state, agent(), "one");
  registerBinding(state, agent({ pane_id: "w1:p3", terminal_id: "term-3" }), "two");
  assert.equal(removeBinding(state, "w1:p2"), true);
  assert.deepEqual(state.workers.map((worker) => worker.paneId), ["w1:p3"]);
  assert.equal(removeBinding(state, "missing"), false);
});

test("review notice explains the goal and signal in plain language", () => {
  const state = { version: 1, workers: [] };
  const binding = registerBinding(state, agent(), "Fix cancellation", ["focused test passes"]);
  const message = reviewMessage(binding, agent({ agent_status: "idle" }), "worker is idle");
  assert.match(message, /Worker review · codex w1:p2/);
  assert.match(message, /Goal\n  Fix cancellation/);
  assert.match(message, /Why review now\n  worker is idle; Herdr reports idle/);
  assert.match(message, /Accept when\n- focused test passes/);
  assert.match(message, /Observe this exact worker/);
  assert.doesNotMatch(message, /supervisor_observe/);
});

test("each shared-session review request re-establishes one worker context", () => {
  const state = { version: 1, workers: [] };
  const first = registerBinding(state, agent(), "Fix API cancellation", ["API test passes"]);
  const second = registerBinding(
    state,
    agent({ pane_id: "w1:p3", terminal_id: "term-3", agent_session: { ...agent().agent_session, value: "session-3" } }),
    "Simplify the console view",
    ["console output is readable"],
  );
  const firstRequest = reviewMessage(first, agent({ agent_status: "idle" }), "worker is idle");
  const secondRequest = reviewMessage(
    second,
    agent({ pane_id: "w1:p3", terminal_id: "term-3", agent_status: "blocked", agent_session: { ...agent().agent_session, value: "session-3" } }),
    "worker is blocked",
  );

  assert.match(firstRequest, /w1:p2/);
  assert.match(firstRequest, /Fix API cancellation/);
  assert.doesNotMatch(firstRequest, /Simplify the console view|w1:p3/);
  assert.match(secondRequest, /w1:p3/);
  assert.match(secondRequest, /Simplify the console view/);
  assert.doesNotMatch(secondRequest, /Fix API cancellation|w1:p2/);
});
