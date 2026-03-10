import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createWriteTool } from "../src/lib/tools/write.js";
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("write tool", () => {
  const testDir = join(tmpdir(), `write-tool-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(join(testDir, "src"), { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("writes to relative path resolved against cwd", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "src/output.ts",
      content: "export const x = 1;\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Successfully wrote");
    const content = readFileSync(join(testDir, "src/output.ts"), "utf-8");
    expect(content).toBe("export const x = 1;\n");
  });

  it("writes to absolute path", async () => {
    const tool = createWriteTool(testDir);
    const filePath = join(testDir, "src/correct-abs.ts");
    const result = await tool.execute("test-id", {
      path: filePath,
      content: "// correct absolute\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Successfully wrote");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("// correct absolute\n");
  });

  it("creates parent directories for new nested paths", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "deep/nested/dir/file.ts",
      content: "// nested\n",
    });
    const text = result.content[0].text;
    expect(text).toContain("Successfully wrote");
    expect(existsSync(join(testDir, "deep/nested/dir/file.ts"))).toBe(true);
  });

  it("overwrites existing file", async () => {
    const filePath = join(testDir, "src/overwrite.ts");
    writeFileSync(filePath, "old content");
    
    const tool = createWriteTool(testDir);
    await tool.execute("test-id", {
      path: "src/overwrite.ts",
      content: "new content",
    });
    expect(readFileSync(filePath, "utf-8")).toBe("new content");
  });

  it("reports byte count in success message", async () => {
    const tool = createWriteTool(testDir);
    const result = await tool.execute("test-id", {
      path: "src/bytes.ts",
      content: "hello",
    });
    expect(result.content[0].text).toContain("5 bytes");
  });
});
