import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createEditTool } from "../src/lib/tools/edit.js";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmpDir = join(tmpdir(), `edit-tool-test-${Date.now()}`);

describe("edit tool", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces exact text match", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "const x = 1;\nconst y = 2;\n");

    const tool = createEditTool(tmpDir);
    const result = await tool.execute("id", {
      path: "test.ts",
      oldText: "const x = 1;",
      newText: "const x = 42;",
    });
    expect(result.content[0].text).toContain("✅ Edit applied to");
    expect(result.content[0].text).toContain("```diff");
    expect(readFileSync(filePath, "utf-8")).toBe("const x = 42;\nconst y = 2;\n");
  });

  it("rejects when old text not found", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "const x = 1;\n");

    const tool = createEditTool(tmpDir);
    await expect(
      tool.execute("id", {
        path: "test.ts",
        oldText: "nonexistent text",
        newText: "replacement",
      }),
    ).rejects.toThrow(/Could not find/);
  });

  it("rejects when multiple occurrences found", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "foo\nbar\nfoo\n");

    const tool = createEditTool(tmpDir);
    await expect(
      tool.execute("id", {
        path: "test.ts",
        oldText: "foo",
        newText: "baz",
      }),
    ).rejects.toThrow(/2 occurrences/);
  });

  it("handles multi-line replacement", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "function foo() {\n  return 1;\n}\n");

    const tool = createEditTool(tmpDir);
    await tool.execute("id", {
      path: "test.ts",
      oldText: "function foo() {\n  return 1;\n}",
      newText: "function foo() {\n  return 42;\n}",
    });
    expect(readFileSync(filePath, "utf-8")).toBe("function foo() {\n  return 42;\n}\n");
  });

  it("rejects when file does not exist", async () => {
    const tool = createEditTool(tmpDir);
    await expect(
      tool.execute("id", {
        path: "nonexistent.ts",
        oldText: "x",
        newText: "y",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("handles fuzzy matching (trailing whitespace)", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "const x = 1;   \n");

    const tool = createEditTool(tmpDir);
    // oldText without trailing spaces should still match via fuzzy
    const result = await tool.execute("id", {
      path: "test.ts",
      oldText: "const x = 1;",
      newText: "const x = 2;",
    });
    expect(result.content[0].text).toContain("✅ Edit applied to");
  });

  it("returns diff in details", async () => {
    const filePath = join(tmpDir, "test.ts");
    writeFileSync(filePath, "const x = 1;\n");

    const tool = createEditTool(tmpDir);
    const result = await tool.execute("id", {
      path: "test.ts",
      oldText: "const x = 1;",
      newText: "const x = 99;",
    });
    expect(result.details).toBeDefined();
    expect(result.details?.diff).toContain("const x = 99;");
  });
});
