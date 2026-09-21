import { describe, expect, test } from "bun:test";
import type { Condition, ObserverContext, TaskDetail } from "@may-agent/sdk";
import {
  GITHUB_PULL_REQUEST_EVENT,
  createGitHubPullRequestObserver,
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
function response(value: unknown, status = 200): Response {
  return Response.json(value, { status });
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
  });
  test("retains explicit Conditions without using them as discovery registration", () => {
    expect(parsePullRequestSubject(condition.subject)).toEqual({
      repository: scope.repository,
      number: 215,
      pullRequestId: "github:hao1939/may-agent#215",
    });
    expect(validateGitHubPullRequestCondition(condition)).toBeNull();
    expect(createGitHubPullRequestObserver(scope)).toMatchObject({
      id: "github-pull-request",
      intervalMs: 900000,
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
    expect(calls.filter((url) => url.includes("?state="))).toHaveLength(2);
    expect(calls).toHaveLength(4);
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
  test("routes initially merged resources from recent closed discovery", async () => {
    const result = await observe(
      context(new Map([["goal/linked-pr", task("goal/linked-pr")]])),
      provider(
        new Map([[215, pullPayload(215, ownerBody(), { merged: true })]]),
      ),
    );
    expect(result.events[0].data).toMatchObject({
      merged: true,
      state: "closed",
    });
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
