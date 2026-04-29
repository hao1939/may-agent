import { describe, it, expect } from "vitest";
import { guard as rbeGuard } from "../shared/guards/rbe-primer.js";
import { guard as vaeGuard } from "../shared/guards/vae-primer.js";

describe("rbe-primer guard", () => {
  it("returns reminder for agent source", () => {
    const demands = rbeGuard.handle({ type: "step_start", source: "agent" } as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("read()");
  });
  it("skips for function source", () => {
    expect(rbeGuard.handle({ type: "step_start", source: "function" } as any)).toEqual([]);
  });
});

describe("vae-primer guard", () => {
  it("returns reminder for agent source", () => {
    const demands = vaeGuard.handle({ type: "step_start", source: "agent" } as any);
    expect(demands).toHaveLength(1);
    expect(demands[0].type).toBe("warn");
    expect(demands[0].reason).toContain("edit()");
  });
  it("skips for function source", () => {
    expect(vaeGuard.handle({ type: "step_start", source: "function" } as any)).toEqual([]);
  });
});
