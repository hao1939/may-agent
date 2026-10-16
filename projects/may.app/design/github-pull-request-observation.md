# GitHub pull-request observation and missed-change recovery

**Supports:** [App observation](../../alex.app/docs/2a-design/agent-app.md#request-entrypoints-schedules-and-observers): bring external facts back to unfinished work without repeated human reminders or model polling.

**Choice basis:** [Simple first](../../alex.app/docs/1-principles/core-principles.md#simple-first) and [Task-driven observation](../../alex.app/docs/2a-design/agent-app.md#task-driven-resource-observation): reuse saved Conditions, the existing provider reader and Host scheduling. No second watch registry or GitHub-specific Host logic.

Status: source implements live observation plus exact Condition checks. Installing
these definitions and upgrading retained waits are separate rollout steps; source
checks are not deployment evidence.

## Two paths, one fact

Live observation reports changes to active PRs. A saved Condition also causes a
periodic read of its exact PR, so a merge before startup or during an outage is
still discoverable. Both paths use the same parser and canonical fact source.
Neither path decides whether work is finished.

| Path | Purpose | Scope |
| --- | --- | --- |
| `github-pull-request-live` | Timely changes to active May-owned PRs | Open PR discovery and direct refresh of remembered open PRs, every 15 minutes |
| `github-pull-request` | Recover missed facts for unfinished work | Exact resources in current open Conditions, hourly and after admitted Task results |

The live path is bounded polling, not a real-time delivery guarantee. It reads
at most two newest-updated pages of **open** PRs. It does not list closed history.
Remembered open PRs remain eligible for a direct read after closure. Snapshot loss
or a resource outside discovery coverage is repaired through the saved Condition.
Without a retained interest, live delivery remains best effort.

The Host already selects and shares resource reads from saved Conditions, checks
new interests promptly, and retries on its ordinary periodic cadence. Unchanged,
unmet Conditions do not need model calls. A matching fact wakes its Task; the
agent judges what to do. `reviewAt` is a separate decision to reconsider the work,
not the polling interval. No recent event is not proof of unchanged provider state.

A merge or closure does not automatically fulfill the whole Task, approve a
release, or remove independent human/dependency waits. Occasional duplicate
consideration across the two paths or a restart is acceptable. Keep committed
effects retry-safe and prevent persistent unchanged wake loops; do not add a
second deduplication ledger.

## Saving the needed fact

Discover the installed `github-pull-request` capability through `tasks.contract`
or `read.contract("may")`. Supply an observation request such as:

```json
{
  "observerId": "github-pull-request",
  "id": "pr-state",
  "resource": "github:hao1939/may-agent#356",
  "expected": { "field": "fingerprint", "notEquals": null }
}
```

Save the returned Condition through the normal Task result or `tasks.apply`.
Construction alone saves nothing. The helper encodes `subject` as
`resource:github:hao1939/may-agent#356` and binds
`expected.source` to `app:may:observer:github-pull-request`. An initial fingerprint
interest requests a current snapshot. After judgment, retain the observed
fingerprint as the baseline if subsequent changes matter. A Task interested only
in closure can instead request `{ "field": "state", "equals": "closed" }`.
Do not infer completion from an unassessed snapshot.

The Condition supplies the exact resource and return relationship. Direct recovery
therefore does not require a PR owner block or list discovery; shared/read-only
resources in the configured repository are valid interests too. Satisfied,
removed and cancelled interests stop these reads. Host demand comes from active
`pending`, `running` and `waiting` Tasks; an old Condition on converged work alone
does not request recovery checks. A satisfied one-shot Condition
must be rearmed when the agent wants later changes. Closed Tasks stay closed.

## Live ownership convention

For ordinary May delivery, the PR body contains exactly one visible block:

```text
## May Task
- App ID: may
- Task ID: <exact existing Task ID>
```

Use the exact May delivery Task identity from current context and read back the
remote body after publishing. Preserve the block during description edits.
Code-fenced examples, duplicates, unsafe identifiers, unsupported App IDs, and
unknown or closed Tasks are not guessed. Branch names and prose are not ownership.
Ordinary `gh pr create` and `gh pr edit` remain supported. The block supplies live
routing; it does not replace a saved interest when later delivery matters.

Alex-origin work keeps its actual saved caller relationship to a genuine May
delivery Task. Do not fabricate that Task or label an Alex Task as May. The
May-scoped live observer does not interpret an `App ID: alex` owner block.

Live discovery is restricted to repository `hao1939/may-agent`, author `hao1939`
and owner App `may`. It rereads each candidate before routing, validates its
repository, number, author and owner, then reads that exact Task. It never scans
Task lists or history. Quiet unclosed owners remain eligible. Failed reads do not
reuse cached ownership. Metadata is routing information, not merge, deployment
or Task-close authority, nor proof of who last edited the body.

## Provider facts and bounded execution

The App reader uses the installation's `GH_TOKEN`, falling back to `GITHUB_TOKEN`.
With neither configured, public reads remain possible but share GitHub's smaller
anonymous quota. Credentials are attached only after fixed-origin/endpoint
validation, redirects are not followed, and credentials never enter facts,
Conditions or observer snapshots. Both paths use the same authentication policy;
the Host does not need GitHub credential logic.

Both paths read PR state, head SHA, draft/merge fields and commit-bound reviews.
They return `reviewsComplete` and any review-read error alongside independently
valid PR facts. They **do not collect CI checks, unresolved review threads or
branch-protection decisions**. Agent guidance must not promise those fields;
read them separately when required for a delivery decision.

The fingerprint excludes fetch time. Live facts include the same `resource` and
source as direct observation, so either path can satisfy a new-style Condition.
Live publication follows meaningful provider and owner changes; adding or
rearming resource demand is served by the dedicated Condition check and does not
reset live suppression. The event journal idempotency key includes recipient,
Task generation, provider revision and fingerprint. Payload version
`github-pr:v2` adds resource correlation without reusing an old key for different
bytes. Existing wait-scoped snapshots remain readable and can cause one bounded
migration consideration before the stable live key is retained. This is not a
guarantee of exactly-once judgment. Fetch time remains diagnostic metadata.

The live pass shares eleven HTTP requests across discovery, PR reads and at most
four review pages per PR. Its 64-candidate capacity reserves 32 places for
remembered open PRs, walks them fairly in PR-number order, and reports overflow.
These are live-discovery coverage limits, not limits on durable Task interests.

The direct path uses the Host's bounded four-resource batches. Each exact read
uses at most five HTTP requests (PR plus four review pages), with a 15-second
per-request deadline and a 75-second overall cancellable read. This is a separate
bounded path, not a promise that all App traffic fits the live pass's eleven
requests. The shared provider client honors GitHub rate-limit deferral across
both paths. Deferral memory is disposable; restart can retry and learn the
provider's current limit again.

Numeric repository aliases in GitHub pagination links supply only a page hint.
The adapter validates origin, endpoint shape and query parameters, and rebuilds
the request under the configured named repository. It never follows an arbitrary
repository URL. Redirects, unsafe integers, duplicate parameters, repeated pages
and excessive review pages remain errors.

Provider failure leaves the wait intact. The Host retains failed direct checks
and observer health; May's existing failure subscription accepts both live-run
failures and failures from its exact declared GitHub observation source. Repeated
identical failures are suppressed within the observer generation. Partial review
failure retains valid PR state and an explicit evidence gap. It is not unchanged
or complete work. No automatic merge, incident service or escalation is added.

## Upgrading existing waits during rollout

The legacy `pull-request:github:...` Condition only matches live events; it has no
source-bound resource interest for the Host to inspect. Keep it readable during
transition. The pure `upgradeGitHubPullRequestCondition` helper converts that
subject and adds the declared source while preserving the Condition ID,
expectation, requested action and independent fields. It performs no storage write
or agent judgment. Prefer saving its result through the current Task's ordinary
fenced change/result path, preserving other Conditions.

Before rollout, inspect unfinished delivery Tasks and their exact PRs. Activate
the compatible definitions before asking an owner to retain the new format; the
old validator does not accept it. Legacy live delivery remains supported during
this transition. Verify relevant retained waits actually upgraded: an unchanged
fact can leave an owner's existing Condition untouched. Do not call activation
alone complete recovery coverage. If a Task has no PR Condition, its owner
must decide and retain the needed interest; a public owner block alone cannot
provide recovery after a lost notification. Do not revive fulfilled requirements
or manufacture waits for every historical PR. Verify the current baseline when
rearming an already-satisfied interest.

At the October 15 review, open PRs #352, #353, #354 and #356 had legacy PR
Conditions, while #355 did not; #352's initial-snapshot Condition was already
satisfied. These are rollout leads, not authority to change those Tasks blindly.
Re-read them before migration because ongoing agents can change their state.

For a mechanical operator migration, use the Host's fenced resource-store commit
with an exact saved before/after plan, never raw SQL writes or a fabricated agent
attempt. Only migrate an unsatisfied wait on an inactive waiting Task. Recheck the
complete Task, Condition and exclusive link in the same transaction; reject drift
or an active attempt. Preserve the predicate, owner, requested action, Task,
input waits and other Conditions. A representation-only conversion retains the
logical Condition generation and observation, and advances its resource version;
changing the generation alone would strand saved input-wait references. Predicate
changes or rearming satisfied interests belong to ordinary owner judgment.

Such a format migration does not emit a pretend Task result or force a model call.
The periodic observer discovers it on its next due check. Verify both the stored
interest and a subsequent read; distinguish eligibility from observed recovery.
Keep the plan and migration receipt so rollback can be reviewed against current
state rather than restoring a stale database over subsequent work.

The [October 15 local trial](../docs/github-pr-condition-recovery-trial-2026-10-15.md)
records actual activation, native owner behavior and separate provider-backed
recovery checks.

## Validation

Unit regressions cover shared Condition matching, live open-to-closed observation,
already-merged exact reads, safe numeric pagination, ownership, bounded traversal,
provider deferral, cancellation and failure admission. Run both composition trials
from the Apps root against an explicit Host checkout:

```sh
HOST_CANDIDATE=/app/projects/may-agent APP_CANDIDATE="$PWD" \
  bun projects/may.app/scripts/github-pull-request-composition.ts /tmp/pr-live.json
HOST_CANDIDATE=/app/projects/may-agent APP_CANDIDATE="$PWD" \
  bun projects/may.app/scripts/github-pull-request-recovery-composition.ts /tmp/pr-recovery.json
```

The first uses May's live observer and subscription. The second uses the production
App resource detector and existing Host fixture Apps to prove saved interests,
shared reads, a merge during downtime, failed-publication retry, same-Task delivery,
quiet unchanged checks and stopping reads after interest removal. HTTP and agent
judgment are fixtures. These trials do not establish live deployment, migrated
production waits or native-agent comprehension.
