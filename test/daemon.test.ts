import { describe, expect, it } from "bun:test";
import { formatDurationMs } from "../src/app/daemon.js";

describe("daemon helpers", () => {
  it("formats durations compactly", () => {
    expect(formatDurationMs(42_000)).toBe("42s");
    expect(formatDurationMs(125_000)).toBe("2m5s");
    expect(formatDurationMs(7_500_000)).toBe("2h5m");
  });
});
