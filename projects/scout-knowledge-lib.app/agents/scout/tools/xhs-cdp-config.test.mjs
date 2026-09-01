import { describe, expect, it } from "bun:test";
import { resolveXhsCdpEndpoint } from "./xhs-cdp-config.mjs";

describe("XHS Chrome DevTools endpoint configuration", () => {
  it("preserves the existing localhost default", () => {
    expect(resolveXhsCdpEndpoint({})).toEqual({
      host: "localhost",
      port: 9222,
    });
  });

  it("accepts explicit deployment wiring", () => {
    expect(
      resolveXhsCdpEndpoint({
        SCOUT_XHS_CDP_HOST: "host.docker.internal",
        SCOUT_XHS_CDP_PORT: "19222",
      }),
    ).toEqual({ host: "host.docker.internal", port: 19222 });
  });

  it("rejects URLs and invalid ports before connecting", () => {
    expect(() =>
      resolveXhsCdpEndpoint({ SCOUT_XHS_CDP_HOST: "http://localhost" }),
    ).toThrow("must be a hostname or IP address");
    expect(() =>
      resolveXhsCdpEndpoint({ SCOUT_XHS_CDP_PORT: "0" }),
    ).toThrow("must be an integer from 1 to 65535");
    expect(() =>
      resolveXhsCdpEndpoint({ SCOUT_XHS_CDP_PORT: "9222.5" }),
    ).toThrow("must be an integer from 1 to 65535");
  });
});
