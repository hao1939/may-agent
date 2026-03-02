import { describe, it, expect } from "vitest";
import { generateId } from "../src/manager.js";

describe("generateId()", () => {
  it("uses default prefix and custom prefix", () => {
    const defaultId = generateId();
    expect(defaultId).toMatch(/^s_\d+_\d+$/);

    const customId = generateId("task");
    expect(customId).toMatch(/^task_\d+_\d+$/);
  });
});
