import { describe, expect, it } from "bun:test";
import { resolveXhsCdpEndpoint, selectXhsCdpTab } from "./xhs-cdp-config.mjs";

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
    expect(() => resolveXhsCdpEndpoint({ SCOUT_XHS_CDP_PORT: "0" })).toThrow(
      "must be an integer from 1 to 65535",
    );
    expect(() =>
      resolveXhsCdpEndpoint({ SCOUT_XHS_CDP_PORT: "9222.5" }),
    ).toThrow("must be an integer from 1 to 65535");
  });
});

describe("XHS Chrome DevTools target selection", () => {
  it("prefers readable source routes over an earlier login tab", () => {
    expect(
      selectXhsCdpTab([
        {
          id: "login",
          type: "page",
          url: "https://www.xiaohongshu.com/login",
        },
        {
          id: "explore",
          type: "page",
          url: "https://www.xiaohongshu.com/explore",
        },
      ]),
    ).toMatchObject({ id: "explore" });
  });

  it("keeps profile content ahead of login and preserves equal-rank order", () => {
    expect(
      selectXhsCdpTab([
        {
          id: "login",
          type: "page",
          url: "https://www.xiaohongshu.com/login",
        },
        {
          id: "profile-first",
          type: "page",
          url: "https://www.xiaohongshu.com/user/profile/stable-id",
        },
        {
          id: "profile-second",
          type: "page",
          url: "https://www.xiaohongshu.com/user/profile/other-id",
        },
      ]),
    ).toMatchObject({ id: "profile-first" });
  });

  it("rejects non-page targets, deceptive hosts, and invalid input", () => {
    expect(
      selectXhsCdpTab([
        {
          id: "socket",
          type: "websocket",
          url: "https://www.xiaohongshu.com/explore",
        },
        {
          id: "deceptive",
          type: "page",
          url: "https://example.test/?next=xiaohongshu.com",
        },
      ]),
    ).toBeNull();
    expect(selectXhsCdpTab(null)).toBeNull();
  });
});
