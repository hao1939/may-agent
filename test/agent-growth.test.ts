import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import { createAgentGrowthTools } from "../src/lib/tools/agent-growth.js";
import {
  forkAgent,
  promoteAgent,
  discardAgent,
  listLabAgents,
} from "../src/lib/growth.js";
import type { GrowthConfig } from "../src/lib/growth.js";
import { join, resolve } from "node:path";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { EventBus } from "../src/app/event-bus.js";

const TEST_DIR = resolve("test-workspace/agent-growth");
const AGENTS_ROOT = join(TEST_DIR, "agents");
const PERSIST_DIR = join(TEST_DIR, "state");

/** Helper: create a minimal agent directory. */
function createTestAgent(name: string, extras?: Record<string, string>) {
  const dir = join(AGENTS_ROOT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "agent.json"),
    JSON.stringify({
      name,
      description: `Test ${name}`,
      domain: "testing",
      model: "test-model",
      tools: [],
    }),
  );
  writeFileSync(join(dir, "SOUL.md"), `I am ${name}.`);
  if (extras) {
    for (const [path, content] of Object.entries(extras)) {
      const fullPath = join(dir, path);
      mkdirSync(join(fullPath, ".."), { recursive: true });
      writeFileSync(fullPath, content);
    }
  }
}

/** Helper: create a memory file for an agent. */
function createTestMemory(name: string) {
  const memDir = join(PERSIST_DIR, "memory");
  mkdirSync(memDir, { recursive: true });
  writeFileSync(
    join(memDir, `${name}.jsonl`),
    JSON.stringify({ ts: Date.now(), text: `Memory for ${name}` }) + "\n",
  );
}

// ── Core Logic Tests (src/lib/growth.ts) ───────────────────────────────

describe("Growth Core Logic", () => {
  let config: GrowthConfig;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(AGENTS_ROOT, { recursive: true });
    mkdirSync(PERSIST_DIR, { recursive: true });
    config = { agentsRoot: AGENTS_ROOT, persistDir: PERSIST_DIR };
    createTestAgent("coder");
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("forkAgent", () => {
    it("should copy agent directory to .lab/", () => {
      const result = forkAgent(config, "coder", "coder-v2");

      expect(existsSync(result.destDir)).toBe(true);
      expect(existsSync(join(result.destDir, "SOUL.md"))).toBe(true);
      expect(readFileSync(join(result.destDir, "SOUL.md"), "utf-8")).toBe(
        "I am coder.",
      );
    });

    it("should update agent.json name in the fork", () => {
      forkAgent(config, "coder", "coder-v2");

      const forkConfig = JSON.parse(
        readFileSync(
          join(AGENTS_ROOT, ".lab", "coder-v2", "agent.json"),
          "utf-8",
        ),
      );
      expect(forkConfig.name).toBe("coder-v2");
      // Original should be unchanged
      const origConfig = JSON.parse(
        readFileSync(join(AGENTS_ROOT, "coder", "agent.json"), "utf-8"),
      );
      expect(origConfig.name).toBe("coder");
    });

    it("should copy memory when persistDir is set", () => {
      createTestMemory("coder");
      forkAgent(config, "coder", "coder-v2");

      const destMemory = join(PERSIST_DIR, "memory", "coder-v2.jsonl");
      expect(existsSync(destMemory)).toBe(true);
    });

    it("should work without persistDir (no memory copy)", () => {
      const noMemConfig: GrowthConfig = { agentsRoot: AGENTS_ROOT };
      createTestMemory("coder");
      forkAgent(noMemConfig, "coder", "coder-v2");

      // Fork created but no memory copied
      expect(
        existsSync(join(AGENTS_ROOT, ".lab", "coder-v2")),
      ).toBe(true);
    });

    it("should throw if source doesn't exist", () => {
      expect(() => forkAgent(config, "nonexistent", "test")).toThrow(
        'Source agent "nonexistent" not found',
      );
    });

    it("should throw if destination already exists", () => {
      forkAgent(config, "coder", "coder-v2");
      expect(() => forkAgent(config, "coder", "coder-v2")).toThrow(
        'Destination "coder-v2" already exists',
      );
    });
  });

  describe("promoteAgent", () => {
    it("should copy content files back to live agent", () => {
      // Fork, modify, promote
      forkAgent(config, "coder", "coder-v2");
      const forkDir = join(AGENTS_ROOT, ".lab", "coder-v2");
      writeFileSync(join(forkDir, "SOUL.md"), "I am Coder V2 — improved.");

      const result = promoteAgent(config, "coder-v2", "coder");

      expect(result.promoted).toContain("SOUL.md");
      expect(
        readFileSync(join(AGENTS_ROOT, "coder", "SOUL.md"), "utf-8"),
      ).toBe("I am Coder V2 — improved.");
    });

    it("should preserve original agent.json (name, model, tools)", () => {
      forkAgent(config, "coder", "coder-v2");
      // Modify the fork's agent.json
      const forkConfigPath = join(
        AGENTS_ROOT,
        ".lab",
        "coder-v2",
        "agent.json",
      );
      const forkConfig = JSON.parse(readFileSync(forkConfigPath, "utf-8"));
      forkConfig.model = "expensive-model";
      forkConfig.description = "Modified fork";
      writeFileSync(forkConfigPath, JSON.stringify(forkConfig, null, 2));

      promoteAgent(config, "coder-v2", "coder");

      // Original agent.json should be unchanged
      const origConfig = JSON.parse(
        readFileSync(join(AGENTS_ROOT, "coder", "agent.json"), "utf-8"),
      );
      expect(origConfig.name).toBe("coder");
      expect(origConfig.model).toBe("test-model");
    });

    it("should promote knowledge/ and skills/ directories", () => {
      createTestAgent("coder", {
        "knowledge/INDEX.md": "# Knowledge\n- basics",
        "skills/debugging.md": "# Debugging skill",
      });
      forkAgent(config, "coder", "coder-v2");

      const forkDir = join(AGENTS_ROOT, ".lab", "coder-v2");
      writeFileSync(
        join(forkDir, "knowledge", "INDEX.md"),
        "# Knowledge\n- basics\n- advanced",
      );
      writeFileSync(
        join(forkDir, "skills", "testing.md"),
        "# Testing skill",
      );

      const result = promoteAgent(config, "coder-v2", "coder");

      expect(result.promoted).toContain("knowledge");
      expect(result.promoted).toContain("skills");
      expect(
        readFileSync(
          join(AGENTS_ROOT, "coder", "knowledge", "INDEX.md"),
          "utf-8",
        ),
      ).toContain("advanced");
      expect(
        existsSync(join(AGENTS_ROOT, "coder", "skills", "testing.md")),
      ).toBe(true);
    });

    it("should delete the lab fork after promote", () => {
      forkAgent(config, "coder", "coder-v2");
      promoteAgent(config, "coder-v2", "coder");

      expect(
        existsSync(join(AGENTS_ROOT, ".lab", "coder-v2")),
      ).toBe(false);
    });

    it("should throw if source not in .lab/", () => {
      expect(() => promoteAgent(config, "nonexistent", "coder")).toThrow(
        'Source "nonexistent" not found in .lab/',
      );
    });

    it("should throw if target not in agents/", () => {
      forkAgent(config, "coder", "coder-v2");
      expect(() =>
        promoteAgent(config, "coder-v2", "nonexistent"),
      ).toThrow('Target "nonexistent" not found in agents/');
    });
  });

  describe("discardAgent", () => {
    it("should remove the lab fork directory", () => {
      forkAgent(config, "coder", "coder-v2");
      discardAgent(config, "coder-v2");

      expect(
        existsSync(join(AGENTS_ROOT, ".lab", "coder-v2")),
      ).toBe(false);
    });

    it("should remove memory state", () => {
      forkAgent(config, "coder", "coder-v2");
      createTestMemory("coder-v2");

      discardAgent(config, "coder-v2");

      expect(
        existsSync(join(PERSIST_DIR, "memory", "coder-v2.jsonl")),
      ).toBe(false);
    });

    it("should throw if agent not in .lab/", () => {
      expect(() => discardAgent(config, "nonexistent")).toThrow(
        'Agent "nonexistent" not found in .lab/',
      );
    });
  });

  describe("listLabAgents", () => {
    it("should return empty array when no forks exist", () => {
      expect(listLabAgents(AGENTS_ROOT)).toEqual([]);
    });

    it("should list all forked agents", () => {
      forkAgent(config, "coder", "coder-v2");
      forkAgent(config, "coder", "coder-v3");

      const agents = listLabAgents(AGENTS_ROOT);
      expect(agents).toContain("coder-v2");
      expect(agents).toContain("coder-v3");
      expect(agents).toHaveLength(2);
    });
  });
});

// ── Tool Wrapper Tests (src/lib/tools/agent-growth.ts) ─────────────────

describe("Agent Growth Tools (wrappers)", () => {
  let manager: SubagentManager;

  function registerTestAgent(name: string) {
    manager.register({
      name,
      description: `Test ${name}`,
      domain: "testing",
      model: { id: "test", provider: "test" } as any,
      tools: [],
      projectRoot: TEST_DIR,
    });
  }

  function createTools() {
    return createAgentGrowthTools({
      agentsRoot: AGENTS_ROOT,
      manager,
      persistDir: PERSIST_DIR,
      loadAgent: (dir) => {
        const config = JSON.parse(
          readFileSync(join(dir, "agent.json"), "utf-8"),
        );
        registerTestAgent(config.name);
      },
      reloadAgent: (name) => {
        const dir = join(AGENTS_ROOT, name);
        const config = JSON.parse(
          readFileSync(join(dir, "agent.json"), "utf-8"),
        );
        registerTestAgent(config.name);
      },
    });
  }

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(AGENTS_ROOT, { recursive: true });
    mkdirSync(PERSIST_DIR, { recursive: true });

    manager = new SubagentManager({
      persistDir: PERSIST_DIR,
      projectRoot: TEST_DIR,
      infraRetryMax: 0,
    });

    createTestAgent("coder");
    registerTestAgent("coder");
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("fork_agent registers the fork with the manager", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;

    const result = await forkTool.execute("call-1", {
      source: "coder",
      dest: "coder-v2",
    });

    expect(manager.hasAgent("coder-v2")).toBe(true);
    expect((result.content[0] as any).text).toContain('Forked "coder"');
  });

  it("verify_agent runs the agent and returns output", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;
    const verifyTool = tools.find((t) => t.name === "verify_agent")!;

    await forkTool.execute("call-1", { source: "coder", dest: "coder-v2" });

    // Mock callAgent
    manager.callAgent = async (name, task) => ({
      sessionId: "test-session",
      status: "done",
      lastAssistantText: `I am ${name} and I did: ${task}`,
      messages: [],
      duration: "0s",
      outputDir: "",
    });

    const result = await verifyTool.execute("call-2", {
      agent: "coder-v2",
      task: "write hello world",
    });
    expect((result.content[0] as any).text).toContain(
      "Verification run for coder-v2",
    );
  });

  it("verify_agent throws if agent not registered", async () => {
    const tools = createTools();
    const verifyTool = tools.find((t) => t.name === "verify_agent")!;

    await expect(
      verifyTool.execute("call-1", {
        agent: "nonexistent",
        task: "test",
      }),
    ).rejects.toThrow("not registered");
  });

  it("promote_agent unregisters fork and reloads target", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;
    const promoteTool = tools.find((t) => t.name === "promote_agent")!;

    await forkTool.execute("call-1", { source: "coder", dest: "coder-v2" });

    // Modify the fork
    writeFileSync(
      join(AGENTS_ROOT, ".lab", "coder-v2", "SOUL.md"),
      "Improved coder.",
    );

    const result = await promoteTool.execute("call-2", {
      source: "coder-v2",
      target: "coder",
    });

    expect(manager.hasAgent("coder-v2")).toBe(false);
    expect(manager.hasAgent("coder")).toBe(true);
    expect(
      readFileSync(join(AGENTS_ROOT, "coder", "SOUL.md"), "utf-8"),
    ).toBe("Improved coder.");
    expect((result.content[0] as any).text).toContain('Promoted "coder-v2"');
  });

  it("discard_agent unregisters and removes the fork", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;
    const discardTool = tools.find((t) => t.name === "discard_agent")!;

    await forkTool.execute("call-1", { source: "coder", dest: "coder-v2" });
    expect(manager.hasAgent("coder-v2")).toBe(true);

    const result = await discardTool.execute("call-2", {
      agent: "coder-v2",
    });

    expect(manager.hasAgent("coder-v2")).toBe(false);
    expect(
      existsSync(join(AGENTS_ROOT, ".lab", "coder-v2")),
    ).toBe(false);
    expect((result.content[0] as any).text).toContain("Discarded");
  });

  it("full lifecycle: fork → modify → verify → promote", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;
    const verifyTool = tools.find((t) => t.name === "verify_agent")!;
    const promoteTool = tools.find((t) => t.name === "promote_agent")!;

    // Mock callAgent for verify
    manager.callAgent = async (name, task) => ({
      sessionId: "test-session",
      status: "done",
      lastAssistantText: `Result from ${name}`,
      messages: [],
      duration: "0s",
      outputDir: "",
    });

    // 1. Fork
    await forkTool.execute("c1", { source: "coder", dest: "coder-exp" });
    expect(manager.hasAgent("coder-exp")).toBe(true);

    // 2. Modify
    writeFileSync(
      join(AGENTS_ROOT, ".lab", "coder-exp", "SOUL.md"),
      "Enhanced coder with new skills.",
    );

    // 3. Verify
    const verifyResult = await verifyTool.execute("c2", {
      agent: "coder-exp",
      task: "solve a problem",
    });
    expect((verifyResult.content[0] as any).text).toContain("coder-exp");

    // 4. Promote
    await promoteTool.execute("c3", {
      source: "coder-exp",
      target: "coder",
    });

    // Verify final state
    expect(manager.hasAgent("coder-exp")).toBe(false);
    expect(
      readFileSync(join(AGENTS_ROOT, "coder", "SOUL.md"), "utf-8"),
    ).toBe("Enhanced coder with new skills.");
    // Original agent.json name preserved
    const finalConfig = JSON.parse(
      readFileSync(join(AGENTS_ROOT, "coder", "agent.json"), "utf-8"),
    );
    expect(finalConfig.name).toBe("coder");
  });

  it("full lifecycle: fork → modify → discard", async () => {
    const tools = createTools();
    const forkTool = tools.find((t) => t.name === "fork_agent")!;
    const discardTool = tools.find((t) => t.name === "discard_agent")!;

    // 1. Fork
    await forkTool.execute("c1", { source: "coder", dest: "coder-fail" });

    // 2. Modify (but it's bad)
    writeFileSync(
      join(AGENTS_ROOT, ".lab", "coder-fail", "SOUL.md"),
      "This change is terrible.",
    );

    // 3. Discard
    await discardTool.execute("c2", { agent: "coder-fail" });

    // Original untouched
    expect(
      readFileSync(join(AGENTS_ROOT, "coder", "SOUL.md"), "utf-8"),
    ).toBe("I am coder.");
    expect(manager.hasAgent("coder-fail")).toBe(false);
  });
});
