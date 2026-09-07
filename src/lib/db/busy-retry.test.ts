import { describe, expect, it } from "bun:test";
import { withSqliteBusyRetry } from "./busy-retry.js";

describe("withSqliteBusyRetry", () => {
  it("retries transient SQLite busy errors and returns the eventual result", () => {
    let attempts = 0;
    const result = withSqliteBusyRetry("workflow-finalize", () => {
      attempts += 1;
      if (attempts < 3) throw new Error("database is locked");
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("outlasts a short competing writer instead of restarting the Host", () => {
    let attempts = 0;
    const result = withSqliteBusyRetry("persist event", () => {
      attempts += 1;
      if (attempts < 6) throw new Error("SQLITE_BUSY");
      return "recorded";
    });

    expect(result).toBe("recorded");
    expect(attempts).toBe(6);
  });

  it("does not retry non-busy errors", () => {
    let attempts = 0;
    expect(() =>
      withSqliteBusyRetry("workflow-finalize", () => {
        attempts += 1;
        throw new Error("unexpected failure");
      }),
    ).toThrow("unexpected failure");
    expect(attempts).toBe(1);
  });
});
