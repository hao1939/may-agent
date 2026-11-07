# Task lifecycle and responsibility — 2026-11-07

**Supports:** [Carry work through change and interruption](../../2a-design/system-model.md#carry-work-through-change-and-interruption).
**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first): one public lifecycle, existing storage authority and explicit owner judgment.

**Design status:** Accepted into the [Task contract](../../2a-design/task-resource-engine.md#state-and-continuing-responsibility), [human surfaces](../../2a-design/human-control-surfaces.md) and [Task guide](../../2b-manual/task-execution-guide/SKILL.md).
**Source status:** Paired Host and Apps candidate branches implement the changes below. Verification and exact revisions are recorded below.
**Deployment status:** Not activated. No live Task, schedule or closure was changed by this implementation.

## Decision and implementation

A Task is a durable owned responsibility with one public lifecycle:
queued (`pending`), running, waiting, attention, idle, closed, cancelled.
`done` remains for historical completion receipts. Idle replaces the ambiguous
human `up-to-date` and SDK open `done`: nothing is runnable, but an assignment
still needs a declared next responsibility or owner disposition. Attempts and
App input processing retain their own execution/result facts, including input
`done`; neither is another Task lifecycle.

Host derives public status from existing phases, readiness and terminal
controls. It adds no stored state machine or migration. SDK/human reads and
filters agree. Open counts include idle; active counts exclude it. Outcome
reporting retains idle responsibilities. A configured next schedule explains
standing work; finite idle detail calls for owner disposition. No model polling,
automatic success inference or archival controller is introduced.

Creating Tasks can close a reviewed assignment through `tasks close`,
`TaskAttempt.closeTask` or workflow `ctx.closeTask`. All use the existing
result/version-fenced close, with an additional current-caller check and immutable
creator authority in one transaction. Workers cannot self-close or close a
sibling's assignment. New input, a different accepted result or stale versions
reject closure. Exact replay preserves the same terminal decision and accepted
caller evidence. Root/App-created work retains trusted App/operator controls.
The worker result schema has no closure action.

Apps update selector eligibility, metric decision reuse and activation follow-up
for idle/closed reads. Historical status compatibility remains at those reader
boundaries. Alex and evaluator guidance identify responsibility, scoped evidence
and explicit disposition instead of treating convergence as fulfillment.

## Existing-task evaluation

The read-only November 7 Alex snapshot contained **544 records: 533 reconciled,
six waiting and five cancelled**. Two reconciled records had configured
recurrence. The 528 older finite reconciled records outside detailed review had
no retained input waits, pending events or Conditions at that snapshot. Recorded
purposes included 272 report intakes and 138 independent reviews. This explains
accumulation; it does not establish semantic fulfillment of all 528 records.

The following comparisons informed the contract and portable fixtures. Live
identities are evidence references, not test dependencies or closure authority.

| Existing example | What the existing evidence establishes | Design/implementation consequence |
| --- | --- | --- |
| Finite latency review `alex/input/app_9ad9d5ec-02b5-4b94-a105-ef6c85815694` | Supported no-change decision for alert 5013; no recorded follow-through | Idle pending owner disposition, then explicit close preserving the exact accepted result. |
| `alex/runtime/pattern-audit` | Standing audit every six hours | Idle between runs with known next schedule; do not close as a finite report. |
| Capacity recovery `alex/input/app_a8a3c687-5456-4c2e-b027-290f6572a988` | May recovery `goal/appdep_1111883e30c78e3fd09a0b0f` and original input completed, while human “retried” Condition remained | Provider completion does not fabricate Condition satisfaction. Owner reviews and retires the obsolete wait explicitly before disposition. |
| PR 361 adoption `alex/input/app_c16ddfaa-d95f-4c03-bbfa-9a89ab326132` and recovery wrapper `input/app_52f99499-9965-43d3-a38d-38db237ab919` | PR merged at `21ab8c9062dbb96a64ff55650d8e0aea2be1e2e4`, checks green, recorded reviews COMMENTED; independent approval still owed by May `goal/appdep_1df10a95ce19513a145339d4` | Preserve exact review wait. Close a duplicate wrapper only after confirming the real obligation and return path remain owned. Merge is not approval. |
| XHS containment `alex/input/appdep_81e1c85137109d62eefa493b` | Scoped exception commit `ff8df7c48354e6d02811dbd9f9f103d2bf611111` stopped a retry loop; plain fetch and ready browser session gave different access evidence | Accepted containment result is not proof of content delivery or broad access diagnosis. Keep that uncertainty in owner judgment; Host cannot infer success. |
| Branch cleanup `alex/input/app_004df513-2f74-4641-8aea-c4cce1d7b1cf` | Eleven unique AKS ref decisions remained | Retain actual external decisions and their owner; do not archive by age. |
| Monitoring `alex/input/app_5782d370-c66f-4fe1-860e-4fd6c3595f43` | External monitoring host/destination authority missing | Preserve waiting and exact missing authority. |
| Historical handoff `alex/input/app_16722bb9-58b9-46d4-a124-4f9a462c23d4` | General pipeline later worked; two exact historical deliveries remained unproved | General recovery does not prove those deliveries. Keep the exact gap or obtain authorized disposition. |

Portable Host fixtures use synthetic Apps, Conditions and evidence. They exercise
finite no-change closure, stale authority/version rejection, mixed execution and
waits, owner retirement of an obsolete human acknowledgment, preservation of a
real review wait, and scoped containment evidence. Existing recurrence fixtures
check known schedule projection and next-wake readiness/count agreement. This
is a comparison against recorded tasks and executable mechanics, not a live
agent-behavior experiment or a substantive re-audit of all historical tasks.

## Verification and paired adoption

Host base: `5ebdd45447` (`origin/main` when the candidate was created).
Host implementation: `7faa69d4206a53012f93e1ba2b4def2b0c0b76f5`, branch
`feat/task-lifecycle-responsibilities`.
Apps candidate: branch `docs/task-state-responsibilities-20261107`, including
initial design commit `610343d601` and the refinement containing this record.

Host validation on that exact source:

- `bun run ci` passed with Node 24.20.0 and Bun 1.3.14: Host and SDK typechecks,
  canonical App boundary and ESLint, then **3,885 passed, three skipped, zero
  failed** across 341 test files (3,888 cases).
- Chrome browser coverage executed, including the served Task board, exact
  selection, idle status, control routing and stale-response handling. The
  three skips are installation-specific agent configuration and fleet checks;
  they are not browser skips.
- Closure fixtures, real Task workflow/agent-tool paths and cross-App caller
  feedback passed. They preserve accepted answers, reject stale or unauthorized
  closure, and keep independent waits visible. Tests use synthetic identities
  and temporary state, not the live Alex records.
- `git diff --check` passed. No image build, model-backed behavior experiment,
  deployment or live closure was performed.

App validation:

- 132 focused tests passed across the affected evaluator and May workflows,
  including selector, public evidence, ongoing review, metric reuse and activation
  follow-up. These exercise the changed readers and prompt contract, not model
  comprehension or live task handling.
- `bun run check:may-design` passed: contracts, executable examples and canonical
  App structure. The existing unclassified root `reports` warning remains.
- Changed Markdown passed file/heading-link inspection and `git diff --check`.
- The paired final-runtime compatibility check still reports 15 pre-existing
  diagnostics across SDK admission narrowing, App error narrowing, coder evidence
  and activation event typing. Running the same check with the prior App consumer
  implementations produced identical diagnostic text after normalizing line
  coordinates. This change adds no diagnostics; the overall App typecheck is not
  green. Host's own strict SDK/Host checks are separate.

Source checks do not certify installed adoption. The App compatibility failures
above remain a separate validation limitation; they do not invalidate the
passing strict Host/SDK gate or establish that all installed Apps are compatible.

Integrate the backward-compatible App readers first: they accept both idle and
the older public labels. Then release the matching Host, SDK and generated UI
together so new status output reaches prepared consumers. Activate closure
guidance with that capability, checking availability on older installations;
existing sessions retain their definition snapshot. No installation was
activated in this work. No database rewrite or bulk closure is required.

Historical cleanup remains an owner operation: select finite nonrecurring
candidates and inspect a bounded batch of exact results, original asks, caller
links and obligations. Record fulfilled, authorized unfulfilled,
transferred-with-owner or still-needed disposition; use current guarded
controls only where authorized. Do not create 528 new review Tasks or close
records solely because their queue is empty. Guidance adoption does not prove
that the stale live waits or duplicate wrappers have been resolved.
