import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SubagentManager } from "../../src/lib/manager.js";
import { appendSessionMessage } from "../../src/lib/persistence.js";
import { closeAllDbs } from "../../src/lib/db/connection.js";

describe("retained detached instance control", () => {
  let root: string;
  let manager: SubagentManager;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "may-legacy-control-"));
    manager = new SubagentManager({ persistDir: root });
  });
  afterEach(() => {
    closeAllDbs();
    rmSync(root, { recursive: true, force: true });
  });

  for (const status of ["done", "error", "interrupted"] as const) {
    it(`reads retained ${status} results through the normal manager API`, async () => {
      manager.registry.saveSession("legacy", {
        agent: "worker",
        task: "retained work",
        status,
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        detached: true,
        instance: "job-legacy",
      });
      appendSessionMessage(root, "legacy", { role: "user", content: "Retained facts", timestamp: Date.now() });
      expect(await manager.waitFor("legacy")).toMatchObject({
        sessionId: "legacy",
        status,
        messages: [{ role: "user", content: "Retained facts" }],
      });
      expect(manager.registry.getSession("legacy")?.status).toBe(status);
    });
  }
});
