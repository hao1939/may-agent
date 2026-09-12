import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskAgentRunner } from "./managed-agent.js";
import type { SubagentManager } from "../../../lib/manager.js";
import type { TaskAgentInput } from "../../core/tasks/execution.js";

test("generic agent execution carries operation facts without reading private deployment files", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-generic-agent-evidence-"));
  try {
    const receipts = join(root, ".state", "deploy-receipts");
    mkdirSync(receipts, { recursive: true });
    // Previously this file selected a deployment prompt for an unrelated App.
    writeFileSync(join(receipts, "private.json"), JSON.stringify({
      version: 1, project: "maintenance", taskId: "work", correlation: "private-correlation",
      artifactSha: "private-artifact", phase: "requested", requestedAt: new Date().toISOString(),
    }));
    let prompt = "";
    const runner = createTaskAgentRunner({ manager: {
      callAgent: async (_agent: string, text: string) => {
        prompt = text;
        return { status: "done", sessionId: "fixture", structuredResult: {
          state: "converged", summary: "Observed operation", evidence: ["event:1"],
        } };
      },
    } as unknown as SubagentManager });
    const input = {
      descriptor: { id: "example", app: {} },
      attempt: {
        task: { id: "work", generation: 1, outcome: "Inspect evidence", acceptance: [] },
        role: { agent: "worker", instructions: "Inspect ordinary facts" },
        events: { items: [{ eventId: 1, event: { type: "project.task.tick", data: {
          reason: "restart-aware-deploy-receipt", deploymentReceipt: { correlation: "event-correlation", phase: "succeeded" },
        } } }] },
        waits: {},
      },
      executionPaths: { projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] },
      dependencies: [],
    } as unknown as TaskAgentInput;
    const result = await runner.execute(input);
    expect(result.handlerResult).toMatchObject({ state: "converged", summary: "Observed operation" });
    expect(prompt).toContain("event-correlation");
    expect(prompt).not.toContain("private-correlation");
    expect(prompt).not.toContain("Restart-aware deploy receipt");
    expect(prompt).not.toContain("Do not deploy again");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
