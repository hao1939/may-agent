import { describe, expect, it } from "bun:test";
import { parseEmitMode } from "./emit.js";

describe("emit mode", () => {
  it("parses event name and JSON payload", () => {
    expect(parseEmitMode(["may-agent", "--emit", "metric.updated", "{\"agent\":\"may\"}"])).toEqual({
      event: "metric.updated",
      data: { agent: "may" },
    });
  });

  it("returns null when --emit is absent", () => {
    expect(parseEmitMode(["may-agent", "--cron"])).toBeNull();
  });

  it("throws a clear error for invalid JSON payload", () => {
    expect(() => parseEmitMode(["may-agent", "--emit", "metric.updated", "{"])).toThrow("Invalid --emit JSON payload");
  });
});
