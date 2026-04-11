import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import the workflow
import { name, description, execute } from "../agents/shared/workflows/research-to-production.js";

// ── Mock WorkflowContext ────────────────────────────────────────────────

interface MockStep {
  type: string;
  step?: string;
  result?: any;
}

function createMockCtx(task: string, agentResponses: Map<string, { status: string; text: string }[]>): {
  ctx: any;
  steps: MockStep[];
  agentCalls: { agent: string; task: string }[];
} {
  const steps: MockStep[] = [];
  const agentCalls: { agent: string; task: string }[] = [];
  // Track which response index we're at for each agent
  const agentCallCounts = new Map<string, number>();

  const ctx = {
    task,
    emit(event: any) {
      steps.push(event);
    },
    async runAgent(agent: string, agentTask: string) {
      agentCalls.push({ agent, task: agentTask });
      const count = agentCallCounts.get(agent) ?? 0;
      agentCallCounts.set(agent, count + 1);
      const responses = agentResponses.get(agent) ?? [];
      const response = responses[count] ?? { status: "done", text: "ok" };
      return {
        status: response.status,
        lastAssistantText: response.text,
        messages: [],
        duration: "5s",
        outputDir: "",
        sessionId: `mock-${agent}-${count}`,
      };
    },
    done(summary: string) {
      return { type: "done" as const, summary };
    },
    escalate(reason: string, context?: unknown) {
      return { type: "escalate" as const, reason, context };
    },
  };

  return { ctx, steps, agentCalls };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("research-to-production workflow", () => {
  it("exports correct name and description", () => {
    expect(name).toBe("research-to-production");
    expect(description).toContain("research→production loop");
  });

  it("returns NOT ACTIONABLE when researcher says so", async () => {
    const responses = new Map([
      ["bob", [{ status: "done", text: "After reviewing KE-052, this is too vague to implement.\n\nVERDICT: NOT ACTIONABLE" }]],
    ]);
    const { ctx } = createMockCtx("Close the loop on KE-052", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect((result as any).summary).toContain("NOT ACTIONABLE");
  });

  it("returns CONFLICTING when researcher finds contradictions", async () => {
    const responses = new Map([
      ["bob", [{ status: "done", text: "This contradicts KE-078.\n\nVERDICT: CONFLICTING" }]],
    ]);
    const { ctx } = createMockCtx("Ship H-092 findings", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect((result as any).summary).toContain("CONFLICTING");
  });

  it("returns ALREADY SHIPPED when finding is already in code", async () => {
    const responses = new Map([
      ["bob", [{ status: "done", text: "This is already in src/lib/tools/path-hallucination-guard.ts\n\nVERDICT: ALREADY SHIPPED" }]],
    ]);
    const { ctx } = createMockCtx("Ship EXP-132", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect((result as any).summary).toContain("ALREADY SHIPPED");
  });

  it("escalates when researcher fails to output a verdict", async () => {
    const responses = new Map([
      ["bob", [{ status: "done", text: "I looked at the research and it's interesting" }]],
    ]);
    const { ctx } = createMockCtx("Close the loop on KE-052", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    expect((result as any).reason).toContain("VERDICT");
  });

  it("escalates when researcher errors", async () => {
    const responses = new Map([
      ["bob", [{ status: "error", text: "Session failed" }]],
    ]);
    const { ctx } = createMockCtx("Close the loop on KE-052", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    expect((result as any).reason).toContain("assess");
  });

  it("runs full pipeline: assess → build → verify → report", async () => {
    const responses = new Map([
      ["bob", [
        // Assess phase
        { status: "done", text: "Spec written to workspace/r2p-spec.md\n\nVERDICT: ACTIONABLE" },
        // Report phase
        { status: "done", text: "Report written. KE-052 is now DEPLOYED." },
      ]],
      ["tech-lead", [
        // Build phase
        { status: "done", text: "Implementation complete, tests pass." },
      ]],
    ]);

    // Inject a passing verify command
    const { ctx, steps, agentCalls } = createMockCtx(
      "verifyCommand: echo PASS\nClose the loop on KE-052",
      responses,
    );

    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect((result as any).summary).toContain("CLOSED");

    // Verify the pipeline order
    expect(agentCalls.length).toBe(3);
    expect(agentCalls[0].agent).toBe("bob");       // assess
    expect(agentCalls[1].agent).toBe("tech-lead");  // build
    expect(agentCalls[2].agent).toBe("bob");        // report

    // Verify steps emitted
    const stepNames = steps.filter((s) => s.type === "step_start").map((s) => s.step);
    expect(stepNames).toContain("assess");
    expect(stepNames).toContain("build");
    expect(stepNames).toContain("verify");
    expect(stepNames).toContain("report");
  });

  it("escalates when build fails after max attempts", async () => {
    const responses = new Map([
      ["bob", [
        { status: "done", text: "VERDICT: ACTIONABLE" },
      ]],
      ["tech-lead", [
        { status: "error", text: "Build failed attempt 1" },
        { status: "error", text: "Build failed attempt 2" },
      ]],
    ]);
    const { ctx } = createMockCtx("Close the loop on KE-052", responses);
    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    expect((result as any).reason).toContain("Build failed");
  });

  it("retries build when first attempt fails", async () => {
    const responses = new Map([
      ["bob", [
        { status: "done", text: "VERDICT: ACTIONABLE" },
        { status: "done", text: "Report written" },
      ]],
      ["tech-lead", [
        { status: "error", text: "Build failed attempt 1" },
        { status: "done", text: "Build fixed" },
      ]],
    ]);
    const { ctx, agentCalls } = createMockCtx(
      "verifyCommand: echo PASS\nClose the loop on KE-052",
      responses,
    );
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    // Should have called tech-lead twice (retry)
    const tlCalls = agentCalls.filter((c) => c.agent === "tech-lead");
    expect(tlCalls.length).toBe(2);
  });

  it("respects custom researcher and builder", async () => {
    const responses = new Map([
      ["coach", [
        { status: "done", text: "VERDICT: ACTIONABLE" },
        { status: "done", text: "Report done" },
      ]],
      ["coder", [
        { status: "done", text: "Built it" },
      ]],
    ]);
    const { ctx, agentCalls } = createMockCtx(
      "researcher: coach\nbuilder: coder\nverifyCommand: echo PASS\nShip the skill",
      responses,
    );
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    expect(agentCalls[0].agent).toBe("coach");  // assess
    expect(agentCalls[1].agent).toBe("coder");  // build
    expect(agentCalls[2].agent).toBe("coach");  // report
  });

  it("skips assess when skipAssess is true", async () => {
    const responses = new Map([
      ["bob", [
        { status: "done", text: "Report done" },
      ]],
      ["tech-lead", [
        { status: "done", text: "Built it" },
      ]],
    ]);
    const { ctx, agentCalls } = createMockCtx(
      "skipAssess: true\nverifyCommand: echo PASS\nBuild this: add a logging function",
      responses,
    );
    const result = await execute(ctx);

    expect(result.type).toBe("done");
    // Should skip assess, go straight to build
    expect(agentCalls.length).toBe(2);
    expect(agentCalls[0].agent).toBe("tech-lead"); // build (no assess)
    expect(agentCalls[1].agent).toBe("bob");        // report
  });

  it("escalates on empty task", async () => {
    const { ctx } = createMockCtx("", new Map());
    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    expect((result as any).reason).toContain("No task");
  });

  it("escalates when verification fails after all attempts", async () => {
    const responses = new Map([
      ["bob", [
        { status: "done", text: "VERDICT: ACTIONABLE" },
      ]],
      ["tech-lead", [
        { status: "done", text: "Built it" },
        { status: "done", text: "Fixed it" },
      ]],
    ]);
    // Use a command that fails
    const { ctx } = createMockCtx(
      "verifyCommand: false\nClose the loop on KE-052",
      responses,
    );
    const result = await execute(ctx);

    expect(result.type).toBe("escalate");
    expect((result as any).reason).toContain("verification failed");
  });
});
