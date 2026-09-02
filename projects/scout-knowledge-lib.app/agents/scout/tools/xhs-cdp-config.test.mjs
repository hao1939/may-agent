import { describe, expect, it } from "bun:test";
import {
  resolveXhsCdpEndpoint,
  selectXhsCdpTab,
  summarizeXhsPageStatus,
} from "./xhs-cdp-config.mjs";

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

describe("XHS page status summarization", () => {
  it("deduplicates overlapping links by stable note ID", () => {
    expect(
      summarizeXhsPageStatus({
        body: "public explore",
        sectionCount: 2,
        hrefs: [
          "https://www.xiaohongshu.com/explore/6a884237000000003400f9f6?xsec_token=first",
          "https://www.xiaohongshu.com/explore/6a884237000000003400f9f6?xsec_token=second",
          "/search_result/6a9690dc000000001c034a3b?xsec_token=third",
          "https://example.test/explore/6a1111110000000011111111",
        ],
      }),
    ).toEqual({
      ready: true,
      noteCount: 2,
      loginWall: false,
      reason: "source content is readable",
    });
  });

  it("keeps source sections readable without inventing stable note IDs", () => {
    expect(
      summarizeXhsPageStatus({
        body: "rendering source cards",
        sectionCount: 3,
        hrefs: ["invalid", null],
      }),
    ).toMatchObject({ ready: true, noteCount: 0, loginWall: false });
  });

  it("keeps a login wall unavailable even when note links remain in the DOM", () => {
    expect(
      summarizeXhsPageStatus({
        body: "请先登录",
        sectionCount: 1,
        hrefs: [
          "https://www.xiaohongshu.com/discovery/item/6a884237000000003400f9f6",
        ],
      }),
    ).toEqual({
      ready: false,
      noteCount: 1,
      loginWall: true,
      reason: "XHS browser login is required",
    });
  });
});
