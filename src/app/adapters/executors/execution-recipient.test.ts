import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../../../test/fixtures/model.js";
import { SubagentManager } from "../../../lib/manager.js";
import { closeDb } from "../../../lib/db/connection.js";
import { createTaskAgentRunner } from "./managed-agent.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("aliases share the resolved recipient while a pinned Task generation retains its owner", () => {
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
  expect(live.executionRecipient!("quality")).toEqual(original);
  expect(live.executionRecipient!("programmatic")).toBeNull();
  expect(live.executionRecipient!("missing")).toBeNull();

  manager.register({ ...definition, name: "reviewer", agentRelativeDir: "agents/reviewer" });
  expect(pinned.executionRecipient!("reviewer")).toEqual(original);
  const replacement = live.executionRecipient!("reviewer")!;
  expect(replacement).toEqual({ kind: "directory", id: "agents/reviewer" });

  manager.register({ ...definition, name: "programmatic", hostIdentity: "review-service" });
  expect(live.executionRecipient!("programmatic")).toEqual({ kind: "programmatic", id: "review-service" });
  expect(pinned.executionRecipient!("programmatic")).toBeNull();
});
