import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { emptyState, loadState, updateState } from "../src/store.js";

const session = {
  source: "herdr:codex",
  agent: "codex",
  kind: "id",
  value: "session-1",
};

test("missing state starts empty and updates are atomic", async () => {
  const directory = await mkdtemp(join(tmpdir(), "herdr-supervisor-"));
  const path = join(directory, "bindings.json");
  assert.deepEqual(await loadState(path), emptyState());

  await Promise.all([
    updateState((state) => {
      state.workers.push({ paneId: "w1:p1", terminalId: "term-1", agentSession: session, goal: "one", acceptance: [] });
      return state;
    }, path),
    updateState((state) => {
      state.workers.push({ paneId: "w1:p2", terminalId: "term-2", agentSession: session, goal: "two", acceptance: [] });
      return state;
    }, path),
  ]);

  const stored = await loadState(path);
  assert.deepEqual(stored.workers.map((worker) => worker.paneId), ["w1:p1", "w1:p2"]);
  assert.equal(JSON.parse(await readFile(path, "utf8")).version, 1);
});

test("invalid durable state is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "herdr-supervisor-"));
  const path = join(directory, "bindings.json");
  await assert.rejects(
    updateState((state) => {
      state.workers.push({ paneId: "w1:p1" });
      return state;
    }, path),
    /requires terminalId/,
  );
});
