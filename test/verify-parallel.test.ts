import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * verify-parallel workflow — structural tests
 *
 * These tests validate the workflow file structure and logic without
 * running real agents (which would require LLM calls). They verify:
 * 1. The workflow file exports the correct interface
 * 2. The classify/verdict helper functions work correctly
 * 3. The QA SOUL.md has the required Auditor protocol
 */

// ── Test 1: Workflow file exports ──────────────────────────────────────

describe("verify-parallel workflow: structure", () => {
  it("exports required workflow interface (name, description, execute)", async () => {
    // Dynamic import of the workflow file
    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");

    expect(mod.name).toBe("verify-parallel");
    expect(typeof mod.description).toBe("string");
    expect(mod.description.length).toBeGreaterThan(0);
    expect(typeof mod.execute).toBe("function");
  });

  it("description mentions kinetic defense and parallel audit", async () => {
    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const desc = mod.description.toLowerCase();
    expect(desc).toContain("kinetic");
    expect(desc).toContain("parallel");
    expect(desc).toContain("auditor");
  });

  it("workflow exists in all three agent workflow dirs", () => {
    const dirs = [
      "agents/tech-lead/workflows/verify-parallel.ts",
      "agents/optimizer/workflows/verify-parallel.ts",
      "agents/may/workflows/verify-parallel.ts",
    ];
    for (const dir of dirs) {
      const content = readFileSync(join(process.cwd(), dir), "utf-8");
      expect(content).toContain("export const name");
      expect(content).toContain("verify-parallel");
      expect(content).toContain("Promise.all");
    }
  });
});

// ── Test 2: QA SOUL.md Auditor Protocol ────────────────────────────────

describe("verify-parallel: QA SOUL.md policy", () => {
  it("QA SOUL.md contains Parallel Auditor Protocol section", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    expect(soul).toContain("Parallel Auditor");
    expect(soul).toContain("CONFIRMED");
  });

  it("QA SOUL.md requires addressing auditor findings", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    expect(soul).toContain("CONFIRMED");
    expect(soul).toContain("FALSE POSITIVE");
    expect(soul).toContain("ALREADY ADDRESSED");
    expect(soul).toContain("Cannot PASS if any CONFIRMED finding is unaddressed");
  });

  it("QA SOUL.md has constraint against dismissing auditor findings without evidence", () => {
    const soul = readFileSync(join(process.cwd(), "agents/qa/SOUL.md"), "utf-8");
    // The constraint is expressed as requiring independent verification of each finding
    expect(soul).toContain("verify each independently");
  });
});

// ── Test 3: Workflow logic — mock context ──────────────────────────────

describe("verify-parallel workflow: execution logic", () => {
  // Helper to create a mock WorkflowContext
  function createMockContext(overrides: {
    agentResponses: Record<string, { status: "done" | "error"; text: string; error?: string }[]>;
  }) {
    const callLog: { agent: string; task: string }[] = [];
    const agentCallCounts: Record<string, number> = {};

    const ctx = {
      task: "Add a new utility function",
      runAgent: async (agent: string, task: string) => {
        callLog.push({ agent, task });
        const count = agentCallCounts[agent] ?? 0;
        agentCallCounts[agent] = count + 1;

        const responses = overrides.agentResponses[agent];
        if (!responses || count >= responses.length) {
          return {
            sessionId: `s_mock_${agent}_${count}`,
            status: "error" as const,
            lastAssistantText: null,
            messages: [],
            duration: "1s",
            outputDir: "/tmp/mock",
            error: `No mock response for ${agent} call #${count}`,
          };
        }

        const resp = responses[count];
        return {
          sessionId: `s_mock_${agent}_${count}`,
          status: resp.status,
          lastAssistantText: resp.text,
          messages: [],
          duration: "5s",
          outputDir: "/tmp/mock",
          error: resp.error,
        };
      },
      emit: () => {},
      summarize: (r: any) => r.lastAssistantText ?? "",
      done: (summary: string) => ({ type: "done" as const, summary }),
      escalate: (reason: string, context?: unknown) => ({
        type: "escalate" as const,
        reason,
        context,
      }),
      runWorkflow: async () => ({ type: "done" as const, summary: "sub" }),
    };

    return { ctx, callLog };
  }

  it("runs QA and Auditor in parallel (both qa agents called)", async () => {
    const { ctx, callLog } = createMockContext({
      agentResponses: {
        coder: [{ status: "done", text: "Implemented the utility function" }],
        qa: [
          { status: "done", text: "## Verdict: PASS\nAll checks passed." },
          { status: "done", text: "NO ISSUES FOUND. Checked all files, ran tsc, ran tests." },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    // Coder called once, QA called twice (review + auditor in parallel)
    const coderCalls = callLog.filter((c) => c.agent === "coder");
    const qaCalls = callLog.filter((c) => c.agent === "qa");
    expect(coderCalls).toHaveLength(1);
    expect(qaCalls).toHaveLength(2);

    // One QA call should have adversarial framing
    const adversarial = qaCalls.find((c) => c.task.includes("ADVERSARIAL AUDIT"));
    expect(adversarial).toBeDefined();
    expect(adversarial!.task).toContain("Assume this code contains a subtle bug");
    expect(adversarial!.task).toContain("Devil's Advocate");

    // Should pass cleanly
    expect(result.type).toBe("done");
  });

  it("escalates when QA passes but Auditor finds critical issues (consensus hallucination caught)", async () => {
    const { ctx, callLog: _callLog } = createMockContext({
      agentResponses: {
        coder: [{ status: "done", text: "Implemented the feature" }],
        qa: [
          { status: "done", text: "## Verdict: PASS\nLooks good, tests pass." },
          {
            status: "done",
            text: "## CRITICAL ISSUE\n\n**SECURITY VULNERABILITY**: The input is not sanitized, allowing injection attacks.\n\n- File: src/lib/handler.ts\n- Location: processInput()\n- Severity: CRITICAL",
          },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    // THIS IS THE KEY TEST — consensus hallucination defense
    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("KINETIC DEFENSE TRIGGERED");
      expect(result.reason).toContain("consensus hallucination");
      const context = result.context as any;
      expect(context.qaVerdict).toBe("PASS");
      expect(context.auditorSeverity).toBe("HIGH");
    }
  });

  it("sends low-severity auditor findings to coder for fixing when QA passed", async () => {
    const { ctx, callLog } = createMockContext({
      agentResponses: {
        coder: [
          { status: "done", text: "Implemented the feature" },
          { status: "done", text: "Fixed the edge case the auditor found" },
        ],
        qa: [
          // First parallel pair: QA passes, Auditor finds low-severity issue
          { status: "done", text: "## Verdict: PASS\nAll checks passed." },
          {
            status: "done",
            text: "## ISSUE: Missing edge case\n\n**WARNING**: The function doesn't handle empty arrays.\n\n- File: src/lib/utils.ts\n- Severity: IMPORTANT",
          },
          // Re-review after fix
          { status: "done", text: "## Verdict: PASS\nAuditor findings addressed correctly." },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    // Coder should have been called twice: implement + fix auditor findings
    const coderCalls = callLog.filter((c) => c.agent === "coder");
    expect(coderCalls).toHaveLength(2);
    expect(coderCalls[1].task).toContain("auditor");

    // Should eventually pass
    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.summary).toContain("auditor findings");
    }
  });

  it("follows standard retry path when QA fails (auditor findings merged)", async () => {
    const { ctx, callLog } = createMockContext({
      agentResponses: {
        coder: [
          { status: "done", text: "Implemented the feature" },
          { status: "done", text: "Fixed the issues" },
        ],
        qa: [
          // First parallel pair: QA fails, Auditor finds low issue
          { status: "done", text: "## Verdict: FAIL\nTests don't pass." },
          {
            status: "done",
            text: "## ISSUE: Edge case bug\n\n**BUG**: Missing null check.\n- Severity: IMPORTANT",
          },
          // Re-review after fix
          { status: "done", text: "## Verdict: PASS\nAll issues resolved." },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    // Fix task should mention both QA and Auditor findings
    const fixCall = callLog.find((c) => c.agent === "coder" && c.task.includes("Fix these issues"));
    expect(fixCall).toBeDefined();
    expect(fixCall!.task).toContain("QA Review Findings");
    expect(fixCall!.task).toContain("Auditor Findings");

    expect(result.type).toBe("done");
  });

  it("escalates on critical QA rejection regardless of auditor", async () => {
    const { ctx } = createMockContext({
      agentResponses: {
        coder: [{ status: "done", text: "Implemented something" }],
        qa: [
          { status: "done", text: "## Verdict: FAIL\nWrong implementation — contradicts the design doc." },
          { status: "done", text: "NO ISSUES FOUND from auditor perspective." },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("critical issues");
      expect(result.reason).toContain("supervisor judgment");
    }
  });

  it("handles coder failure gracefully", async () => {
    const { ctx } = createMockContext({
      agentResponses: {
        coder: [{ status: "error", text: "", error: "API error" }],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("coder failed");
    }
  });

  it("handles both QA and Auditor failure", async () => {
    const { ctx } = createMockContext({
      agentResponses: {
        coder: [{ status: "done", text: "Implemented it" }],
        qa: [
          { status: "error", text: "", error: "QA API error" },
          { status: "error", text: "", error: "Auditor API error" },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    const result = await mod.execute(ctx as any);

    expect(result.type).toBe("escalate");
    if (result.type === "escalate") {
      expect(result.reason).toContain("both QA and Auditor failed");
    }
  });

  it("auditor task uses contrastive framing (UNTRUSTED, find bugs)", async () => {
    const { ctx, callLog } = createMockContext({
      agentResponses: {
        coder: [{ status: "done", text: "Done" }],
        qa: [
          { status: "done", text: "PASS" },
          { status: "done", text: "NO ISSUES FOUND" },
        ],
      },
    });

    const mod = await import("../agents/tech-lead/workflows/verify-parallel.ts");
    await mod.execute(ctx as any);

    const auditorCall = callLog.find((c) => c.task.includes("ADVERSARIAL AUDIT"));
    expect(auditorCall).toBeDefined();

    // Verify contrastive framing elements
    const task = auditorCall!.task;
    expect(task).toContain("UNTRUSTED");
    expect(task).toContain("assume it's hiding something");
    expect(task).toContain("Assume this code contains a subtle bug");
    expect(task).toContain("off-by-one");
    expect(task).toContain("race condition");
    expect(task).toContain("prototype pollution");
    expect(task).toContain("NO ISSUES FOUND"); // explicit instruction for honest "clean" report
    expect(task).toContain("Do NOT fabricate issues"); // anti-false-positive
  });
});
