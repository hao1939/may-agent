import { afterEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeModel } from "../../test/fixtures/model.js";
import { createAgentRun } from "../lib/agent-runner.js";
import { SubagentManager } from "../lib/manager.js";
import { readSessionMeta } from "../lib/persistence.js";
import { closeDb } from "../lib/db/connection.js";
import { discoverAppDefinitions } from "./adapters/discovery/app-definitions.js";
import { AppRegistry } from "./core/apps/registry.js";
import { EventBus, type AgentEvent } from "./core/events/bus.js";
import { HostCapacity } from "./core/scheduling/host-capacity.js";
import { closeInstalledAppTaskRuntimes } from "./core/tasks/app-task-runtime.js";
import { prepareDaemonAgents } from "./daemon-agents.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

describe("daemon Task executor compatibility", () => {
  it.each(["app.ts", "app.js"])("preserves App-local ownership through the %s loader", async (filename) => {
    const root = mkdtempSync(join(tmpdir(), "may-local-owner-"));
    roots.push(root);
    const canonicalProjects = join(root, "projects");
    const appDir = join(canonicalProjects, "sample.app");
    const localDir = join(appDir, "agents", "actual-folder");
    const globalDir = join(root, "agents", "arc");
    for (const dir of [localDir, globalDir, join(root, "shared")]) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(localDir, "agent.json"),
      JSON.stringify({
        name: "arc",
        description: "Fixture",
        domain: "test",
        model: "fixture",
        tools: [],
      }),
    );
    writeFileSync(
      join(appDir, filename),
      'export default { id: "sample", version: 1, agent: "arc", inputSchema: { type: "object" }, tasks: {} };',
    );
    const sourceRoot = join(root, "release");
    cpSync(canonicalProjects, join(sourceRoot, "projects"), { recursive: true });
    const bus = new EventBus();
    const events: AgentEvent[] = [];
    bus.subscribe((event) => events.push(event));
    const manager = new SubagentManager({
      persistDir: root,
      projectRoot: root,
      bus,
      agentRunFactory: (options) => {
        const run = createAgentRun(options);
        run.prompt = async () => {
          run.state.messages.push({
            role: "assistant",
            content: [{ type: "text", text: "Fixture finished" }],
            stopReason: "stop",
          } as any);
        };
        return run;
      },
    });
    const registry = new AppRegistry(discoverAppDefinitions(join(sourceRoot, "projects"), canonicalProjects));
    await registry.reload();
    try {
      await prepareDaemonAgents({
        agentsRoot: join(root, "agents"),
        sharedRoot: join(root, "shared"),
        definitionSharedRoot: join(root, "shared"),
        projectsRoot: join(sourceRoot, "projects"),
        canonicalProjectsRoot: canonicalProjects,
        projectRoot: root,
        persistDir: root,
        models: { fixture: fakeModel() },
        manager,
        bus,
        appRegistry: registry,
        hostCapacity: new HostCapacity(1),
        taskRuntimeMode: "manual",
      });
      const definition = manager.getAgentDefinition("arc")!;
      expect(definition).toMatchObject({
        agentDir: join(sourceRoot, "projects/sample.app/agents/actual-folder"),
        agentRelativeDir: "projects/sample.app/agents/actual-folder",
        appLocal: true,
        projectId: "sample",
      });
      writeFileSync(join(appDir, ".disabled"), "");
      const sessionId = manager.run("arc", "Complete accepted work");
      expect((await manager.waitFor(sessionId)).status).toBe("done");
      expect(readSessionMeta(root, sessionId)?.agentRelativeDir).toBe(definition.agentRelativeDir);
      expect(events.filter((event) => event.type === "session.end")).toMatchObject([
        { data: { sessionId, agentRelativeDir: definition.agentRelativeDir, status: "done" } },
      ]);
    } finally {
      await closeInstalledAppTaskRuntimes(bus);
    }
  });
});
