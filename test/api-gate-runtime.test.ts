import { describe, expect, it } from "bun:test";
import { createRuntimeApiGate } from "../src/app/api-gate-runtime.js";

describe("runtime api gate", () => {
  it("uses env concurrency defaults and endpoint overrides", async () => {
    const gate = createRuntimeApiGate({
      API_GATE_CONCURRENCY: "1",
      API_GATE_OVERRIDES: JSON.stringify({ provider: 2 }),
    });

    const release = await gate.acquire("provider", "session-1", "may");
    try {
      expect(gate.status()).toEqual([
        {
          endpoint: "provider",
          active: 1,
          limit: 2,
          queued: 0,
          queuedAgents: [],
        },
      ]);
    } finally {
      release();
    }
  });
});
