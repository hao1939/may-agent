import { settings } from "../lib/settings";

describe("settings", () => {
  it("should have maxRetries set to 5", () => {
    expect(settings.maxRetries).toBe(5);
  });

  it("should have a valid timeout", () => {
    expect(settings.timeout).toBeGreaterThan(0);
  });
});
