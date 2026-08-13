import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { markSessionActive, readActiveSessionProcessId, sessionDir } from "./persistence.js";

describe("active session process ownership", () => {
  let persistDir: string;

  beforeEach(() => {
    persistDir = mkdtempSync(join(tmpdir(), "may-active-session-owner-"));
  });

  afterEach(() => {
    rmSync(persistDir, { recursive: true, force: true });
  });

  it("records and recognizes the current process instance", () => {
    markSessionActive(persistDir, "session-current");
    const marker = JSON.parse(readFileSync(join(sessionDir(persistDir, "session-current"), "[ACTIVE]"), "utf8"));
    expect(marker).toMatchObject({
      pid: process.pid,
      processIdentity: expect.any(String),
      activatedAt: expect.any(String),
    });
    expect(readActiveSessionProcessId(persistDir, "session-current")).toBe(process.pid);
  });

  it("rejects a marker from a previous container that reused the current PID", () => {
    markSessionActive(persistDir, "session-reused");
    const markerPath = join(sessionDir(persistDir, "session-reused"), "[ACTIVE]");
    const marker = JSON.parse(readFileSync(markerPath, "utf8"));
    writeFileSync(markerPath, JSON.stringify({ ...marker, processIdentity: "previous-container-runtime" }));
    expect(readActiveSessionProcessId(persistDir, "session-reused")).toBeNull();
  });

  it("rejects a legacy same-PID marker written before the current Linux process", () => {
    if (!existsSync(`/proc/${process.pid}`)) return;
    markSessionActive(persistDir, "session-legacy");
    const markerPath = join(sessionDir(persistDir, "session-legacy"), "[ACTIVE]");
    writeFileSync(markerPath, JSON.stringify({ pid: process.pid, activatedAt: "2000-01-01T00:00:00.000Z" }));
    expect(readActiveSessionProcessId(persistDir, "session-legacy")).toBeNull();
  });
});
