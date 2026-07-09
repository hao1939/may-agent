import { describe, expect, it } from "bun:test";

const { guard } = await import("../guards/knowledge-entry-overwrite.ts");

function eventWithCalls(
  toolCalls: Array<{ name: string; input: Record<string, any> }>,
  finishStatus = "success",
): any {
  return {
    type: "step_done",
    source: "workflow:scout-explore",
    result: {
      finishResult: { status: finishStatus },
      messages: [
        {
          role: "assistant",
          content: toolCalls.map((tc) => ({
            type: "tool_use",
            name: tc.name,
            input: tc.input,
          })),
        },
      ],
    },
    completedSteps: [],
  };
}

describe("knowledge-entry-overwrite guard", () => {
  it("warns on finish(success) after write() to a legacy KE path", () => {
    const demands = guard.handle(
      eventWithCalls([
        {
          name: "write",
          input: {
            path: "agents/shared/knowledge/entries/KE-021.md",
            content: "new content",
          },
        },
      ]),
    );

    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("KE-021.md");
    expect(demands[0].reason).toContain(
      "projects/scout-knowledge-lib/knowledge/",
    );
  });

  it("warns on shell redirection overwrites of low-numbered KE files", () => {
    const demands = guard.handle(
      eventWithCalls([
        {
          name: "bash",
          input: {
            command:
              "cat > agents/shared/knowledge/entries/KE-001.md <<'EOF'\nreplacement\nEOF",
          },
        },
      ]),
    );

    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("KE-001.md");
  });

  it("warns on high-numbered new KE writes to the legacy shared directory", () => {
    const demands = guard.handle(
      eventWithCalls([
        {
          name: "write",
          input: {
            path: "agents/shared/knowledge/entries/KE-1028-new-finding.md",
            content: "new content",
          },
        },
      ]),
    );

    expect(demands).toHaveLength(1);
    expect(demands[0].reason).toContain("KE-1028-new-finding.md");
    expect(demands[0].reason).toContain(
      "projects/scout-knowledge-lib/knowledge/",
    );
  });

  it("allows edit() of legacy KE files for explicit corrections", () => {
    const demands = guard.handle(
      eventWithCalls([
        {
          name: "read",
          input: { path: "agents/shared/knowledge/entries/KE-021.md" },
        },
        {
          name: "edit",
          input: {
            path: "agents/shared/knowledge/entries/KE-021.md",
            oldText: "x",
            newText: "y",
          },
        },
      ]),
    );

    expect(demands).toEqual([]);
  });

  it("does not block non-success finish statuses", () => {
    const demands = guard.handle(
      eventWithCalls(
        [
          {
            name: "write",
            input: {
              path: "agents/shared/knowledge/entries/KE-002.md",
              content: "draft",
            },
          },
        ],
        "partial",
      ),
    );

    expect(demands).toEqual([]);
  });
});
