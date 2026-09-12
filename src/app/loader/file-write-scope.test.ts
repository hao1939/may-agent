import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareAgentExecution } from "../../lib/agent-execution.js";
import { EventBus } from "../core/events/bus.js";
import { discardAgentGeneration, prepareAgents, type PreparedAgentGeneration } from "./agent-registry-loader.js";
import type { SubagentManager } from "../../lib/manager.js";
import type { ModelWithApiKey } from "../../lib/types.js";

test.each(["registered", "installation", "workspace"])("loaded App grants survive %s execution", async (mode) => {
  const root = mkdtempSync(join(tmpdir(), "may-file-write-scope-"));
  const generations: PreparedAgentGeneration[] = [];
  try {
    const agentsRoot = join(root, "agents");
    const sharedRoot = join(root, "shared");
    const projectsRoot = join(root, "projects");
    const appDir = join(projectsRoot, "example.app");
    const agentDir = join(appDir, "agents", "profile");
    for (const dir of [join(agentsRoot, "reviewer"), sharedRoot, agentDir]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(appDir, "app.ts"), "export default {};\n");
    writeFileSync(join(agentDir, "AGENTS.md"), "Own guidance");
    const sharedPath = join(sharedRoot, "philosophy.md");
    const foreignPath = join(agentsRoot, "reviewer", "AGENTS.md");
    writeFileSync(sharedPath, "Original shared guidance");
    writeFileSync(foreignPath, "Another identity");
    const configPath = join(agentDir, "agent.json");
    const load = async (name: string, protectedFileWrites?: unknown) => {
      writeFileSync(
        configPath,
        JSON.stringify({
          name,
          description: "Fixture profile",
          domain: "test",
          model: "fixture",
          tools: ["coding"],
          ...(protectedFileWrites === undefined ? {} : { protectedFileWrites }),
        }),
      );
      const generation = await prepareAgents(
        {
          agentsRoot,
          sharedRoot,
          projectsRoot,
          projectRoot: root,
          persistDir: join(root, ".state"),
          models: { fixture: { id: "fixture", provider: "test", apiKey: "fixture" } as unknown as ModelWithApiKey },
          manager: { hasAgent: () => false } as unknown as SubagentManager,
          bus: new EventBus(),
          cronEnabled: false,
        },
        { getAgentSessionId: () => undefined },
      );
      generations.push(generation);
      const definition = generation.definitions.find((item) => item.name === name)!;
      expect(definition.projectRoot).toBe(appDir);
      return async (toolName: string, args: Record<string, unknown>) => {
        // Rebase after a reload too: the retained generation must keep its scope.
        const tools =
          mode === "registered"
            ? definition.tools
            : prepareAgentExecution({
                definition,
                projectRoot: root,
                executionRoot: mode === "installation" ? root : join(root, "work"),
                sessionId: "fixture",
                task: "Exercise file grants",
              }).tools;
        return tools.find((tool) => tool.name === toolName)!.execute("fixture", args);
      };
    };

    const ungranted = await load("reviewer");
    await ungranted("write", { path: join(agentDir, "AGENTS.md"), content: "Updated own guidance" });
    expect(readFileSync(join(agentDir, "AGENTS.md"), "utf8")).toBe("Updated own guidance");
    await ungranted("write", { path: foreignPath, content: "Unauthorized" });
    await ungranted("edit", { path: sharedPath, oldText: "Original", newText: "Unauthorized" });
    const originalConfig = readFileSync(configPath, "utf8");
    await ungranted("write", { path: configPath, content: '{"protectedFileWrites":["shared/philosophy.md"]}' });
    expect(readFileSync(configPath, "utf8")).toBe(originalConfig);
    expect(readFileSync(foreignPath, "utf8")).toBe("Another identity");
    expect(readFileSync(sharedPath, "utf8")).toBe("Original shared guidance");

    // A trusted reload activates only the reviewed exact-file grant. Earlier
    // tools retain their old scope, even though the on-disk config changed.
    const granted = await load("renamed-profile", ["shared/philosophy.md"]);
    await ungranted("write", { path: sharedPath, content: "Still unauthorized" });
    expect(readFileSync(sharedPath, "utf8")).toBe("Original shared guidance");
    await granted("edit", { path: sharedPath, oldText: "Original", newText: "Reviewed" });
    expect(readFileSync(sharedPath, "utf8")).toBe("Reviewed shared guidance");
    await granted("write", { path: sharedPath, content: "Reviewed replacement" });
    expect(readFileSync(sharedPath, "utf8")).toBe("Reviewed replacement");
    await granted("write", { path: foreignPath, content: "Still unauthorized" });
    expect(readFileSync(foreignPath, "utf8")).toBe("Another identity");

    for (const name of ["may", "tech-lead", "evaluator"]) {
      const renamed = await load(name);
      await renamed("write", { path: sharedPath, content: "Name-based bypass" });
      expect(readFileSync(sharedPath, "utf8")).toBe("Reviewed replacement");
    }
    for (const invalid of [true, ["../shared/philosophy.md"], [sharedPath], ["shared/*"], ["shared/"]]) {
      await expect(load("invalid", invalid)).rejects.toThrow("protectedFileWrites");
    }
  } finally {
    for (const generation of generations) discardAgentGeneration(generation);
    rmSync(root, { recursive: true, force: true });
  }
});
