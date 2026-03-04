import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { Cron } from "../run/cron.js";

function makeMockManager() {
  const calls: Array<{ sessionId: string; message: string }> = [];
  return {
    calls,
    followUp: (sessionId: string, message: string) => {
      calls.push({ sessionId, message });
    },
  };
}

describe("Cron", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "cron-"));
    configPath = resolve(dir, "cron.json");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads entries from cron.json", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "health", intervalMs: 60000, message: "check" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    const entries = c.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("health");
  });

  it("returns empty when no config file", () => {
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    expect(c.load()).toHaveLength(0);
  });

  it("skips invalid entries", () => {
    const errors: string[] = [];
    writeFileSync(configPath, JSON.stringify([
      { name: "ok", intervalMs: 60000, message: "fine" },
      { name: 123 }, // invalid
      { name: "fast", intervalMs: 500, message: "too fast" }, // below minimum
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    const entries = c.load();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("ok");
    expect(errors).toHaveLength(2);
  });

  it("fires followUp on interval", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "ping", intervalMs: 30000, message: "hello" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.load();
    c.start();

    expect(mgr.calls).toHaveLength(0);
    vi.advanceTimersByTime(30000);
    expect(mgr.calls).toHaveLength(1);
    expect(mgr.calls[0]).toEqual({ sessionId: "sid-1", message: "hello" });

    vi.advanceTimersByTime(30000);
    expect(mgr.calls).toHaveLength(2);

    c.stop();
    vi.advanceTimersByTime(30000);
    expect(mgr.calls).toHaveLength(2); // no more after stop
  });

  it("stop clears all jobs", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "a", intervalMs: 10000, message: "m1" },
      { name: "b", intervalMs: 20000, message: "m2" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.load();
    c.start();

    c.stop();
    vi.advanceTimersByTime(100000);
    expect(mgr.calls).toHaveLength(0);
  });

  it("reload picks up new entries", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "old", intervalMs: 10000, message: "old msg" },
    ]));
    const mgr = makeMockManager();
    const c = new Cron(configPath, mgr as any, () => "sid-1");
    c.load();
    c.start();

    // Update config file
    writeFileSync(configPath, JSON.stringify([
      { name: "new", intervalMs: 15000, message: "new msg" },
    ]));
    c.reload();

    vi.advanceTimersByTime(15000);
    expect(mgr.calls).toHaveLength(1);
    expect(mgr.calls[0].message).toBe("new msg");

    // Second tick of new job
    vi.advanceTimersByTime(15000);
    expect(mgr.calls).toHaveLength(2);
    expect(mgr.calls[1].message).toBe("new msg");
  });

  it("uses dynamic session ID", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "t", intervalMs: 10000, message: "m" },
    ]));
    const mgr = makeMockManager();
    let currentSid = "sid-1";
    const c = new Cron(configPath, mgr as any, () => currentSid);
    c.load();
    c.start();

    vi.advanceTimersByTime(10000);
    expect(mgr.calls[0].sessionId).toBe("sid-1");

    currentSid = "sid-2";
    vi.advanceTimersByTime(10000);
    expect(mgr.calls[1].sessionId).toBe("sid-2");

    c.stop();
  });

  it("handles followUp errors gracefully", () => {
    writeFileSync(configPath, JSON.stringify([
      { name: "t", intervalMs: 10000, message: "m" },
    ]));
    const errors: string[] = [];
    const mgr = {
      followUp: () => { throw new Error("session gone"); },
    };
    const c = new Cron(configPath, mgr as any, () => "sid-1", (msg) => errors.push(msg));
    c.load();
    c.start();

    // Should not throw, just report error
    vi.advanceTimersByTime(10000);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("session gone");

    c.stop();
  });
});
