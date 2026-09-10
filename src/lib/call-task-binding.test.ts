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

test("input cancellation waits for execution settlement even when cancellation reporting fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-call-cancel-"));
  roots.push(root);
  const manager = new SubagentManager({ persistDir: root });
  const definition = { name: "worker" } as SubagentDefinition;
  const settled = Promise.withResolvers<never>();
  const entered = Promise.withResolvers<void>();
  const run = spyOn(manager, "runDefinition").mockReturnValue("exact-session");
  const wait = spyOn(manager, "waitFor").mockImplementation(() => settled.promise);
  const cancel = spyOn(manager, "cancel").mockImplementation(() => {
    throw new Error("fixture evidence unavailable");
  });
  const controller = new AbortController();
  let finished = false;
  const result = manager
    .callAgentDefinition(definition, "Work", {
      signal: controller.signal,
      sessionStarted: (id) => {
        expect(id).toBe("exact-session");
        entered.resolve();
      },
    })
    .catch((error) => {
      finished = true;
      return error;
    });
  try {
    await entered.promise;
    controller.abort(new Error("Ownership lost"));
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledWith("exact-session");
    expect(finished).toBe(false);
    settled.resolve({ status: "interrupted" } as never);
    expect((await result).message).toBe("Ownership lost");
  } finally {
    settled.resolve({ status: "interrupted" } as never);
    run.mockRestore();
    wait.mockRestore();
    cancel.mockRestore();
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
