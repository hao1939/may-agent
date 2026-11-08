import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../../../test/fixtures/model.js";
import { SubagentManager } from "../../../lib/manager.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { TaskExecutionStore } from "../../core/state/task-execution-store.js";
import { createTaskAgentRunner } from "./managed-agent.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("aliases share the resolved recipient limit while a pinned Task generation retains its owner", () => {
  const root = mkdtempSync(join(tmpdir(), "may-recipient-"));
  roots.push(root);
  const manager = new SubagentManager({ persistDir: root });
  const directory = "projects/sample.app/agents/reviewer";
  const definition = { description: "Reviewer", domain: "test", systemPrompt: "Review", tools: [], model: fakeModel() };
  manager.register({ ...definition, name: "reviewer", agentRelativeDir: directory });
  manager.register({ ...definition, name: "quality", agentRelativeDir: directory });
  manager.register({ ...definition, name: "programmatic" });
  const live = createTaskAgentRunner({ manager });
  const pinned = live.snapshot();
  const original = pinned.executionRecipient!("reviewer")!;
  expect(original).toEqual({ kind: "directory", id: directory });
  expect(live.executionRecipient!("programmatic")).toBeNull();
  expect(live.executionRecipient!("missing")).toBeNull();

  manager.register({ ...definition, name: "reviewer", agentRelativeDir: "agents/reviewer" });
  expect(pinned.executionRecipient!("reviewer")).toEqual(original);
  const replacement = live.executionRecipient!("reviewer")!;
  expect(replacement).toEqual({ kind: "directory", id: "agents/reviewer" });
  const store = new TaskExecutionStore(getDb(root));
  store.installLimit({ kind: "host" }, 4);
  store.installLimit({ kind: "agent", recipient: original }, 1);
  store.installLimit({ kind: "agent", recipient: replacement }, 1);
  const request = (id: string, recipient = original) => ({
    operation: { kind: "helper" as const, invocationId: id, sessionId: id },
    recipient,
    lane: "background" as const,
    ownerId: "fixture-owner",
  });
  expect(store.reserve(request("pinned")).kind).toBe("admitted");
  expect(store.reserve(request("alias", live.executionRecipient!("quality")!))).toMatchObject({
    kind: "deferred",
    scope: { kind: "agent", recipient: original },
  });
  expect(store.reserve(request("replacement", replacement)).kind).toBe("admitted");

  manager.register({ ...definition, name: "programmatic", hostIdentity: "review-service" });
  expect(live.executionRecipient!("programmatic")).toEqual({ kind: "programmatic", id: "review-service" });
  expect(pinned.executionRecipient!("programmatic")).toBeNull();
});
