import { describe, expect, it } from "bun:test";
import { withSqliteBusyRetry, withSqliteInitializationRetry } from "./busy-retry.js";

describe("withSqliteBusyRetry", () => {
  it("leaves serving-path retry with the operation owner", () => {
    let attempts = 0;
    const busy = new Error("database is locked");
    expect(() => withSqliteBusyRetry("persist event", () => {
      attempts += 1;
      throw busy;
    })).toThrow(busy);
    expect(attempts).toBe(1);
  });

  it("keeps repeatable initialization retry separate from serving operations", () => {
    let attempts = 0;
    const result = withSqliteInitializationRetry("apply database schema", () => {
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
