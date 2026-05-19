import { describe, expect, it } from "bun:test";
import { parseWebPort } from "./web.js";

describe("web mode", () => {
  it("uses the configured port when valid", () => {
    expect(parseWebPort("9090")).toBe(9090);
  });

  it("falls back to 8080 when unset or invalid", () => {
    expect(parseWebPort(undefined)).toBe(8080);
    expect(parseWebPort("not-a-port")).toBe(8080);
  });
});
