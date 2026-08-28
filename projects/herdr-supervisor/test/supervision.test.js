import assert from "node:assert/strict";
import test from "node:test";
import {
  captureIdentity,
  identityMismatch,
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
  const binding = registerBinding(state, agent(), " Fix cancellation ", [" test passes "]);
  assert.deepEqual(captureIdentity(agent()), {
    paneId: "w1:p2",
    terminalId: "term-1",
    agentSession: { source: "herdr:codex", agent: "codex", kind: "id", value: "session-1" },
  });
  assert.equal(binding.goal, "Fix cancellation");
  assert.deepEqual(binding.acceptance, ["test passes"]);
  assert.equal(state.workers.length, 1);
});

test("registering the same pane updates one binding", () => {
  const state = { version: 1, workers: [] };
  registerBinding(state, agent(), "first");
  registerBinding(state, agent(), "refined");
  assert.equal(state.workers.length, 1);
  assert.equal(state.workers[0].goal, "refined");
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
  assert.match(message, /Review needed · codex w1:p2/);
  assert.match(message, /Goal\n  Fix cancellation/);
  assert.match(message, /Why now\n  worker is idle; Herdr reports idle/);
  assert.match(message, /Accept when\n- focused test passes/);
  assert.doesNotMatch(message, /supervisor_observe/);
});
