import { describe, it, expect } from "bun:test";
import { validateOutput, findDuplicate, validateContentType, hashContent } from "../workflows/output-validator.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const TMP_DIR = "/tmp/ov-test-outputs";

function setupDir() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
}

describe("output-validator", () => {
  describe("validateOutput", () => {
    it("rejects empty content", () => {
      const r = validateOutput("test.md", "");
      expect(r.valid).toBe(false);
      expect(r.errors).toContain("File content is empty");
    });

    it("rejects whitespace-only content", () => {
      const r = validateOutput("test.md", "   \n  ");
      expect(r.valid).toBe(false);
    });

    it("rejects content below minSize", () => {
      const r = validateOutput("test.md", "hi", { minSize: 10 });
      expect(r.valid).toBe(false);
      expect(r.errors[0]).toContain("too small");
    });

    it("accepts valid content", () => {
      const r = validateOutput("test.md", "# Hello\nThis is valid markdown content here.", {
        checkDuplicates: false,
      });
      expect(r.valid).toBe(true);
    });

    it("detects duplicates when enabled", () => {
      setupDir();
      writeFileSync(`${TMP_DIR}/existing.md`, "# Duplicate content here");
      const r = validateOutput("new.md", "# Duplicate content here", {
        outputDir: TMP_DIR,
        checkDuplicates: true,
      });
      expect(r.valid).toBe(false);
      expect(r.errors.some(e => e.includes("duplicate"))).toBe(true);
      rmSync(TMP_DIR, { recursive: true, force: true });
    });

    it("skips duplicate check for non-existent dir", () => {
      const r = validateOutput("test.md", "# Some valid content here", {
        outputDir: "/tmp/nonexistent-dir-xyz",
        checkDuplicates: true,
      });
      expect(r.valid).toBe(true);
    });
  });

  describe("findDuplicate", () => {
    it("returns null for empty dir", () => {
      setupDir();
      expect(findDuplicate("some content", TMP_DIR)).toBeNull();
      rmSync(TMP_DIR, { recursive: true, force: true });
    });

    it("finds matching file", () => {
      setupDir();
      writeFileSync(`${TMP_DIR}/a.txt`, "hello world");
      expect(findDuplicate("hello world", TMP_DIR)).toBe("a.txt");
      rmSync(TMP_DIR, { recursive: true, force: true });
    });

    it("excludes specified filename", () => {
      setupDir();
      writeFileSync(`${TMP_DIR}/self.txt`, "hello world");
      expect(findDuplicate("hello world", TMP_DIR, "self.txt")).toBeNull();
      rmSync(TMP_DIR, { recursive: true, force: true });
    });

    it("returns null for non-existent dir", () => {
      expect(findDuplicate("x", "/tmp/nope-not-here")).toBeNull();
    });
  });

  describe("validateContentType", () => {
    it("warns on markdown without headers", () => {
      const r = validateContentType("file.md", "no headers here");
      expect(r.warnings.length).toBeGreaterThan(0);
    });

    it("no warning for markdown with header", () => {
      const r = validateContentType("file.md", "# Title\nContent");
      expect(r.warnings).toHaveLength(0);
    });

    it("errors on test file without test blocks", () => {
      const r = validateContentType("foo.test.ts", "const x = 1;");
      expect(r.errors.some(e => e.includes("no test/it/describe"))).toBe(true);
    });

    it("accepts test file with describe block", () => {
      const r = validateContentType("foo.test.ts", 'describe("x", () => {})');
      expect(r.errors).toHaveLength(0);
    });

    it("errors on invalid JSON", () => {
      const r = validateContentType("data.json", "{invalid}");
      expect(r.errors.some(e => e.includes("invalid JSON"))).toBe(true);
    });

    it("accepts valid JSON", () => {
      const r = validateContentType("data.json", '{"key": "value"}');
      expect(r.errors).toHaveLength(0);
    });

    it("warns on shell script without shebang", () => {
      const r = validateContentType("run.sh", "echo hello");
      expect(r.warnings.some(w => w.includes("shebang"))).toBe(true);
    });

    it("no warning for shell script with shebang", () => {
      const r = validateContentType("run.sh", "#!/bin/bash\necho hello");
      expect(r.warnings).toHaveLength(0);
    });
  });

  describe("hashContent", () => {
    it("returns consistent hash", () => {
      expect(hashContent("hello")).toBe(hashContent("hello"));
    });

    it("different content gives different hash", () => {
      expect(hashContent("a")).not.toBe(hashContent("b"));
    });

    it("trims whitespace before hashing", () => {
      expect(hashContent("  hello  ")).toBe(hashContent("hello"));
    });
  });
});
