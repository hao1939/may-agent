import { describe, expect, test } from "bun:test";
import { matchesAppTaskCondition } from "../../may-agent/src/app/core/tasks/app-task-condition-tracker.ts";
import type { Condition, ObserverContext, TaskDetail } from "@may-agent/sdk";
import {
  GITHUB_PULL_REQUEST_EVENT,
  createGitHubPullRequestObservers,
  upgradeGitHubPullRequestCondition,
  observeGitHubPullRequests,
  parseMayTaskOwner,
  parsePullRequestSubject,
  readGitHubPullRequest,
  validateGitHubPullRequestCondition,
} from "./github-pull-request";
const scope = {
  repository: "hao1939/may-agent",
  author: "hao1939",
  appId: "may",
  project: "may",
};
const ownerBody = (taskId = "goal/linked-pr") =>
  `Summary\n\n## May Task\n- App ID: may\n- Task ID: ${taskId}\n`;
const condition: Condition = {
  id: "github-pr",
  type: GITHUB_PULL_REQUEST_EVENT,
  subject: "pull-request:github:hao1939/may-agent#215",
  expected: {
    provider: "github",
    repository: "hao1939/may-agent",
    field: "fingerprint",
    notEquals: null,
  },
  owner: "app:may",
  reviewAfterMs: 1000,
};
function task(id: string, status: TaskDetail["status"] = "done"): TaskDetail {
  return {
    id,
    status,
    generation: 1,
    outcome: "Deliver",
    parentId: "may",
    acceptance: ["Observe"],
    input: {},
    conditions: [
      {
        id: "human",
        type: "conversation.message.created",
        subject: "conversationId:test",
        expected: { field: "text", equals: "approve" },
        owner: "human",
      },
    ],
    acceptedEvidence: { available: false, maxPageSize: 8 },
  };
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
        list: async () => {
          throw new Error("observer must not enumerate Tasks");
        },
        get: async (id) => tasks.get(id) ?? null,
      },
    },
  };
}
function response(
  value: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(value, { status, headers });
}
function pullPayload(
  number: number,
  body = ownerBody(),
  options: { merged?: boolean; author?: string } = {},
) {
  const merged = options.merged ?? false;
  return {
    number,
    body,
    user: { login: options.author ?? "hao1939" },
    state: merged ? "closed" : "open",
    draft: false,
    merged,
    merged_at: merged ? "2026-09-21T00:00:00Z" : null,
    merge_commit_sha: merged ? `merge-${number}` : null,
    head: { sha: `head-${number}` },
    updated_at: merged ? "2026-09-21T00:00:00Z" : "2026-09-20T00:00:00Z",
    base: { repo: { full_name: scope.repository } },
  };
}
function provider(
  pulls: Map<number, ReturnType<typeof pullPayload>>,
  calls: string[] = [],
  failReviews = false,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("?state=")) {
      const state = new URL(url).searchParams.get("state");
      return response(
        [...pulls.values()].filter((item) =>
          state === "open" ? item.state === "open" : item.state === "closed",
        ),
      );
    }
    if (url.includes("/reviews"))
      return failReviews ? response({ error: "bad" }) : response([]);
    const number = Number(url.match(/\/pulls\/(\d+)$/)?.[1]);
    return response(
      pulls.get(number) ?? { message: "missing" },
      pulls.has(number) ? 200 : 404,
    );
  }) as typeof fetch;
}
const observe = (ctx: ObserverContext, fetcher: typeof fetch) =>
  observeGitHubPullRequests(
    ctx,
    scope,
    fetcher,
    () => new Date("2026-09-21T01:00:00Z"),
  );
describe("May GitHub pull-request resource ownership", () => {
  test("republication is stable across fetch times and distinguishes provider revisions and owner generations", async () => {
    const tasks = new Map([["goal/linked-pr", task("goal/linked-pr")]]);
    const pulls = new Map([[215, pullPayload(215, ownerBody())]]);
    const read = (at: string) =>
      observeGitHubPullRequests(
        context(tasks),
        scope,
        provider(pulls),
        () => new Date(at),
      );
    const first = (await read("2026-09-21T01:00:00Z")).events[0]!;
    const again = (await read("2026-09-21T02:00:00Z")).events[0]!;
    expect(again).toEqual(first);
    expect(first.data).not.toHaveProperty("fetchedAt");
    expect(first.data).toHaveProperty("idempotencyKey");
    pulls.get(215)!.updated_at = "2026-09-21T03:00:00Z";
    const laterRevision = (await read("2026-09-21T04:00:00Z")).events[0]!;
    expect(laterRevision.data.idempotencyKey).not.toBe(
      first.data.idempotencyKey,
    );
    tasks.get("goal/linked-pr")!.generation = 2;
    expect(
      (await read("2026-09-21T05:00:00Z")).events[0]!.data.idempotencyKey,
    ).not.toBe(laterRevision.data.idempotencyKey);
    const retained = await read("2026-09-21T05:00:00Z");
    tasks
      .get("goal/linked-pr")!
      .conditions.push({ ...condition, reviewAfterMs: undefined });
    const demand = await observe(
      context(tasks, retained.nextObservation),
      provider(pulls),
    );
    expect(demand.events).toHaveLength(1);
    expect(demand.events[0]!.data.idempotencyKey).not.toBe(
      retained.events[0]!.data.idempotencyKey,
    );
    Reflect.deleteProperty(pulls.get(215)!, "updated_at");
    expect((await read("2026-09-21T06:00:00Z")).events).toEqual([]);
  });
  test("parses one exact visible metadata block and rejects ambiguity", () => {
    expect(parseMayTaskOwner(ownerBody())).toEqual({
      appId: "may",
      taskId: "goal/linked-pr",
    });
    expect(
      parseMayTaskOwner(`${ownerBody()}\n${ownerBody("goal/other")}`),
    ).toBeNull();
    expect(parseMayTaskOwner("```md\n" + ownerBody() + "```")).toBeNull();
    expect(parseMayTaskOwner("~~~md\n" + ownerBody() + "~~~")).toBeNull();
    expect(parseMayTaskOwner("```md\n" + ownerBody())).toBeNull();
    expect(
      parseMayTaskOwner("## May Task\n- App ID: may\n- Task ID: ../escape"),
    ).toBeNull();
    expect(
      parseMayTaskOwner(
        "## May Task\n- App ID: may\n- App ID: invalid app\n- Task ID: goal/linked-pr",
      ),
    ).toBeNull();
    expect(
      parseMayTaskOwner(
        "## May Task\n- App ID: may\n- Task ID: goal/linked-pr\n- Task ID: invalid task",
      ),
    ).toBeNull();
  });
  test("retains explicit Conditions without using them as discovery registration", () => {
    expect(parsePullRequestSubject(condition.subject)).toEqual({
      repository: scope.repository,
      number: 215,
      pullRequestId: "github:hao1939/may-agent#215",
    });
    expect(validateGitHubPullRequestCondition(condition)).toBeNull();
    expect(createGitHubPullRequestObservers(scope)[0]).toMatchObject({
      id: "github-pull-request-live",
      intervalMs: 900000,
    });
  });
  test("routes an Alex-origin candidate only through its genuine May delivery owner", async () => {
    const unsupportedAlexOwner =
      "Alex-origin candidate\n\n## Task\n- App ID: alex\n- Task ID: input/alex-origin\n";
    expect(parseMayTaskOwner(unsupportedAlexOwner)).toBeNull();
    const rejected = await observe(
      context(new Map([["input/alex-origin", task("input/alex-origin")]])),
      provider(new Map([[215, pullPayload(215, unsupportedAlexOwner)]])),
    );
    expect(rejected.events).toHaveLength(0);

    const deliveryTaskId = "goal/deliver-alex-candidate";
    const routed = await observe(
      context(new Map([[deliveryTaskId, task(deliveryTaskId)]])),
      provider(new Map([[215, pullPayload(215, ownerBody(deliveryTaskId))]])),
    );
    expect(routed.events).toHaveLength(1);
    expect(routed.events[0]).toMatchObject({
      type: GITHUB_PULL_REQUEST_EVENT,
      target: { appId: "may", project: "may", taskId: deliveryTaskId },
      data: { number: 215, state: "open", merged: false },
    });
  });
  test("routes a PR to a quiet done owner with only a human Condition", async () => {
    const calls: string[] = [];
    const result = await observe(
      context(new Map([["goal/linked-pr", task("goal/linked-pr")]])),
      provider(new Map([[215, pullPayload(215)]]), calls),
    );
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: GITHUB_PULL_REQUEST_EVENT,
      target: { appId: "may", project: "may", taskId: "goal/linked-pr" },
      data: { number: 215, state: "open", merged: false },
    });
    expect(calls.filter((url) => url.includes("?state="))).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });
  test("suppresses unchanged facts and emits open-to-merged", async () => {
    const tasks = new Map([["goal/linked-pr", task("goal/linked-pr")]]);
    const open = await observe(
      context(tasks),
      provider(new Map([[215, pullPayload(215)]])),
    );
    const quiet = await observe(
      context(tasks, open.nextObservation),
      provider(new Map([[215, pullPayload(215)]])),
    );
    expect(quiet.events).toHaveLength(0);
    const merged = await observe(
      context(tasks, quiet.nextObservation),
      provider(
        new Map([[215, pullPayload(215, ownerBody(), { merged: true })]]),
      ),
    );
    expect(merged.events[0].data).toMatchObject({
      state: "closed",
      merged: true,
    });
  });
  test("live discovery does not scan closed history; exact recovery sees an initially merged PR", async () => {
    const calls: string[] = [];
    const fetcher = provider(
      new Map([[215, pullPayload(215, ownerBody(), { merged: true })]]),
      calls,
    );
    const [live, recovery] = createGitHubPullRequestObservers(scope, fetcher);
    const result = await live.run(context(new Map()));
    expect(result).toMatchObject({ events: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("state=open");
    const fact = await recovery.inspect("github:hao1939/may-agent#215", {
      signal: new AbortController().signal,
    });
    expect(fact).toMatchObject({ merged: true, state: "closed" });
    expect(fact).not.toHaveProperty("fetchedAt");
    expect(calls.slice(1).every((url) => !url.includes("?state="))).toBeTrue();
  });
  test("revalidates metadata and never reuses cached ownership", async () => {
    const tasks = new Map([
      ["goal/linked-pr", task("goal/linked-pr")],
      ["goal/other", task("goal/other")],
    ]);
    const initial = await observe(
      context(tasks),
      provider(new Map([[215, pullPayload(215)]])),
    );
    const removed = await observe(
      context(tasks, initial.nextObservation),
      provider(new Map([[215, pullPayload(215, "no owner")]])),
    );
    expect(removed.events).toHaveLength(0);
    const changed = await observe(
      context(tasks, removed.nextObservation),
      provider(new Map([[215, pullPayload(215, ownerBody("goal/other"))]])),
    );
    expect(changed.events[0].target?.taskId).toBe("goal/other");
  });
  test("rejects unknown, closed, cross-App and untrusted owners", async () => {
    const closed = { ...task("goal/linked-pr"), closed: true };
    const cases: Array<[string, string, Map<string, TaskDetail>]> = [
      [ownerBody("goal/missing"), "hao1939", new Map()],
      [ownerBody(), "hao1939", new Map([["goal/linked-pr", closed]])],
      [
        "## May Task\n- App ID: other\n- Task ID: goal/linked-pr",
        "hao1939",
        new Map([["goal/linked-pr", task("goal/linked-pr")]]),
      ],
      [
        ownerBody(),
        "attacker",
        new Map([["goal/linked-pr", task("goal/linked-pr")]]),
      ],
    ];
    for (const [body, author, tasks] of cases) {
      const result = await observe(
        context(tasks),
        provider(new Map([[215, pullPayload(215, body, { author })]])),
      );
      expect(result.events).toHaveLength(0);
    }
  });
  test("keeps valid PR state when reviews are incomplete", async () => {
    const result = await observe(
      context(new Map([["goal/linked-pr", task("goal/linked-pr")]])),
      provider(new Map([[215, pullPayload(215)]]), [], true),
    );
    expect(result.events.map((event) => event.type)).toEqual([
      GITHUB_PULL_REQUEST_EVENT,
      "may.github.pull-request.read-failed",
    ]);
    expect(result.events[0].data).toMatchObject({
      reviewsComplete: false,
      state: "open",
    });
  });
  test("bounds reads and remembers open resources", async () => {
    const pulls = new Map<number, ReturnType<typeof pullPayload>>();
    const tasks = new Map<string, TaskDetail>();
    for (let number = 1; number <= 20; number++) {
      const id = `goal/${number}`;
      pulls.set(number, pullPayload(number, ownerBody(id)));
      tasks.set(id, task(id));
    }
    const calls: string[] = [];
    const first = await observe(context(tasks), provider(pulls, calls));
    expect(calls.length).toBeLessThanOrEqual(11);
    expect(first.events.length).toBeGreaterThan(0);
    expect(
      (first.nextObservation as { resources: unknown[] }).resources.length,
    ).toBeGreaterThan(0);
  });
  test("preserves suppression and unvisited open memory across a full budget rotation", async () => {
    const pulls = new Map<number, ReturnType<typeof pullPayload>>();
    const tasks = new Map<string, TaskDetail>();
    for (let number = 1; number <= 6; number++) {
      const id = `goal/${number}`;
      pulls.set(number, pullPayload(number, ownerBody(id)));
      tasks.set(id, task(id));
    }
    let previous: ObserverContext["previousObservation"];
    const emitted: number[][] = [];
    for (let pass = 0; pass < 4; pass++) {
      const result = await observe(context(tasks, previous), provider(pulls));
      emitted.push(
        result.events
          .filter((event) => event.type === GITHUB_PULL_REQUEST_EVENT)
          .map((event) => Number((event.data as { number: number }).number)),
      );
      previous = result.nextObservation;
    }
    expect(emitted.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);

    const listEmptyButDirectReadable = (async (
      input: string | URL | Request,
    ) => {
      const url = String(input);
      if (url.includes("?state=")) return response([]);
      if (url.includes("/reviews")) return response([]);
      const number = Number(url.match(/\/pulls\/(\d+)$/)?.[1]);
      return response(pulls.get(number));
    }) as typeof fetch;
    const retained = await observe(
      context(tasks, previous),
      listEmptyButDirectReadable,
    );
    expect(retained.events).toHaveLength(0);
    expect(
      (retained.nextObservation as { resources: unknown[] }).resources.length,
    ).toBeGreaterThan(0);
  });

  test("repeatedly services every saturated resource despite refresh-recency memory order", async () => {
    const pulls = new Map<number, ReturnType<typeof pullPayload>>();
    const tasks = new Map<string, TaskDetail>();
    for (let number = 1; number <= 64; number++) {
      const id = `goal/${number}`;
      pulls.set(number, pullPayload(number, ownerBody(id)));
      tasks.set(id, task(id));
    }
    let calls = 0;
    const directReads = new Map<number, number>();
    const fetcher = (async (input: string | URL | Request) => {
      calls++;
      const url = String(input);
      if (url.includes("?state=")) {
        const parsed = new URL(url);
        if (parsed.searchParams.get("state") === "closed") return response([]);
        const page = Number(parsed.searchParams.get("page") ?? "1");
        const values = [...pulls.values()];
        const body = values.slice((page - 1) * 50, page * 50);
        const headers =
          page === 1
            ? {
                link: `<https://api.github.com/repos/${scope.repository}/pulls?state=open&sort=updated&direction=desc&per_page=50&page=2>; rel="next"`,
              }
            : undefined;
        return response(body, 200, headers);
      }
      if (url.includes("/reviews")) return response([]);
      const number = Number(url.match(/\/pulls\/(\d+)$/)?.[1]);
      directReads.set(number, (directReads.get(number) ?? 0) + 1);
      return response(pulls.get(number));
    }) as typeof fetch;

    let previous: ObserverContext["previousObservation"];
    const initiallyObserved = new Set<number>();
    let maxCalls = 0;
    for (let pass = 0; pass < 40; pass++) {
      const before = calls;
      const result = await observe(context(tasks, previous), fetcher);
      maxCalls = Math.max(maxCalls, calls - before);
      for (const event of result.events)
        if (event.type === GITHUB_PULL_REQUEST_EVENT)
          initiallyObserved.add(
            Number((event.data as { number: number }).number),
          );
      previous = result.nextObservation;
    }
    expect(initiallyObserved.size).toBe(64);
    expect([...directReads.values()].every((count) => count >= 2)).toBe(true);
    expect(directReads.get(1)).toBeGreaterThanOrEqual(2);
    expect(maxCalls).toBeLessThanOrEqual(11);

    const changedNumbers = [1, 29, 64];
    for (const number of changedNumbers)
      pulls.get(number)!.head.sha = `changed-head-${number}`;
    const changesObserved = new Set<number>();
    for (let pass = 0; pass < 20 && changesObserved.size < 3; pass++) {
      const before = calls;
      const result = await observe(context(tasks, previous), fetcher);
      maxCalls = Math.max(maxCalls, calls - before);
      for (const event of result.events) {
        const number = Number((event.data as { number?: number }).number);
        if (
          event.type === GITHUB_PULL_REQUEST_EVENT &&
          changedNumbers.includes(number)
        )
          changesObserved.add(number);
      }
      previous = result.nextObservation;
    }
    expect([...changesObserved].sort((a, b) => a - b)).toEqual(changedNumbers);
    expect(maxCalls).toBeLessThanOrEqual(11);
  });

  test("distinguishes successful empty discovery from total provider failure and recovers normally", async () => {
    const empty = await observe(context(new Map()), provider(new Map()));
    expect(empty).toEqual({
      events: [],
      nextObservation: { cursor: 0, resources: [], states: {} },
    });

    let unavailable = true;
    const fetcher = (async () =>
      unavailable
        ? response({ message: "unavailable" }, 503)
        : response([])) as typeof fetch;
    await expect(observe(context(new Map()), fetcher)).rejects.toThrow(
      "discovery unavailable: open: GitHub read failed HTTP 503",
    );

    unavailable = false;
    const recovered = await observe(context(new Map()), fetcher);
    expect(recovered.events).toEqual([]);
    expect(recovered.nextObservation).toEqual({
      cursor: 0,
      resources: [],
      states: {},
    });
  });

  test("preserves provider deferral during open PR discovery", async () => {
    const nowMs = new Date("2026-09-21T01:00:00Z").getTime();
    for (const rateLimitedState of ["open"] as const) {
      const calls: string[] = [];
      const ctx = context(new Map());
      const result = await observe(ctx, (async (
        input: string | URL | Request,
      ) => {
        const state = new URL(String(input)).searchParams.get("state");
        calls.push(String(state));
        return state === rateLimitedState
          ? response({ message: "limited" }, 429, { "retry-after": "60" })
          : response({ message: "unavailable" }, 503);
      }) as typeof fetch);
      expect(result.events).toEqual([]);
      expect(result.nextObservation).toMatchObject({
        deferUntil: nowMs + 15 * 60_000,
        resources: [],
        states: {},
      });
      expect(ctx.warnings).toContainEqual(
        expect.stringContaining(
          `${rateLimitedState}: GitHub read failed HTTP 429`,
        ),
      );
      expect(calls).toEqual(["open"]);
    }
  });

  test("services successful discovery despite a later provider failure and reports incomplete coverage", async () => {
    const ctx = context(new Map([["goal/linked-pr", task("goal/linked-pr")]]));
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("state=open") && !url.includes("page=2"))
        return response([pullPayload(215)], 200, {
          link: `<https://api.github.com/repos/${scope.repository}/pulls?state=open&sort=updated&direction=desc&per_page=50&page=2>; rel="next"`,
        });
      if (url.includes("state=open") && url.includes("page=2"))
        return response({ message: "unavailable" }, 503);
      if (url.includes("state=closed")) return response([]);
      if (url.includes("/reviews")) return response([]);
      return response(pullPayload(215));
    }) as typeof fetch;
    const result = await observe(ctx, fetcher);
    expect(result.events[0]).toMatchObject({
      type: GITHUB_PULL_REQUEST_EVENT,
      target: { taskId: "goal/linked-pr" },
    });
    expect(ctx.warnings).toContainEqual(
      expect.stringContaining(
        "coverage incomplete: open: GitHub read failed HTTP 503",
      ),
    );
  });

  test("reserves fair refresh capacity for remembered open resources and reports overflow", async () => {
    const tasks = new Map<string, TaskDetail>();
    const listed: ReturnType<typeof pullPayload>[] = [];
    for (let number = 1; number <= 65; number++) {
      const id = `goal/${number}`;
      tasks.set(id, task(id));
      listed.push(pullPayload(number, ownerBody(id)));
    }
    tasks.set("goal/remembered", task("goal/remembered"));
    const ctx = context(tasks, {
      cursor: 0,
      resources: [{ repository: scope.repository, number: 900, open: true }],
      states: {},
    });
    const calls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("state=open")) return response(listed);
      if (url.includes("state=closed")) return response([]);
      if (url.includes("/reviews")) return response([]);
      const number = Number(url.match(/\/pulls\/(\d+)$/)?.[1]);
      return response(
        number === 900
          ? pullPayload(900, ownerBody("goal/remembered"), { merged: true })
          : pullPayload(number, ownerBody(`goal/${number}`)),
      );
    }) as typeof fetch;
    const result = await observe(ctx, fetcher);
    expect(calls.some((url) => url.endsWith("/pulls/900"))).toBe(true);
    expect(result.events[0]).toMatchObject({
      target: { taskId: "goal/remembered" },
      data: { number: 900, merged: true },
    });
    expect(ctx.warnings).toContainEqual(
      expect.stringContaining("candidate coverage exceeded"),
    );
  });

  test("direct reader remains ownership-independent and rejects malformed provider boundaries", async () => {
    const noOwner = pullPayload(215, "ordinary external PR body", {
      author: "someone-else",
    });
    const direct = await readGitHubPullRequest(
      scope.repository,
      215,
      provider(new Map([[215, noOwner]])),
    );
    expect(direct).toMatchObject({ number: 215, state: "open" });

    await expect(
      readGitHubPullRequest(scope.repository, 215, (async (
        input: string | URL | Request,
      ) =>
        String(input).includes("/reviews")
          ? response([])
          : response({ ...pullPayload(215), number: 216 })) as typeof fetch),
    ).rejects.toThrow("identity does not match");
    await expect(
      readGitHubPullRequest(scope.repository, 215, (async (
        input: string | URL | Request,
      ) =>
        String(input).includes("/reviews")
          ? response([])
          : response({ ...pullPayload(215), draft: "false" })) as typeof fetch),
    ).rejects.toThrow("missing boolean draft");
    await expect(
      readGitHubPullRequest(scope.repository, 215, (async () =>
        response({ message: "no" }, 503)) as typeof fetch),
    ).rejects.toThrow("HTTP 503");
  });

  test("fails review pagination closed for duplicate, unsafe-integer, and redirected pages while retaining PR state", async () => {
    const links = [
      `https://api.github.com/repos/${scope.repository}/pulls/215/reviews?per_page=50&page=2&page=3`,
      `https://api.github.com/repos/${scope.repository}/pulls/215/reviews?per_page=50&page=9007199254740992`,
    ];
    for (const link of links) {
      const fact = await readGitHubPullRequest(scope.repository, 215, (async (
        input: string | URL | Request,
      ) =>
        String(input).includes("/reviews")
          ? response([], 200, { link: `<${link}>; rel="next"` })
          : response(pullPayload(215))) as typeof fetch);
      expect(fact).toMatchObject({
        state: "open",
        reviewsComplete: false,
        reviewError: expect.stringContaining("unsafe"),
      });
    }

    const redirected = await readGitHubPullRequest(
      scope.repository,
      215,
      (async (input: string | URL | Request) => {
        const result = String(input).includes("/reviews")
          ? response([])
          : response(pullPayload(215));
        if (String(input).includes("/reviews"))
          Object.defineProperty(result, "url", {
            value: "https://api.github.com/redirected",
          });
        return result;
      }) as typeof fetch,
    );
    expect(redirected).toMatchObject({
      state: "open",
      reviewsComplete: false,
      reviewError: expect.stringContaining("redirected"),
    });
  });

  test("persists Retry-After date and rate-limit reset deferral", async () => {
    for (const headers of [
      { "retry-after": "Sun, 21 Sep 2026 02:00:00 GMT" },
      {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Date.parse("2026-09-21T02:00:00Z") / 1000),
      },
    ]) {
      let calls = 0;
      const first = await observe(context(new Map()), (async () => {
        calls++;
        return response({ message: "limited" }, 429, headers);
      }) as typeof fetch);
      expect(calls).toBe(1);
      expect(
        Number((first.nextObservation as { deferUntil: number }).deferUntil),
      ).toBeGreaterThan(Date.parse("2026-09-21T01:00:00Z"));
    }
  });

  test("does no reads during persisted rate-limit deferral", async () => {
    const calls: string[] = [];
    const result = await observe(
      context(new Map(), { deferUntil: Date.parse("2026-09-21T02:00:00Z") }),
      provider(new Map(), calls),
    );
    expect(calls).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });
});

describe("GitHub live observation and saved Condition recovery", () => {
  test("both paths satisfy the same saved interest; upgrade preserves the owner's expectation", async () => {
    const original = {
      ...condition,
      requestedAction: "Review a changed PR",
      reviewAfterMs: 3600000,
    };
    const upgraded = upgradeGitHubPullRequestCondition(original);
    expect(upgraded).toMatchObject({
      id: original.id,
      requestedAction: original.requestedAction,
      reviewAfterMs: original.reviewAfterMs,
      subject: "resource:github:hao1939/may-agent#215",
      expected: {
        ...(original.expected as object),
        source: "app:may:observer:github-pull-request",
      },
    });
    expect(original.subject).toBe("pull-request:github:hao1939/may-agent#215");
    expect(upgradeGitHubPullRequestCondition(upgraded)).toBe(upgraded);
    expect(validateGitHubPullRequestCondition(upgraded)).toBeNull();
    const tasks = new Map([
      ["goal/linked-pr", { ...task("goal/linked-pr"), conditions: [upgraded] }],
    ]);
    const [live, recovery] = createGitHubPullRequestObservers(
      scope,
      provider(new Map([[215, pullPayload(215)]])),
    );
    const result = (await live.run(context(tasks))) as { events: any[] };
    const liveFact = result.events[0];
    const saved = {
      metadata: { id: upgraded.id, generation: 1, resourceVersion: 1 },
      spec: upgraded,
      status: { state: "unknown", observedGeneration: 0 },
    } as any;
    expect(matchesAppTaskCondition(saved, liveFact)).toBeTrue();
    const fact = await recovery.inspect("github:hao1939/may-agent#215", {
      signal: new AbortController().signal,
    });
    expect(
      matchesAppTaskCondition(saved, {
        type: recovery.type,
        source: liveFact.source,
        data: { ...fact, resource: "github:hao1939/may-agent#215" },
      }),
    ).toBeTrue();
    expect(
      validateGitHubPullRequestCondition({
        ...upgraded,
        expected: { field: "state", equals: "closed", source: liveFact.source },
      }),
    ).toBeNull();
    expect(
      validateGitHubPullRequestCondition({
        ...upgraded,
        expected: { source: "app:other" },
      }),
    ).toContain("installed");
  });

  test("normalizes numeric pagination hints without fetching numeric or other repository URLs", async () => {
    const calls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      calls.push(url.href);
      if (url.searchParams.has("state")) {
        if (url.searchParams.has("page")) return response([pullPayload(215)]);
        return response([], 200, {
          link: '<https://api.github.com/repositories/1171846913/pulls?state=open&sort=updated&direction=desc&per_page=50&page=2>; rel="next"',
        });
      }
      if (url.pathname.endsWith("/reviews")) {
        if (url.searchParams.has("page"))
          return response([
            {
              id: 2,
              state: "APPROVED",
              commit_id: "head-215",
              submitted_at: null,
              user: { login: "reviewer" },
            },
          ]);
        return response([], 200, {
          link: '<https://api.github.com/repositories/1171846913/pulls/215/reviews?per_page=50&page=2>; rel="next"',
        });
      }
      return response(pullPayload(215));
    }) as typeof fetch;
    const result = await observe(
      context(new Map([["goal/linked-pr", task("goal/linked-pr")]])),
      fetcher,
    );
    expect(result.events[0].data).toMatchObject({
      reviewsComplete: true,
      reviews: [{ id: 2, state: "approved" }],
    });
    expect(calls).toHaveLength(5);
    expect(
      calls.every((url) =>
        url.startsWith("https://api.github.com/repos/hao1939/may-agent/pulls"),
      ),
    ).toBeTrue();
    expect(calls.some((url) => url.includes("state=closed"))).toBeFalse();
  });

  test("refuses unsafe numeric review links while retaining independently valid PR state", async () => {
    for (const link of [
      "https://evil.example/repositories/1171846913/pulls/215/reviews?per_page=50&page=2",
      "https://api.github.com/repositories/1171846913/pulls/216/reviews?per_page=50&page=2",
      "https://api.github.com/repositories/1171846913/pulls/215/reviews?per_page=50&page=2&page=3",
      "https://api.github.com/repos/other/repo/pulls/215/reviews?per_page=50&page=2",
      "https://api.github.com/repositories/9007199254740992/pulls/215/reviews?per_page=50&page=2",
    ]) {
      let calls = 0;
      const fact = await readGitHubPullRequest(scope.repository, 215, (async (
        input: string | URL | Request,
      ) => {
        calls++;
        return String(input).includes("/reviews")
          ? response([], 200, { link: `<${link}>; rel="next"` })
          : response(pullPayload(215));
      }) as typeof fetch);
      expect(fact).toMatchObject({ state: "open", reviewsComplete: false });
      expect(fact.reviewError).toBeString();
      expect(calls).toBe(2);
    }
  });

  test("provider deferral is shared between live and recovery paths, in either direction", async () => {
    for (const first of ["live", "recovery"] as const) {
      let calls = 0;
      let clock = Date.parse("2026-10-15T15:00:00Z");
      let limited = true;
      const [live, recovery] = createGitHubPullRequestObservers(
        scope,
        (async (input: string | URL | Request) => {
          calls++;
          if (limited) return response({}, 429, { "retry-after": "3600" });
          return String(input).includes("/reviews") ||
            String(input).includes("?state=")
            ? response([])
            : response(pullPayload(215));
        }) as typeof fetch,
        () => new Date(clock),
      );
      const check = () =>
        recovery.inspect("github:hao1939/may-agent#215", {
          signal: new AbortController().signal,
        });
      if (first === "live") await live.run(context(new Map()));
      else await expect(check()).rejects.toThrow("429");
      await expect(check()).rejects.toThrow("deferral");
      await live.run(context(new Map()));
      expect(calls).toBe(1);
      clock += 3600001;
      limited = false;
      await expect(check()).resolves.toMatchObject({ state: "open" });
      expect(calls).toBe(3);
    }
  });

  test("exact recovery rejects out-of-scope references and honors cancellation during review read", async () => {
    let calls = 0;
    const abort = new AbortController();
    const [, recovery] = createGitHubPullRequestObservers(scope, (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls++;
      expect(init?.signal).toBeDefined();
      if (String(input).includes("/reviews"))
        abort.abort(new Error("fixture cancelled"));
      return String(input).includes("/reviews")
        ? response([])
        : response(pullPayload(215));
    }) as typeof fetch);
    for (const resource of [
      "github:other/repo#215",
      "https://evil.example",
      "github:hao1939/may-agent#0",
    ])
      await expect(
        recovery.inspect(resource, { signal: abort.signal }),
      ).rejects.toThrow("configured repository");
    expect(calls).toBe(0);
    await expect(
      recovery.inspect("github:hao1939/may-agent#215", {
        signal: abort.signal,
      }),
    ).rejects.toThrow("fixture cancelled");
    expect(calls).toBe(2);
    await expect(
      recovery.inspect("github:hao1939/may-agent#215", {
        signal: abort.signal,
      }),
    ).rejects.toThrow("fixture cancelled");
    expect(calls).toBe(2);
  });
});
