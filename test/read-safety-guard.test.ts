import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createReadTool } from "../src/lib/tools/read.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join("/tmp", "read-safety-test");

function setup() {
  mkdirSync(tmpDir, { recursive: true });
}

function cleanup() {
  try {
    rmSync(tmpDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

describe("read safety guards", () => {
  beforeEach(setup);
  afterEach(cleanup);

  describe("directory block", () => {
    it("throws when path is a directory", async () => {
      const subDir = join(tmpDir, "mydir");
      mkdirSync(subDir, { recursive: true });
      const tool = createReadTool(tmpDir);
      await expect(
        tool.execute("test-id", { path: subDir })
      ).rejects.toThrow("Path is a directory");
    });
  });

  describe("size cap", () => {
    it("throws for files > 50KB without limit", async () => {
      const bigFile = join(tmpDir, "big.txt");
      // Create a 60KB file
      writeFileSync(bigFile, "x".repeat(60 * 1024));
      const tool = createReadTool(tmpDir);
      await expect(
        tool.execute("test-id", { path: bigFile })
      ).rejects.toThrow("File is too large");
    });

    it("allows files > 50KB when limit is provided", async () => {
      const bigFile = join(tmpDir, "big-with-limit.txt");
      const lines = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`);
      writeFileSync(bigFile, lines.join("\n"));
      const tool = createReadTool(tmpDir);
      const result = await tool.execute("test-id", { path: bigFile, limit: 10 });
      expect(result.content[0].text).toContain("line 1");
    });

    it("allows files <= 50KB without limit", async () => {
      const smallFile = join(tmpDir, "small.txt");
      writeFileSync(smallFile, "hello world");
      const tool = createReadTool(tmpDir);
      const result = await tool.execute("test-id", { path: smallFile });
      expect(result.content[0].text).toContain("hello world");
    });
  });

  describe("binary guard", () => {
    it("throws for binary files", async () => {
      const binFile = join(tmpDir, "binary.dat");
      const buf = Buffer.alloc(100);
      buf.write("header");
      // null bytes at position 50
      buf[50] = 0;
      writeFileSync(binFile, buf);
      const tool = createReadTool(tmpDir);
      await expect(
        tool.execute("test-id", { path: binFile })
      ).rejects.toThrow("File appears to be binary");
    });

    it("allows text files with no null bytes", async () => {
      const txtFile = join(tmpDir, "text.txt");
      writeFileSync(txtFile, "just normal text\nwith newlines\n");
      const tool = createReadTool(tmpDir);
      const result = await tool.execute("test-id", { path: txtFile });
      expect(result.content[0].text).toContain("just normal text");
    });
  });
});
