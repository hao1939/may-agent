import { expect, test } from "bun:test";
import { hostReportUrl, readHostReport } from "./host-reporting.js";
import { readPublicAttempts } from "./task-population-evidence.js";
import { readPublicSession } from "./task-process-evidence.js";
import { readMetricObservation } from "./metric-evidence.js";
import { selectMetricCandidate } from "./metric-selection.js";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";

const fixtureUrl = new URL("http://fixture.invalid/api/report");

test("the byte bound includes multibyte text split across chunks and accepts the exact limit", async () => {
  const expected = { text: "你好🌟" };
  const bytes = Buffer.from(JSON.stringify(expected));
  const request = async () =>
    new Response(
      new ReadableStream({
        start(stream) {
          for (const byte of bytes) stream.enqueue(Uint8Array.of(byte));
          stream.close();
        },
      }),
    );
  expect(
    await readHostReport(
      fixtureUrl,
      {
        timeoutMs: 1_000,
        maxBytes: bytes.length,
      },
      request,
    ),
  ).toEqual(expected);
  await expect(
    readHostReport(
      fixtureUrl,
      {
        timeoutMs: 1_000,
        maxBytes: bytes.length - 1,
      },
      request,
    ),
  ).rejects.toThrow("byte limit");
});

test("oversize cleanup cancels and releases the body without hiding the original error", async () => {
  let cancelled = false;
  const response = new Response(
    new ReadableStream({
      start(stream) {
        stream.enqueue(new Uint8Array(11));
      },
      cancel() {
        cancelled = true;
        throw new Error("cleanup failed");
      },
    }),
  );
  await expect(
    readHostReport(
      fixtureUrl,
      { timeoutMs: 1_000, maxBytes: 10 },
      async () => response,
    ),
  ).rejects.toThrow("byte limit");
  expect(cancelled).toBe(true);
  expect(response.body!.locked).toBe(false);
});

test("pre-cancelled reads make no request; bad status, missing body and malformed JSON fail", async () => {
  let requests = 0;
  const controller = new AbortController();
  controller.abort(new Error("Review stopped"));
  await expect(
    readHostReport(
      fixtureUrl,
      {
        timeoutMs: 1_000,
        maxBytes: 100,
        signal: controller.signal,
      },
      async () => {
        requests++;
        return Response.json({});
      },
    ),
  ).rejects.toThrow("Review stopped");
  expect(requests).toBe(0);
  for (const [response, error] of [
    [new Response("unavailable", { status: 503 }), "503"],
    [new Response(null, { status: 204 }), "unavailable"],
    [new Response("not JSON"), "JSON"],
  ] as const) {
    await expect(
      readHostReport(
        fixtureUrl,
        { timeoutMs: 1_000, maxBytes: 100 },
        async () => response,
      ),
    ).rejects.toThrow(error);
    expect(response.body?.locked ?? false).toBe(false);
  }
});

test.each(["caller", "deadline"])(
  "%s cancellation stops an unfinished HTTP body",
  async (kind) => {
    const controller = new AbortController();
    let received!: () => void;
    const headers = new Promise<void>((resolve) => {
      received = resolve;
    });
    const host = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(Buffer.alloc(65_536, " "));
            },
          }),
        ),
    });
    let body: ReadableStream<Uint8Array> | null = null;
    try {
      const reading = readHostReport(
        new URL("/api/report", host.url),
        {
          timeoutMs: kind === "deadline" ? 250 : 5_000,
          maxBytes: 128_000,
          signal: controller.signal,
        },
        async (input, options) => {
          const response = await fetch(input, options);
          body = response.body;
          received();
          return response;
        },
      );
      const outcome = reading.then(
        () => "unexpected success",
        (error) => String(error),
      );
      await headers;
      if (kind === "caller") controller.abort(new Error("Review stopped"));
      expect(await outcome).toContain(
        kind === "caller" ? "Review stopped" : "timed out",
      );
      expect(body!.locked).toBe(false);
    } finally {
      controller.abort();
      host.stop(true);
    }
  },
);

test("redirects are rejected rather than reading another endpoint", async () => {
  const paths: string[] = [];
  const host = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request): Response {
      paths.push(new URL(request.url).pathname);
      return Response.redirect(new URL("/other", host.url));
    },
  });
  try {
    await expect(
      readHostReport(new URL("/api/report", host.url), {
        timeoutMs: 1_000,
        maxBytes: 100,
      }),
    ).rejects.toThrow();
    expect(paths).toEqual(["/api/report"]);
  } finally {
    host.stop(true);
  }
});

test("metric observation still rejects mismatched identity after a successful HTTP read", async () => {
  for (const mismatch of [
    { metricId: "other" },
    { end: 2 },
    { metric: { id: "other" } },
  ]) {
    await expect(
      readMetricObservation("sample", 1, undefined, undefined, async () =>
        Response.json({
          version: 1,
          available: true,
          metricId: "sample",
          end: 1,
          metric: { id: "sample" },
          ...mismatch,
        }),
      ),
    ).rejects.toThrow("identity");
  }
});

test.each(["metric", "catalog", "attempts", "session"])(
  "%s rejects an oversized body before the server finishes sending it",
  async (kind) => {
    const previous = process.env.MAY_REPORT_BASE_URL;
    const controller = new AbortController();
    const host = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        new Response(
          new ReadableStream({
            start(stream) {
              stream.enqueue(
                new Uint8Array(kind === "metric" ? 128_001 : 1_000_001),
              );
              // Deliberately never finish: a bound must not wait for EOF.
            },
          }),
        ),
    });
    process.env.MAY_REPORT_BASE_URL = host.url.origin;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const read =
        kind === "metric"
          ? readMetricObservation("sample", 1, undefined, controller.signal)
          : kind === "attempts"
            ? readPublicAttempts({ appId: "sample" }, controller.signal)
            : kind === "session"
              ? readPublicSession("s_trial", false)
              : selectMetricCandidate(
                  createTestAppWorkflowContext({
                    input: {},
                    signal: controller.signal,
                  }),
                  "",
                  "evaluator",
                ).then((selection) => {
                  if (
                    selection.facts.some((fact) => fact.includes("byte limit"))
                  )
                    throw new Error("catalog byte limit");
                  return selection;
                });
      const outcome = read.then(
        () => "success",
        (error) => String(error),
      );
      const result = await Promise.race([
        outcome,
        new Promise<string>((resolve) => {
          timer = setTimeout(() => resolve("still reading after limit"), 1_000);
        }),
      ]);
      expect(result).toContain("byte limit");
    } finally {
      clearTimeout(timer);
      controller.abort();
      host.stop(true);
      if (previous === undefined) delete process.env.MAY_REPORT_BASE_URL;
      else process.env.MAY_REPORT_BASE_URL = previous;
    }
  },
);

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
