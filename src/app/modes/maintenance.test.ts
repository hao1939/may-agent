import { describe, expect, test } from "bun:test";
import { observeRuntimeLiveness } from "./maintenance.js";

describe("runtime liveness maintenance", () => {
  test("requires consecutive failures before requesting recovery", () => {
    let state = { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 };
    for (let attempt = 1; attempt < 3; attempt += 1) {
      const observed = observeRuntimeLiveness(state, { responsive: false, activeWork: false }, attempt, {
        failureThreshold: 3,
      });
      state = observed.state;
      expect(observed.requestRestart).toBe(false);
    }
    const observed = observeRuntimeLiveness(state, { responsive: false, activeWork: false }, 3, {
      failureThreshold: 3,
    });
    expect(observed.requestRestart).toBe(true);
  });

  test("a healthy probe resets the failure streak", () => {
    expect(
      observeRuntimeLiveness(
        { consecutiveFailures: 5, lastRestartAt: 0, activeWorkProtectedUntil: 20 },
        { responsive: true, activeWork: false },
        10,
      ),
    ).toEqual({
      state: { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 },
      requestRestart: false,
      protectedActiveWork: false,
    });
  });

  test("restart cooldown prevents a recovery loop", () => {
    const observed = observeRuntimeLiveness(
      { consecutiveFailures: 8, lastRestartAt: 1_000, activeWorkProtectedUntil: 0 },
      { responsive: false, activeWork: false },
      1_500,
      {
        failureThreshold: 3,
        restartCooldownMs: 1_000,
      },
    );
    expect(observed.requestRestart).toBe(false);
    expect(observed.state.consecutiveFailures).toBe(9);
  });

  test("recently observed active work suppresses socket-timeout recovery", () => {
    const active = observeRuntimeLiveness(
      { consecutiveFailures: 0, lastRestartAt: 0, activeWorkProtectedUntil: 0 },
      { responsive: true, activeWork: true },
      100,
      { activeWorkGraceMs: 1_000 },
    );
    const failed = observeRuntimeLiveness(
      { ...active.state, consecutiveFailures: 5 },
      { responsive: false, activeWork: false },
      500,
      { failureThreshold: 3, activeWorkGraceMs: 1_000 },
    );
    expect(failed.requestRestart).toBe(false);
    expect(failed.protectedActiveWork).toBe(true);
  });

  test("expired active-work protection permits recovery", () => {
    const observed = observeRuntimeLiveness(
      { consecutiveFailures: 5, lastRestartAt: 0, activeWorkProtectedUntil: 1_100 },
      { responsive: false, activeWork: false },
      1_101,
      { failureThreshold: 3 },
    );
    expect(observed.requestRestart).toBe(true);
    expect(observed.protectedActiveWork).toBe(false);
  });
});
