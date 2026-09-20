import { describe, expect, test } from "bun:test";
import type { Condition, ObserverContext, TaskDetail } from "@may-agent/sdk";
import {
  GITHUB_PULL_REQUEST_EVENT,
  githubPullRequestObserver,
  observeGitHubPullRequests,
  parsePullRequestSubject,
  readGitHubPullRequest,
  validateGitHubPullRequestCondition,
} from "./github-pull-request";

const subject = "pull-request:github:hao1939/may-agent#215";
const conditionFor = (
  number: number,
  baseline: string | null = null,
  suffix = String(number),
): Condition => ({
  id: `github-pr-${suffix}`,
  type: GITHUB_PULL_REQUEST_EVENT,
  subject: `pull-request:github:hao1939/may-agent#${number}`,
  expected: {
    provider: "github",
    repository: "hao1939/may-agent",
    field: "fingerprint",
    notEquals: baseline,
  },
  owner: "app:may",
  reviewAfterMs: 21_600_000,
});
const condition = (baseline: string | null = null): Condition =>
  conditionFor(215, baseline);

function task(id: string, conditions: Condition[]): TaskDetail {
  return {
    id,
    status: "waiting",
    generation: 1,
    outcome: "Deliver the change",
    parentId: "may",
    acceptance: ["Observe the linked PR"],
    input: {},
    conditions,
    acceptedEvidence: { available: false, maxPageSize: 8 },
  };
}

function response(
  value: unknown,
  link?: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      ...(link ? { link } : {}),
      ...headers,
    },
  });
}

function pullPayload(number: number, merged = false): Record<string, unknown> {
  return {
    number,
    state: merged ? "closed" : "open",
    draft: false,
    merged,
    merged_at: merged ? "2026-09-20T06:30:19Z" : null,
    merge_commit_sha: merged ? `merge-${number}` : null,
    head: { sha: `head-${number}` },
    base: { repo: { full_name: "hao1939/may-agent" } },
  };
}

function providerByUrl(calls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/reviews")) return response([]);
    const number = Number(url.match(/\/pulls\/(\d+)$/)?.[1]);
    return response(pullPayload(number));
  }) as typeof fetch;
}

function provider(
  state: { merged: boolean; head: string; reviewState?: string },
  calls: string[] = [],
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/reviews")) {
      return response([
        {
          id: 9,
          state: state.reviewState ?? "APPROVED",
          commit_id: state.head,
          submitted_at: "2026-09-20T06:00:00Z",
          user: { login: "reviewer" },
        },
      ]);
    }
    return response({
      number: 215,
      state: state.merged ? "closed" : "open",
      draft: false,
      merged: state.merged,
      merged_at: state.merged ? "2026-09-20T06:30:19Z" : null,
      merge_commit_sha: state.merged ? "merge-sha" : null,
      head: { sha: state.head },
      base: { repo: { full_name: "hao1939/may-agent" } },
    });
  }) as typeof fetch;
}

function context(
  tasks: Map<string, TaskDetail>,
  previousObservation?: ObserverContext["previousObservation"],
): ObserverContext & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    previousObservation,
    warnings,
    workspace: { appRoot: "/unused", projectRoot: "/unused" },
    log: {
      debug() {},
      info() {},
      warn(message) {
        warnings.push(message);
      },
      error() {},
    },
    read: {
      appResult: async () => null,
      execution: async () => null,
      metric: async () => null,
      tasks: {
        outcomes: async () => {
          throw new Error("not used");
        },
        list: async () => ({
          items: [...tasks.values()].map(({ conditions: _, ...view }) => view),
        }),
        get: async (id) => tasks.get(id) ?? null,
      },
    },
  };
}

describe("May GitHub pull-request observer", () => {
  test("accepts only exact structured PR Conditions", () => {
    expect(parsePullRequestSubject(subject)).toEqual({
      repository: "hao1939/may-agent",
      number: 215,
      pullRequestId: "github:hao1939/may-agent#215",
    });
    expect(validateGitHubPullRequestCondition(condition())).toBeNull();
    expect(
      validateGitHubPullRequestCondition({
        ...condition(),
        subject: "pull-request:https://github.com/hao1939/may-agent/pull/215",
      }),
    ).toContain("pull-request:github:");
    expect(
      validateGitHubPullRequestCondition({
        ...condition(),
        expected: { field: "merged", equals: true },
      }),
    ).toContain("fingerprint notEquals");
    expect(
      validateGitHubPullRequestCondition(condition("not-a-hash")),
    ).toContain("exact observed SHA-256");
    expect(
      validateGitHubPullRequestCondition({
        ...condition(),
        type: "conversation.message.created",
      }),
    ).toBeNull();
  });

  test("normalizes provider state, reviewed head, and complete pagination", async () => {
    const calls: string[] = [];
    let reviewPage = 0;
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (!url.includes("/reviews"))
        return provider({ merged: false, head: "head-a" })(input);
      reviewPage++;
      return reviewPage === 1
        ? response(
            [
              {
                id: 2,
                state: "CHANGES_REQUESTED",
                commit_id: "old-head",
                user: { login: "a" },
              },
            ],
            '<https://api.github.com/repos/hao1939/may-agent/pulls/215/reviews?per_page=100&page=2>; rel="next"',
          )
        : response([
            {
              id: 3,
              state: "APPROVED",
              commit_id: "head-a",
              user: { login: "b" },
            },
          ]);
    }) as typeof fetch;
    const fact = await readGitHubPullRequest(
      "hao1939/may-agent",
      215,
      fetcher,
      () => new Date("2026-09-20T07:00:00Z"),
    );
    expect(fact).toMatchObject({
      provider: "github",
      repository: "hao1939/may-agent",
      pullRequestId: "github:hao1939/may-agent#215",
      headSha: "head-a",
      merged: false,
      reviewsComplete: true,
      reviews: [
        { state: "changes_requested", commitId: "old-head" },
        { state: "approved", commitId: "head-a" },
      ],
    });
    expect(calls).toHaveLength(3);
  });

  test("rejects unknown state and malformed required provider fields", async () => {
    const invalid = [
      { ...pullPayload(215), state: "unexpected" },
      { ...pullPayload(215), state: undefined },
      { ...pullPayload(215), draft: "false" },
      { ...pullPayload(215), merged: "false" },
      { ...pullPayload(215), merged_at: undefined },
      { ...pullPayload(215), merge_commit_sha: undefined },
      { ...pullPayload(215), head: {} },
    ];
    for (const payload of invalid) {
      await expect(
        readGitHubPullRequest("hao1939/may-agent", 215, (async () =>
          response(payload)) as typeof fetch),
      ).rejects.toThrow();
    }
  });

  test("retains independently well-typed provider fields even when their combination is unusual", async () => {
    const payload = {
      ...pullPayload(215),
      state: "open",
      merged: true,
      merged_at: null,
      merge_commit_sha: "merge-215",
    };
    const fact = await readGitHubPullRequest("hao1939/may-agent", 215, (async (
      input: string | URL | Request,
    ) =>
      String(input).includes("/reviews")
        ? response([])
        : response(payload)) as typeof fetch);
    expect(fact).toMatchObject({
      state: "open",
      merged: true,
      mergedAt: null,
      mergeCommitSha: "merge-215",
    });
  });

  test("refuses off-origin, wrong-path, unsafe-query pagination and redirects while retaining PR facts", async () => {
    const links = [
      "http://metadata.invalid/private",
      "https://api.github.com/repos/other/repo/pulls/215/reviews?per_page=100&page=2",
      "https://api.github.com/repos/hao1939/may-agent/pulls/215/reviews?per_page=100&page=2&access_token=secret",
      "/repos/hao1939/may-agent/pulls/215/reviews?per_page=100&page=2",
    ];
    for (const link of links) {
      const calls: string[] = [];
      const fact = await readGitHubPullRequest(
        "hao1939/may-agent",
        215,
        (async (input: string | URL | Request) => {
          const url = String(input);
          calls.push(url);
          if (url.includes("/reviews")) {
            return response(
              [
                {
                  id: 1,
                  state: "APPROVED",
                  commit_id: "head-215",
                  user: { login: "reviewer" },
                },
              ],
              `<${link}>; rel="next"`,
            );
          }
          return response(pullPayload(215, true));
        }) as typeof fetch,
      );
      expect(calls).toHaveLength(2);
      expect(fact).toMatchObject({
        state: "closed",
        merged: true,
        headSha: "head-215",
        reviewsComplete: false,
        reviews: [{ id: 1, state: "approved" }],
        reviewError: expect.stringContaining("GitHub"),
      });
    }

    const redirects: RequestRedirect[] = [];
    const redirected = await readGitHubPullRequest(
      "hao1939/may-agent",
      215,
      (async (input: string | URL | Request, init?: RequestInit) => {
        redirects.push(init?.redirect ?? "follow");
        if (!String(input).includes("/reviews"))
          return response(pullPayload(215));
        return new Response(null, {
          status: 302,
          headers: { location: "http://metadata.invalid/private" },
        });
      }) as typeof fetch,
    );
    expect(redirects).toEqual(["manual", "manual"]);
    expect(redirected).toMatchObject({
      state: "open",
      headSha: "head-215",
      reviewsComplete: false,
      reviewError: expect.stringContaining("redirect"),
    });
  });

  test("publishes initial and changed facts without a human reply, but suppresses unchanged facts", async () => {
    const tasks = new Map([["goal/one", task("goal/one", [condition()])]]);
    const first = await observeGitHubPullRequests(
      context(tasks),
      provider({ merged: false, head: "head-a" }),
    );
    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      type: GITHUB_PULL_REQUEST_EVENT,
      target: { taskId: "goal/one" },
      data: { merged: false, headSha: "head-a" },
    });
    const unchanged = await observeGitHubPullRequests(
      context(tasks, first.nextObservation),
      provider({ merged: false, head: "head-a" }),
    );
    expect(unchanged.events).toEqual([]);
    const merged = await observeGitHubPullRequests(
      context(tasks, first.nextObservation),
      provider({ merged: true, head: "head-a" }),
    );
    expect(merged.events).toMatchObject([
      { data: { merged: true, mergeCommitSha: "merge-sha" } },
    ]);
  });

  test("isolates repo/head identity, reloads from Conditions, and honors a durable baseline", async () => {
    const initialTasks = new Map([
      ["goal/one", task("goal/one", [condition()])],
    ]);
    const first = await observeGitHubPullRequests(
      context(initialTasks),
      provider({ merged: true, head: "head-b" }),
    );
    const fingerprint = (first.events[0].data as any).fingerprint as string;
    const rearmedTasks = new Map([
      ["goal/one", task("goal/one", [condition(fingerprint)])],
    ]);
    const afterReload = await observeGitHubPullRequests(
      context(rearmedTasks),
      provider({ merged: true, head: "head-b" }),
    );
    expect(afterReload.events).toEqual([]);
    expect(
      readGitHubPullRequest(
        "other/repository",
        215,
        provider({ merged: true, head: "head-b" }),
      ),
    ).rejects.toThrow("identity does not match");
    const newHead = await observeGitHubPullRequests(
      context(rearmedTasks),
      provider({ merged: true, head: "head-c" }),
    );
    expect(newHead.events).toMatchObject([{ data: { headSha: "head-c" } }]);
  });

  test("keeps a valid merged/head fact when the independent review read fails", async () => {
    const tasks = new Map([["goal/one", task("goal/one", [condition()])]]);
    const fetcher = (async (input: string | URL | Request) => {
      if (!String(input).includes("/reviews"))
        return provider({ merged: true, head: "head-b" })(input);
      return response({ message: "review rate limited" }, undefined, 429);
    }) as typeof fetch;
    const ctx = context(tasks);
    const observed = await observeGitHubPullRequests(ctx, fetcher);
    expect(observed.events).toMatchObject([
      {
        type: "may.github.pull-request.read-failed",
        data: { scope: "reviews" },
      },
      {
        type: GITHUB_PULL_REQUEST_EVENT,
        data: {
          merged: true,
          headSha: "head-b",
          reviews: [],
          reviewsComplete: false,
          reviewError: expect.stringContaining("HTTP 429"),
        },
      },
    ]);
    const replay = await observeGitHubPullRequests(
      context(tasks, observed.nextObservation),
      fetcher,
    );
    expect(replay.events).toEqual([]);
    expect(ctx.warnings[0]).toContain("review observation failed");
  });

  test("drops a provider result when its exact Condition was replaced during the read", async () => {
    const original = task("goal/one", [condition()]);
    const tasks = new Map([["goal/one", original]]);
    const fetcher = (async (input: string | URL | Request) => {
      const result = await provider({ merged: true, head: "head-b" })(input);
      tasks.set("goal/one", task("goal/one", [condition("b".repeat(64))]));
      return result;
    }) as typeof fetch;
    const observed = await observeGitHubPullRequests(context(tasks), fetcher);
    expect(observed.events).toEqual([]);
  });

  test("drops a provider failure when its exact Condition was withdrawn during the read", async () => {
    const tasks = new Map([["goal/one", task("goal/one", [condition()])]]);
    const observed = await observeGitHubPullRequests(
      context(tasks),
      (async () => {
        tasks.set("goal/one", task("goal/one", []));
        return response({ message: "unavailable" }, undefined, 503);
      }) as typeof fetch,
    );
    expect(observed.events).toEqual([]);
  });

  test("reports bounded provider failure without erasing the wait or prior success memory", async () => {
    const tasks = new Map([
      ["goal/one", task("goal/one", [condition()])],
      [
        "goal/unrelated",
        task("goal/unrelated", [
          {
            id: "human",
            type: "conversation.message.created",
            subject: "conversation:may:primary",
            expected: { field: "text", equals: "independent answer" },
            owner: "human",
            reviewAfterMs: 60_000,
          },
        ]),
      ],
    ]);
    const prior = { cursor: 0, states: {} };
    const ctx = context(tasks, prior);
    const failed = await observeGitHubPullRequests(ctx, (async () =>
      response({ message: "rate limited" }, undefined, 429)) as typeof fetch);
    expect(failed.events).toMatchObject([
      {
        type: "may.github.pull-request.read-failed",
        target: { taskId: "goal/one" },
        data: { pullRequestId: "github:hao1939/may-agent#215" },
      },
    ]);
    expect(tasks.get("goal/unrelated")?.conditions).toHaveLength(1);
    expect(ctx.warnings[0]).toContain("HTTP 429");
    expect(Object.keys((failed.nextObservation as any).states)).toHaveLength(1);
    const unchangedFailure = await observeGitHubPullRequests(
      context(tasks, failed.nextObservation),
      (async () =>
        response({ message: "rate limited" }, undefined, 429)) as typeof fetch,
    );
    expect(unchangedFailure.events).toEqual([]);
  });

  test("caps actual HTTP calls, advances a fair round-robin cursor, and uses a conservative cadence", async () => {
    const tasks = new Map(
      Array.from({ length: 20 }, (_, index) => {
        const number = index + 1;
        const id = `goal/${String(number).padStart(2, "0")}`;
        return [id, task(id, [conditionFor(number)])] as const;
      }),
    );
    const firstCalls: string[] = [];
    const first = await observeGitHubPullRequests(
      context(tasks),
      providerByUrl(firstCalls),
    );
    const firstPulls = firstCalls.filter((url) => !url.includes("/reviews"));
    expect(firstCalls.length).toBeLessThanOrEqual(11);
    expect(firstPulls).toHaveLength(5);

    const secondCalls: string[] = [];
    await observeGitHubPullRequests(
      context(tasks, first.nextObservation),
      providerByUrl(secondCalls),
    );
    const secondPulls = secondCalls.filter((url) => !url.includes("/reviews"));
    expect(secondCalls.length).toBeLessThanOrEqual(11);
    expect(secondPulls).toHaveLength(5);
    expect(new Set([...firstPulls, ...secondPulls]).size).toBe(10);
    expect(githubPullRequestObserver.intervalMs).toBe(15 * 60_000);
  });

  test("honors provider rate-limit deferral before making another HTTP call", async () => {
    const tasks = new Map([["goal/one", task("goal/one", [condition()])]]);
    const firstNow = new Date("2026-09-20T07:00:00Z");
    const resetSeconds = Math.floor(
      new Date("2026-09-20T07:20:00Z").getTime() / 1_000,
    );
    let firstCalls = 0;
    const first = await observeGitHubPullRequests(
      context(tasks),
      (async () => {
        firstCalls++;
        return response({ message: "rate limited" }, undefined, 429, {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetSeconds),
        });
      }) as typeof fetch,
      () => firstNow,
    );
    expect(firstCalls).toBe(1);
    expect(first.events).toMatchObject([
      { type: "may.github.pull-request.read-failed" },
    ]);

    let deferredCalls = 0;
    const deferred = await observeGitHubPullRequests(
      context(tasks, first.nextObservation),
      (async () => {
        deferredCalls++;
        return response(pullPayload(215));
      }) as typeof fetch,
      () => new Date("2026-09-20T07:10:00Z"),
    );
    expect(deferredCalls).toBe(0);
    expect(deferred.events).toEqual([]);

    const resumedCalls: string[] = [];
    const resumed = await observeGitHubPullRequests(
      context(tasks, deferred.nextObservation),
      providerByUrl(resumedCalls),
      () => new Date("2026-09-20T07:21:00Z"),
    );
    expect(resumedCalls).toHaveLength(2);
    expect(resumed.events).toMatchObject([
      { type: GITHUB_PULL_REQUEST_EVENT, data: { state: "open" } },
    ]);
  });

  test("keeps disposable suppression below 64 KiB for 500 current interests", async () => {
    const tasks = new Map(
      Array.from({ length: 500 }, (_, index) => {
        const id = `goal/${String(index).padStart(3, "0")}`;
        return [
          id,
          task(id, [conditionFor(215, null, String(index))]),
        ] as const;
      }),
    );
    let previous: ObserverContext["previousObservation"];
    let published = 0;
    const publishedTasks = new Set<string>();
    for (let pass = 0; pass < 42; pass++) {
      const result = await observeGitHubPullRequests(
        context(tasks, previous),
        providerByUrl(),
      );
      published += result.events.length;
      for (const event of result.events) {
        if (event.target?.taskId) publishedTasks.add(event.target.taskId);
      }
      previous = result.nextObservation;
    }
    expect(publishedTasks).toHaveLength(500);
    expect(published).toBeLessThanOrEqual(512);
    expect(Buffer.byteLength(JSON.stringify(previous), "utf8")).toBeLessThan(
      64 * 1024,
    );
    expect(Object.keys((previous as any).states)).toHaveLength(128);
  });
});
