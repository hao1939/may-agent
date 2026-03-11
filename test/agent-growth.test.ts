
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SubagentManager } from "../src/lib/manager.js";
import { createAgentGrowthTools } from "../src/lib/tools/agent-growth.js";
import { join, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { EventBus } from "../src/app/event-bus.js";

const TEST_DIR = resolve("test-workspace/agent-growth");
const AGENTS_ROOT = join(TEST_DIR, "agents");
const PERSIST_DIR = join(TEST_DIR, "state");

describe("Agent Growth Tools", () => {
  let manager: SubagentManager;
  let bus: EventBus;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(AGENTS_ROOT, { recursive: true });
    mkdirSync(PERSIST_DIR, { recursive: true });

    bus = new EventBus();
    manager = new SubagentManager({
      persistDir: PERSIST_DIR,
      projectRoot: TEST_DIR,
    });

    // Create a dummy "coder" agent to fork
    const coderDir = join(AGENTS_ROOT, "coder");
    mkdirSync(coderDir, { recursive: true });
    writeFileSync(join(coderDir, "agent.json"), JSON.stringify({
      name: "coder",
      description: "Original Coder",
      domain: "coding",
      model: "test-model",
      tools: [],
    }));
    writeFileSync(join(coderDir, "SOUL.md"), "I am Coder.");
    
    // Register the "coder" agent manually so the manager knows it (for verification)
    manager.register({
      name: "coder",
      description: "Original Coder",
      domain: "coding",
      model: { id: "test", provider: "test" } as any,
      tools: [],
      projectRoot: TEST_DIR,
    });
  });

  afterEach(() => {
    // rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("should fork, verify, promote, and discard agents", async () => {
    // 1. Setup tools
    const tools = createAgentGrowthTools({
      agentsRoot: AGENTS_ROOT,
      manager,
      loadAgent: (dir) => {
        const config = JSON.parse(readFileSync(join(dir, "agent.json"), "utf-8"));
        manager.register({
          name: config.name,
          description: config.description,
          domain: config.domain,
          model: { id: "test", provider: "test" } as any,
          tools: [], // Simplified for test
          projectRoot: TEST_DIR,
          systemPrompt: "You are a test agent.",
        });
      },
      reloadAgent: (name) => {
         // Mock reload - just re-register
         const dir = join(AGENTS_ROOT, name);
         const config = JSON.parse(readFileSync(join(dir, "agent.json"), "utf-8"));
         manager.register({
          name: config.name,
          description: config.description,
          domain: config.domain,
          model: { id: "test", provider: "test" } as any,
          tools: [],
          projectRoot: TEST_DIR,
          systemPrompt: "You are a test agent.",
        });
      }
    });

    const forkTool = tools.find(t => t.name === "fork_agent")!;
    const verifyTool = tools.find(t => t.name === "verify_agent")!;
    const promoteTool = tools.find(t => t.name === "promote_agent")!;
    const discardTool = tools.find(t => t.name === "discard_agent")!;

    // 2. Test Fork
    await forkTool.execute("call-1", { source: "coder", dest: "coder-v2" });
    
    const forkDir = join(AGENTS_ROOT, ".lab", "coder-v2");
    expect(existsSync(forkDir)).toBe(true);
    expect(existsSync(join(forkDir, "SOUL.md"))).toBe(true);
    
    const forkConfig = JSON.parse(readFileSync(join(forkDir, "agent.json"), "utf-8"));
    expect(forkConfig.name).toBe("coder-v2");
    
    expect(manager.hasAgent("coder-v2")).toBe(true);

    // 3. Modify Fork (simulate coach edit)
    writeFileSync(join(forkDir, "SOUL.md"), "I am Coder V2.");

    // 4. Test Verify
    // Mock callAgent response since we don't have a real LLM here
    // We override manager.callAgent for the test
    manager.callAgent = async (name, task) => {
      return {
        sessionId: "test-session",
        status: "done",
        lastAssistantText: `I am ${name} and I did ${task}`,
        messages: [],
        duration: "0s",
        outputDir: "",
      };
    };

    const verifyResult = await verifyTool.execute("call-2", { agent: "coder-v2", task: "who are you?" });
    expect((verifyResult.content[0] as any).text).toContain("Verification run for coder-v2");

    // 5. Test Promote
    await promoteTool.execute("call-3", { source: "coder-v2", target: "coder" });

    // Check files copied back
    const originalSoul = readFileSync(join(AGENTS_ROOT, "coder", "SOUL.md"), "utf-8");
    expect(originalSoul).toBe("I am Coder V2.");

    // Check fork removed
    expect(existsSync(forkDir)).toBe(false);
    expect(manager.hasAgent("coder-v2")).toBe(false);

    // 6. Test Discard
    // Re-fork to test discard
    await forkTool.execute("call-4", { source: "coder", dest: "coder-v3" });
    expect(manager.hasAgent("coder-v3")).toBe(true);
    
    await discardTool.execute("call-5", { agent: "coder-v3" });
    
    expect(existsSync(join(AGENTS_ROOT, ".lab", "coder-v3"))).toBe(false);
    expect(manager.hasAgent("coder-v3")).toBe(false);
  });
});
