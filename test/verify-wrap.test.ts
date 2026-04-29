import { describe, it, expect } from "vitest";
import { name, description } from "../shared/workflows/verify-wrap.js";

describe("verify-wrap exports", () => {
  it("exports workflow name", () => {
    expect(name).toBe("verify-wrap");
  });

  it("exports a description string", () => {
    expect(typeof description).toBe("string");
    expect(description.length).toBeGreaterThan(0);
  });

  it("exports execute as a function", async () => {
    const mod = await import("../shared/workflows/verify-wrap.js");
    expect(typeof mod.execute).toBe("function");
  });
});
