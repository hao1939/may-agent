import { describe, expect, test } from "bun:test";

import { createControlledModelRegistry } from "../src/model-registry";

describe("controlled model registry", () => {
  test("preserves registered identities while disabling silent fallback", () => {
    const registry = createControlledModelRegistry();
    expect(Object.keys(registry).length).toBeGreaterThan(0);
    expect(registry["gpt-5.6-sol"]).toBeDefined();
    for (const model of Object.values(registry)) {
      expect(Object.prototype.hasOwnProperty.call(model, "fallbackModel")).toBe(false);
    }
  });
});
