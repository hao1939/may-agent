import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";

const { fastWrite } = await import("../workflows/fast-path.ts");

describe("fast-path fastWrite uncovered branches", () => {
  const tmpDir = "/tmp/fast-path-test-" + Date.now();

  it("rejects markdown without headers", () => {
    const filePath = path.join(tmpDir, "bad.md");
    const result = fastWrite("Just plain text, no headers at all.", filePath);
    expect(result.written).toBe(false);
    expect(result.reason).toBe("Markdown file missing headers");
  });

  it("rejects test file without test blocks", () => {
    const filePath = path.join(tmpDir, "bad.test.ts");
    const result = fastWrite("const x = 1;\nconsole.log(x);", filePath);
    expect(result.written).toBe(false);
    expect(result.reason).toBe("Test file missing test blocks");
  });

  it("handles write failure gracefully", () => {
    const result = fastWrite("# Valid\ncontent", "/proc/fake/impossible/file.md");
    expect(result.written).toBe(false);
    expect(result.reason).toContain("Write failed");
  });

  it("accepts valid test file with describe block", () => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, "good.test.ts");
    const result = fastWrite('describe("test", () => { it("works", () => {}); });', filePath);
    expect(result.written).toBe(true);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });
});
