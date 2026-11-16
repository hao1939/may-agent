// Portable provider fixture only; no live HTTP, credentials, writes or judgment.
export function githubPullRequestFixture() {
  const repository = "hao1939/may-agent";
  const at = "2026-11-16T10:00:00Z";
  const pull = {
    number: 215,
    body: "## Task\n- App ID: alex\n- Task ID: delivery/change\n",
    user: { login: "hao1939" },
    state: "open",
    draft: false,
    merged: false,
    merged_at: null as string | null,
    merge_commit_sha: null as string | null,
    head: { sha: "a".repeat(40) },
    updated_at: at,
    base: { repo: { full_name: repository } },
  };
  const fixture = {
    repository,
    at,
    pull,
    calls: [] as string[],
    checks: [] as Record<string, unknown>[],
    statuses: [] as Record<string, unknown>[],
    reviews: [] as Record<string, unknown>[],
    comments: [] as Record<string, unknown>[],
    reviewComments: [] as Record<string, unknown>[],
    override: undefined as
      | undefined
      | ((
          url: URL,
          init?: RequestInit,
        ) => Response | Promise<Response> | undefined),
    fetch: undefined as unknown as typeof fetch,
    check(id = 1, conclusion: string | null = "failure") {
      return {
        id,
        name: "verify",
        status: conclusion === null ? "in_progress" : "completed",
        conclusion,
        head_sha: pull.head.sha,
        details_url: `https://github.com/${repository}/actions/runs/${id}`,
        completed_at: conclusion === null ? null : at,
      };
    },
    comment(id = 1, body = "Please cover the failure case") {
      return {
        id,
        user: { login: "reviewer" },
        body,
        created_at: at,
        updated_at: at,
        html_url: `https://github.com/${repository}/pull/215#issuecomment-${id}`,
      };
    },
    status(id = 2, state = "pending") {
      return {
        id,
        context: "legacy-ci",
        state,
        description: "Provider status",
        target_url: null,
        updated_at: at,
      };
    },
  };
  fixture.fetch = (async (input, init) => {
    const url = new URL(String(input));
    fixture.calls.push(url.href);
    const overridden = await fixture.override?.(url, init);
    if (overridden) return overridden;
    const path = url.pathname;
    if (path.endsWith("/pulls") && url.searchParams.has("state"))
      return Response.json([pull]);
    if (path === `/repos/${repository}/pulls/215`) return Response.json(pull);
    if (path.endsWith("/reviews")) return Response.json(fixture.reviews);
    if (path.endsWith("/check-runs"))
      return Response.json({
        total_count: fixture.checks.length,
        check_runs: fixture.checks,
      });
    if (path.endsWith("/status"))
      return Response.json({
        sha: pull.head.sha,
        total_count: fixture.statuses.length,
        statuses: fixture.statuses,
      });
    if (path.endsWith("/issues/215/comments"))
      return Response.json(fixture.comments);
    if (path.endsWith("/pulls/215/comments"))
      return Response.json(fixture.reviewComments);
    throw new Error(`Unexpected fixture endpoint: ${url.href}`);
  }) as typeof fetch;
  return fixture;
}
