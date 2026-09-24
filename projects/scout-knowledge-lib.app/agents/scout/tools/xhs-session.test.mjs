import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parseXhsCredentialOutput } from "./lib/xhs-credential.ts";
import { xhsWaitResult } from "../workflows/scout-explore.ts";

const run = promisify(execFile);
const tool = fileURLToPath(new URL("./xhs-browse.mjs", import.meta.url));

// Exercise the actual Node CLI, CDP requests, DOM summary and wait admission.
// The browser protocol is local and synthetic; this does not exercise live XHS.
function browser(loginWall = false) {
  const tabs = [];
  const requests = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      requests.push({ method: request.method, path: url.pathname });
      if (url.pathname === "/devtools/page/xhs" && server.upgrade(request))
        return;
      if (url.pathname === "/json/list") return Response.json(tabs);
      if (url.pathname === "/json/new" && request.method === "PUT") {
        expect(decodeURIComponent(url.search.slice(1))).toBe(
          "https://www.xiaohongshu.com/explore",
        );
        const tab = {
          type: "page",
          url: "https://www.xiaohongshu.com/explore",
          webSocketDebuggerUrl: `ws://127.0.0.1:${server.port}/devtools/page/xhs`,
        };
        tabs.push(tab);
        return Response.json(tab);
      }
      return new Response("unexpected request", { status: 404 });
    },
    websocket: {
      message(ws, message) {
        const call = JSON.parse(String(message));
        let result = {};
        if (call.method === "Runtime.evaluate") {
          const document = {
            body: { innerText: loginWall ? "请先登录" : "Current source" },
            querySelectorAll: () =>
              loginWall
                ? []
                : [
                    {
                      href: "https://www.xiaohongshu.com/explore/123456789012345678901234",
                    },
                  ],
          };
          const value = new Function(
            "document",
            "window",
            `return (${call.params.expression})`,
          )(document, { location: { href: tabs[0].url } });
          result = { result: { value } };
        }
        ws.send(JSON.stringify({ id: call.id, result }));
      },
    },
  });
  return {
    requests,
    async command(command) {
      const env = {
        ...process.env,
        SCOUT_XHS_CDP_HOST: "127.0.0.1",
        SCOUT_XHS_CDP_PORT: String(server.port),
      };
      try {
        const { stdout, stderr } = await run("node", [tool, command], {
          env,
          timeout: 15000,
        });
        return parseXhsCredentialOutput(stdout, stderr);
      } catch (error) {
        if (typeof error.code !== "number") throw error;
        return parseXhsCredentialOutput(error.stdout, error.stderr, error.code);
      }
    },
    close() {
      server.stop(true);
    },
  };
}

describe("XHS browser preparation", () => {
  it("keeps observation read-only and restores an absent tab exactly once for action", async () => {
    const b = browser();
    try {
      const before = await b.command("status");
      expect(before.state).toBe("unavailable");
      expect(before.loginWall).toBeUndefined();
      expect(b.requests).toEqual([{ method: "GET", path: "/json/list" }]);
      const prepared = await b.command("prepare");
      expect(prepared.state).toBe("ready");
      expect(xhsWaitResult("xhs", prepared)).toBeNull();
      expect((await b.command("prepare")).state).toBe("ready");
      expect((await b.command("status")).state).toBe("ready");
      expect(
        b.requests.filter((request) => request.method === "PUT"),
      ).toHaveLength(1);
    } finally {
      b.close();
    }
  }, 15000);

  it("retains human help when the opened page really presents a login wall", async () => {
    const b = browser(true);
    try {
      const prepared = await b.command("prepare");
      expect(prepared).toMatchObject({ state: "unavailable", loginWall: true });
      expect(xhsWaitResult("xhs", prepared)).toMatchObject({
        state: "waiting",
        conditions: [{ owner: "human:operator" }],
      });
    } finally {
      b.close();
    }
  }, 15000);
});
