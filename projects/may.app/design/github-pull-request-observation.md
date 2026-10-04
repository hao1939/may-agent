# GitHub pull-request ownership and observation

**Supports:** [App observation](../../alex.app/docs/2a-design/agent-app.md#request-entrypoints-schedules-and-observers): return meaningful provider facts to accountable work without repeated supervision.

**Choice basis:** [Simple first](../../alex.app/docs/1-principles/core-principles.md#simple-first) and [safe retry ownership](../../alex.app/docs/2a-design/system-boundary.md#retry-and-recovery-ownership): reuse the event journal's idempotent admission.

Status: observer implemented; this companion adds durable republication identity.
See the [source follow-up](token-efficiency-proposal-20261002.md#october-3-source-follow-up)
for validation and integration. Source changes are not deployment evidence.

## Public ownership convention

Ordinary May delivery records its owner on the GitHub resource itself. A PR body
contains exactly one visible block:

```text
## May Task
- App ID: may
- Task ID: <exact existing Task ID>
```

The heading and both fields must each occur once in the block. Code-fenced
examples, duplicates, missing fields, unsupported App IDs, unsafe identifiers,
and unknown or closed Tasks are rejected rather than guessed. Task IDs are
opaque; branch names and free prose are not ownership. The block contains no
secret, local path, Task prose, or session identity.

PR authors obtain the exact May delivery Task identity from current context,
include the block in the initial body, preserve it during description polishing,
and read the final remote body back. Ordinary `gh pr create` and `gh pr edit`
remain usable. There is no registration command, watch registry, mandatory
helper, or special Condition.

An Alex development Task ends at its local candidate and is not directly owned
or observed by this May-scoped observer. If separately authorized publication
of an Alex-origin candidate is assigned to a genuine May delivery Task, the
block names that May delivery owner. The originating Alex Task is preserved by
its actual saved caller/request relationship with the delivery work, not by a
second PR ownership block. `## Task` with `App ID: alex` is unsupported and is
rejected. Without a real May delivery Task, a publisher must not invent a May
identity or claim observer routing.

This implements the accepted resource-ownership convention in
`projects/alex.app/docs/2a-design/agent-app.md`: Conditions describe what a
Task awaits; they do not subscribe resources to observers. Explicit PR Conditions
remain a valid matching contract for exceptional shared/read-only resources, but
this observer does not enumerate Tasks to discover ordinary PRs.

## Discovery and trust boundary

`app.ts` configures one local trusted scope: repository `hao1939/may-agent`, PR
author `hao1939`, owner App `may`, and project `may`. Author filtering bounds the
controlled-writer surface; it is not cryptographic proof of who last edited a
body. Metadata routes evidence only. It grants no approval, provenance, merge,
deployment, Task-close, or Condition-satisfaction authority.

Each fifteen-minute pass reads at most two newest-updated pages for each state
(open and recently closed): up to four discovery reads from the shared request
budget. Successful empty list reads are an ordinary empty observation. If every
attempted list read fails before any valid page is available, the run rejects so
the Host's existing `app.observer.failed` producer records that discovery was
unavailable; it must not commit the same snapshot as a successful empty run. A
rate-limit response instead records the existing provider deferral and returns
normally, and the next eligible pass retries without an incident service. A
failure on a later page or state is reported as incomplete coverage; already
valid discoveries are still serviced with the remaining budget. The observer
then directly reads candidate PRs before routing, because list responses
are not authoritative for body, author, merge, or review state. The
direct response must match repository, number, configured author, and one valid
owner block. Only then does the observer perform `tasks.get(exactTaskId)`; it
never scans Task lists or history. Quiet unclosed owners, including status
`done`, remain valid. Unknown and closed owners do not receive events.

Open resources are remembered in a bounded disposable snapshot and refreshed
even after leaving the newest list page, so closure remains observable. Owner
metadata is re-read every time: removal or change invalidates the old route, and
a failed direct read never targets a cached owner. Recently closed resources can
therefore produce an initially merged observation. Snapshot loss can retry
publication of the same durable fact without another owner attempt. Resources
outside the two newest pages/cache can be missed; this is a bounded observer,
not complete GitHub history.

## Facts, budgets, and coexistence

The observer shares an eleven-request pass budget across up to four discovery
reads, direct PR reads, and review pagination. A round-robin resource-identity checkpoint (with a legacy positional fallback)
walks candidates in stable PR-number order, separate from the recency order used
for bounded memory retention. Thus refreshing memory cannot reorder traversal or
starve continuously admitted remembered or newly discovered candidates. The
64-resource candidate capacity reserves 32 positions for previously remembered
open PRs; current newest-first discoveries fill the rest. Excess discoveries are
reported as incomplete capacity coverage. Open-resource memory retains the 32
most recently admitted/observed entries and explicitly reports older eviction.
Thus every retained resource remains eligible for refresh, while more than 32
simultaneously remembered open PRs can be evicted and later missed if they also
fall outside both two-page discovery windows. Compact publication markers are
bounded separately. Rate-limit deferral prevents calls until the recorded time.
URL, redirect, identity, required-field, safe-integer/duplicate pagination and
review-page validation remain fail closed.

A successful `may.github.pull-request.state` fact contains repository/number,
head, open/closed and merge state, and commit-bound reviews. Its fingerprint
covers meaningful provider facts, not fetch time. Owner identity is part of the
suppression key, so moving a valid block routes a fresh observation to the new
owner even if provider state is unchanged.

Published facts use the existing event idempotency key, derived from owner Task
and generation, resource, GitHub `updated_at`, semantic fingerprint, and current
PR Condition specification identities. A newly declared Condition can therefore
receive a fresh observation without provider change. Observation timestamps and
resource versions do not renew that identity. Durable replay survives reload or
restart even when the observer snapshot was lost. Provider `updated_at` is
required; it distinguishes an observed A → B → A transition from a replay of A.
It is provider revision evidence, not a guarantee of complete transition history.
A changed revision after lost memory may cause one fresh delivery even if the
selected fields are unchanged; it does not create a recurring unchanged wait.

Published payloads omit local `fetchedAt` so retries retain identical bytes;
the event envelope records observation time and the direct reader retains fetch
time for diagnostics. This adds no delivery registry or agent bookkeeping.
Incomplete reviews produce a targeted review diagnostic while preserving
independently valid PR state. Direct-read or
ownership failure is logged but is not targeted using stale ownership.

Host publication remains generation-fenced and commits `nextObservation` only
with successful publication. Targeted facts enter ordinary same-Task admission:
a busy owner retains input, while a quiet owner can wake. They do not create,
remove, or satisfy independent human/dependency Conditions. May rereads current
Task state and decides what changed.

May explicitly subscribes to its Host-produced `app.observer.failed` facts and
normalizes them into the ordinary message/Task path with the exact observer ID,
error, and original Event. This is the accountable owner policy for total
discovery failure. May verifies current evidence and allows normal retry and
recovery; one failure fact is neither proof that a GitHub operation failed nor
a reason to create an incident or human escalation. Partial review failure keeps
the valid PR state and emits the typed targeted
`may.github.pull-request.read-failed` evidence. A partial discovery window keeps
valid discoveries usable and reports its bounded coverage warning.

## Verification and limits

Unit regressions cover the prior gap (a quiet `done` owner with only a human
Condition), initial merged and open-to-merged state, unchanged suppression,
metadata removal/change, closed/unknown/cross-App/untrusted owners, successful
empty versus total failed discovery, recovery, partial reviews, request bounds,
memory, deferral, and May's exact generic-failure subscription. The composition
trial uses the production App observer, provider parser, Host event bus,
persistence, targeted admission, and Task reconciler against an isolated
database with mocked GitHub
HTTP. It asserts same-Task delivery, unchanged suppression, and preservation of
the unrelated human Condition without any PR Condition.

The fixture does not prove a real GitHub write, merge, credential path, or native
agent judgment. A native May authoring trial should prepare the exact body through
ordinary guidance and feed those bytes into the composition fixture. A real live
transition is reported only if a genuine in-scope pending PR exists; no dummy PR,
fabricated approval, or test-only merge is permitted.
