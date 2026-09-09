import { afterEach, expect, test, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager, type SubagentDefinition } from "./manager.js";
import { closeDb } from "./db/connection.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

test("workflow calls preserve the exact supplied Task binding without inferring one from project identity", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-call-binding-"));
  roots.push(root);
  const manager = new SubagentManager({ persistDir: root });
  const definition = { name: "worker" } as SubagentDefinition;
  const run = spyOn(manager, "runDefinition").mockReturnValue("session-test");
  const wait = spyOn(manager, "waitFor").mockResolvedValue({ sessionId: "session-test", status: "done" } as never);
  const progress = spyOn(manager, "progress").mockReturnValue([]);
  const taskBinding = { appId: "sample", taskId: "work/one", generation: 3, attemptId: "attempt-one" };
  try {
    await manager.callAgentDefinition(definition, "Inspect current facts", {
      source: "workflow:reconcile",
      projectId: "sample",
      taskBinding,
      toolPolicy: "readonly",
    });
    expect(run.mock.calls[0]?.[2]).toMatchObject({ taskBinding, toolPolicy: "readonly", source: "workflow:reconcile" });
    await manager.callAgentDefinition(definition, "Unbound observation", {
      source: "workflow:reconcile",
      projectId: "sample",
    });
    expect(run.mock.calls[1]?.[2]?.taskBinding).toBeUndefined();
  } finally {
    run.mockRestore();
    wait.mockRestore();
    progress.mockRestore();
  }
});
