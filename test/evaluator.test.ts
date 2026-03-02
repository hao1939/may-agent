import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { SubagentManager } from "../src/manager.js";
import { evaluateSession, maintainAgent } from "../src/evaluator.js";
import type { EvaluationResult, EvaluationScores, MaintenanceResult } from "../src/evaluator.js";
import { historyDir, ensureSessionDir, appendSessionMessage } from "../src/persistence.js";

// ── Helpers ────────────────────────────────────────────────────────────

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
}

function userMessage(text: string): AgentMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function assistantMessage(text: string): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function toolCallMessage(name: string, args: Record<string, unknown>): AgentMessage {
  return {
    role: "assistant",
    content: [{ type: "toolCall", id: "tc_1", name, arguments: args }],
    timestamp: Date.now(),
  } as AgentMessage;
}

function toolResultMessage(toolName: string, text: string): AgentMessage {
  return {
    role: "toolResult",
    toolName,
    toolCallId: "tc_1",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  } as AgentMessage;
}

/**
 * Build a well-formed evaluator response text with scores, lessons, and
 * optionally a workflow suggestion.
 */
function buildEvalResponse(opts: {
  scores?: Partial<EvaluationScores>;
  lessons?: string;
  workflowCode?: string;
}): string {
  const scores: EvaluationScores = {
    efficiency: 8,
    quality: 9,
    pattern_detected: false,
    pattern_name: null,
    total_tool_calls: 5,
    productive_calls: 4,
    wasted_calls: 1,
    verdict: "good",
    ...opts.scores,
  };

  // Emit the nested format the evaluator actually produces
  const nested = {
    agents: {
      agent: {
        efficiency: scores.efficiency,
        quality: scores.quality,
        wasted_calls: scores.wasted_calls,
        productive_calls: scores.productive_calls,
        metrics: {},
      },
    },
    workflow: null,
    overall: {
      efficiency: scores.efficiency,
      quality: scores.quality,
      verdict: scores.verdict,
    },
    verifications: [],
  };

  const parts: string[] = [];
  parts.push("# Evaluation\n");
  parts.push("```json\n" + JSON.stringify(nested, null, 2) + "\n```\n");

  if (opts.lessons) {
    parts.push("### Lessons\n" + opts.lessons + "\n");
  }

  if (opts.workflowCode) {
    parts.push("### Workflow Suggestion\nHere is a workflow:\n```typescript\n" + opts.workflowCode + "\n```\n");
  }

  return parts.join("\n");
}

/**
 * Build a well-formed maintenance response with domain.md, lessons.md,
 * and a maintenance report JSON section.
 */
function buildMaintenanceResponse(opts: {
  lessons?: string;
  report?: Partial<{ lessonsPruned: number; suggestions: string[]; staleItems: string[]; toolIssues: string[] }>;
}): string {
  const parts: string[] = [];
  parts.push("# Maintenance Results\n");

  if (opts.lessons !== undefined) {
    parts.push("### Updated lessons.md\n```markdown\n" + opts.lessons + "\n```\n");
  }

  const report = {
    lessonsPruned: opts.report?.lessonsPruned ?? 0,
    suggestions: opts.report?.suggestions ?? [],
    staleItems: opts.report?.staleItems ?? [],
    toolIssues: opts.report?.toolIssues ?? [],
    ...opts.report,
  };

  parts.push("### Maintenance Report\n```json\n" + JSON.stringify(report, null, 2) + "\n```\n");

  return parts.join("\n");
}

/**
 * Create a mock SubagentManager whose `run()` and `waitFor()` are stubbed
 * so no real LLM call is made.  The evaluator agent returns `responseText`.
 */
function mockManager(responseText: string): SubagentManager {
  const manager = new SubagentManager();
  const fakeSessionId = "eval_mock_1";

  vi.spyOn(manager, "run").mockReturnValue(fakeSessionId);
  vi.spyOn(manager, "waitFor").mockResolvedValue({
    sessionId: fakeSessionId,
    status: "done",
    lastAssistantText: responseText,
    messages: [assistantMessage(responseText)],
    duration: "2s",
    outputDir: "",
  });

  return manager;
}

/**
 * Create a mock SubagentManager that returns null lastAssistantText.
 */
function mockManagerNullText(): SubagentManager {
  const manager = new SubagentManager();
  const fakeSessionId = "eval_null_text";

  vi.spyOn(manager, "run").mockReturnValue(fakeSessionId);
  vi.spyOn(manager, "waitFor").mockResolvedValue({
    sessionId: fakeSessionId,
    status: "done",
    lastAssistantText: null,
    messages: [],
    duration: "1s",
    outputDir: "",
  });

  return manager;
}

/**
 * Seed a session transcript in the history directory (as evaluateSession reads
 * from history JSONL first).
 */
function seedHistorySession(
  persistDir: string,
  sessionId: string,
  messages: AgentMessage[],
): void {
  const dir = join(historyDir(persistDir), sessionId);
  mkdirSync(dir, { recursive: true });
  const jsonl = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  writeFileSync(join(dir, "session.jsonl"), jsonl, "utf-8");
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("evaluateSession", () => {
  let persistDir: string;
  let knowledgeDir: string;
  let workflowDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "eval-test-"));
    knowledgeDir = join(persistDir, "knowledge");
    workflowDir = join(persistDir, "workflows");
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── Empty session handling ──────────────────────────────────────────

  describe("empty session", () => {
    it("returns defaults when no transcript is found", async () => {
      const manager = mockManager("");
      const result = await evaluateSession({
        manager,
        sessionId: "nonexistent-session",
        agentName: "test-agent",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.raw).toBe("(no session transcript found)");
      expect(result.scores.verdict).toBe("needs_improvement");
      expect(result.scores.efficiency).toBe(0);
      expect(result.scores.quality).toBe(0);
      expect(result.lessons).toBeNull();
      expect(result.workflowCode).toBeNull();
      expect(result.workflowName).toBeNull();

      // Manager.run should NOT have been called (no transcript → early return)
      expect(manager.run).not.toHaveBeenCalled();
    });
  });

  // ── Score parsing ───────────────────────────────────────────────────

  describe("score parsing", () => {
    it("extracts JSON scores from evaluator response", async () => {
      const responseText = buildEvalResponse({
        scores: {
          efficiency: 7,
          quality: 8,
          pattern_detected: true,
          pattern_name: "file-search-loop",
          total_tool_calls: 12,
          productive_calls: 9,
          wasted_calls: 3,
          verdict: "acceptable",
        },
      });

      const manager = mockManager(responseText);
      const sessionId = "score-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("implement feature X"),
        assistantMessage("Done."),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(7);
      expect(result.scores.quality).toBe(8);
      expect(result.scores.total_tool_calls).toBe(12);
      expect(result.scores.productive_calls).toBe(9);
      expect(result.scores.wasted_calls).toBe(3);
      expect(result.scores.verdict).toBe("acceptable");
    });

    it("keeps defaults when JSON block is malformed", async () => {
      const responseText = "# Evaluation\n\n```json\n{not valid json}\n```\n";
      const manager = mockManager(responseText);
      const sessionId = "bad-json-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("do something"),
        assistantMessage("ok"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(0);
      expect(result.scores.quality).toBe(0);
      expect(result.scores.verdict).toBe("needs_improvement");
    });

    it("keeps defaults when no JSON block is present", async () => {
      const responseText = "# Evaluation\n\nThis session was fine.\n";
      const manager = mockManager(responseText);
      const sessionId = "no-json-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("do something"),
        assistantMessage("ok"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(0);
      expect(result.scores.verdict).toBe("needs_improvement");
    });

    it("merges partial JSON with defaults", async () => {
      const responseText = '# Evaluation\n\n```json\n{"overall": {"efficiency": 10, "quality": 10}}\n```\n';
      const manager = mockManager(responseText);
      const sessionId = "partial-json-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("do something"),
        assistantMessage("ok"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(10);
      expect(result.scores.quality).toBe(10);
      // Unset fields retain defaults
      expect(result.scores.verdict).toBe("needs_improvement");
      expect(result.scores.pattern_detected).toBe(false);
      expect(result.scores.total_tool_calls).toBe(0);
    });
  });

  // ── Lessons parsing & persistence ───────────────────────────────────

  describe("lessons", () => {
    it("extracts lessons from evaluator response", async () => {
      const responseText = buildEvalResponse({
        lessons: "- Always check file existence before reading\n- Use batch operations",
      });

      const manager = mockManager(responseText);
      const sessionId = "lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("implement feature"),
        assistantMessage("Done."),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.lessons).toBe(
        "- Always check file existence before reading\n- Use batch operations",
      );
    });

    it("creates lessons.md when it does not exist", async () => {
      const responseText = buildEvalResponse({
        lessons: "- Use grep before find",
      });

      const manager = mockManager(responseText);
      const sessionId = "create-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const lessonsPath = join(knowledgeDir, "lessons.md");
      expect(existsSync(lessonsPath)).toBe(true);

      const content = readFileSync(lessonsPath, "utf-8");
      expect(content).toContain("# Lessons");
      expect(content).toContain("Feedback from evaluator sessions.");
      expect(content).toContain("- Use grep before find");
      expect(content).toContain(`Session ${sessionId}`);
    });

    it("appends to existing lessons.md", async () => {
      // Create an existing lessons.md
      mkdirSync(knowledgeDir, { recursive: true });
      const lessonsPath = join(knowledgeDir, "lessons.md");
      writeFileSync(lessonsPath, "# Lessons\n\nExisting content.\n", "utf-8");

      const responseText = buildEvalResponse({
        lessons: "- New lesson from this session",
      });

      const manager = mockManager(responseText);
      const sessionId = "append-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const content = readFileSync(lessonsPath, "utf-8");
      // Original content preserved
      expect(content).toContain("Existing content.");
      // New content appended
      expect(content).toContain("- New lesson from this session");
      expect(content).toContain(`Session ${sessionId}`);
    });

    it("includes workflow name in lessons when workflowUsed is set", async () => {
      const responseText = buildEvalResponse({
        lessons: "- Workflow handled it well",
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: "implement-and-review",
        persistDir,
        knowledgeDir,
      });

      const lessonsPath = join(knowledgeDir, "lessons.md");
      const content = readFileSync(lessonsPath, "utf-8");
      expect(content).toContain("Workflow: implement-and-review");
    });

    it("does not write lessons.md when no lessons in response", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "no-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const lessonsPath = join(knowledgeDir, "lessons.md");
      expect(existsSync(lessonsPath)).toBe(false);
    });

    it("treats lessons section at end of response with only whitespace as null", async () => {
      // When ### Lessons is the last section with only whitespace, trim → empty → null
      const responseText = '# Evaluation\n\n```json\n{"overall":{"efficiency":5,"quality":0,"verdict":"needs_improvement"}}\n```\n\n### Lessons\n   \n';
      const manager = mockManager(responseText);
      const sessionId = "empty-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      // Whitespace-only lessons → trimmed to empty → treated as null
      expect(result.lessons).toBeNull();
      expect(existsSync(join(knowledgeDir, "lessons.md"))).toBe(false);
    });
  });

  // ── Workflow code parsing & file writing ────────────────────────────

  describe("workflow extraction", () => {
    const sampleWorkflowCode = [
      'export const name = "batch-file-ops";',
      'export const description = "Batch file operations to reduce tool calls.";',
      "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
      '  const result = await ctx.runAgent("coder", ctx.task);',
      '  return ctx.done(result.lastAssistantText ?? "done");',
      "}",
    ].join("\n");

    it("extracts workflow code and name from response", async () => {
      const responseText = buildEvalResponse({
        scores: { pattern_detected: true, pattern_name: "batch-file-ops" },
        workflowCode: sampleWorkflowCode,
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-extract-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      expect(result.workflowCode).toBe(sampleWorkflowCode);
      expect(result.workflowName).toBe("batch-file-ops");
    });

    it("stages workflow file to .state/staged/workflows/", async () => {
      const responseText = buildEvalResponse({
        scores: { pattern_detected: true },
        workflowCode: sampleWorkflowCode,
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-write-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      const expectedPath = join(persistDir, "staged", "workflows", "batch-file-ops.ts");
      expect(existsSync(expectedPath)).toBe(true);
      const content = readFileSync(expectedPath, "utf-8");
      expect(content).toBe(sampleWorkflowCode);
    });

    it("normalises workflow name for filename (spaces → dashes, lowercase)", async () => {
      const codeWithSpaceName = [
        'export const name = "My Great Workflow";',
        'export const description = "Test";',
        "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
        '  return ctx.done("ok");',
        "}",
      ].join("\n");

      const responseText = buildEvalResponse({
        scores: { pattern_detected: true },
        workflowCode: codeWithSpaceName,
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-normalise-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      const expectedPath = join(persistDir, "staged", "workflows", "my-great-workflow.ts");
      expect(existsSync(expectedPath)).toBe(true);
    });

    it("stages workflow even when workflowDir is not provided", async () => {
      const responseText = buildEvalResponse({
        scores: { pattern_detected: true },
        workflowCode: sampleWorkflowCode,
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-no-dir-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        // workflowDir intentionally omitted
      });

      // Code is still parsed
      expect(result.workflowCode).toBe(sampleWorkflowCode);
      expect(result.workflowName).toBe("batch-file-ops");
      // File IS staged (uses persistDir, not workflowDir)
      const stagedPath = join(persistDir, "staged", "workflows", "batch-file-ops.ts");
      expect(existsSync(stagedPath)).toBe(true);
    });

    it("does not write workflow file when no workflow code in response", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "no-workflow-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      expect(result.workflowCode).toBeNull();
      expect(result.workflowName).toBeNull();
      expect(existsSync(join(persistDir, "staged", "workflows"))).toBe(false);
    });

    it("does not write workflow when code has no name export", async () => {
      const codeNoName = [
        "// no name export",
        "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
        '  return ctx.done("ok");',
        "}",
      ].join("\n");

      const responseText = buildEvalResponse({
        workflowCode: codeNoName,
      });

      const manager = mockManager(responseText);
      const sessionId = "workflow-no-name-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      // workflowCode is extracted but workflowName is null → no file written
      expect(result.workflowCode).toBe(codeNoName);
      expect(result.workflowName).toBeNull();
      // staged dir should not even be created
      expect(existsSync(join(persistDir, "staged", "workflows"))).toBe(false);
    });
  });

  // ── Score persistence ───────────────────────────────────────────────

  describe("score persistence", () => {
    it("saves scores to .state/evaluations/<sessionId>.json", async () => {
      const responseText = buildEvalResponse({
        scores: {
          efficiency: 6,
          quality: 7,
          verdict: "acceptable",
          total_tool_calls: 10,
          productive_calls: 8,
          wasted_calls: 2,
        },
      });

      const manager = mockManager(responseText);
      const sessionId = "persist-scores-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const scoresPath = join(persistDir, "evaluations", `${sessionId}.json`);
      expect(existsSync(scoresPath)).toBe(true);

      const saved: EvaluationScores = JSON.parse(readFileSync(scoresPath, "utf-8"));
      expect(saved.efficiency).toBe(6);
      expect(saved.quality).toBe(7);
      expect(saved.verdict).toBe("acceptable");
      expect(saved.total_tool_calls).toBe(10);
      expect(saved.productive_calls).toBe(8);
      expect(saved.wasted_calls).toBe(2);
    });

    it("creates evaluations directory if it does not exist", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "mkdir-eval-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const evalDir = join(persistDir, "evaluations");
      expect(existsSync(evalDir)).toBe(false);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(existsSync(evalDir)).toBe(true);
    });
  });

  // ── Transcript reading ──────────────────────────────────────────────

  describe("transcript source", () => {
    it("reads from history JSONL when available", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "history-session";

      seedHistorySession(persistDir, sessionId, [
        userMessage("from history"),
        assistantMessage("response"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      // Manager.run was called (transcript was found)
      expect(manager.run).toHaveBeenCalledWith("evaluator", expect.stringContaining("from history"));
    });

    it("falls back to active session dir when history is missing", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "active-session";

      // Write to active sessions dir (not history)
      ensureSessionDir(persistDir, sessionId);
      appendSessionMessage(persistDir, sessionId, userMessage("from active"));
      appendSessionMessage(persistDir, sessionId, assistantMessage("reply"));

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(manager.run).toHaveBeenCalledWith("evaluator", expect.stringContaining("from active"));
    });
  });

  // ── Evaluator prompt construction ───────────────────────────────────

  describe("prompt construction", () => {
    it("includes agent name in the evaluation prompt", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "prompt-agent-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "my-special-agent",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("Agent: my-special-agent");
    });

    it("includes workflow name in the evaluation prompt when provided", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "prompt-wf-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: "implement-and-review",
        persistDir,
        knowledgeDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("Workflow Used: implement-and-review");
    });

    it("says 'slow path' when no workflow was used", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "prompt-nwf-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("slow path (no workflow)");
    });

    it("includes session ID in the evaluation prompt", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "prompt-sid-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("Session ID: prompt-sid-session");
    });

    it("includes formatted transcript with tool calls and results", async () => {
      const responseText = buildEvalResponse({});
      const manager = mockManager(responseText);
      const sessionId = "transcript-format-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("read file"),
        toolCallMessage("read", { path: "/tmp/test.txt" }),
        toolResultMessage("read", "file contents here"),
        assistantMessage("Here is the file."),
      ]);

      await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("read file");
      expect(prompt).toContain("[tool_call: read]");
      expect(prompt).toContain("[tool_result: read]");
      expect(prompt).toContain("file contents here");
      expect(prompt).toContain("Here is the file.");
    });
  });

  // ── Return value structure ──────────────────────────────────────────

  describe("return value", () => {
    it("includes raw response text", async () => {
      const responseText = buildEvalResponse({ lessons: "- Test lesson" });
      const manager = mockManager(responseText);
      const sessionId = "raw-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.raw).toBe(responseText);
    });

    it("returns full EvaluationResult with all fields populated", async () => {
      const workflowCode = [
        'export const name = "test-wf";',
        'export const description = "A test workflow";',
        "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
        '  return ctx.done("done");',
        "}",
      ].join("\n");

      const responseText = buildEvalResponse({
        scores: {
          efficiency: 9,
          quality: 10,
          pattern_detected: true,
          pattern_name: "test-wf",
          total_tool_calls: 3,
          productive_calls: 3,
          wasted_calls: 0,
          verdict: "good",
        },
        lessons: "- Everything was great",
        workflowCode,
      });

      const manager = mockManager(responseText);
      const sessionId = "full-result-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      expect(result.scores.efficiency).toBe(9);
      expect(result.scores.quality).toBe(10);
      expect(result.scores.verdict).toBe("good");
      expect(result.lessons).toBe("- Everything was great");
      expect(result.workflowCode).toBe(workflowCode);
      expect(result.workflowName).toBe("test-wf");
    });
  });

  // ── Edge cases in parsing ───────────────────────────────────────────

  describe("parsing edge cases", () => {
    it("handles multiple JSON code blocks (takes the first)", async () => {
      const responseText = [
        "```json",
        '{"overall": {"efficiency": 5, "quality": 5, "verdict": "acceptable"}}',
        "```",
        "Some text",
        "```json",
        '{"overall": {"efficiency": 99, "quality": 99, "verdict": "good"}}',
        "```",
      ].join("\n");

      const manager = mockManager(responseText);
      const sessionId = "multi-json-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(5);
      expect(result.scores.verdict).toBe("acceptable");
    });

    it("handles lessons with markdown formatting", async () => {
      const lessons = "- **Important**: Always use `find` with `-maxdepth`\n- Use `grep -r` instead of manual traversal";
      const responseText = buildEvalResponse({ lessons });
      const manager = mockManager(responseText);
      const sessionId = "md-lessons-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.lessons).toContain("**Important**");
      expect(result.lessons).toContain("`grep -r`");
    });

    it("handles evaluator returning empty response", async () => {
      const manager = mockManager("");
      const sessionId = "empty-response-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      // Still returns a valid result with defaults
      expect(result.scores.efficiency).toBe(0);
      expect(result.scores.verdict).toBe("needs_improvement");
      expect(result.lessons).toBeNull();
      expect(result.workflowCode).toBeNull();

      // Scores should still be persisted (with defaults)
      const scoresPath = join(persistDir, "evaluations", `${sessionId}.json`);
      expect(existsSync(scoresPath)).toBe(true);
    });

    it("handles evaluator returning null lastAssistantText", async () => {
      const manager = mockManagerNullText();

      const sessionId = "null-text-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
      });

      expect(result.scores.efficiency).toBe(0);
      expect(result.lessons).toBeNull();
      expect(result.raw).toBe("");
    });

    it("handles workflow code with single quotes in name export", async () => {
      const code = [
        "export const name = 'single-quote-wf';",
        'export const description = "Test";',
        "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
        '  return ctx.done("ok");',
        "}",
      ].join("\n");

      const responseText = buildEvalResponse({ workflowCode: code });
      const manager = mockManager(responseText);
      const sessionId = "single-quote-session";
      seedHistorySession(persistDir, sessionId, [
        userMessage("task"),
        assistantMessage("done"),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: null,
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      expect(result.workflowName).toBe("single-quote-wf");
      const expectedPath = join(persistDir, "staged", "workflows", "single-quote-wf.ts");
      expect(existsSync(expectedPath)).toBe(true);
    });
  });

  // ── Integration: all side effects together ──────────────────────────

  describe("full integration", () => {
    it("produces all artifacts: lessons.md, workflow file, and scores JSON", async () => {
      const workflowCode = [
        'export const name = "integration-wf";',
        'export const description = "Integration test workflow";',
        "export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {",
        '  const r = await ctx.runAgent("coder", ctx.task);',
        '  return ctx.done(r.lastAssistantText ?? "done");',
        "}",
      ].join("\n");

      const responseText = buildEvalResponse({
        scores: {
          efficiency: 7,
          quality: 8,
          pattern_detected: true,
          pattern_name: "integration-wf",
          total_tool_calls: 6,
          productive_calls: 5,
          wasted_calls: 1,
          verdict: "acceptable",
        },
        lessons: "- Combine file reads into a single exec call",
        workflowCode,
      });

      const manager = mockManager(responseText);
      const sessionId = "full-integration";
      seedHistorySession(persistDir, sessionId, [
        userMessage("build a feature"),
        toolCallMessage("exec", { command: "ls" }),
        toolResultMessage("exec", "file1.ts\nfile2.ts"),
        assistantMessage("Feature built."),
      ]);

      const result = await evaluateSession({
        manager,
        sessionId,
        agentName: "coder",
        workflowUsed: "implement-and-review",
        persistDir,
        knowledgeDir,
        workflowDir,
      });

      // 1. Lessons file
      const lessonsPath = join(knowledgeDir, "lessons.md");
      expect(existsSync(lessonsPath)).toBe(true);
      const lessonsContent = readFileSync(lessonsPath, "utf-8");
      expect(lessonsContent).toContain("Combine file reads");
      expect(lessonsContent).toContain("Workflow: implement-and-review");

      // 2. Workflow file (staged, not in workflowDir)
      const wfPath = join(persistDir, "staged", "workflows", "integration-wf.ts");
      expect(existsSync(wfPath)).toBe(true);
      expect(readFileSync(wfPath, "utf-8")).toBe(workflowCode);

      // 3. Scores file
      const scoresPath = join(persistDir, "evaluations", `${sessionId}.json`);
      expect(existsSync(scoresPath)).toBe(true);
      const savedScores = JSON.parse(readFileSync(scoresPath, "utf-8"));
      expect(savedScores.efficiency).toBe(7);
      expect(savedScores.quality).toBe(8);
      expect(savedScores.verdict).toBe("acceptable");

      // 4. Return value
      expect(result.scores.efficiency).toBe(7);
      expect(result.lessons).toContain("Combine file reads");
      expect(result.workflowName).toBe("integration-wf");
    });

    it("accumulates lessons across multiple evaluations", async () => {
      const sessionIds = ["multi-eval-1", "multi-eval-2", "multi-eval-3"];

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];
        const responseText = buildEvalResponse({
          lessons: `- Lesson ${i + 1} from session ${sessionId}`,
        });

        const manager = mockManager(responseText);
        seedHistorySession(persistDir, sessionId, [
          userMessage(`task ${i + 1}`),
          assistantMessage("done"),
        ]);

        await evaluateSession({
          manager,
          sessionId,
          agentName: "coder",
          workflowUsed: null,
          persistDir,
          knowledgeDir,
        });

        vi.restoreAllMocks();
      }

      const lessonsPath = join(knowledgeDir, "lessons.md");
      const content = readFileSync(lessonsPath, "utf-8");

      // All three lessons should be present
      expect(content).toContain("Lesson 1 from session multi-eval-1");
      expect(content).toContain("Lesson 2 from session multi-eval-2");
      expect(content).toContain("Lesson 3 from session multi-eval-3");

      // All three session IDs should appear
      expect(content).toContain("Session multi-eval-1");
      expect(content).toContain("Session multi-eval-2");
      expect(content).toContain("Session multi-eval-3");
    });
  });
});

// ── maintainAgent Tests ──────────────────────────────────────────────

describe("maintainAgent", () => {
  let persistDir: string;
  let knowledgeDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "maintain-test-"));
    knowledgeDir = join(persistDir, "knowledge");
    mkdirSync(knowledgeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("no-op cases", () => {
    it("returns early without calling manager.run when lessons.md is missing", async () => {
      const manager = mockManager("");
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);
      expect(result.staleItems).toEqual([]);
      expect(result.toolIssues).toEqual([]);
      expect(manager.run).not.toHaveBeenCalled();
    });

    it("returns early when lessons.md is empty", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "", "utf-8");
      const manager = mockManager("");
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);
      expect(manager.run).not.toHaveBeenCalled();
    });

    it("returns early when lessons.md is whitespace-only", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "   \n  \n  ", "utf-8");
      const manager = mockManager("");
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(manager.run).not.toHaveBeenCalled();
    });
  });

  describe("successful pruning", () => {
    it("prunes lessons.md and returns suggestions without modifying domain.md", async () => {
      const originalDomain = "# Domain\n\nOriginal content.\n";
      writeFileSync(join(knowledgeDir, "domain.md"), originalDomain, "utf-8");
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- Lesson A\n- Lesson B\n- Lesson C\n", "utf-8");

      const responseText = buildMaintenanceResponse({
        lessons: "# Lessons\n\n- Lesson C (recent, kept)",
        report: {
          lessonsPruned: 2,
          suggestions: ["Add 'Lesson A' to ## Best Practices in domain.md"],
          staleItems: ["old API reference in domain.md"],
          toolIssues: [],
        },
      });

      const manager = mockManager(responseText);
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(2);
      expect(result.suggestions).toEqual(["Add 'Lesson A' to ## Best Practices in domain.md"]);
      expect(result.staleItems).toEqual(["old API reference in domain.md"]);

      // domain.md must NOT be modified
      const domainContent = readFileSync(join(knowledgeDir, "domain.md"), "utf-8");
      expect(domainContent).toBe(originalDomain);

      // lessons.md should be pruned
      const lessonsContent = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
      expect(lessonsContent).toContain("Lesson C (recent, kept)");
      expect(lessonsContent).not.toContain("Lesson A");
    });
  });

  describe("domain.md not created", () => {
    it("does not create domain.md even when it doesn't exist", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- Important lesson\n", "utf-8");

      const responseText = buildMaintenanceResponse({
        lessons: "# Lessons\n\n- Important lesson (kept)",
        report: {
          lessonsPruned: 0,
          suggestions: ["Create domain.md with identity section"],
        },
      });

      const manager = mockManager(responseText);
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.suggestions).toEqual(["Create domain.md with identity section"]);
      expect(existsSync(join(knowledgeDir, "domain.md"))).toBe(false);
    });
  });

  describe("empty evaluator response", () => {
    it("returns defaults when evaluator returns empty text", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- Some lesson\n", "utf-8");
      writeFileSync(join(knowledgeDir, "domain.md"), "# Domain\n\nOriginal.\n", "utf-8");

      const manager = mockManager("");
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);

      // Files unchanged
      expect(readFileSync(join(knowledgeDir, "domain.md"), "utf-8")).toBe("# Domain\n\nOriginal.\n");
      expect(readFileSync(join(knowledgeDir, "lessons.md"), "utf-8")).toBe("# Lessons\n\n- Some lesson\n");
    });
  });

  describe("null lastAssistantText", () => {
    it("returns defaults when evaluator returns null text", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- A lesson\n", "utf-8");

      const manager = mockManagerNullText();
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);
    });
  });

  describe("malformed evaluator response", () => {
    it("returns defaults when response has no structured sections", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- Some lesson\n", "utf-8");

      const manager = mockManager("I analyzed the lessons but couldn't format the response.");
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);
    });

    it("handles malformed JSON in report section", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- A lesson\n", "utf-8");

      const responseText = [
        "### Updated lessons.md",
        "```markdown",
        "# Lessons\n- Pruned",
        "```",
        "",
        "### Maintenance Report",
        "```json",
        "{not valid json}",
        "```",
      ].join("\n");

      const manager = mockManager(responseText);
      const result = await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      expect(result.lessonsPruned).toBe(0);
      expect(result.suggestions).toEqual([]);

      // lessons.md should still be updated since that section was valid
      const lessonsContent = readFileSync(join(knowledgeDir, "lessons.md"), "utf-8");
      expect(lessonsContent).toContain("Pruned");
    });
  });

  describe("prompt construction", () => {
    it("includes domain.md content as READ-ONLY context", async () => {
      writeFileSync(join(knowledgeDir, "domain.md"), "# Domain\n\nMy domain knowledge.\n", "utf-8");
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- Lesson Alpha\n", "utf-8");

      const responseText = buildMaintenanceResponse({
        lessons: "# Lessons",
        report: {},
      });
      const manager = mockManager(responseText);

      await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("My domain knowledge.");
      expect(prompt).toContain("Lesson Alpha");
      expect(prompt).toContain("READ-ONLY");
    });

    it("includes agent name in the prompt", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- A lesson\n", "utf-8");

      const responseText = buildMaintenanceResponse({ lessons: "# Lessons", report: {} });
      const manager = mockManager(responseText);

      await maintainAgent({
        manager,
        agentName: "my-special-agent",
        knowledgeDir,
        persistDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("my-special-agent");
    });

    it("indicates when domain.md does not exist", async () => {
      writeFileSync(join(knowledgeDir, "lessons.md"), "# Lessons\n\n- A lesson\n", "utf-8");

      const responseText = buildMaintenanceResponse({ lessons: "# Lessons", report: {} });
      const manager = mockManager(responseText);

      await maintainAgent({
        manager,
        agentName: "coder",
        knowledgeDir,
        persistDir,
      });

      const prompt = (manager.run as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
      expect(prompt).toContain("no domain.md exists");
    });
  });
});

