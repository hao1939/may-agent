import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { generateAutoHeartbeats } from "./heartbeat-loader.js";

function createHeartbeatAgent(agentsRoot: string, agentName: string): void {
  const agentDir = join(agentsRoot, agentName);
  mkdirSync(join(agentDir, "workflows"), { recursive: true });
  writeFileSync(join(agentDir, "agent.json"), JSON.stringify({ name: agentName, model: "test", tools: [] }));
  writeFileSync(join(agentDir, "workflows", `${agentName}-heartbeat.ts`), "export const name = 'heartbeat';\n");
}

describe("generateAutoHeartbeats", () => {
  it("uses global agent paths for global agents", () => {
    const root = mkdtempSync(join(tmpdir(), "may-heartbeat-global-"));
    const agentsRoot = join(root, "agents");
    createHeartbeatAgent(agentsRoot, "may");

    const [entry] = generateAutoHeartbeats(agentsRoot);

    expect(entry.handler).toMatchObject({
      agent: "may",
      task: expect.stringContaining("Read agents/may/heartbeat.md"),
    });
  });

  it("uses project-app paths for app-local agents", () => {
    const root = mkdtempSync(join(tmpdir(), "may-heartbeat-app-"));
    const agentsRoot = join(root, "projects", "demo.app", "agents");
    createHeartbeatAgent(agentsRoot, "owner");

    const [entry] = generateAutoHeartbeats(agentsRoot, "demo");

    expect(entry.handler).toMatchObject({
      agent: "owner",
      projectId: "demo",
      task: expect.stringContaining("Read projects/demo.app/agents/owner/heartbeat.md"),
    });
  });

  it("uses project-local paths for legacy project agents", () => {
    const root = mkdtempSync(join(tmpdir(), "may-heartbeat-project-"));
    const agentsRoot = join(root, "projects", "legacy", "agents");
    createHeartbeatAgent(agentsRoot, "worker");

    const [entry] = generateAutoHeartbeats(agentsRoot, "legacy");

    expect(entry.handler).toMatchObject({
      agent: "worker",
      projectId: "legacy",
      task: expect.stringContaining("Read projects/legacy/agents/worker/heartbeat.md"),
    });
  });
});
