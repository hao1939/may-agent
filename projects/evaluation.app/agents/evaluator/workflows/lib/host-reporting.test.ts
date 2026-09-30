import { expect, test } from "bun:test";
import { hostReportUrl } from "./host-reporting.js";
import { readPublicAttempts } from "./task-population-evidence.js";
import { readPublicSession } from "./task-process-evidence.js";

test("session, transcript and attempt evidence use the configured Host without fallback", async () => {
  const previous = process.env.MAY_REPORT_BASE_URL;
  const requests: string[] = [];
  let unavailable = false;
  let slow = false;
  const host = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      requests.push(url.pathname + url.search);
      if (slow) await new Promise((resolve) => setTimeout(resolve, 100));
      return unavailable
        ? new Response("unavailable", { status: 503 })
        : Response.json({ installation: "isolated", path: url.pathname });
    },
  });
  try {
    delete process.env.MAY_REPORT_BASE_URL;
    expect(hostReportUrl("/api/task-attempts").origin).toBe(
      "http://localhost:8080",
    );
    process.env.MAY_REPORT_BASE_URL = host.url.origin;
    expect(await readPublicSession("s_trial", false)).toEqual({
      installation: "isolated",
      path: "/api/sessions/s_trial",
    });
    expect(await readPublicSession("s_trial", true)).toEqual({
      installation: "isolated",
      path: "/api/sessions/s_trial/transcript",
    });
    expect(await readPublicSession("s_trial", 14)).toEqual({
      installation: "isolated",
      path: "/api/sessions/s_trial/raw-log",
    });
    await expect(readPublicSession("s_trial", -1)).rejects.toThrow("raw line");
    expect(
      await readPublicAttempts({ appId: "sample", taskId: "review/one" }),
    ).toEqual({
      installation: "isolated",
      path: "/api/task-attempts",
    });
    expect(requests).toEqual([
      "/api/sessions/s_trial",
      "/api/sessions/s_trial/transcript",
      "/api/sessions/s_trial/raw-log?line=14",
      "/api/task-attempts?appId=sample&taskId=review%2Fone",
    ]);
    unavailable = true;
    await expect(readPublicSession("s_trial", false)).rejects.toThrow("503");
    await expect(readPublicAttempts({ appId: "sample" })).rejects.toThrow(
      "503",
    );
    expect(requests).toHaveLength(6);
    unavailable = false;
    slow = true;
    await expect(readPublicSession("s_trial", 14, 10)).rejects.toThrow();
  } finally {
    if (previous === undefined) delete process.env.MAY_REPORT_BASE_URL;
    else process.env.MAY_REPORT_BASE_URL = previous;
    host.stop(true);
  }
});
