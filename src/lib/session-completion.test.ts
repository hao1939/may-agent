import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { cpSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createLastSessionWriter } from "./session-subscribers.js";
import { resolveRuntimeAgentDirectory } from "../app/loader/agent-discovery.js";
import { buildAgentDefinition } from "../app/loader/agent-definition.js";
import { fakeModel } from "../../test/fixtures/model.js";

let tmpDir: string;
let persistDir: string;
let agentsDir: string;
let agentDir: string;

describe("Session completion files", () => {
  beforeEach(() => {
    tmpDir = join(tmpdir(), `session-completion-test-${randomBytes(6).toString("hex")}`);
    persistDir = join(tmpDir, ".state");
    agentsDir = join(tmpDir, "agents");
    agentDir = join(agentsDir, "test-agent");
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    mkdirSync(persistDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it.each([false, true])("keeps completion writes App-local after disabling it (global duplicate=%s)", async (globalDuplicate) => {
    const projectsRoot = join(tmpDir, "projects");
    const appDir = join(projectsRoot, "sample.app");
    // The configured agent name need not match its folder or the App name.
    const appAgentDir = join(appDir, "agents", "local-owner");
    const globalAgentDir = join(agentsDir, "arc");
    mkdirSync(appAgentDir, { recursive: true });
    writeFileSync(join(appDir, "app.ts"), "export default {};\n");
    const config = { name: "arc", description: "Test owner", domain: "test", model: "test", tools: [] };
    writeFileSync(join(appAgentDir, "agent.json"), JSON.stringify(config));
    if (globalDuplicate) {
      mkdirSync(globalAgentDir, { recursive: true });
      writeFileSync(join(globalAgentDir, "agent.json"), JSON.stringify({ name: "arc", model: "test", tools: [] }));
      for (const file of ["context.md", "last-session.md"]) writeFileSync(join(globalAgentDir, file), "Global state\n");
    }
    expect(resolveRuntimeAgentDirectory(agentsDir, "arc", projectsRoot)?.dir).toBe(appAgentDir);
    // Definitions load from a source release; completion files stay in the installation.
    const releaseRoot = join(tmpDir, "release");
    cpSync(projectsRoot, join(releaseRoot, "projects"), { recursive: true });
    const source = resolveRuntimeAgentDirectory(join(releaseRoot, "agents"), "arc", join(releaseRoot, "projects"))!;
    const definition = await buildAgentDefinition({
      config,
      source,
      model: fakeModel(),
      tools: [],
      projectRoot: tmpDir,
      sharedRoot: join(releaseRoot, "shared"),
      globalAgentsRoot: join(releaseRoot, "agents"),
    });
    expect(definition.agentDir).toBe(join(releaseRoot, "projects", "sample.app", "agents", "local-owner"));
    expect(definition.agentRelativeDir).toBe("projects/sample.app/agents/local-owner");
    const writeHandoff = createLastSessionWriter(tmpDir);
    const complete = (agentRelativeDir: string | undefined, summary: string) => {
      const event = {
        type: "session.end",
        source: "runtime",
        owner: "agent:arc",
        data: {
          sessionId: `s_${summary}`,
          agent: "arc",
          agentRelativeDir,
          outcome: "done",
          summary,
          durationMs: 1,
          status: "done",
          finishParams: { summary, context_updates: [{ action: "add", content: summary }] },
        },
      } as const;
      writeHandoff(event);
    };
    for (const disabled of [false, true]) {
      if (disabled) writeFileSync(join(appDir, ".disabled"), "");
      // Runtime discovery still excludes the disabled App for new work.
      expect(resolveRuntimeAgentDirectory(agentsDir, "arc", projectsRoot)?.dir).toBe(
        disabled ? (globalDuplicate ? globalAgentDir : undefined) : appAgentDir,
      );
      const summary = disabled ? "Finished after the disable request" : "Finished before the disable request";
      complete(definition.agentRelativeDir, summary);
      expect(existsSync(join(appAgentDir, "context.md"))).toBe(false);
      expect(readFileSync(join(appAgentDir, "last-session.md"), "utf8")).toContain(summary);
      for (const file of ["context.md", "last-session.md"]) {
        if (globalDuplicate) expect(readFileSync(join(globalAgentDir, file), "utf8")).toBe("Global state\n");
        else expect(existsSync(join(globalAgentDir, file))).toBe(false);
      }
    }
    for (const file of ["context.md", "last-session.md"]) expect(existsSync(join(source.dir, file))).toBe(false);

    if (globalDuplicate) {
      // New work can select the global agent. Its completion must not be sent
      // back to the disabled App just because that directory still exists.
      const globalSource = resolveRuntimeAgentDirectory(agentsDir, "arc", projectsRoot)!;
      const globalDefinition = await buildAgentDefinition({
        config,
        source: globalSource,
        model: fakeModel(),
        tools: [],
        projectRoot: tmpDir,
        sharedRoot: join(tmpDir, "shared"),
        globalAgentsRoot: agentsDir,
      });
      const appHandoff = readFileSync(join(appAgentDir, "last-session.md"), "utf8");
      complete(globalDefinition.agentRelativeDir, "Global work finished");
      expect(readFileSync(join(globalAgentDir, "last-session.md"), "utf8")).toContain("Global work finished");
      expect(readFileSync(join(appAgentDir, "last-session.md"), "utf8")).toBe(appHandoff);
      expect(readFileSync(join(globalAgentDir, "context.md"), "utf8")).toBe("Global state\n");
    }
  });
});
