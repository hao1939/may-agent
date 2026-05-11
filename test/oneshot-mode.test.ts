import { describe, expect, it } from "vitest";
import { parseOneshotTimeoutMinutes } from "../src/app/modes/oneshot.js";

describe("oneshot mode", () => {
  it("parses timeout minutes", () => {
    expect(parseOneshotTimeoutMinutes(["may-agent", "--timeout=12"])).toBe(12);
  });

  it("defaults timeout to 5 minutes when missing or invalid", () => {
    expect(parseOneshotTimeoutMinutes(["may-agent"])).toBe(5);
    expect(parseOneshotTimeoutMinutes(["may-agent", "--timeout=nope"])).toBe(5);
  });
});
