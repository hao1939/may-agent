import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { cpSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { createContextUpdater, createLastSessionWriter } from "./session-subscribers.js";
import { resolveRuntimeAgentDirectory } from "../app/loader/agent-discovery.js";
import { agentFileWriteScope, buildAgentDefinition } from "../app/loader/agent-definition.js";
import { fakeModel } from "../../test/fixtures/model.js";

let tmpDir: string;
let persistDir: string;
let agentsDir: string;
let agentDir: string;
let contextPath: string;

/**
 * Helper: emit a fake session.end event to the context updater subscriber.
 * This simulates what happens in production: the manager fires session.end
 * on the bus, and createContextUpdater reacts to it.
 */
function applyContextUpdates(
  projectRoot: string,
  agentName: string,
  updates: Array<{ action: string; content: string }>,
): void {
  const subscriber = createContextUpdater(projectRoot);
  subscriber({
    type: "session.end",
    source: "runtime",
    owner: `agent:${agentName}`,
    data: {
      sessionId: "s_test",
      agent: agentName,
      outcome: "done",
      summary: "done",
      durationMs: 0,
      status: "done",
      finishParams: { context_updates: updates },
    },
  } as any);
}

describe("Context Learning", () => {
  beforeEach(() => {
    tmpDir = join(tmpdir(), `context-learning-test-${randomBytes(6).toString("hex")}`);
    persistDir = join(tmpDir, ".state");
    agentsDir = join(tmpDir, "agents");
    agentDir = join(agentsDir, "test-agent");
    contextPath = join(agentDir, "context.md");
    mkdirSync(join(agentDir, "knowledge"), { recursive: true });
    mkdirSync(join(agentDir, "workspace"), { recursive: true });
    mkdirSync(persistDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it("applyContextUpdates creates context.md with added facts", () => {
    applyContextUpdates(tmpDir, "test-agent", [
      { action: "add", content: "Project uses Bun not npm" },
      { action: "add", content: "Config files in /app/config/" },
    ]);

    expect(existsSync(contextPath)).toBe(true);
    const content = readFileSync(contextPath, "utf-8");
    expect(content).toContain("- Project uses Bun not npm");
    expect(content).toContain("- Config files in /app/config/");
  });

  it("applyContextUpdates removes facts", () => {
    // Pre-populate context.md
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Old fact about PostgreSQL\n- Keep this fact\n- Another old fact about pg\n");

    applyContextUpdates(tmpDir, "test-agent", [{ action: "remove", content: "PostgreSQL" }]);

    const content = readFileSync(contextPath, "utf-8");
    expect(content).not.toContain("PostgreSQL");
    expect(content).toContain("Keep this fact");
    // "pg" line stays — we only removed lines containing "PostgreSQL", not "pg"
    expect(content).toContain("Another old fact about pg");
  });

  it("applyContextUpdates deduplicates", () => {
    applyContextUpdates(tmpDir, "test-agent", [
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
      { action: "add", content: "Fact A" },
    ]);

    const content = readFileSync(contextPath, "utf-8");
    const matches = content.match(/Fact A/g);
    expect(matches?.length).toBe(1);
  });

  it("applyContextUpdates is idempotent for existing content", () => {
    // Pre-populate context.md with a fact
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(contextPath, "- Existing fact\n");

    // Try to add the same fact again
    applyContextUpdates(tmpDir, "test-agent", [{ action: "add", content: "Existing fact" }]);

    const content = readFileSync(contextPath, "utf-8");
    const matches = content.match(/Existing fact/g);
    expect(matches?.length).toBe(1);
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
      fileWriteScope: agentFileWriteScope(tmpDir, source, config),
      model: fakeModel(),
      tools: [],
      projectRoot: tmpDir,
      sharedRoot: join(releaseRoot, "shared"),
      globalAgentsRoot: join(releaseRoot, "agents"),
    });
    expect(definition.agentDir).toBe(join(releaseRoot, "projects", "sample.app", "agents", "local-owner"));
    expect(definition.agentRelativeDir).toBe("projects/sample.app/agents/local-owner");
    const writeContext = createContextUpdater(tmpDir);
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
      writeContext(event);
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
      expect(readFileSync(join(appAgentDir, "context.md"), "utf8")).toContain(`- ${summary}`);
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
        fileWriteScope: agentFileWriteScope(tmpDir, globalSource, config),
        model: fakeModel(),
        tools: [],
        projectRoot: tmpDir,
        sharedRoot: join(tmpDir, "shared"),
        globalAgentsRoot: agentsDir,
      });
      const appFiles = ["context.md", "last-session.md"].map((file) => readFileSync(join(appAgentDir, file), "utf8"));
      complete(globalDefinition.agentRelativeDir, "Global work finished");
      for (const [index, file] of ["context.md", "last-session.md"].entries()) {
        expect(readFileSync(join(globalAgentDir, file), "utf8")).toContain("Global work finished");
        expect(readFileSync(join(appAgentDir, file), "utf8")).toBe(appFiles[index]);
      }
    }
  });
});
