import { describe, expect, test } from "bun:test";
import { observeRuntimeLiveness } from "./maintenance.js";

describe("runtime liveness maintenance", () => {
  test("requires consecutive failures before requesting recovery", () => {
    let state = { consecutiveFailures: 0, lastRestartAt: 0 };
    for (let attempt = 1; attempt < 3; attempt += 1) {
      const observed = observeRuntimeLiveness(state, false, attempt, {
        failureThreshold: 3,
      });
      state = observed.state;
      expect(observed.requestRestart).toBe(false);
    }
    const observed = observeRuntimeLiveness(state, false, 3, {
      failureThreshold: 3,
    });
    expect(observed.requestRestart).toBe(true);
  });

  test("a healthy probe resets the failure streak", () => {
    expect(observeRuntimeLiveness({ consecutiveFailures: 5, lastRestartAt: 0 }, true, 10)).toEqual({
      state: { consecutiveFailures: 0, lastRestartAt: 0 },
      requestRestart: false,
    });
  });

  test("restart cooldown prevents a recovery loop", () => {
    const observed = observeRuntimeLiveness({ consecutiveFailures: 8, lastRestartAt: 1_000 }, false, 1_500, {
      failureThreshold: 3,
      restartCooldownMs: 1_000,
    });
    expect(observed.requestRestart).toBe(false);
    expect(observed.state.consecutiveFailures).toBe(9);
  });
});
