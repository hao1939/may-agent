import { describe, expect, it } from "bun:test";
import { inspectXhsCredential, prepareXhsSession } from "./xhs-credential";
import { searchXhs } from "./xhs-source";
import { xhsCommandFixture } from "./xhs-command.test-fixture";

const operations = [
  { command: "status", run: inspectXhsCredential },
  { command: "prepare", run: prepareXhsSession },
  {
    command: "search",
    run: (root: string, signal?: AbortSignal) =>
      searchXhs(root, "AI agent 智能体", signal),
  },
];

describe("bounded XHS command execution", () => {
  it.each(operations)(
    "cancels $command and confirms child exit before rejecting",
    async ({ command, run }) => {
      const fixture = xhsCommandFixture(command);
      const controller = new AbortController();
      const pending = run(fixture.root, controller.signal);
      const outcome = pending.catch((error: unknown) => error);
      try {
        const pid = await fixture.started;
        const reason = new Error("caller cancelled XHS");
        controller.abort(reason);
        expect(await outcome).toBe(reason);
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        fixture.close();
        await outcome;
      }
    },
  );

  it.each(operations)(
    "does not start $command for an already cancelled caller",
    async ({ run }) => {
      const fixture = xhsCommandFixture();
      const reason = new Error("already cancelled");
      try {
        await expect(run(fixture.root, AbortSignal.abort(reason))).rejects.toBe(
          reason,
        );
        expect(fixture.calls).toEqual([]);
      } finally {
        fixture.close();
      }
    },
  );

  it.each([false, true])(
    "rejects output overflow as a technical failure (stderr=%s)",
    async (stderr) => {
      const fixture = xhsCommandFixture("prepare", 0, stderr);
      const pending = prepareXhsSession(fixture.root);
      try {
        const pid = await fixture.started;
        // Start with valid ready/login JSON: truncated output must never be accepted.
        fixture.release(
          JSON.stringify({
            status: "success",
            data: { ready: true, loginWall: true },
          }) + " ".repeat(1024 * 1024),
        );
        const status = await pending;
        expect(status.state).toBe("unavailable");
        expect(status.reason).toContain("could not run");
        expect(status).not.toHaveProperty("loginWall");
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        fixture.close();
        await pending;
      }
    },
  );

  it("keeps search asynchronous and passes its exact query without a shell", async () => {
    const fixture = xhsCommandFixture("search");
    const query = "AI agent 智能体; $(not-a-command)";
    let settled = false;
    const pending = searchXhs(fixture.root, query).finally(() => {
      settled = true;
    });
    try {
      await fixture.started;
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).toBe(false);
      expect(fixture.calls).toEqual([["search", query]]);
      fixture.release(
        JSON.stringify({
          status: "success",
          data: [
            {
              id: "note-1",
              title: "Fixture",
              link: "https://example.invalid/fixture",
            },
          ],
        }),
      );
      expect(await pending).toMatchObject({
        state: "success",
        query,
        items: [{ id: "note-1" }],
      });
    } finally {
      fixture.close();
      await pending;
    }
  });

  it("preserves structured search failure from stderr and a nonzero exit", async () => {
    const fixture = xhsCommandFixture("search", 2, true);
    const pending = searchXhs(fixture.root, "query");
    try {
      await fixture.started;
      fixture.release(
        JSON.stringify({ status: "error", error: "fixture source failure" }),
      );
      expect(await pending).toEqual({
        state: "failed",
        query: "query",
        reason: "fixture source failure",
        evidence: ["exit:2"],
      });
    } finally {
      fixture.close();
      await pending;
    }
  });

  it("stops a stuck search at its existing 60-second command deadline", async () => {
    const fixture = xhsCommandFixture("search");
    const pending = searchXhs(fixture.root, "query", undefined, 500);
    try {
      const pid = await fixture.started;
      expect(await pending).toMatchObject({
        state: "failed",
        reason: expect.stringContaining("could not run"),
      });
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      fixture.close();
      await pending;
    }
  }, 70_000);
});
