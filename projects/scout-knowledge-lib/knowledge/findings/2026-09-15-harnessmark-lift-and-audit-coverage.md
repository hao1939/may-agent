<ai_context>
summary: "HarnessMark provides a useful paired design for measuring coding-agent harness lift while holding the model and tasks fixed, and its retraction of answer-leaking runs shows why transcript audits matter. At the inspected revision, however, no reference run exists for the sole current model/harness row, container grading is unverified, and the retrospective leak-audit script treats a missing transcript as clean; benchmark claims therefore need both comparability and audit-coverage receipts."
triggers: ["HarnessMark", "coding agent harness benchmark", "harness lift", "paired harness evaluation", "answer lookup", "benchmark leakage", "transcript audit coverage", "missing transcript"]
last_updated: "2026-09-15"
source_basis: "Read-only GitHub Search API discovery and pinned inspection of aliacollins/harnessmark at commit 4996796fef0e60b3905774ea0c23383875d941b8; benchmark runs were not reproduced."
</ai_context>

# Harness Lift Needs a Comparability Receipt and an Audit-Coverage Receipt

**Date:** 2026-09-15  
**Repo:** [aliacollins/harnessmark](https://github.com/aliacollins/harnessmark)  
**Inspected revision:** [`4996796fef0e60b3905774ea0c23383875d941b8`](https://github.com/aliacollins/harnessmark/tree/4996796fef0e60b3905774ea0c23383875d941b8)

## Observation

HarnessMark targets a confound that ordinary coding-agent leaderboards leave
hidden: a reported resolve rate is the product of a model and the harness around
it. Its proposed headline metric, **lift**, is the paired resolve-rate difference
between a harness and a deliberately minimal reference harness using the same
model string on the same tasks. It also records topology and cost signals such
as tool calls, delegation, re-reads, result bytes, context growth, and cost per
resolve.

The task and grading design adds several useful controls:

- tasks are harvested from behavioral commits, then validated by injecting the
  fix commit's tests at the parent commit;
- the runner captures the candidate patch instead of trusting an agent report;
- oracle tests and support files are restored before grading, while touched test
  infrastructure is restored from the parent;
- provider failures are excluded and counted separately; and
- task-set, prompt-version, telemetry-availability, and sample-size differences
  remain visible rather than being coerced into one ranking.

The project's own answer-lookup incident is especially instructive. Under an
earlier prompt version, public PR references let agents retrieve upstream answer
material. The methodology says 96 of 250 Claude Code trials and 48 DeepSeek-based
trials across reference and Pi groups reached the PR diff or post-fix source;
every one of those 48 trials resolved. HarnessMark retracted version 1/2 numbers,
redacted identifiers in prompt version 3, restricted common retrieval paths, and
added post-run command audits.
That is evidence that benchmark contamination is a measured harness behavior,
not merely a prompt-compliance assumption.

## Two receipts are required before interpreting “lift”

### 1. Comparability receipt

A paired formula is not yet a paired result. At the pinned revision, the checked-in
leaderboard contains one prompt-v3 run: Claude Code with Sonnet 5 over 50 Hono
tasks and five trials per task. It reports a 71.1% scored resolve rate over 246
non-infrastructure-failure trials, but explicitly says **“no reference”**. No lift
can therefore be computed for the only current row. The README also says the
corpus currently covers two TypeScript repositories and that containerized
grading is implemented but unverified on the development machine.

A usable comparison should retain a receipt binding at least:

`benchmark version + prompt version + frozen task set + model/provider identity +
harness configuration + grader environment + trial coverage`.

Without that binding, an absolute score remains model–harness-confounded even
when the benchmark supports a sound paired design.

### 2. Audit-coverage receipt

The post-run leak audit has a fail-open edge. In `tools/audit-leaks.mjs`, when no
transcript can be found for a result line, the script increments a missing count
but constructs a leak verdict with `clean: true`, zero scanned commands, and the
note `no transcript found`. It prints the missing count, yet a missing transcript
is not made an `answer_lookup` failure.

This does not invalidate the current row: the leaderboard reports all 246 scored
trials as audited, and this inspection did not find evidence that its transcripts
were absent. It does show that **audit cleanliness and audit coverage are
independent facts**. “No lookup detected” is meaningful only together with a
denominator proving that a parseable, complete command transcript existed for
every trial being certified. Unknown adapter formats are another coverage
boundary: the parser recognizes the supported Claude, Pi/reference, and Codex
event shapes, so adapter admission should test extraction completeness rather
than assume any JSONL transcript is observable.

A stronger benchmark verdict would fail closed or explicitly mark the trial
unscored when the required transcript is absent or unparseable, and report:

`trials expected → transcripts present → transcripts parseable → commands scanned →
trials clean / lookup / unknown`.

## Why this matters

Benchmark integrity is not one scalar. HarnessMark demonstrates three distinct
layers:

1. **outcome integrity** — oracle tests and restoration decide whether the patch
   works without rewarding test tampering;
2. **comparability integrity** — only paired, version-matched runs can isolate a
   harness contribution; and
3. **observation integrity** — leak detection needs evidence that the activity
   channel was present and understood, not just that its classifier returned no
   finding.

The reusable lesson is to publish these layers separately. A valid patch is not
proof of a fair comparison, and a clean audit result is not proof that the audit
observed the whole run.

## Evidence boundary

This run inspected repository documentation and source code at one pinned commit.
It did not execute the 250-trial benchmark, reproduce the reported rate, inspect
private provider behavior, or validate that command transcripts capture effects
outside supported harness event formats. Repository metadata and checked-in
results establish the implementation and reporting shape, not independent
benchmark efficacy.

## Primary evidence

- [README and benchmark status](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/README.md)
- [Methodology, grading, and answer-lookup retraction](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/docs/METHODOLOGY.md)
- [Current leaderboard](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/leaderboard.md)
- [Retrospective leak-audit missing-transcript behavior](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/tools/audit-leaks.mjs)
- [Supported command-transcript parsers and leak classification](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/harness/leak.mjs)
- [Oracle evaluator](https://github.com/aliacollins/harnessmark/blob/4996796fef0e60b3905774ea0c23383875d941b8/evaluator/evaluate.mjs)

## Related Scout knowledge

- [Coverage-Accounted Discovery Is the First Stage of Agent Detection](./2026-09-10-coverage-accounted-agent-detection.md) — partial observation must remain explicit downstream.
- [The Commodity Proof](./2026-07-09-hn-arxiv-github-scan-482.md#the-convergence) — prior evidence and limits around harness-level comparisons.
- [Agent Evaluation Research: Diagnostic Layers](../agent-evaluation-research-diagnostic-layers.md) — outcome correctness and trace integrity are separate evaluation layers.
