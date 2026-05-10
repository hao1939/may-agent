import { describe, expect, it } from "vitest";

const { guard } = await import("../guards/knowledge-entry-overwrite.ts");

function eventWithCalls(toolCalls: Array<{ name: string; input: Record<string, any> }>, finishStatus = "success"): any {
  return {
    type: "step_done",
    source: "workflow:scout-explore",
    result: {
      finishResult: { status: finishStatus },
      messages: [{
        role: "assistant",
        content: toolCalls.map((tc) => ({
          type: "tool_use",
          name: tc.name,
          input: tc.input,
        })),
      }],
    },
    completedSteps: [],
  };
}

describe("knowledge-entry-overwrite guard", () => {
  it("blocks finish(success) after write() to a legacy KE path", () => {
    const demands = guard.handle(eventWithCalls([
      { name: "write", input: { path: "agents/shared/knowledge/entries/KE-021.md", content: "new content" } },
    ]));

    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("KE-021.md");
    expect(demands[0].reason).toContain("choose a new unused high-numbered KE id");
  });

  it("blocks shell redirection overwrites of low-numbered KE files", () => {
    const demands = guard.handle(eventWithCalls([
      { name: "bash", input: { command: "cat > agents/shared/knowledge/entries/KE-001.md <<'EOF'\nreplacement\nEOF" } },
    ]));

    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("block");
    expect(demands[0].reason).toContain("KE-001.md");
  });

  it("allows high-numbered new KE writes", () => {
    const demands = guard.handle(eventWithCalls([
      { name: "write", input: { path: "agents/shared/knowledge/entries/KE-1028-new-finding.md", content: "new content" } },
    ]));

    expect(demands).toEqual([]);
  });

  it("allows edit() of legacy KE files for explicit corrections", () => {
    const demands = guard.handle(eventWithCalls([
      { name: "read", input: { path: "agents/shared/knowledge/entries/KE-021.md" } },
      { name: "edit", input: { path: "agents/shared/knowledge/entries/KE-021.md", oldText: "x", newText: "y" } },
    ]));

    expect(demands).toEqual([]);
  });

  it("does not block non-success finish statuses", () => {
    const demands = guard.handle(eventWithCalls([
      { name: "write", input: { path: "agents/shared/knowledge/entries/KE-002.md", content: "draft" } },
    ], "partial"));

    expect(demands).toEqual([]);
  });
});
