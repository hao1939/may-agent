import { describe, expect, it } from "bun:test";
import {
  compareXhsSavedProfileAccess,
  fingerprintXhsSavedProfileAccess,
  inspectXhsSavedProfileStatus,
} from "./xhs-browse.mjs";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function page(url, id) {
  return {
    id,
    type: "page",
    url,
    webSocketDebuggerUrl: `ws://127.0.0.1/devtools/page/${id}`,
  };
}

function fakeClient(historyEntries, observed, calls) {
  return {
    async connect() {
      calls.push("connect");
    },
    async send(method) {
      calls.push(method);
      if (method === "Page.getNavigationHistory") {
        return { entries: historyEntries };
      }
      return {};
    },
    async evaluate(expression) {
      calls.push(["evaluate", expression]);
      return observed;
    },
    close() {
      calls.push("close");
    },
  };
}

describe("XHS saved-profile status inspection", () => {
  it("uses login-tab history without navigating and returns only safe evidence", async () => {
    const calls = [];
    const secretUrl =
      "https://www.xiaohongshu.com/user/profile/6a1111110000000011111111?tab=collect";
    const observed = {
      httpStatus: 200,
      contentType: "text/html; charset=utf-8",
      finalLocation: "login",
      byteLength: 46672,
      bodySha256: "a".repeat(64),
      attributableItemCount: 0,
      idFingerprint: EMPTY_SHA256,
      loginWall: true,
      rawUrl: secretUrl,
      cookie: "must-not-escape",
    };
    const result = await inspectXhsSavedProfileStatus(
      [
        page("https://www.xiaohongshu.com/explore", "explore"),
        page("https://www.xiaohongshu.com/login", "login"),
        page("https://xiaohongshu.com.example.test/login", "deceptive"),
      ],
      (wsUrl) => {
        expect(wsUrl).toEndWith("/login");
        return fakeClient([{ id: 17, url: secretUrl }], observed, calls);
      },
    );

    expect(result).toEqual({
      ready: false,
      targetEvidenceSha256:
        "1d842861979e899b1aea8df8498d6f1a42c5906df2aab47693231d91e114a5bd",
      targetQueryKeys: ["tab"],
      accessFingerprint:
        "60da356b88ea030c2f6e87e48803b8ac900fa38c9c3bb296c88ad932e3788e17",
      httpStatus: 200,
      contentType: "text/html; charset=utf-8",
      finalLocation: "login",
      byteLength: 46672,
      bodySha256: "a".repeat(64),
      attributableItemCount: 0,
      idFingerprint: EMPTY_SHA256,
      loginWall: true,
    });
    expect(calls.filter((call) => call === "Page.navigate")).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("6a1111110000000011111111");
    expect(JSON.stringify(result)).not.toContain("collect");
    expect(JSON.stringify(result)).not.toContain("must-not-escape");
    expect(calls.map((call) => (Array.isArray(call) ? call[0] : call))).toEqual(
      [
        "connect",
        "Runtime.enable",
        "Page.getNavigationHistory",
        "evaluate",
        "close",
      ],
    );
  });

  it("returns a supported no-op when no history contains a safe profile", async () => {
    const calls = [];
    const result = await inspectXhsSavedProfileStatus(
      [page("https://www.xiaohongshu.com/login", "login")],
      () =>
        fakeClient(
          [
            { id: 1, url: "https://www.xiaohongshu.com/login" },
            {
              id: 2,
              url: "https://www.xiaohongshu.com/user/profile/6a1111110000000011111111?token=secret",
            },
          ],
          null,
          calls,
        ),
    );

    expect(result).toEqual({
      ready: false,
      reason: "no credential-safe saved profile found in XHS page history",
    });
    expect(calls.some((call) => Array.isArray(call))).toBeFalse();
    expect(calls.at(-1)).toBe("close");
  });

  it("fails closed when browser evaluation returns an invalid summary", async () => {
    const calls = [];
    await expect(
      inspectXhsSavedProfileStatus(
        [page("https://www.xiaohongshu.com/login", "login")],
        () =>
          fakeClient(
            [
              {
                id: 17,
                url: "https://www.xiaohongshu.com/user/profile/6a1111110000000011111111",
              },
            ],
            { bodySha256: "not-a-digest" },
            calls,
          ),
      ),
    ).rejects.toThrow("invalid summary");
    expect(calls.at(-1)).toBe("close");
  });

  it("separates volatile body provenance from stable access equivalence", () => {
    const evidence = {
      targetEvidenceSha256: "1".repeat(64),
      targetQueryKeys: ["subTab", "tab"],
      httpStatus: 200,
      contentType: "text/html; charset=utf-8",
      finalLocation: "login",
      byteLength: 46672,
      attributableItemCount: 0,
      idFingerprint: EMPTY_SHA256,
      loginWall: true,
    };
    const baseline = fingerprintXhsSavedProfileAccess({
      ...evidence,
      bodySha256: "a".repeat(64),
    });

    expect(
      fingerprintXhsSavedProfileAccess({
        ...evidence,
        bodySha256: "b".repeat(64),
      }),
    ).toBe(baseline);
    for (const changed of [
      { targetEvidenceSha256: "2".repeat(64) },
      { targetQueryKeys: ["tab"] },
      { httpStatus: 403 },
      { contentType: "application/json" },
      { finalLocation: "profile" },
      { byteLength: 46673 },
      { attributableItemCount: 1 },
      { idFingerprint: "3".repeat(64) },
      { loginWall: false },
    ]) {
      expect(
        fingerprintXhsSavedProfileAccess({ ...evidence, ...changed }),
      ).not.toBe(baseline);
    }
    expect(() =>
      fingerprintXhsSavedProfileAccess({
        ...evidence,
        targetQueryKeys: ["tab", "tab"],
      }),
    ).toThrow("invalid");
    expect(() =>
      fingerprintXhsSavedProfileAccess({
        ...evidence,
        targetQueryKeys: ["token"],
      }),
    ).toThrow("invalid");
  });

  it("attributes observed body-only and one-byte access deltas without values", () => {
    const cycle56 = {
      targetEvidenceSha256:
        "e860da46506d774eced62830a670ea284f5150429482f8003c706bc6b006906e",
      targetQueryKeys: [],
      httpStatus: 200,
      contentType: "text/html; charset=utf-8",
      finalLocation: "login",
      byteLength: 46672,
      bodySha256:
        "0431b05b15b81a7e57a73dea0f30a3cb34f64928a5ac721fe32afbb0d7e10181",
      attributableItemCount: 0,
      idFingerprint: EMPTY_SHA256,
      loginWall: true,
    };
    const laterCycle56 = {
      ...cycle56,
      bodySha256:
        "0034cd5ea8bff43216d4cc3f4f4c5d71cfb782409099ce6de514fd14b28fb9a5",
    };
    expect(compareXhsSavedProfileAccess(cycle56, laterCycle56)).toEqual({
      equivalent: true,
      changedAccessFields: [],
      bodyChanged: true,
    });

    const cycle57 = {
      ...cycle56,
      byteLength: 46673,
      bodySha256:
        "ea6c911ee4f5e957a44328cd16e3c7b7ecfc7d4d358becab77555f945e0a2384",
    };
    const delta = compareXhsSavedProfileAccess(laterCycle56, cycle57);
    expect(delta).toEqual({
      equivalent: false,
      changedAccessFields: ["byteLength"],
      bodyChanged: true,
    });
    expect(JSON.stringify(delta)).not.toContain(cycle57.bodySha256);
    expect(JSON.stringify(delta)).not.toContain("e860da46506d");
  });

  it("attributes every stable field and rejects unsafe evidence", () => {
    const baseline = {
      targetEvidenceSha256: "1".repeat(64),
      targetQueryKeys: ["tab"],
      httpStatus: 200,
      contentType: "text/html",
      finalLocation: "login",
      byteLength: 46672,
      bodySha256: "2".repeat(64),
      attributableItemCount: 0,
      idFingerprint: EMPTY_SHA256,
      loginWall: true,
    };
    for (const [field, value] of [
      ["targetEvidenceSha256", "3".repeat(64)],
      ["targetQueryKeys", ["subTab", "tab"]],
      ["httpStatus", 403],
      ["contentType", "application/json"],
      ["finalLocation", "profile"],
      ["byteLength", 46673],
      ["attributableItemCount", 1],
      ["idFingerprint", "4".repeat(64)],
      ["loginWall", false],
    ]) {
      expect(
        compareXhsSavedProfileAccess(baseline, {
          ...baseline,
          [field]: value,
        }),
      ).toEqual({
        equivalent: false,
        changedAccessFields: [field],
        bodyChanged: false,
      });
    }
    expect(() =>
      compareXhsSavedProfileAccess(baseline, {
        ...baseline,
        targetQueryKeys: ["token"],
      }),
    ).toThrow("invalid");
    expect(() =>
      compareXhsSavedProfileAccess(baseline, {
        ...baseline,
        bodySha256: "not-a-digest",
      }),
    ).toThrow("invalid summary");
  });
});
