import { describe, expect, it } from "bun:test";

import { appInboxQueryFromUrl } from "./server.js";

describe("HTTP App inbox query", () => {
  it("omits an absent status instead of passing URLSearchParams null to storage", () => {
    expect(appInboxQueryFromUrl(new URL("http://localhost/api/app-inbox"))).toEqual({
      appId: undefined,
      status: undefined,
      idempotencyKey: undefined,
      limit: 100,
    });
  });

  it("parses supported filters and clamps the limit", () => {
    expect(
      appInboxQueryFromUrl(
        new URL("http://localhost/api/app-inbox?appId=evaluation-canary&status=done&idempotencyKey=canary-1&limit=999"),
      ),
    ).toEqual({
      appId: "evaluation-canary",
      status: "done",
      idempotencyKey: "canary-1",
      limit: 500,
    });
  });

  it("rejects an unsupported status", () => {
    expect(() => appInboxQueryFromUrl(new URL("http://localhost/api/app-inbox?status=unknown"))).toThrow(
      "Invalid App inbox status: unknown",
    );
  });
});
