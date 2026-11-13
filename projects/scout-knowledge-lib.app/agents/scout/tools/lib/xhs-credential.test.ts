import { describe, expect, it } from "bun:test";
import { xhsCommandFixture } from "./xhs-command.test-fixture";
import {
  inspectXhsCredential,
  parseXhsCredentialOutput,
} from "./xhs-credential";

describe("XHS credential status", () => {
  it("leaves the event loop responsive while a real child waits for output", async () => {
    const fixture = xhsCommandFixture();
    let settled = false;
    const pending = inspectXhsCredential(fixture.root).finally(() => {
      settled = true;
    });
    try {
      await fixture.started;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).toBe(false);
      fixture.release(
        JSON.stringify({ status: "success", data: { ready: true } }),
      );
      expect(await pending).toMatchObject({
        credential: "xhs",
        state: "ready",
      });
    } finally {
      fixture.close();
      await pending;
    }
  });

  it("preserves a provider failure from stderr and a nonzero exit", async () => {
    const fixture = xhsCommandFixture("status", 2, true);
    const pending = inspectXhsCredential(fixture.root);
    try {
      await fixture.started;
      fixture.release(
        JSON.stringify({ status: "error", error: "fixture login unavailable" }),
      );
      expect(await pending).toMatchObject({
        state: "unavailable",
        reason: "fixture login unavailable",
        evidence: ["exit:2"],
      });
    } finally {
      fixture.close();
      await pending;
    }
  });

  it("retains a malformed provider value as unknown access, not login", async () => {
    const fixture = xhsCommandFixture();
    const pending = inspectXhsCredential(fixture.root);
    const outcome = pending.catch((error: unknown) => error);
    try {
      await fixture.started;
      fixture.release("null");
      expect(await outcome).toMatchObject({ state: "unavailable" });
      expect(await outcome).not.toHaveProperty("loginWall");
    } finally {
      fixture.close();
      await pending.catch(() => {});
    }
  });

  it("kills a stuck probe at the existing 30-second deadline", async () => {
    const fixture = xhsCommandFixture();
    const pending = inspectXhsCredential(fixture.root);
    try {
      const pid = await fixture.started;
      const status = await pending;
      expect(status.state).toBe("unavailable");
      expect(status.reason).toContain("could not run");
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      fixture.close();
      await pending;
    }
  }, 40_000);

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
    ).toMatchObject({
      credential: "xhs",
      state: "unavailable",
      loginWall: true,
    });
    expect(parseXhsCredentialOutput("not-json", "", 1).state).toBe(
      "unavailable",
    );
  });
});
