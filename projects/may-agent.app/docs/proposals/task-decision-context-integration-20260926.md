# Apply the Task decision-context proposal

Status: implemented and deployed to the local installation; Host PR #230 awaits
human review/merge. Date: 2026-09-26.

## Scope and implementation

The isolated proposal trials found that adding full Task JSON at entry increases
input size and can lose important facts after compaction. Refreshing a bounded
brief improved delivery, and preserving known facts when refresh failed allowed
ordinary diagnostic recovery. Those trials also showed that the baseline can
recover through normal reads and that small contexts can grow with the brief.

This implementation starts from Host `origin/main` at `4d4589a3`. It does not
depend on the unmerged communication or shared-event-history prototypes.
The candidate is `063a9f53` on `fix/task-decision-context`, proposed in
[Host PR #230](https://github.com/hao1939/may-agent/pull/230).

Changes:

1. The existing exact Task reader returns resource revision, Condition
   observations beside their definitions, and a bounded pending-input window.
   Its related reads share a synchronous SQLite snapshot. The Task-bound reader
   now forwards existing accepted-evidence read options.
2. One shared decision projection prepares assignment, accepted results and
   understanding, Conditions, open obligations, input and working references.
   Structural previews shorten large sections; exact JSON pointers resolve
   against content-addressed snapshots under the existing attempt context root.
3. The managed execution context transform adds that brief after transcript
   compaction and before each model request. Helpers use their inherited Task
   context while retaining their specific caller assignment. Briefs are not
   appended to durable conversation history.
4. Root Task execution replaces duplicate default Task JSON in model input.
   The original request remains in execution evidence and is still supplied to
   explicit App context-preparation adapters. If initial workspace discovery
   fails, the root keeps the complete inline request.
5. Refresh failure retains the last successful read, or the attempt-start
   snapshot. The brief reports the failure, snapshot scope and diagnostic read
   route. A known generation mismatch is exposed without rebinding the worker.

The Host still owns execution binding, cancellation, input accounting and
settlement. The change does not schedule another attempt, mark input handled,
retire a wait, or infer what a domain result means. Apps need no migration or
new task schema. The common contracts live in the existing
[agent context](../2a-design/agents.md#context-passing) and
[Task reader](../2a-design/task-resource-read-interface.md) documents.

## Verification

Portable regressions exercise the real reader, Task claims and settlements,
managed root/helper execution, and the production compactor. The lifecycle
fixture proves that a helper discovers retained input after a missed live hint;
a finishing-window correction survives settlement; a fresh manager reuses the
accepted output; the edit happens once; and independent approval stays open.
Reader checks preserve accepted progress while one Condition is satisfied and
another remains unknown. Projection checks cover Unicode, omitted detail,
generation mismatch, refresh failure, file failure and non-accumulating context.

Full portable CI passed on the final candidate: 3,271 passed, three explicit
installation-only skips, no failures and 15,588 assertions. Browser coverage ran.
The same revision passed GitHub Quality and Container.

The separate installation suite returned 26 passes, seven skips, seven failures
and one load error. The unchanged local baseline produced the same named failures
and totals: legacy guidance assertions, App catalog/Scout golden-trace drift and
a missing Gym helper. These are retained as existing installation-test drift;
they are not hidden by skips or a claim that every installed App is certified.

Four initial real-model trials completed with the correct schedule, inspected
output identity and retained approval: helper, compaction, large input and
automatic-refresh failure. A second iteration exposed two limitations. One
model replaced a stale-version approval wait with an overly broad future-version
wait. Another proposed retiring the wait while newer input was pending; the
existing action fence rejected it. The initial trial called settlement directly
and therefore stopped without the production attempt runner's normal recovery.
Both negative receipts remain evidence.

The next trial clarified the App assignment positively: this is a review
contribution, while the assigning owner maintains the draft and approval
Conditions. No approval-specific Host guard or Task-state change was added.
The large-input trial then preserved the existing approval. The lifecycle trial
used the production `runTaskAttempt`, not a copied settlement handler: an initial
review, an additional pass for retained live input, and a later caller follow-up
all settled successfully. Pending input was empty at the end, accepted review
evidence remained linked, and approval stayed unknown/open. The model still
performed repeated inspections and helper reviews. This demonstrates correct
continuation, not optimal execution cost or universal judgment reliability.

The initial large-input request was about 29.7 KB; later ordinary Task reads
loaded additional background, bringing total serialized requests to about
242 KB. That is a useful reminder to measure the entire run, not only the first
brief. No matched final-baseline speed or monetary saving is claimed.

Scout's live review prompted an omitted-reference trial. The first fixture (r4)
was inadequate: its required key already appeared in the initial brief, so a
correct answer did not demonstrate retrieval. The revised fixture (r5) placed
`ORCHID-42` after 30 background records and verified its absence from the first
model request. The model first followed the decision-detail file link, hit the
ordinary reader's 50 KB line limit on a 124.9 KB serialized line, then read the
existing `context.json` and `TASK.md` links. The captured tool result delivered
the key before the final review cited its provenance. All six checks passed,
including retained approval and the schedule correction. Three model requests
totaled 143,600 serialized bytes.

This proves retrieval of one omitted source reference through existing discovery
and fallback, not universal recall, a safety-critical omitted-constraint check,
or post-compaction recall. The direct detail-file read limitation remains visible;
no new tool or fallback mechanism was added. Across these implementation rounds,
ten real-model trials produced seven successful outcomes, two negative findings
and one inadequate fixture. Those counts exclude the earlier proposal trials.

Deterministic fixtures prove delivery/accounting, not agent judgment. The model
trials use an isolated synthetic App and record actual provider input; they do
not certify every deployed App workflow. Retained local evidence is under
`/app/.state/review-pilots/task-decision-context-implementation*-20260926-*/`;
the exact final index is
`/app/.state/review-pilots/task-decision-context-implementation-20260926/VERIFIED.json`.

## Local rollout and App review

The standalone deployment receipt is
`/app/projects/may-agent/.state/deploy-receipts/task-decision-context-063a9f53-20260926.json`.
It reports `succeeded`, healthy services and `duplicateDeploy: false`. Source is
`063a9f53aca93521f1355fe20f455c1f7d9d3183`; the staged artifact and both running
daemon/web executables match SHA-256
`0a3058b841414ad0f3653bd1ae2505f6e950142ae7acb30416eb94194e26e9af`.
The SDK link points to the matching version. App definitions were not changed.

Two bounded read-only reviews entered through ordinary App admission:

- May Task `goal/app_4d374d90-40ad-40ed-9a7a-102edc041d24` completed with accepted
  attempt `r_1_47f9660d-ecfa-4405-896a-a8df3876cecb`. May reviewed the source and
  ran 15 focused tests, finding no blocking change. She highlighted operating
  cost and correctly declined a general token/latency improvement claim.
- Scout Task `goal/app_6fa01f65-54b7-4ad9-8aac-e3037e99e7b2` completed through
  `knowledge-planner`, accepted attempt `r_1_e6e348a7-3822-4a82-99c2-9c642110a481`.
  Scout linked existing research on reversible context eviction and Compactdiff,
  recommended one omitted-evidence recall trial, and returned `publication:no-change`.

Both executions produced decision snapshots with their exact App/Task/attempt
binding. Live receipts are retained as `live-may.json` and
`live-scout-knowledge-lib.json` beside the final evidence index. These are two
completed deployed paths, not certification of every App or native executor.

## Reproduction and evidence

Portable checks run from the Host candidate with `bun run ci`. Focused contracts
are in `src/lib/task-decision-context.test.ts`,
`src/app/core/reads/app-read.test.ts`, and
`test/integration/task-decision-context.test.ts`.

The isolated real-model harness is retained on
`poc/task-decision-context-integration` at
`experiments/task-decision-context/pilot.ts`. It uses configured model credentials
and temporary Task storage, and captures provider requests, receipts and its own
source. From that checkout, choose a new evidence directory and run:

```sh
bun experiments/task-decision-context/pilot.ts production hidden model /tmp/task-context-hidden-trial
```

Use `large`, `lifecycle`, `helper`, `compaction`, or `missing` in place of `hidden`
for the other cases. These are separately authorized model experiments, not PR
CI. The final evidence entry point is
`/app/.state/review-pilots/task-decision-context-implementation-20260926/FINAL.md`;
`VERIFIED.json` records exact source/harness revisions, receipt hashes, trial
classifications and live review identities. Negative receipts are unchanged.

## Value, cost and limits

The value is consistent delivery of current decision facts, less duplicated
large input, and recovery that preserves what is already known. Each model
request performs an exact local Task read and prepares a small projection.
Unchanged detail content reuses the existing artifact hash. Small requests may
grow; the implementation does not promise fewer model calls or lower latency.

The brief uses structural section budgets, not semantic ranking. An omitted
section can contain important evidence; the worker must inspect it before an
action that depends on it. Large serialized detail files can exceed an ordinary
reader's line limit; the trial recovered using the separately linked attempt
context, whose freshness is limited to attempt start. Current facts still require
the scoped Task reader when the action depends on them.
The current-input reader covers 32 unclaimed events
and marks remaining input explicitly. Full Event history/navigation and
transactionally complete change evidence remain separate work.

Native executors keep their existing execution-boundary behavior. This change
refreshes managed model calls, including calls made by workflows; it does not
interrupt a long native command or grant every adapter live steering support.
Task state can change after a read. Existing execution fences and final input
accounting remain necessary.

No new scheduler, work queue, registry, universal annotation schema, ownership
lifecycle, semantic summarizer or event-sourced state reconstruction is added.
