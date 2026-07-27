# Gym App

Autonomous operator for the standalone [`../gym`](../gym) benchmark project.
Gym remains runnable from its CLI without this app. This app supplies a bounded
autonomous improvement loop, reviewed-session learning intake, owner review,
exact-artifact approval, and operating metrics.

## Autonomous flow

```text
reviewed success ─────> positive learning evidence ───────────────┐
reviewed failure ─────> negative evidence + incident ─> review ───┤
new Codex sessions ───> strong Hao intent candidates ─────────────┤
                                                               learning unit
                                                                    │
manual canary wake ──> lesson-informed candidate ─> blind verification
                                                    └─> exact human approval
task workflow failure ─────────────────────────────> Gym owner fallback
```

The app does not approve ground truth, rewrite evidence, merge changes, or
expose infrastructure APIs inside the evaluated May execution. It invokes the
same standalone Gym CLI a developer or CI would use.

The automatic weekly improvement schedule remains disabled until one complete
canary cycle succeeds. The first proof uses the four cases documented in
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
request resolves to stable task intent. The task tree records ownership,
attempts, and outcomes; it does not schedule work. Known tasks bind to the
existing Gym workflows, while an unavailable or blocked workflow falls back to
the Gym owner review workflow.

## Actions

- `improve-may-now` — run one bounded improvement cycle over the approved
  four-case canary.
- `run-regression` — run `may-alignment`, optionally with `scenario` and
  `trials` parameters.
- `report-incident` — submit a May failure or human correction for intake.
- `collect-codex-learning` — backfill or incrementally collect strong Hao
  intent signals without starting May improvement.

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
