import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureSessionDir, sessionExists } from "./persistence.js";

describe("sessionExists", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-session-exists-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("returns true when the session directory exists", () => {
    const sessionId = "sess-exists-1";
    ensureSessionDir(persistDir, sessionId);
    expect(sessionExists(persistDir, sessionId)).toBe(true);
  });

  it("returns false when the session directory does not exist", () => {
    expect(sessionExists(persistDir, "sess-nonexistent")).toBe(false);
  });
});
