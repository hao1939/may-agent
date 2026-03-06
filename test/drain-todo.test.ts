import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { parseTodoItems, createDrainTodoHandler } from "../run/handlers/drain-todo.js";

describe("drain-todo (LLM-to-JS #4)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "drain-todo-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("parseTodoItems", () => {
    it("parses simple TODO items", () => {
      const content = `# TODO
- Item one
- Item two
- Item three

# Tracking
- Done item
`;
      const items = parseTodoItems(content);
      expect(items).toEqual(["- Item one", "- Item two", "- Item three"]);
    });

    it("handles multi-line items with indented continuation", () => {
      const content = `# TODO
- [2026-03-05] First item with details
  More details on the next line
  And another line
- Second item

# Tracking
`;
      const items = parseTodoItems(content);
      expect(items).toHaveLength(2);
      expect(items[0]).toContain("First item with details");
      expect(items[0]).toContain("More details on the next line");
      expect(items[0]).toContain("And another line");
      expect(items[1]).toBe("- Second item");
    });

    it("handles ## sub-headings within TODO section", () => {
      const content = `# TODO

## Research Tasks

- [ ] Research item one
- [ ] Research item two

## OpenClaw Learnings

- [ ] Learning item one

# Tracking
- Done
`;
      const items = parseTodoItems(content);
      expect(items).toHaveLength(3);
      expect(items[0]).toContain("Research item one");
      expect(items[1]).toContain("Research item two");
      expect(items[2]).toContain("Learning item one");
    });

    it("returns empty array when no TODO section", () => {
      const content = `# Tracking
- Done item 1
- Done item 2
`;
      const items = parseTodoItems(content);
      expect(items).toEqual([]);
    });

    it("returns empty array when TODO section is empty", () => {
      const content = `# TODO

# Tracking
- Done item 1
`;
      const items = parseTodoItems(content);
      expect(items).toEqual([]);
    });

    it("handles TODO section at end of file (no trailing heading)", () => {
      const content = `# TODO
- Item at end of file
- Another item
`;
      const items = parseTodoItems(content);
      expect(items).toHaveLength(2);
      expect(items[0]).toBe("- Item at end of file");
      expect(items[1]).toBe("- Another item");
    });

    it("handles checkbox-style items", () => {
      const content = `# TODO
- [ ] Unchecked item
- [x] Checked item (still listed)
`;
      const items = parseTodoItems(content);
      expect(items).toHaveLength(2);
      expect(items[0]).toContain("Unchecked item");
      expect(items[1]).toContain("Checked item");
    });

    it("handles complex real-world todo.md", () => {
      const content = `# TODO
- [2026-03-05] LLM-to-JS #4: Implement drain-todo JS handler. The \`optimizer-drain-todo\`, \`bob-drain-todo\`, and \`drain-todo\` cron jobs all follow the same formulaic pattern.
- [2026-03-05] SubagentManager health API: Move system-status logic into manager as first-class API.

# Tracking

- [2026-03-05] ✅ LLM-to-JS #1: Aborted/meta-agent session evaluations.
- [2026-03-22] ✅ Shrink guard for write tool.
`;
      const items = parseTodoItems(content);
      expect(items).toHaveLength(2);
      expect(items[0]).toContain("LLM-to-JS #4");
      expect(items[1]).toContain("SubagentManager health API");
    });
  });

  describe("createDrainTodoHandler", () => {
    it("skips silently when no todo.md exists", async () => {
      const logs: string[] = [];
      const mockManager = { run: vi.fn(), followUp: vi.fn() } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "optimizer", targetAgent: "optimizer", mode: "run" },
        { agentsRoot: join(dir, "agents"), manager: mockManager, onLog: (msg) => logs.push(msg) },
      );

      await handler();

      expect(mockManager.run).not.toHaveBeenCalled();
      expect(mockManager.followUp).not.toHaveBeenCalled();
      expect(logs.some(l => l.includes("No todo.md found"))).toBe(true);
    });

    it("skips silently when TODO section is empty", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "optimizer", "workspace"), { recursive: true });
      writeFileSync(join(agentsRoot, "optimizer", "workspace", "todo.md"), "# TODO\n\n# Tracking\n- Done\n");

      const logs: string[] = [];
      const mockManager = { run: vi.fn(), followUp: vi.fn() } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "optimizer", targetAgent: "optimizer", mode: "run" },
        { agentsRoot, manager: mockManager, onLog: (msg) => logs.push(msg) },
      );

      await handler();

      expect(mockManager.run).not.toHaveBeenCalled();
      expect(logs.some(l => l.includes("No TODO items"))).toBe(true);
    });

    it("delegates to target agent via manager.run() in 'run' mode", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "optimizer", "workspace"), { recursive: true });
      writeFileSync(
        join(agentsRoot, "optimizer", "workspace", "todo.md"),
        "# TODO\n- Implement feature X\n- Fix bug Y\n\n# Tracking\n",
      );

      const logs: string[] = [];
      const mockManager = { run: vi.fn().mockReturnValue("s_test_1"), followUp: vi.fn() } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "optimizer", targetAgent: "optimizer", mode: "run" },
        { agentsRoot, manager: mockManager, onLog: (msg) => logs.push(msg) },
      );

      await handler();

      expect(mockManager.run).toHaveBeenCalledTimes(1);
      expect(mockManager.run).toHaveBeenCalledWith(
        "optimizer",
        expect.stringContaining("Implement feature X"),
        { source: "cron" },
      );
      expect(mockManager.followUp).not.toHaveBeenCalled();
      expect(logs.some(l => l.includes("Found 2 item(s)"))).toBe(true);
      expect(logs.some(l => l.includes("s_test_1"))).toBe(true);
    });

    it("only delegates the TOP item, not all items", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "bob", "workspace"), { recursive: true });
      writeFileSync(
        join(agentsRoot, "bob", "workspace", "todo.md"),
        "# TODO\n- First item\n- Second item\n- Third item\n",
      );

      const mockManager = { run: vi.fn().mockReturnValue("s_test_1") } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "bob", targetAgent: "bob", mode: "run" },
        { agentsRoot, manager: mockManager },
      );

      await handler();

      expect(mockManager.run).toHaveBeenCalledTimes(1);
      const taskArg = mockManager.run.mock.calls[0][1];
      expect(taskArg).toContain("First item");
      expect(taskArg).not.toContain("Second item");
      expect(taskArg).not.toContain("Third item");
    });

    it("sends followUp in 'followUp' mode (May self-drain)", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "may", "workspace"), { recursive: true });
      writeFileSync(
        join(agentsRoot, "may", "workspace", "todo.md"),
        "# TODO\n- Check health status\n\n# Tracking\n",
      );

      const logs: string[] = [];
      const mockManager = { run: vi.fn(), followUp: vi.fn() } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "may", targetAgent: "may", mode: "followUp", getSessionId: () => "s_may_1" },
        { agentsRoot, manager: mockManager, onLog: (msg) => logs.push(msg) },
      );

      await handler();

      expect(mockManager.followUp).toHaveBeenCalledTimes(1);
      expect(mockManager.followUp).toHaveBeenCalledWith(
        "s_may_1",
        expect.stringContaining("Check health status"),
        "cron",
      );
      expect(mockManager.run).not.toHaveBeenCalled();
    });

    it("errors when followUp mode has no getSessionId", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "may", "workspace"), { recursive: true });
      writeFileSync(
        join(agentsRoot, "may", "workspace", "todo.md"),
        "# TODO\n- Some item\n",
      );

      const logs: string[] = [];
      const mockManager = { run: vi.fn(), followUp: vi.fn() } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "may", targetAgent: "may", mode: "followUp" },
        { agentsRoot, manager: mockManager, onLog: (msg) => logs.push(msg) },
      );

      await handler();

      expect(mockManager.followUp).not.toHaveBeenCalled();
      expect(mockManager.run).not.toHaveBeenCalled();
      expect(logs.some(l => l.includes("ERROR: followUp mode requires getSessionId"))).toBe(true);
    });

    it("handles items with sub-headings (bob's research tasks)", async () => {
      const agentsRoot = join(dir, "agents");
      mkdirSync(join(agentsRoot, "bob", "workspace"), { recursive: true });
      writeFileSync(
        join(agentsRoot, "bob", "workspace", "todo.md"),
        `# TODO

## Research Tasks

- [ ] **Anthropic Skill Creator** — Research how it works
- [ ] **RALPH Loop** — Investigate the RALPH pattern

## OpenClaw Learnings

- [ ] **Import Design Philosophy** — Read principles

# Tracking
- Done
`,
      );

      const mockManager = { run: vi.fn().mockReturnValue("s_bob_1") } as any;

      const handler = createDrainTodoHandler(
        { sourceAgent: "bob", targetAgent: "bob", mode: "run" },
        { agentsRoot, manager: mockManager },
      );

      await handler();

      expect(mockManager.run).toHaveBeenCalledTimes(1);
      const taskArg = mockManager.run.mock.calls[0][1];
      expect(taskArg).toContain("Anthropic Skill Creator");
      // Should only include the first item
      expect(taskArg).not.toContain("RALPH Loop");
    });
  });
});
