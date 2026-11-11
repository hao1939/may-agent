import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "../../src/app/core/events/bus.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { createWorkflowTool } from "../../src/lib/workflow-tool.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";

type RuntimeEvent = { type: string; [key: string]: unknown };

const roots: string[] = [];
const stateDirs: string[] = [];

function makeRoot(prefix: string): { root: string; stateDir: string } {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const stateDir = join(root, ".state");
  mkdirSync(stateDir, { recursive: true });
  roots.push(root);
  stateDirs.push(stateDir);
  return { root, stateDir };
}

afterEach(() => {
  for (const stateDir of stateDirs.splice(0)) closeDb(stateDir);
  for (const root of roots.splice(0)) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("runtime integration", () => {
  it("keeps a workflow blocker local instead of manufacturing an external handoff", async () => {
    const { root, stateDir } = makeRoot("may-workflow-boundary-");
    const workflowDir = join(root, "agents", "dev", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "blocked.ts"),
      `
      export const name = "blocked";
      export const description = "Reports a local blocker without owning a handoff";
      export async function execute(ctx) {
        return ctx.blocked("missing approval", {
          owner: "human:operator",
          requestedAction: "Approve or reject the rollout",
          facts: { change: "database migration" },
        });
      }
    `,
      "utf-8",
    );

    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const runtimeEvents: RuntimeEvent[] = [];
    bus.setPersistenceSubscriber(writer.handler);
    bus.subscribe((event) => runtimeEvents.push(event as RuntimeEvent));

    const manager = new SubagentManager({ persistDir: stateDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      agentName: "dev",
      runtimeCtx: {
        emit: (event: RuntimeEvent) => bus.emit(event as never),
        dispatchEvent: () => {},
        getDb: () => getDb(stateDir),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: stateDir,
        projectRoot: root,
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        projectsRoot: join(root, "projects"),
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "blocked",
      task: "ship migration",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    const escalations = getDb(stateDir)
      .prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?")
      .get("escalation.created") as { count: number };
    expect(escalations.count).toBe(0);
    expect(parsed).toMatchObject({ type: "blocked", reason: "missing approval" });
  });
});
