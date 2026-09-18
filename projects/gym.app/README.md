# Gym App

**Integration status (September 18):** This README describes the legacy Gym
implementation and its source defaults. Gym is not loaded in the inspected May
installation. Use the [report-driven improvement proposal](design/report-driven-improvement.md)
for the proposed current-Task integration and final human approval boundary;
do not infer live training from the schedules described below.

Autonomous operator for the standalone [`../gym`](../gym) benchmark project.
Gym remains runnable from its CLI without this app. This app supplies a bounded
autonomous improvement loop, reviewed-session learning intake, owner review,
exact-artifact approval, and operating metrics.

Start with [`design/may-training-program.md`](design/may-training-program.md)
for the app contract. The learning content and truth boundaries are defined in
[`design/may-deputy-learning-curriculum.md`](design/may-deputy-learning-curriculum.md).

## Autonomous resource model

```text
timer or domain event
  -> wake the affected task resource
  -> reconcile its desired state from durable evidence
  -> save proof
  -> stop, wait, or emit a domain event that wakes another resource
```

Gym has no central scheduler task or app-specific pipeline state machine.
`improve/may`, Codex learning intake, Telegram field review, design-alignment
review, and bounded incident/review tasks each own their target and reconcile
independently. Workflows are learned reconciliation procedures, not durable job
state.

The app does not approve ground truth, rewrite evidence, merge changes, or
expose infrastructure APIs inside the evaluated May execution. Improvement
workflows call the same typed Gym loop used by the standalone project; bounded
regression tasks may invoke its CLI and preserve the resulting run pointer.

The daily improvement refill is enabled. It wakes the stable `improve/may`
resource, which drains approved learning material until it is exhausted or an
exact approval or authority boundary is reached. Human requests, May-owned
metric breaches, exact approvals, and May revisions wake the same resource
immediately. Once exhausted, unchanged daily wakes are cheap no-ops. The
focused canary remains documented in
[`../gym/benchmarks/may-alignment/CANARY.md`](../gym/benchmarks/may-alignment/CANARY.md).

Every reviewed May session is preserved as idempotent positive or negative
learning evidence. Curated evidence becomes a versioned learning unit with a
lesson and practice material. Candidate builders may see that learning packet,
but withheld transfer answers and release labels stay hidden. Adding a later
issue means adding evidence and a learning unit or extending one, then rerunning
development, release, and regression benchmarks; expensive retraining is never
triggered merely by evidence intake.

Codex learning intake runs independently from May improvement. A one-time
backfill and daily incremental pass review only new Hao-authored turns. The
semantic extractor keeps explicit, repeated, or independently validated
preferences, corrections, requirements, and meaningful decisions. It discards
ordinary task requests and weak inference. Raw turns remain in Codex storage;
Gym stores hashes, source pointers, and plain-language candidates under ignored
state. Every changed catalog is checked against the May deputy curriculum and
accepted May-agent design. The review records whether each candidate is
supported, needs revision, conflicts, or belongs outside deputy learning.
Intake never changes May or benchmark truth directly.

Events wake reconciliation. Each incident, regression request, and review
request resolves to stable task intent. Task resources hold desired and observed
state; the generated tree only presents their ownership and relationships.
Known tasks bind to existing Gym workflows. An unavailable named workflow stays
visible in `attention` until its binding is repaired; the Host never silently
substitutes the owner or another workflow.

A daily design-alignment event also wakes one stable, read-only Gym owner task.
It compares accepted May behavior, benchmark truth, and deputy-learning
curriculum with observed sessions and Gym evidence. It stays quiet when aligned
and proposes the smallest domain repair when it finds a real gap. Host,
scheduling, delivery, or runtime defects are reported to their owning App.

## Actions

- `improve-may-now` — run one bounded improvement cycle over the approved
  autonomous learning tracks.
- `run-regression` — run `may-alignment`, optionally with `scenario` and
  `trials` parameters.
- `report-incident` — submit a May failure or human correction for intake.
- `collect-codex-learning` — backfill or incrementally collect strong Hao
  intent signals without starting May improvement.
- `review-telegram-field` — review a bounded set of completed May Telegram
  conversations for strong reusable evidence.

Generated incident packets, run pointers, candidate checkpoints, reviews, and
operating metrics live under the ignored `projects/gym.app/.state/` directory.
Metrics cover valid-run rate, model-trial/runtime cost proxies,
time-to-classification, accepted proposals, and prevented regressions.
Benchmark definitions and human-approved labels remain under `projects/gym/`.

## Development

```bash
cd /app/projects/gym.app
bun run check
```
