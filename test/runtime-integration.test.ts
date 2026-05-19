import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cron } from "../src/app/cron.js";
import { EventBus } from "../src/app/event-bus.js";
import { DbWriter } from "../src/lib/db-writer.js";
import { closeDb, getDb } from "../src/lib/requests.js";
import { buildAgentSDK, type SDKDeps } from "../src/lib/sdk-impl.js";
import { SubagentManager } from "../src/lib/manager.js";
import { createWorkflowTool } from "../src/lib/workflow-tool.js";
import type { WorkflowToolResult } from "../src/lib/workflow.js";

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

function waitForAsyncHandlers(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  for (const stateDir of stateDirs.splice(0)) closeDb(stateDir);
  for (const root of roots.splice(0)) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }
});

describe("runtime integration", () => {
  it("persists canonical escalation events and delivers the same envelope to cron subscribers", async () => {
    const { root, stateDir } = makeRoot("may-runtime-integration-");
    const configPath = join(root, "cron.json");
    writeFileSync(configPath, JSON.stringify([
      {
        name: "escalation-reactor",
        enabled: true,
        handler: "escalation-reactor",
        on: ["escalation.created"],
      },
    ]), "utf-8");

    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const handled: unknown[] = [];
    bus.subscribe(writer.handler, { priority: "first" });

    const cron = new Cron(configPath, {} as never, () => "", undefined, root, undefined, (event) => bus.emit(event as never));
    cron.load();
    cron.registerHandler("escalation-reactor", async (event) => {
      handled.push(event);
    });
    cron.subscribeToBus(bus);

    bus.emit({
      type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "high",
      data: {
        escalationId: "esc_integration",
        sourceAgent: "dev",
        reason: "Need a decision",
        requestedAction: "Decide the rollout window",
        severity: "P1",
      },
    } as never);
    await waitForAsyncHandlers();
    cron.stop();

    const db = getDb(stateDir);
    const row = db.prepare(
      "SELECT event_type, source, owner, urgency, data FROM events WHERE event_type = ?",
    ).get("escalation.created") as {
      event_type: string;
      source: string;
      owner: string;
      urgency: string;
      data: string;
    };
    expect(row).toMatchObject({
      event_type: "escalation.created",
      source: "agent:dev",
      owner: "agent:may",
      urgency: "high",
    });
    expect(JSON.parse(row.data)).toEqual({
      escalationId: "esc_integration",
      sourceAgent: "dev",
      reason: "Need a decision",
      requestedAction: "Decide the rollout window",
      severity: "P1",
    });
    expect(JSON.parse(row.data)).not.toHaveProperty("owner");

    expect(handled).toHaveLength(1);
    expect(handled[0]).toMatchObject({
      type: "escalation.created",
      source: "event",
      entry: "escalation-reactor",
      data: {
        type: "escalation.created",
        source: "agent:dev",
        owner: "agent:may",
        urgency: "high",
        data: {
          escalationId: "esc_integration",
          reason: "Need a decision",
        },
      },
    });
  });

  it("sends SDK escalation and messages through the bus into the events table", () => {
    const { root, stateDir } = makeRoot("may-sdk-runtime-");
    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    bus.subscribe(writer.handler, { priority: "first" });

    const deps: SDKDeps = {
      bus,
      persistDir: stateDir,
      projectRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      agentName: "dev",
      callAgent: async (agent: string) => ({
        sessionId: `s_${agent}`,
        status: "done",
        lastAssistantText: "ok",
      }),
    };
    const sdk = buildAgentSDK(deps);

    sdk.escalate("Blocked on production credentials");
    sdk.message("reviewer", "Please inspect the migration.");

    const db = getDb(stateDir);
    const escalation = db.prepare(
      "SELECT source, owner, urgency, data FROM events WHERE event_type = ? ORDER BY id ASC LIMIT 1",
    ).get("escalation.created") as { source: string; owner: string; urgency: string; data: string };
    const escalationData = JSON.parse(escalation.data);
    expect(escalation).toMatchObject({
      source: "agent:dev",
      owner: "agent:may",
      urgency: "normal",
    });
    expect(escalationData).toMatchObject({
      sourceAgent: "dev",
      reason: "Blocked on production credentials",
      requestedAction: "Investigate and resolve or answer this blocker: Blocked on production credentials",
      severity: "P2",
    });
    expect(escalationData).not.toHaveProperty("owner");

    const messages = db.prepare(
      "SELECT source, owner, data FROM events WHERE event_type = ? ORDER BY id ASC",
    ).all("message.created") as Array<{ source: string; owner: string; data: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ source: "dev", owner: "human" });
    expect(JSON.parse(messages[0].data)).toMatchObject({
      from: "dev",
      to: "human",
      content: expect.stringContaining("Blocked on production credentials"),
    });
    expect(messages[1]).toMatchObject({ source: "dev", owner: "reviewer" });
    expect(JSON.parse(messages[1].data)).toMatchObject({
      from: "dev",
      to: "reviewer",
      content: "Please inspect the migration.",
    });
  });

  it("keeps workflow escalation local until the caller promotes it across the workflow boundary", async () => {
    const { root, stateDir } = makeRoot("may-workflow-boundary-");
    const workflowDir = join(root, "agents", "dev", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "blocked.ts"), `
      export const name = "blocked";
      export async function execute(ctx) {
        return ctx.escalate("missing approval", {
          owner: "human:operator",
          requestedAction: "Approve or reject the rollout",
          evidence: { change: "database migration" },
        });
      }
    `, "utf-8");

    const bus = new EventBus();
    const writer = new DbWriter(stateDir);
    const runtimeEvents: RuntimeEvent[] = [];
    bus.subscribe(writer.handler, { priority: "first" });
    bus.subscribe((event) => runtimeEvents.push(event as RuntimeEvent));

    const manager = new SubagentManager({ persistDir: stateDir, infraRetryMax: 0 });
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

    expect(parsed.type).toBe("escalated");
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    const beforePromotion = getDb(stateDir).prepare(
      "SELECT COUNT(*) AS count FROM events WHERE event_type = ?",
    ).get("escalation.created") as { count: number };
    expect(beforePromotion.count).toBe(0);

    const sdk = buildAgentSDK({
      bus,
      persistDir: stateDir,
      projectRoot: root,
      agentsRoot: join(root, "agents"),
      sharedRoot: join(root, "shared"),
      projectsRoot: join(root, "projects"),
      agentName: "dev",
      callAgent: async (agent: string) => ({
        sessionId: `s_${agent}`,
        status: "done",
        lastAssistantText: "ok",
      }),
    });
    if (parsed.type === "escalated") {
      sdk.escalate(parsed.reason, parsed.context as never);
    }

    const escalation = getDb(stateDir).prepare(
      "SELECT owner, data FROM events WHERE event_type = ?",
    ).get("escalation.created") as { owner: string; data: string };
    expect(escalation.owner).toBe("human:operator");
    expect(JSON.parse(escalation.data)).toMatchObject({
      sourceAgent: "dev",
      reason: "missing approval",
      requestedAction: "Approve or reject the rollout",
      evidence: { change: "database migration" },
    });
  });
});
