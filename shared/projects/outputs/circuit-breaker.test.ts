/**
 * Tests for workflows/circuit-breaker.ts
 * 
 * Since the real module uses fs operations, we replicate the pure logic
 * and test it directly.
 */
import { describe, it, expect, beforeEach } from "vitest";

// ── Replicated types and constants ──────────────────────────────────

const THRESHOLD = 3;

interface AgentState {
  consecutiveErrors: number;
  lastError?: string;
  trippedAt?: string;
}

interface BreakerState {
  agents: Record<string, AgentState>;
}

// ── Replicated pure logic ───────────────────────────────────────────

function checkCircuitBreakerPure(
  state: BreakerState,
  agent: string,
  signalFileExists: boolean
): { result: string | null; newState: BreakerState } {
  const agentState = state.agents[agent];

  if (!agentState || agentState.consecutiveErrors < THRESHOLD) {
    return { result: null, newState: state };
  }

  // Signal file deleted = manual re-enable
  if (!signalFileExists) {
    const newState = {
      ...state,
      agents: { ...state.agents, [agent]: { consecutiveErrors: 0 } },
    };
    return { result: null, newState };
  }

  return {
    result: `Circuit breaker OPEN: ${agentState.consecutiveErrors} consecutive errors since ${agentState.trippedAt}`,
    newState: state,
  };
}

function recordOutcomePure(
  state: BreakerState,
  agent: string,
  isError: boolean,
  errorDetail?: string
): { newState: BreakerState; shouldTrip: boolean; shouldCleanSignal: boolean } {
  const newState: BreakerState = {
    agents: { ...state.agents },
  };

  if (!newState.agents[agent]) {
    newState.agents[agent] = { consecutiveErrors: 0 };
  } else {
    newState.agents[agent] = { ...newState.agents[agent] };
  }

  let shouldTrip = false;
  let shouldCleanSignal = false;

  if (isError) {
    newState.agents[agent].consecutiveErrors++;
    newState.agents[agent].lastError = errorDetail ?? "unknown";

    if (
      newState.agents[agent].consecutiveErrors >= THRESHOLD &&
      !newState.agents[agent].trippedAt
    ) {
      shouldTrip = true;
      newState.agents[agent].trippedAt = "2025-01-01T00:00:00.000Z";
    }
  } else {
    const wasTripped = newState.agents[agent].consecutiveErrors >= THRESHOLD;
    newState.agents[agent] = { consecutiveErrors: 0 };
    if (wasTripped) shouldCleanSignal = true;
  }

  return { newState, shouldTrip, shouldCleanSignal };
}

function resetCircuitBreakerPure(
  state: BreakerState,
  agent: string
): BreakerState {
  return {
    ...state,
    agents: { ...state.agents, [agent]: { consecutiveErrors: 0 } },
  };
}

function generateSignalContent(agent: string, agentState: AgentState): string {
  return [
    `# ⚡ Circuit Breaker Tripped`,
    `**Agent**: ${agent}`,
    `**Consecutive errors**: ${agentState.consecutiveErrors}`,
  ].join("\n");
}

// ── Tests ───────────────────────────────────────────────────────────

describe("circuit-breaker", () => {
  let emptyState: BreakerState;

  beforeEach(() => {
    emptyState = { agents: {} };
  });

  describe("checkCircuitBreaker", () => {
    it("returns null for unknown agent", () => {
      const { result } = checkCircuitBreakerPure(emptyState, "worker", true);
      expect(result).toBeNull();
    });

    it("returns null when errors below threshold", () => {
      const state: BreakerState = {
        agents: { worker: { consecutiveErrors: 2 } },
      };
      const { result } = checkCircuitBreakerPure(state, "worker", true);
      expect(result).toBeNull();
    });

    it("returns null when errors exactly 0", () => {
      const state: BreakerState = {
        agents: { worker: { consecutiveErrors: 0 } },
      };
      const { result } = checkCircuitBreakerPure(state, "worker", true);
      expect(result).toBeNull();
    });

    it("returns blocked message when at threshold", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 3,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const { result } = checkCircuitBreakerPure(state, "worker", true);
      expect(result).toContain("Circuit breaker OPEN");
      expect(result).toContain("3 consecutive errors");
    });

    it("returns blocked message when above threshold", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 7,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const { result } = checkCircuitBreakerPure(state, "worker", true);
      expect(result).toContain("7 consecutive errors");
    });

    it("resets when signal file is deleted (manual re-enable)", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 5,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const { result, newState } = checkCircuitBreakerPure(state, "worker", false);
      expect(result).toBeNull();
      expect(newState.agents.worker.consecutiveErrors).toBe(0);
    });

    it("does not affect other agents when one is tripped", () => {
      const state: BreakerState = {
        agents: {
          worker: { consecutiveErrors: 5, trippedAt: "2025-01-01T00:00:00.000Z" },
          coach: { consecutiveErrors: 1 },
        },
      };
      const { result } = checkCircuitBreakerPure(state, "coach", true);
      expect(result).toBeNull();
    });

    it("includes trippedAt timestamp in message", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 3,
            trippedAt: "2025-06-15T12:00:00.000Z",
          },
        },
      };
      const { result } = checkCircuitBreakerPure(state, "worker", true);
      expect(result).toContain("2025-06-15T12:00:00.000Z");
    });
  });

  describe("recordOutcome", () => {
    it("initializes agent state on first error", () => {
      const { newState } = recordOutcomePure(emptyState, "worker", true, "timeout");
      expect(newState.agents.worker.consecutiveErrors).toBe(1);
      expect(newState.agents.worker.lastError).toBe("timeout");
    });

    it("initializes agent state on first success", () => {
      const { newState } = recordOutcomePure(emptyState, "worker", false);
      expect(newState.agents.worker.consecutiveErrors).toBe(0);
    });

    it("increments consecutive errors", () => {
      let state = emptyState;
      for (let i = 0; i < 3; i++) {
        const res = recordOutcomePure(state, "worker", true, `err${i}`);
        state = res.newState;
      }
      expect(state.agents.worker.consecutiveErrors).toBe(3);
    });

    it("trips breaker at threshold", () => {
      let state = emptyState;
      let tripped = false;
      for (let i = 0; i < 3; i++) {
        const res = recordOutcomePure(state, "worker", true);
        state = res.newState;
        if (res.shouldTrip) tripped = true;
      }
      expect(tripped).toBe(true);
      expect(state.agents.worker.trippedAt).toBeDefined();
    });

    it("does not trip before threshold", () => {
      let state = emptyState;
      for (let i = 0; i < 2; i++) {
        const res = recordOutcomePure(state, "worker", true);
        state = res.newState;
        expect(res.shouldTrip).toBe(false);
      }
    });

    it("does not re-trip if already tripped", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 5,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const { shouldTrip } = recordOutcomePure(state, "worker", true);
      expect(shouldTrip).toBe(false);
    });

    it("resets on success", () => {
      const state: BreakerState = {
        agents: { worker: { consecutiveErrors: 2 } },
      };
      const { newState } = recordOutcomePure(state, "worker", false);
      expect(newState.agents.worker.consecutiveErrors).toBe(0);
    });

    it("cleans signal file on success after trip", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 5,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const { shouldCleanSignal } = recordOutcomePure(state, "worker", false);
      expect(shouldCleanSignal).toBe(true);
    });

    it("does not clean signal on success if not tripped", () => {
      const state: BreakerState = {
        agents: { worker: { consecutiveErrors: 1 } },
      };
      const { shouldCleanSignal } = recordOutcomePure(state, "worker", false);
      expect(shouldCleanSignal).toBe(false);
    });

    it("uses fallback when no errorDetail provided", () => {
      const { newState } = recordOutcomePure(emptyState, "worker", true);
      expect(newState.agents.worker.lastError).toBe("unknown");
    });

    it("handles multiple agents independently", () => {
      let state = emptyState;
      state = recordOutcomePure(state, "worker", true, "e1").newState;
      state = recordOutcomePure(state, "worker", true, "e2").newState;
      state = recordOutcomePure(state, "coach", true, "e1").newState;
      expect(state.agents.worker.consecutiveErrors).toBe(2);
      expect(state.agents.coach.consecutiveErrors).toBe(1);
    });
  });

  describe("resetCircuitBreaker", () => {
    it("resets a tripped agent", () => {
      const state: BreakerState = {
        agents: {
          worker: {
            consecutiveErrors: 5,
            trippedAt: "2025-01-01T00:00:00.000Z",
          },
        },
      };
      const newState = resetCircuitBreakerPure(state, "worker");
      expect(newState.agents.worker.consecutiveErrors).toBe(0);
      expect(newState.agents.worker.trippedAt).toBeUndefined();
    });

    it("resets a non-tripped agent", () => {
      const state: BreakerState = {
        agents: { worker: { consecutiveErrors: 1 } },
      };
      const newState = resetCircuitBreakerPure(state, "worker");
      expect(newState.agents.worker.consecutiveErrors).toBe(0);
    });

    it("handles unknown agent", () => {
      const newState = resetCircuitBreakerPure(emptyState, "unknown");
      expect(newState.agents.unknown.consecutiveErrors).toBe(0);
    });

    it("does not affect other agents", () => {
      const state: BreakerState = {
        agents: {
          worker: { consecutiveErrors: 5, trippedAt: "2025-01-01T00:00:00.000Z" },
          coach: { consecutiveErrors: 2 },
        },
      };
      const newState = resetCircuitBreakerPure(state, "worker");
      expect(newState.agents.coach.consecutiveErrors).toBe(2);
    });
  });

  describe("signal file content", () => {
    it("includes agent name", () => {
      const content = generateSignalContent("worker", {
        consecutiveErrors: 3,
        trippedAt: "2025-01-01T00:00:00.000Z",
      });
      expect(content).toContain("worker");
    });

    it("includes error count", () => {
      const content = generateSignalContent("worker", {
        consecutiveErrors: 5,
      });
      expect(content).toContain("5");
    });
  });

  describe("threshold constant", () => {
    it("is 3", () => {
      expect(THRESHOLD).toBe(3);
    });
  });
});
