# GitHub pull-request ownership and observation

Status: local source candidate; activation requires supervisor clearance.

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

PR authors obtain the exact Task identity from current context, include the block
in the initial body, preserve it during description polishing, and read the final
remote body back. Ordinary `gh pr create` and `gh pr edit` remain usable. There is
no registration command, watch registry, mandatory helper, or special Condition.

This implements the accepted resource-ownership convention in
`projects/may-agent.app/docs/2a-design/agent-app.md`: Conditions describe what a
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
budget. A failure on a later page or state is reported as incomplete coverage;
already valid discoveries are still serviced with the remaining budget. The
observer then directly reads candidate PRs before routing, because list responses
are not authoritative for body, author, merge, or review state. The
direct response must match repository, number, configured author, and one valid
owner block. Only then does the observer perform `tasks.get(exactTaskId)`; it
never scans Task lists or history. Quiet unclosed owners, including status
`done`, remain valid. Unknown and closed owners do not receive events.

Open resources are remembered in a bounded disposable snapshot and refreshed
even after leaving the newest list page, so closure remains observable. Owner
metadata is re-read every time: removal or change invalidates the old route, and
a failed direct read never targets a cached owner. Recently closed resources can
therefore produce an initially merged observation. Snapshot loss can re-publish
facts and resources outside the two newest pages/cache can be missed; this is a
bounded observer, not complete GitHub history.

## Facts, budgets, and coexistence

The observer shares an eleven-request pass budget across up to four discovery
reads, direct PR reads, and review pagination. A round-robin cursor gives admitted
remembered and newly discovered candidates progress over later passes. The
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
owner even if provider state is unchanged. Incomplete reviews produce a targeted
review diagnostic while preserving independently valid PR state. Direct-read or
ownership failure is logged but is not targeted using stale ownership.

Host publication remains generation-fenced and commits `nextObservation` only
with successful publication. Targeted facts enter ordinary same-Task admission:
a busy owner retains input, while a quiet owner can wake. They do not create,
remove, or satisfy independent human/dependency Conditions. May rereads current
Task state and decides what changed.

## Verification and limits

Unit regressions cover the prior gap (a quiet `done` owner with only a human
Condition), initial merged and open-to-merged state, unchanged suppression,
metadata removal/change, closed/unknown/cross-App/untrusted owners, partial
reviews, request bounds, memory, and deferral. The composition trial uses the
production App observer, provider parser, Host event bus, persistence, targeted
admission, and Task reconciler against an isolated database with mocked GitHub
HTTP. It asserts same-Task delivery, unchanged suppression, and preservation of
the unrelated human Condition without any PR Condition.

The fixture does not prove a real GitHub write, merge, credential path, or native
agent judgment. A native May authoring trial should prepare the exact body through
ordinary guidance and feed those bytes into the composition fixture. A real live
transition is reported only if a genuine in-scope pending PR exists; no dummy PR,
fabricated approval, or test-only merge is permitted.
