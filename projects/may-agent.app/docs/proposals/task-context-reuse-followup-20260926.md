# Task context: reuse and smaller presentation changes

**Status:** Completed: 68 matched executions plus a separate six-run field check.
Evidence verified. No production
source or deployment changed. This follows the
[60-run comparison](task-decision-context-behavior-comparison-20260926.md) and
preserves its failures.

## Why this comparison

The preceding trial showed fewer model calls and less serialized input, but no
overall behavioral improvement. In two candidate runs, the full matching accepted
review and the reuse instruction were visible; the worker still created another
review. More metadata or a missing-context guard would not explain that failure.

The fixture asked the worker to “record a new review,” then gave a reuse exception.
The creation tool also said to reuse an existing review without specifying who
performs that reuse. Its implementation always creates a receipt and replaces
the file. One failed run later described expecting the tool to reuse the receipt.
This suggests an ambiguous action contract; it does not establish the model's
internal cause or rule out sampling effects.

## What was compared

| Version | Difference |
| --- | --- |
| Baseline | Host `4d4589a3`, original fixture instructions |
| Optional discovery | Baseline with only the mandatory `TASK.md` read changed to on-demand discovery |
| Current candidate | Host `063a9f53`, original fixture instructions |
| Clear App/tool wording | Same candidate, with compare/reuse/create wording and an accurate creation-tool description |

The clearer wording asks the worker to compare the accepted review with current
evidence, return its receipt when it still fits, and create one new review when
it is missing or no longer fits. The tool explicitly states that each call
creates a new receipt and replaces the file. The implementation, other tools,
model and fixtures are unchanged within each contrast. This tests a combined
App-assignment/tool-description change; it cannot identify which of those two
sentences matters more. It adds no Host reuse decision or rejection rule.

The frozen plan contains 68 model executions: four versions, five unchanged-reuse
fixtures, and three fixtures each for changed evidence, fresh work, helper calls
and compaction. The changed-evidence case is new: the accepted review refers to
the same draft version, but a newer official date requires a replacement review.
The other cases retain the preceding experiment's definitions.

Two fixture groups run concurrently, with rotating version order within each
group. Each run uses the configured `gpt-5.6-sol`, production Task runner and
readers, isolated SQLite/files, normal helper calls, compaction and settlement.
Limits remain three immediate attempts, 24 model calls and 180 seconds, with a
240-second external limit. Later timed recovery is outside this experiment.

## Results

All 68 runs completed within their bounds, with matching fixture checks and
verified source/harness hashes, provider responses, usage, actions and receipts.
Every run retained its independent approval obligation, settled within the
observed attempts, and made no publication or unnecessary human request.

| Measure, 17 runs per version | Baseline | Optional discovery | Current candidate | Clear wording |
| --- | ---: | ---: | ---: | ---: |
| Correct final core review fields | 17 | 17 | 17 | 16 |
| Full artifact/action contract checks | 15 | 15 | 15 | 16 |
| Unchanged accepted reuse, out of 5 | 5 | 4 | 4 | 5 |
| Changed-evidence review, out of 3 | 3 | 3 | 3 | 2 |
| Fresh review, out of 3 | 3 | 3 | 3 | 3 |
| Helper review, out of 3 | 3 | 3 | 3 | 3 |
| Compaction and retained-input handling, out of 3 | 1 | 2 | 2 | 3 |
| Model calls | 136 | 114 | 90 | 92 |
| Serialized request bytes | 7,574,755 | 5,727,339 | 4,345,716 | 5,007,248 |
| Model-requested Task lookups | 52 | 33 | 11 | 19 |
| Model-requested file reads | 87 | 72 | 51 | 79 |
| Mean observed seconds | 36.9 | 29.9 | 24.4 | 25.7 |

Optional discovery saved 16% of calls; the full candidate saved 34% relative to
baseline and 21% relative to optional discovery. The one-line change accounts for
22 of the 46 fewer calls in this cohort. The full change saved more, especially
for helpers: 62 baseline calls, 50 with optional discovery, and 32 with the
candidate. This separates the one-line change from the rest of the PR, but does
not isolate each remaining reader/prompt/refresh change from the others.

Clearer wording used two more calls and 15% more serialized input than the
unchanged candidate. It improved the observed reuse decisions without proving a
net cost saving. Provider-reported total tokens were 977,155 / 767,832 / 641,659 /
734,973 respectively. Cache-read and cache-write composition differed substantially
(e.g. baseline cache writes 194,040 versus candidate 368,913); monetary savings
remain unverified.

### What failed

- Baseline `compaction-0` and `compaction-1` first saved the old Wednesday review
  with `needsRevision=false`, then learned the correction and saved a replacement.
  Optional discovery also did this in `compaction-1`. Final correctness does not
  erase the earlier stale effect or its redo cost.
- Optional discovery `reuse-3` and candidate `reuse-2` replaced an unchanged
  accepted review. Candidate `compaction-1` wrote correct Friday findings in its
  first attempt, then repeated the same review in the retained-input attempt.
  Those candidate failures reproduce the preceding cohort's behavior.
- Clear wording made the right create-versus-reuse decision in every run, but
  `stale-reuse-2` wrote Wednesday into `review.day` while its prose correctly
  identified Monday as authoritative and marked revision required. The accepted
  result even contained a separate authoritative Monday schedule. The correction
  was fully visible; it was not lost.

The last case remains failed under the frozen criterion that `day` names the
authoritative day. Its schema merely says string and gives no field description;
reviewing an unchanged Wednesday draft can plausibly produce an observed-day
interpretation. That ambiguity limits attribution of the failure to model
judgment. We did not retroactively change the field criterion or rerun the failed
case to replace its result. The separate check below investigates it explicitly.

All extra issue labels were grounded in the draft/official-day mismatch. The
original exact-ID checker remains in receipts and scored 9/17, 9/17, 10/17 and
11/17. The primary assessment was defined before this cohort to permit grounded
extras while checking actions, required obligations, accepted state and artifact
identity. The root reviewer inspected the exceptions against actual evidence;
this follow-up did not add another blinded model judge. Objective scores and the
review record are both retained.

### What this establishes

This repeats the efficiency finding and shows the small discovery change captures
only part of it. The candidate avoided the observed stale-date writes, while
accepted-result reuse remained unreliable under the original wording. Clearer
wording had a better observed action result, with an additional field-meaning
problem and some extra reads. None establishes population-level reliability: the
exploratory paired acceptance tests are all `p = 1.0`, and repeated synthetic
templates with one model are limited coverage. This trial omits the preceding
cohort's mixed-failure and failed-refresh cases; their prior evidence remains
separate.

### Separate field-meaning check

A six-run exploratory comparison holds the clear assignment, tool effects and
Host constant. Its only treatment is a description for `record_review.day`:
“the current authoritative schedule day the draft should use,” even when the
inspected draft says another day. Three fresh changed-evidence fixtures per arm
compare the original schema with the described schema. The hypothesis and bounds
were saved before those runs; they are additional evidence, not replacements.

Both schemas passed all three fresh fixtures: original schema used 11 model
calls, explicit description used 10. The earlier field failure did not recur, so
this check does **not** establish that the description improves behavior. It
documents the intended meaning at negligible complexity, but a claim that it
“fixed” the earlier outcome would overstate the evidence. All six runs and the
original failed case remain retained. The field experiment source is `d3be8c08`;
its independent manifest and verified scores live under `fields/`.

## Interpretation and common guidance

Keep PR #230 scoped to current factual context and its demonstrated efficiency
benefit. Retain optional discovery within it; replacing the full change with that
one line loses observed savings and the explicit refresh contract. The current
evidence does not justify adding a Host duplicate-work guard or promising improved
overall judgment.

Adopt the low-cost authoring guidance: express compare/reuse/create as the worker's
decision; describe tool effects accurately; define ambiguous result fields. Keep
those semantic choices in the App/tool contract and evaluate them against both
unchanged and changed evidence. No live App instruction rewrite or new runtime
mechanism was deployed in this experiment.

A current-context brief and an action contract solve different problems. The
Host supplies facts and their observation scope. The App expresses what a result
means and when work remains. Tools describe their actual effects. An accepted
result can be correct while an unrelated approval remains pending; new evidence
can require more work while the output version stays unchanged.

Keep reuse as an evidence comparison at the responsible App. A generic rule that
rejects new work whenever an accepted result exists would prevent valid updates.
Likewise, adding mandatory rereads everywhere would need evidence that their
benefit justifies the extra work. The
[authoring guidance](../2b-manual/workflow-authoring.md#best-practices-and-learning)
explains the comparison and the distinction between tool effects and caller advice.

## Evidence and reproduction

The subsequent [App review and Scout trial](../../../scout-knowledge-lib.app/docs/verification/scout-reuse-guidance-20260926.md)
applies this guidance to existing consumers. It retains May/Evaluation's current
reuse paths, clarifies two Scout instructions, and fixes a dead returned link
found during the trial. Its App source and activation status are separate from
this comparison and Host PR #230.

The evidence root is
`/app/.state/review-pilots/task-context-followup-20260926/`. `INVESTIGATION.md`
records the initial source/transcript findings. `matched/PLAN.md` and
`matched/manifest.json` freeze the method, model and source identities. Each run
retains its exact harness, fixture, provider requests/responses, tool descriptions,
actions, accepted Task state and receipt. The final artifact is copied beside its
receipt during verification. `VERIFIED.json` indexes the main cohort;
`matched/OBJECTIVE-SCORES.json` and `matched/BEHAVIOR-REVIEW.json` retain objective
checks and review judgments. `fields/VERIFIED-SCORES.json` verifies the six-run
comparison, including that its only tool-schema difference is the day description. The original exact-ID scores remain unchanged;
additional grounded issue labels are assessed separately under the frozen plan.

Experiment branches and exact measured commits:

- `experiment/task-context-followup-baseline-20260926`: `78071eca`.
- `experiment/task-context-followup-discovery-20260926`: `cb5c9056`.
- `experiment/task-context-followup-candidate-20260926`: `2d1adfd4`.
- Common harness SHA-256:
  `a6c81854022724672a67df14803d37336b864e11d9df841a99c6465e867f4157`.

From the candidate checkout, `python3 experiments/task-context-followup/compare.py
<new-absolute-evidence-directory>` runs the same bounded comparison using the
named sibling checkouts. `run.ts` accepts scenario, repetition, provider, output
directory and `original` or `clear` contract. `summarize.py` verifies and scores
that cohort. `compare-fields.py` and `summarize-fields.py` reproduce and verify the
separate field comparison; their additional executions do not replace earlier
receipts. The local configured model service
is needed for model trials; scripted probes test wiring only. The first scripted
probe failed because instrumentation tried to clone tool functions; capturing
serializable tool definitions fixed it before measured runs. An orchestrator
syntax error was also corrected before any measured execution. Neither failed
setup attempt is evidence about agent behavior.
