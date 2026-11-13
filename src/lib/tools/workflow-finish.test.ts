import { Type } from "typebox";
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateToolArguments, type ToolCall } from "@earendil-works/pi-ai";
import { Value } from "typebox/value";
import { createFinishTool } from "./lifecycle.js";
import { createWorkflowFinishTool } from "./workflow-finish.js";

function toolCall(arguments_: Record<string, unknown>): ToolCall {
  return { type: "toolCall", id: "call-1", name: "finish", arguments: arguments_ };
}

describe("workflow finish contract", () => {
  it.each([false, true])("matches code checks on original report values (serialized schema: %s)", async (serialized) => {
    const declared = Type.Object({
      summary: Type.String({ pattern: "\\S" }),
      verification: Type.Optional(Type.Array(Type.String())),
      value: Type.Optional(Type.Union([Type.Number(), Type.String(), Type.Null()])),
    }, { additionalProperties: false });
    const schema = serialized ? JSON.parse(JSON.stringify(declared)) : declared;
    let executions = 0;
    const base = createFinishTool({ projectRoot: tmpdir() });
    const tool = createWorkflowFinishTool({ ...base, execute: async (...args) => {
      executions++;
      return base.execute(...args);
    } }, schema);

    for (const report of [
      { summary: "Incomplete; evidence unavailable" },
      { summary: "Known value", value: "42" },
      { summary: "Explicit null", value: null },
      { summary: 42 }, { summary: false }, { summary: " " }, {},
      { summary: "Draft", verification: [false] },
      { summary: "Draft", verification: null },
      { summary: "Draft", extra: true },
    ]) {
      const args = { status: "partial", summary: "Review report", result: report };
      const original = structuredClone(args);
      const before = executions;
      // This is Pi's supported order, also used by captured-finish recovery.
      const prepare = () => validateToolArguments(tool, toolCall(tool.prepareArguments!(args)));
      if (Value.Check(schema, report)) {
        const params = prepare();
        expect(params.result).toEqual(report);
        expect((await tool.execute("report", params)).terminate).toBe(true);
        expect(executions).toBe(before + 1);
      } else {
        expect(prepare).toThrow("supplied schema");
        // A direct tool caller cannot bypass the report contract either.
        await expect(tool.execute("report", args)).rejects.toThrow("supplied schema");
        expect(executions).toBe(before);
      }
      expect(args).toEqual(original);
    }
  });

  it.each(["success", "partial", "blocked", "failure"])("admits an incomplete report as ordinary %s output", async (status) => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-report-"));
    try {
      const schema = Type.Object({
        summary: Type.String(),
        changes: Type.Optional(Type.Array(Type.String())),
        testResults: Type.Optional(Type.Array(Type.String())),
      });
      const report = { summary: "Patch written; test environment unavailable.", changes: ["parser.ts"] };
      let admitted: unknown;
      const tool = createWorkflowFinishTool(
        createFinishTool({ projectRoot }), schema,
        (output) => { admitted = output; return Value.Check(schema, output) ? null : "Invalid report"; },
      );
      // Code and the model tool admit the same report. An omitted optional
      // field is not a correction request or a fabricated successful test.
      expect(Value.Check(schema, report)).toBe(true);
      const params = validateToolArguments(tool, toolCall({ status, summary: report.summary, result: report }));
      const result = await tool.execute("report", params);
      expect(result.terminate).toBe(true);
      expect(admitted).toEqual(report);
      expect(admitted).not.toHaveProperty("testResults");
      expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining(report.summary) });

      // Present values and deliberately required fields retain their contract.
      for (const invalid of [{ changes: ["parser.ts"] }, { ...report, testResults: { passed: true } }]) {
        expect(Value.Check(schema, invalid)).toBe(false);
        expect(() => validateToolArguments(tool, toolCall({ status, summary: report.summary, result: invalid }))).toThrow();
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("requires and captures the workflow-authored result schema through finish()", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ projectRoot });
      const tool = createWorkflowFinishTool(
        base,
        Type.Object({ verdict: Type.Union([Type.Literal("pass"), Type.Literal("fail")]) }),
      );
      expect((tool.parameters as any).type).toBe("object");
      const call = toolCall({
        status: "success",
        summary: "Review complete",
        result: { verdict: "pass" },
      });
      const params = validateToolArguments(tool, call);

      const result = await tool.execute(call.id, params);

      expect(result.terminate).toBe(true);
      expect((params as any).result).toEqual({ verdict: "pass" });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("rejects a missing caller-defined result before finish executes", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ projectRoot });
      const tool = createWorkflowFinishTool(base, Type.Object({ verdict: Type.String() }));

      expect(() =>
        validateToolArguments(
          tool,
          toolCall({ status: "success", summary: "Review complete", verification_facts: ["test facts"] }),
        ),
      ).toThrow("result");
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("does not terminate when a supplied deliverable fails its check", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "workflow-finish-"));
    try {
      const base = createFinishTool({ projectRoot });
      const tool = createWorkflowFinishTool(base);

      const result = await tool.execute("call-1", {
        status: "success", summary: "Done", deliverables: [{ path: "missing.txt", description: "Report" }],
      });

      expect(result.terminate).toBeUndefined();
      expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("finish() error") });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
