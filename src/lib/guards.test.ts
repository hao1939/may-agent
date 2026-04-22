import { describe, test, expect, beforeEach } from "bun:test";
import { EditGuard } from "./edit-guard";
import { validateBashCommand, enforceNoHallucinatedPaths } from "./path-guard";

// ── Edit Guard Tests ──────────────────────────────────────────────────

describe("EditGuard", () => {
  let guard: EditGuard;

  beforeEach(() => {
    guard = new EditGuard();
  });

  test("rejects edit without prior read", () => {
    const result = guard.validateEdit("src/foo.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("C1.1");
  });

  test("allows edit after read", () => {
    guard.trackRead("src/foo.ts");
    const result = guard.validateEdit("src/foo.ts");
    expect(result.valid).toBe(true);
  });

  test("normalizes ./ prefix", () => {
    guard.trackRead("./src/foo.ts");
    const result = guard.validateEdit("src/foo.ts");
    expect(result.valid).toBe(true);
  });

  test("rejects stale read", () => {
    const guard = new EditGuard({ maxAgeMs: 1 }); // 1ms max age
    guard.trackRead("src/foo.ts");
    // Wait a bit
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms
    const result = guard.validateEdit("src/foo.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Stale Read");
  });

  test("tracks count correctly", () => {
    expect(guard.trackedCount).toBe(0);
    guard.trackRead("a.ts");
    guard.trackRead("b.ts");
    expect(guard.trackedCount).toBe(2);
  });

  test("enforceReadBeforeEdit throws", () => {
    expect(() => guard.enforceReadBeforeEdit("x.ts")).toThrow("C1.1");
  });

  test("reset clears tracking", () => {
    guard.trackRead("a.ts");
    guard.reset();
    expect(guard.trackedCount).toBe(0);
    const result = guard.validateEdit("a.ts");
    expect(result.valid).toBe(false);
  });
});

// ── Path Guard Tests ──────────────────────────────────────────────────

describe("PathGuard", () => {
  test("rejects /home/user paths", () => {
    const result = validateBashCommand("cd /home/user && ls");
    expect(result.valid).toBe(false);
    expect(result.offendingPaths).toContain("/home/user");
  });

  test("rejects /home/ubuntu paths", () => {
    const result = validateBashCommand("cat /home/ubuntu/file.txt");
    expect(result.valid).toBe(false);
  });

  test("allows /app paths", () => {
    const result = validateBashCommand("cd /app && ls src/");
    expect(result.valid).toBe(true);
  });

  test("allows relative paths", () => {
    const result = validateBashCommand("cat src/foo.ts");
    expect(result.valid).toBe(true);
  });

  test("allows grep searching for /home/", () => {
    const result = validateBashCommand('grep /home/ src/config.ts');
    expect(result.valid).toBe(true);
  });

  test("enforceNoHallucinatedPaths throws", () => {
    expect(() => enforceNoHallucinatedPaths("ls /home/agent")).toThrow("C7.1");
  });

  test("allows commands without paths", () => {
    const result = validateBashCommand("echo hello world");
    expect(result.valid).toBe(true);
  });

  test("deduplicates offending paths", () => {
    const result = validateBashCommand("ls /home/user && cd /home/user");
    expect(result.valid).toBe(false);
    expect(result.offendingPaths).toEqual(["/home/user"]);
  });
});
