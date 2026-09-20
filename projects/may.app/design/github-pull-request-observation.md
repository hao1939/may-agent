# GitHub pull-request observation

Status: local source candidate; do not activate before supervisor review.

PR215 exposed a missing producer, not a failed Condition matcher or timer. Its
Task waited for exact conversation text while GitHub merged the PR, and the
loaded May App had no GitHub observer. The six-hour fallback had not elapsed.

May now declares the `github-pull-request` AppObserver. A Task opts in with one
durable structured Condition:

```json
{
  "id": "github-pr-215",
  "type": "may.github.pull-request.state",
  "subject": "pull-request:github:hao1939/may-agent#215",
  "expected": {
    "provider": "github",
    "repository": "hao1939/may-agent",
    "field": "fingerprint",
    "notEquals": null
  },
  "owner": "app:may",
  "reviewAfterMs": 21600000
}
```

`null` asks for the first current observation, including an already-merged PR.
After judging it, May may replace the Condition with the observed fingerprint as
`notEquals`. That durable baseline survives App reloads and suppresses unchanged
owner work. The observer's small snapshot only suppresses duplicate publication
between reloads; it is not authoritative state.

The observer paginates all current May Tasks, reads exact Task detail, and follows
only canonical Condition subjects. It never extracts repository or PR identity
from outcome prose, requested actions, old results, or GitHub-wide searches.
Runs occur every fifteen minutes and spend at most eleven actual HTTP requests,
not merely a PR-count allowance. A persisted round-robin cursor advances only
over examined interests, so budget or provider deferral cannot repeatedly starve
later work. This is at most 44 requests in four ordinary hourly runs, below the
anonymous GitHub allowance. Exact PRs are deduplicated within a pass.

Each HTTP call has a timeout and disables automatic redirect following. The only
permitted endpoints are the fixed HTTPS `api.github.com` PR URL and that exact
PR's reviews URL; pagination accepts only one `per_page=100` and an optional
positive `page`. Off-origin, wrong-repository/path, extra-query, repeated-page,
and redirect responses are rejected before another request. `Retry-After` and
rate-limit remaining/reset headers persist a no-request deferral until a safe
time. Review pagination is complete through ten 100-item pages when the shared
HTTP budget permits, or is published explicitly as incomplete with the failure;
valid PR merge/state/head facts and already parsed review pages remain usable.

A successful fact includes provider, repository, number, canonical PR identity,
head SHA, open/closed state, draft flag, merge flag/time/SHA, and each review's
state and reviewed commit. Required provider identity, state, booleans, head, and
nullable merge fields are type-checked; an unknown or missing state is not
invented as closed. The fingerprint covers meaningful PR/review facts and review
completeness, not acquisition time or a changing error string. Review state
remains tied to its reviewed commit, so an old-head approval is not represented
as approval of a new head.

Before publication the observer rereads the exact Task and Condition signature.
A result acquired for a replaced wait is discarded. Host `.state` freshness then
fences journal replay by the event envelope timestamp. Fetch failures, timeouts,
rate limits, malformed provider results, and incomplete review pagination produce
a non-matching `may.github.pull-request.read-failed` fact and warning; they neither
satisfy nor remove the PR Condition. A review-only failure does not discard the
independently valid PR state, merge, or head fact.

Disposable suppression memory stores ordinary typed JSON publication states for
at most 128 recently observed live Conditions. The 500-interest regression stays
below the SDK's 64 KiB snapshot ceiling; evicted entries may publish once again,
while retained unchanged success and failure entries stay quiet. This bounded
cache is only a replay/noise optimization. The Condition's exact SHA-256 baseline
remains the authoritative unchanged-state fence across reloads and beyond the
cache window.

The observation is evidence, not approval. May must compare it with current
acceptance and authority, retire only the obsolete linked Condition with a
fenced same-Task action, preserve unrelated human or external Conditions, and
finish or rearm as appropriate. The observer never merges, deploys, closes a
Task, or sends a human message. Human replies and periodic review remain
independent fallback routes.

## Value and limits

This small App-local adapter removes phrase-dependent merge discovery without a
new registry, queue, scheduler, or Host API. Its ongoing cost is bounded GitHub
API traffic and maintenance of one provider parser. Periodic manual checking is
simpler but does not meet automatic observation; a Host change is unnecessary
because scoped Task list/get, AppObserver publication, and existing Condition
matching already provide the route.

A bounded local live trial may call the production reader for the already-merged
public `hao1939/may-agent#215`. It can prove current connectivity and parsing only.
It cannot prove an open-to-merged transition, live owner reconciliation, approval,
deployment, or production activation, and must not write the live database or
create/merge a PR.
