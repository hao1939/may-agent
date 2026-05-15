import { describe, it, expect, beforeAll } from "bun:test";

// These guards export a `guard` object with name, events, and handle()
// They are simple primer guards that return a warning on step_start

describe("rbe-primer guard", () => {
  let guard: any;
  
  beforeAll(async () => {
    // Dynamic import to avoid TS reference path issues
    const mod = await import("../guards/rbe-primer.js");
    guard = mod.guard;
  });

  it("has correct name", () => {
    expect(guard.name).toBe("rbe-primer");
  });

  it("fires on step_start events", () => {
    expect(guard.events).toContain("step_start");
  });

  it("returns a warning demand for non-function sources", () => {
    const demands = guard.handle({ source: "agent" });
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("read()");
  });

  it("returns empty for function source", () => {
    const demands = guard.handle({ source: "function" });
    expect(demands).toHaveLength(0);
  });
});

describe("vae-primer guard", () => {
  let guard: any;
  
  beforeAll(async () => {
    const mod = await import("../guards/vae-primer.js");
    guard = mod.guard;
  });

  it("has correct name", () => {
    expect(guard.name).toBe("vae-primer");
  });

  it("returns a warning about verify after edit", () => {
    const demands = guard.handle({ source: "agent" });
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("edit()");
  });

  it("skips function sources", () => {
    const demands = guard.handle({ source: "function" });
    expect(demands).toHaveLength(0);
  });
});
