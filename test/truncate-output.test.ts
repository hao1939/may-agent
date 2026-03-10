import { describe, it, expect } from "vitest";
import { createReadTool } from "../src/lib/tools.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("createReadTool maxFileLength", () => {
  const tmpDir = join("/tmp", "read-truncation-test");

  const setupDir = () => {
    mkdirSync(tmpDir, { recursive: true });
  };

  const cleanup = () => {
    try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  };

  it("truncates large files when maxFileLength is set", () => {
    setupDir();
    const filePath = join(tmpDir, "large.txt");
    const largeContent = "x".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text.length).toBeLessThanOrEqual(1500); // truncated + warning text
      expect(text).toContain("truncated");
      expect(text).toContain("FILE TRUNCATED");
      cleanup();
    });
  });

  it("does not truncate small files", () => {
    setupDir();
    const filePath = join(tmpDir, "small.txt");
    const content = "hello world";
    writeFileSync(filePath, content);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe("hello world");
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("does not truncate when maxFileLength is 0 (disabled)", () => {
    setupDir();
    const filePath = join(tmpDir, "nolimit.txt");
    const largeContent = "y".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({ maxFileLength: 0 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe(largeContent);
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("does not truncate when maxFileLength is not set", () => {
    setupDir();
    const filePath = join(tmpDir, "default.txt");
    const largeContent = "z".repeat(5000);
    writeFileSync(filePath, largeContent);

    const tool = createReadTool({});
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toBe(largeContent);
      expect(text).not.toContain("truncated");
      cleanup();
    });
  });

  it("preserves head and tail of truncated files", () => {
    setupDir();
    const filePath = join(tmpDir, "headtail.txt");
    const head = "HEADER_CONTENT_";
    const middle = "m".repeat(5000);
    const tail = "_FOOTER_CONTENT";
    writeFileSync(filePath, head + middle + tail);

    const tool = createReadTool({ maxFileLength: 1000 });
    return tool.execute("test-id", { path: filePath }).then((result) => {
      const text = result.content[0].type === "text" ? result.content[0].text : "";
      expect(text).toContain("HEADER_CONTENT");
      expect(text).toContain("FOOTER_CONTENT");
      expect(text).toContain("truncated");
      cleanup();
    });
  });
});
