import { describe, expect, test } from "bun:test";
import type { ObserverContext, TaskDetail } from "@may-agent/sdk";
import { observationCondition } from "@may-agent/sdk";
import {
  createGitHubPullRequestObservers,
  observeGitHubPullRequests,
  parseTaskOwner,
  readGitHubPullRequest,
  validateGitHubPullRequestCondition,
} from "./github-pull-request.js";
import { githubPullRequestFixture } from "../tests/fixtures/github-pull-request.js";

const scope = {
  repository: "hao1939/may-agent",
  author: "hao1939",
  appId: "alex",
  project: "alex",
  feedback: true,
};
const now = () => new Date("2026-11-16T11:00:00Z");
const read = (
  f: ReturnType<typeof githubPullRequestFixture>,
  signal?: AbortSignal,
) => readGitHubPullRequest(f.repository, 215, f.fetch, now, signal, true);
function context(
  previousObservation?: ObserverContext["previousObservation"],
  closed = false,
): ObserverContext {
  return {
    previousObservation,
    workspace: { appRoot: "/unused", projectRoot: "/unused" },
    log: { info() {}, warn() {}, debug() {}, error() {} },
    read: {
      tasks: {
        get: async (id) =>
          ({ id, generation: 1, status: "waiting", closed }) as TaskDetail,
        list: async () => {
          throw new Error("watcher must not scan Tasks");
        },
      },
    } as ObserverContext["read"],
  };
}

describe("Task + GitHub watcher delivery evidence", () => {
  test("one bounded exact read returns head-bound CI, review bodies and both comment kinds", async () => {
    const f = githubPullRequestFixture();
    f.checks = [f.check()];
    f.statuses = [f.status()];
    f.comments = [f.comment()];
    f.reviewComments = [
      {
        ...f.comment(3, "Repair this line"),
        commit_id: f.pull.head.sha,
        original_commit_id: "b".repeat(40),
        path: "src/change.ts",
        line: 7,
      },
    ];
    f.reviews = [
      {
        id: 4,
        state: "CHANGES_REQUESTED",
        commit_id: f.pull.head.sha,
        submitted_at: f.at,
        user: { login: "reviewer" },
        body: "Needs the missing case",
      },
    ];
    const fact = await read(f);
    expect(f.calls).toHaveLength(7);
    expect(f.calls.filter((url) => url.includes("?state="))).toEqual([]);
    expect(fact.feedback).toMatchObject({
      headSha: f.pull.head.sha,
      checks: [{ id: 1, conclusion: "failure", headSha: f.pull.head.sha }],
      checksComplete: true,
      statuses: [{ id: 2, state: "pending" }],
      statusesComplete: true,
      comments: [{ id: 1, bodyPreview: "Please cover the failure case" }],
      commentsComplete: true,
      reviewComments: [
        {
          id: 3,
          bodyPreview: "Repair this line",
          line: 7,
          commitId: f.pull.head.sha,
        },
      ],
      reviewCommentsComplete: true,
      errors: {},
    });
    expect(fact.reviews).toMatchObject([
      { state: "changes_requested", bodyPreview: "Needs the missing case" },
    ]);
    expect(fact).not.toHaveProperty("ciPassed");
    expect(fact).not.toHaveProperty("approved");
  });

  test("no reported checks is an empty evidence set, not required CI passing", async () => {
    const fact = await read(githubPullRequestFixture());
    expect(fact.feedback).toMatchObject({
      checks: [],
      checksComplete: true,
      statuses: [],
      statusesComplete: true,
    });
    expect(fact).not.toHaveProperty("ciPassed");
  });

  test("CI or comment-only transitions wake the same Alex Task and unchanged scans stay quiet", async () => {
    const f = githubPullRequestFixture();
    f.checks = [f.check(1, null)];
    const observe = (previous?: ObserverContext["previousObservation"]) =>
      observeGitHubPullRequests(context(previous), scope, f.fetch, now);
    const first = await observe();
    expect(first.events).toHaveLength(1);
    expect(first.events[0]).toMatchObject({
      type: "alex.github.pull-request.state",
      source: "app:alex:observer:github-pull-request",
      target: { appId: "alex", project: "alex", taskId: "delivery/change" },
    });
    expect((await observe(first.nextObservation)).events).toEqual([]);
    f.checks = [f.check(1, "failure")]; // GitHub PR updated_at need not change.
    const ci = await observe(first.nextObservation);
    expect(ci.events).toHaveLength(1);
    expect(ci.events[0]!.data.idempotencyKey).not.toBe(
      first.events[0]!.data.idempotencyKey,
    );
    f.comments = [f.comment()];
    const comment = await observe(ci.nextObservation);
    expect(comment.events).toHaveLength(1);
    f.comments[0]!.body = "A correction to the same comment";
    const edit = await observe(comment.nextObservation);
    expect(edit.events).toHaveLength(1);
    expect((await observe(edit.nextObservation)).events).toEqual([]);
    expect((await observe()).events).toEqual(edit.events); // snapshot loss replay is stable.
  });

  test("live and exact paths use the same fact; fetch time is not a change", async () => {
    const f = githubPullRequestFixture();
    f.comments = [f.comment()];
    const [, exact] = createGitHubPullRequestObservers(scope, f.fetch, now);
    const direct = await exact.inspect("github:hao1939/may-agent#215", {
      signal: new AbortController().signal,
    });
    const live = await observeGitHubPullRequests(
      context(),
      scope,
      f.fetch,
      () => new Date("2026-11-16T12:00:00Z"),
    );
    expect(live.events[0]!.data.fingerprint).toBe(direct.fingerprint);
    expect(live.events[0]!.data.feedback).toEqual(direct.feedback);
    expect(live.events[0]!.data).not.toHaveProperty("fetchedAt");
  });

  test.each([
    "check-runs",
    "status",
    "issues/215/comments",
    "pulls/215/comments",
  ])(
    "a failed %s read preserves independent facts and reports incomplete coverage",
    async (endpoint) => {
      const f = githubPullRequestFixture();
      f.override = (url) =>
        url.pathname.endsWith(endpoint)
          ? Response.json({}, { status: 503 })
          : undefined;
      const fact = await read(f);
      expect(fact.state).toBe("open");
      expect(fact.reviewsComplete).toBe(true);
      const key = (
        {
          "check-runs": "checks",
          status: "statuses",
          "issues/215/comments": "comments",
          "pulls/215/comments": "reviewComments",
        } as const
      )[endpoint];
      expect(fact.feedback?.errors[key]).toContain("503");
      expect(
        (fact.feedback as unknown as Record<string, unknown>)[`${key}Complete`],
      ).toBe(false);
      for (const other of [
        "checks",
        "statuses",
        "comments",
        "reviewComments",
      ].filter((other) => other !== key))
        expect(
          (fact.feedback as unknown as Record<string, unknown>)[
            `${other}Complete`
          ],
        ).toBe(true);
    },
  );

  test("old-head check success and mismatched status SHA are not current evidence", async () => {
    const f = githubPullRequestFixture();
    f.checks = [{ ...f.check(1, "success"), head_sha: "b".repeat(40) }];
    f.override = (url) =>
      url.pathname.endsWith("/status")
        ? Response.json({ sha: "b".repeat(40), total_count: 0, statuses: [] })
        : undefined;
    const fact = await read(f);
    expect(fact.feedback).toMatchObject({
      checks: [],
      checksComplete: false,
      statuses: [],
      statusesComplete: false,
    });
  });

  test("a head moving during the read fails explicitly instead of certifying an old head", async () => {
    const f = githubPullRequestFixture();
    let pullReads = 0;
    f.override = (url) =>
      url.pathname.endsWith("/pulls/215") && ++pullReads === 2
        ? Response.json({ ...f.pull, head: { sha: "b".repeat(40) } })
        : undefined;
    await expect(read(f)).rejects.toThrow("head changed");
  });

  test("live routing rereads ownership after feedback and rejects a changed owner", async () => {
    const f = githubPullRequestFixture();
    let pullReads = 0;
    f.override = (url) =>
      url.pathname.endsWith("/pulls/215") && ++pullReads === 2
        ? Response.json({
            ...f.pull,
            body: "## Task\n- App ID: alex\n- Task ID: delivery/other\n",
          })
        : undefined;
    expect(
      (await observeGitHubPullRequests(context(), scope, f.fetch, now)).events,
    ).toEqual([]);
  });

  test("pagination limits retain partial evidence and never claim full coverage", async () => {
    const f = githubPullRequestFixture();
    f.override = (url) => {
      if (!url.pathname.endsWith("/issues/215/comments")) return;
      const page = Number(url.searchParams.get("page") || 1);
      const next = new URL(url);
      next.searchParams.set("page", String(page + 1));
      return Response.json([f.comment(page)], {
        headers: { link: `<${next}>; rel="next"` },
      });
    };
    const fact = await read(f);
    expect(fact.feedback?.comments).toHaveLength(2);
    expect(fact.feedback?.commentsComplete).toBe(false);
    expect(fact.feedback?.errors.comments).toContain("pagination limit");
    expect(
      f.calls.filter((url) => url.includes("/issues/215/comments")),
    ).toHaveLength(2);
  });

  test("provider count inconsistent with missing pagination is an evidence gap", async () => {
    const f = githubPullRequestFixture();
    f.override = (url) =>
      url.pathname.endsWith("/check-runs")
        ? Response.json({ total_count: 3, check_runs: [f.check()] })
        : undefined;
    expect((await read(f)).feedback?.checksComplete).toBe(false);
  });

  test.each([
    "https://example.invalid/repos/hao1939/may-agent/issues/215/comments?per_page=25&page=2",
    "https://api.github.com/repos/other/repo/issues/215/comments?per_page=25&page=2",
    "https://api.github.com/repos/hao1939/may-agent/issues/216/comments?per_page=25&page=2",
    `https://api.github.com/repos/hao1939/may-agent/commits/${"b".repeat(40)}/check-runs?per_page=25&page=2`,
    "https://api.github.com/repos/hao1939/may-agent/issues/215/comments?per_page=25&page=2&page=3",
    "https://api.github.com/repos/hao1939/may-agent/pulls/215/comments?per_page=25&page=2",
    "https://api.github.com/repositories/9007199254740992/issues/215/comments?per_page=25&page=2",
  ])("unsafe pagination is refused before a request: %s", async (next) => {
    const f = githubPullRequestFixture();
    f.override = (url) =>
      url.pathname.endsWith("/issues/215/comments")
        ? Response.json([f.comment()], {
            headers: { link: `<${next}>; rel="next"` },
          })
        : undefined;
    const fact = await read(f);
    expect(fact.feedback?.commentsComplete).toBe(false);
    expect(f.calls).not.toContain(next);
  });

  test("numeric repository pagination is rebuilt under the configured resource", async () => {
    const f = githubPullRequestFixture();
    f.override = (url) =>
      url.pathname.endsWith("/issues/215/comments")
        ? Response.json(
            [f.comment(url.searchParams.has("page") ? 2 : 1)],
            !url.searchParams.has("page")
              ? {
                  headers: {
                    link: '<https://api.github.com/repositories/123/issues/215/comments?per_page=25&page=2>; rel="next"',
                  },
                }
              : undefined,
          )
        : undefined;
    const fact = await read(f);
    expect(fact.feedback?.commentsComplete).toBe(true);
    expect(fact.feedback?.comments).toHaveLength(2);
    expect(f.calls.some((url) => url.includes("/repositories/"))).toBe(false);
  });

  test("bounded body previews still detect edits beyond the visible prefix", async () => {
    const f = githubPullRequestFixture();
    f.comments = [f.comment(1, "x".repeat(20_000) + "first")];
    const first = await read(f);
    f.comments[0]!.body = "x".repeat(20_000) + "edited";
    const edited = await read(f);
    expect(first.feedback?.comments[0]?.bodyPreview.length).toBe(512);
    expect(first.feedback?.comments[0]?.bodyTruncated).toBe(true);
    expect(first.feedback?.comments[0]?.bodyPreview).toBe(
      edited.feedback?.comments[0]?.bodyPreview,
    );
    expect(first.fingerprint).not.toBe(edited.fingerprint);
  });

  test("full pagination stays within fourteen requests and aggregate body-preview budgets", async () => {
    const f = githubPullRequestFixture();
    f.override = (url) => {
      if (url.pathname.endsWith("/pulls/215")) return;
      const page = Number(url.searchParams.get("page") || 1);
      const review = url.pathname.endsWith("/reviews");
      const size = review ? 50 : 25;
      const pages = review ? 4 : 2;
      const items = Array.from({ length: size }, (_, i) => {
        const id = (page - 1) * size + i + 1;
        if (review)
          return {
            id,
            state: "APPROVED",
            commit_id: f.pull.head.sha,
            submitted_at: f.at,
            user: { login: "reviewer" },
            body: "x".repeat(20_000),
          };
        if (url.pathname.endsWith("/check-runs")) return f.check(id);
        if (url.pathname.endsWith("/status")) return f.status(id);
        return {
          ...f.comment(id, "x".repeat(20_000)),
          commit_id: f.pull.head.sha,
          original_commit_id: f.pull.head.sha,
          path: "change.ts",
          line: null,
          in_reply_to_id: null,
        };
      });
      const next = new URL(url);
      next.searchParams.set("page", String(page + 1));
      const value = url.pathname.endsWith("/check-runs")
        ? { total_count: 50, check_runs: items }
        : url.pathname.endsWith("/status")
          ? { sha: f.pull.head.sha, total_count: 50, statuses: items }
          : items;
      return Response.json(
        value,
        page < pages
          ? { headers: { link: `<${next}>; rel="next"` } }
          : undefined,
      );
    };
    const fact = await read(f);
    expect(f.calls).toHaveLength(14);
    expect(fact.reviewsComplete).toBe(true);
    expect(fact.feedback?.errors).toEqual({});
    expect(
      fact.reviews.reduce(
        (n, review) => n + (review.bodyPreview?.length || 0),
        0,
      ),
    ).toBeLessThanOrEqual(4_096);
    expect(
      [
        ...(fact.feedback?.comments || []),
        ...(fact.feedback?.reviewComments || []),
      ].reduce((n, comment) => n + comment.bodyPreview.length, 0),
    ).toBeLessThanOrEqual(8_192);
  });

  test("feedback live discovery rotates fairly instead of spending a partial budget on a second PR", async () => {
    const f = githubPullRequestFixture();
    const second = { ...f.pull, number: 216 };
    f.override = (url) => {
      if (url.pathname.endsWith("/pulls") && url.searchParams.has("state"))
        return Response.json([f.pull, second]);
      if (url.pathname.endsWith("/pulls/216")) return Response.json(second);
      if (url.pathname.includes("/216/")) return Response.json([]);
    };
    const first = await observeGitHubPullRequests(
      context(),
      scope,
      f.fetch,
      now,
    );
    const secondPass = await observeGitHubPullRequests(
      context(first.nextObservation),
      scope,
      f.fetch,
      now,
    );
    expect(first.events.map((event) => event.data.number)).toEqual([215]);
    expect(secondPass.events.map((event) => event.data.number)).toEqual([216]);
    expect(secondPass.events[0]?.data.feedback).toMatchObject({ errors: {} });
  });

  test("feedback requests authenticate only fixed endpoints and never retain credentials", async () => {
    const saved = process.env.GH_TOKEN;
    try {
      process.env.GH_TOKEN = "fixture-feedback-token";
      const f = githubPullRequestFixture();
      f.override = (url, init) => {
        expect(url.origin).toBe("https://api.github.com");
        expect(init?.redirect).toBe("manual");
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer fixture-feedback-token",
        );
      };
      const result = await observeGitHubPullRequests(
        context(),
        scope,
        f.fetch,
        now,
      );
      expect(JSON.stringify(result)).not.toContain("fixture-feedback-token");
    } finally {
      if (saved === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = saved;
    }
  });

  test("cancellation does not turn failed I/O into empty success", async () => {
    const f = githubPullRequestFixture();
    const controller = new AbortController();
    f.override = (url) => {
      if (url.pathname.endsWith("/check-runs"))
        controller.abort(new Error("stop fixture"));
    };
    await expect(read(f, controller.signal)).rejects.toThrow("stop fixture");
    expect(f.calls.some((url) => url.includes("/issues/"))).toBe(false);
  });

  test("App identity and source stay exact; invalid or closed owners are not routed", async () => {
    const f = githubPullRequestFixture();
    f.pull.body = "## Task\n- App ID: may\n- Task ID: delivery/change\n";
    expect(
      (await observeGitHubPullRequests(context(), scope, f.fetch, now)).events,
    ).toEqual([]);
    f.pull.body = "## Task\n- App ID: alex\n- Task ID: delivery/change\n";
    expect(
      (
        await observeGitHubPullRequests(
          context(undefined, true),
          scope,
          f.fetch,
          now,
        )
      ).events,
    ).toEqual([]);
    expect(parseTaskOwner(f.pull.body)).toEqual({
      appId: "alex",
      taskId: "delivery/change",
    });
    expect(
      parseTaskOwner(
        f.pull.body + "\n## May Task\n- App ID: may\n- Task ID: other\n",
      ),
    ).toBeNull();
    const [, detector] = createGitHubPullRequestObservers(scope, f.fetch, now);
    const wait = observationCondition(
      { ...detector, appId: "alex" },
      {
        id: "feedback",
        observerId: detector.id,
        resource: "github:hao1939/may-agent#215",
        expected: { field: "fingerprint", notEquals: null },
      },
    );
    expect(validateGitHubPullRequestCondition(wait, "alex")).toBeNull();
    expect(
      validateGitHubPullRequestCondition(
        {
          ...wait,
          expected: {
            ...wait.expected,
            source: "app:may:observer:github-pull-request",
          },
        },
        "alex",
      ),
    ).toContain("installed");
  });
});
