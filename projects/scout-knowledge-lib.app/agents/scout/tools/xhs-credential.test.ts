import { describe, expect, it } from "bun:test";
import { parseXhsCredentialOutput } from "./xhs-credential";

describe("XHS credential status", () => {
  it("accepts a source-readable browser session", () => {
    expect(
      parseXhsCredentialOutput(
        JSON.stringify({
          status: "success",
          data: {
            ready: true,
            url: "https://www.xiaohongshu.com/explore",
            noteCount: 12,
            loginWall: false,
          },
        }),
      ),
    ).toMatchObject({ credential: "xhs", state: "ready" });
  });

  it("keeps unavailable or malformed sessions out of the ready path", () => {
    expect(
      parseXhsCredentialOutput(
        JSON.stringify({
          status: "success",
          data: {
            ready: false,
            url: "https://www.xiaohongshu.com/explore",
            noteCount: 0,
            loginWall: true,
            reason: "login required",
          },
        }),
      ),
    ).toMatchObject({ credential: "xhs", state: "unavailable" });
    expect(parseXhsCredentialOutput("not-json", "", 1).state).toBe(
      "unavailable",
    );
  });
});
