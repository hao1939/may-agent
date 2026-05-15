import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => {
  const store: Record<string, string> = {};
  const dirs: Set<string> = new Set();
  return {
    existsSync: vi.fn((p: string) => p in store || dirs.has(p)),
    mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
    writeFileSync: vi.fn((p: string, data: string) => { store[p] = data; }),
    readFileSync: vi.fn((p: string) => {
      if (!(p in store)) throw new Error("ENOENT");
      return store[p];
    }),
    readdirSync: vi.fn((_p: string) => []),
    unlinkSync: vi.fn((p: string) => { delete store[p]; }),
    _store: store,
    _dirs: dirs,
  };
});

import { existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import {
  checkCircuitBreaker,
  recordOutcome,
  resetCircuitBreaker,
} from "../workflows/circuit-breaker.js";

const fs = await import("node:fs") as any;

function resetStore() {
  for (const k of Object.keys(fs._store)) delete fs._store[k];
  fs._dirs.clear();
  vi.clearAllMocks();
}

describe("circuit-breaker extended", () => {
  beforeEach(resetStore);

  it("returns null for unknown agent", () => {
    const result = checkCircuitBreaker("/agents", "unknown");
    expect(result).toBeNull();
  });

  it("returns null when errors below threshold", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({ agents: { bob: { consecutiveErrors: 2 } } });
    expect(checkCircuitBreaker("/agents", "bob")).toBeNull();
  });

  it("returns reason when errors at threshold", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 3, trippedAt: new Date().toISOString() } }
    });
    // Signal file must exist
    const signalPath = "/agents/bob/SIGNAL-circuit-breaker.md";
    fs._store[signalPath] = "signal";
    
    const result = checkCircuitBreaker("/agents", "bob");
    expect(result).toContain("OPEN");
    expect(result).toContain("3 consecutive errors");
  });

  it("auto-resets when signal file deleted", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 5, trippedAt: "2024-01-01" } }
    });
    // No signal file = manual re-enable
    const result = checkCircuitBreaker("/agents", "bob");
    expect(result).toBeNull();
  });

  it("recordOutcome increments errors", () => {
    recordOutcome("/agents", "alice", true, "timeout");
    const writeCall = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    expect(writeCall).toBeTruthy();
    const state = JSON.parse(writeCall[1]);
    expect(state.agents.alice.consecutiveErrors).toBe(1);
  });

  it("recordOutcome trips breaker at threshold", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    // Pre-load with 2 errors
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 2, lastError: "prev" } }
    });
    
    recordOutcome("/agents", "bob", true, "error3");
    
    // Should have written signal file
    const signalWrite = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("SIGNAL")
    );
    expect(signalWrite).toBeTruthy();
    expect(signalWrite[1]).toContain("Circuit Breaker Tripped");
  });

  it("recordOutcome resets on success", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 1 } }
    });
    
    recordOutcome("/agents", "bob", false);
    const writeCall = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    const state = JSON.parse(writeCall[1]);
    expect(state.agents.bob.consecutiveErrors).toBe(0);
  });

  it("recordOutcome cleans signal on success after trip", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    const signalPath = "/agents/bob/SIGNAL-circuit-breaker.md";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 5, trippedAt: "2024-01-01" } }
    });
    fs._store[signalPath] = "signal content";
    
    recordOutcome("/agents", "bob", false);
    expect(unlinkSync).toHaveBeenCalledWith(signalPath);
  });

  it("recordOutcome does not clean signal when not previously tripped", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 1 } }
    });
    
    recordOutcome("/agents", "bob", false);
    expect(unlinkSync).not.toHaveBeenCalled();
  });

  it("resetCircuitBreaker clears state and signal", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    const signalPath = "/agents/bob/SIGNAL-circuit-breaker.md";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 5, trippedAt: "2024-01-01" } }
    });
    fs._store[signalPath] = "signal";
    
    resetCircuitBreaker("/agents", "bob");
    
    const writeCall = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    const state = JSON.parse(writeCall[1]);
    expect(state.agents.bob.consecutiveErrors).toBe(0);
    expect(unlinkSync).toHaveBeenCalledWith(signalPath);
  });

  it("does not re-trip already tripped breaker", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { bob: { consecutiveErrors: 4, trippedAt: "2024-01-01" } }
    });
    
    recordOutcome("/agents", "bob", true);
    
    // Should NOT write a new signal (already tripped)
    const signalWrites = (writeFileSync as any).mock.calls.filter((c: any[]) =>
      c[0].includes("SIGNAL")
    );
    expect(signalWrites.length).toBe(0);
  });

  it("handles corrupt state file gracefully", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = "not json";
    
    // readFileSync will return the string, JSON.parse will fail, loadState returns default
    const result = checkCircuitBreaker("/agents", "bob");
    expect(result).toBeNull();
  });

  it("handles missing state file", () => {
    const result = checkCircuitBreaker("/agents", "newagent");
    expect(result).toBeNull();
  });

  it("recordOutcome creates agent entry if not exists", () => {
    recordOutcome("/agents", "newagent", true);
    const writeCall = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    const state = JSON.parse(writeCall[1]);
    expect(state.agents.newagent.consecutiveErrors).toBe(1);
  });

  it("recordOutcome uses ISO date when no errorDetail", () => {
    recordOutcome("/agents", "agent1", true);
    const writeCall = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    const state = JSON.parse(writeCall[1]);
    // lastError should be an ISO-ish string
    expect(state.agents.agent1.lastError).toBeTruthy();
  });

  it("signal file contains agent name and instructions", () => {
    const statePath = "/agents/shared/circuit-breaker-state.json";
    fs._store[statePath] = JSON.stringify({
      agents: { myagent: { consecutiveErrors: 2 } }
    });
    
    // Create dir for agent
    fs._dirs.add("/agents/myagent");
    
    recordOutcome("/agents", "myagent", true, "provider timeout");
    
    const signalWrite = (writeFileSync as any).mock.calls.find((c: any[]) =>
      c[0].includes("SIGNAL")
    );
    expect(signalWrite[1]).toContain("myagent");
    expect(signalWrite[1]).toContain("re-enable");
    expect(signalWrite[1]).toContain("Delete this file");
  });

  it("multiple agents tracked independently", () => {
    recordOutcome("/agents", "alice", true);
    recordOutcome("/agents", "bob", true);
    recordOutcome("/agents", "alice", true);
    
    // Find the last state write
    const allWrites = (writeFileSync as any).mock.calls.filter((c: any[]) =>
      c[0].includes("circuit-breaker-state.json")
    );
    const lastState = JSON.parse(allWrites[allWrites.length - 1][1]);
    expect(lastState.agents.alice.consecutiveErrors).toBe(2);
    expect(lastState.agents.bob.consecutiveErrors).toBe(1);
  });
});
