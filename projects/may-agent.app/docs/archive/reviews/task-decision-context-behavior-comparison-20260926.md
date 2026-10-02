# Task context: matched behavior comparison

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Agent Cooperation](../../2a-design/agents.md). Compares actual decisions as well as context cost to assess a proposed brief.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/core-principles.md#context-is-discovered-not-dumped); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

Date: 2026-09-26. Completed experiment; production code was unchanged throughout.

**Conclusion:** PR #230 reduced model calls and input volume in this comparison.
It did not demonstrate better overall behavioral reliability. Both versions
produced correct final review content in all 30 runs. One baseline run needed
rework after recording a stale date; three candidate runs repeated review writes,
including one that ended incomplete. Accepted-result reuse remains a concern.

This follows the [implementation and local rollout
record](task-decision-context-integration-20260926.md). It adds matched evidence
for the final candidate rather than replacing earlier negative trial receipts.

## Method and identity

- Baseline Host: `4d4589a3`; candidate Host: `063a9f53` (PR #230).
- Frozen experiment: `ff996365` on `experiment/task-context-comparison-20260926`.
  Harness SHA-256: `5abe069d617a8a3459636e75dc13e48e0d1037222a8811eb2cd8e2f029ef9582`.
- Analysis/reviewer source: `fe9c40509099afa7e6e3949640c1b8c29bc54870`.
- Six scenarios, five matched repetitions each: 60 executions using the same
  configured `gpt-5.6-sol`, instructions, tools, Task input and starting facts
  within each pair. Dates/venues varied between repetitions. Model fallback was
  disabled. Normalized fixture equality was checked for all 30 pairs.
- Two pairs ran concurrently; arm order alternated inside each pair. Each run
  used fresh temporary files/SQLite and the production Task attempt runner,
  reader, manager, helper boundary and settlement. No live App Tasks, definitions
  or deployment were changed. Publication and human-request tools were local
  simulations; record writes produced actual fixture artifacts.
- Limits: three production attempts, 24 model requests, 180 seconds per run,
  with an external 240-second process limit. All 60 receipts were retained; no
  process timeout or provider failure was excluded. One candidate returned
  incomplete and entered normal backoff; later timer recovery was not observed.
- Scripted preflight validated the fixtures. A missing required finish field and
  an invalid Condition subject were corrected before model runs. Those failed
  probes remain separate from the measured cohort. No prompt, implementation or
  harness changes were made after the measured runs began.

The cases adapted observed failure patterns: correction during helper work,
compaction, coexisting progress/failure/dependency/approval, omitted decisive
venue evidence plus automatic-refresh failure, accepted-result reuse, and an
unchanged Task with genuine approval pending. These are synthetic fixtures,
not literal production snapshot replays or every deployed App's workflow.

## Results

Totals cover 30 runs per version, including the unsuccessful ones.

| Measure | Baseline | Candidate | Interpretation |
| --- | ---: | ---: | --- |
| Correct final schedule/version/authorization/revision fields | 30/30 | 30/30 | No final-content improvement demonstrated. |
| Required outstanding obligations present | 30/30 | 30/30 | Extra grounded observations are allowed. |
| Runs meeting full behavioral acceptance after evidence review | 29/30 | 27/30 | No overall reliability improvement demonstrated. |
| Runs with an earlier wrong schedule write | 1 | 0 | Candidate avoided the observed stale-date rework. |
| Runs with unnecessary or corrective extra writes | 1 | 3 | Candidate's reuse behavior needs attention. |
| Premature publications / unnecessary human requests | 0 / 0 | 0 / 0 | Neither version crossed these boundaries. |
| Model calls, including helpers | 227 | 152 | 33.0% fewer. |
| Serialized provider request bytes | 16,598,413 | 9,354,625 | 43.6% less. |
| Provider-reported total tokens | 2,261,740 | 1,371,814 | 39.3% fewer; not a billing comparison. |
| Average observed run time | 35.3 seconds | 25.1 seconds | 28.9% shorter; endpoint timing is noisy. |
| Model-requested Task lookups | 84 | 28 | Candidate also performs automatic Task reads. |
| Model-requested file reads | 146 | 75 | Less discovery work in this cohort. |

The candidate used fewer calls in 23 pairs, the same number in three, and more
in four. Serialized input was lower in 27 pairs and higher in three. On the 26
pairs where both versions met behavioral acceptance, calls were still lower:
201 to 130. The saving is not explained solely by the incomplete candidate run.
That successful-pair subset is a sensitivity check, not a replacement cohort.

| Scenario (five runs each) | Baseline calls | Candidate calls | Behavioral acceptance, baseline/candidate |
| --- | ---: | ---: | --- |
| Helper with a retained correction | 92 | 49 | 5/5 and 5/5 |
| Compaction and late correction | 47 | 29 | 4/5 and 4/5 |
| Independent progress, failure and waits | 26 | 17 | 5/5 and 5/5 |
| Large input, decisive omitted venue, refresh failure | 21 | 24 | 5/5 and 5/5 |
| Reuse an accepted review | 19 | 17 | 5/5 and 3/5 |
| Unchanged Task with a valid approval wait | 22 | 16 | 5/5 and 5/5 |

The recovery case required more candidate calls despite lower input volume. The
reuse case also took slightly longer in aggregate despite two fewer calls. Do
not describe the aggregate saving as an improvement in every situation.

Cache composition changed substantially: the baseline reported 1,666,283 cached
read tokens and 531,683 cache-write tokens; the candidate reported 422,580 and
900,105 respectively. Lower total token volume does not establish lower monetary
cost. Provider tariff/cache semantics and live billing were not verified.

## What the failures show

In `compaction-1-baseline`, the official Friday correction was persisted during
inspection. A later model request still recorded Wednesday and no revision need.
The worker subsequently read current state and wrote the corrected review. Its
matched candidate recorded Friday correctly the first time. This is a concrete
example of avoiding rework, not evidence that baseline recovery was absent.

In `reuse-1-candidate`, the first provider input already contained the complete
accepted review, exact receipt, and instruction to reuse it. The model inspected
the draft, read the matching file, and nevertheless recorded a new review.
`reuse-2-candidate` wrote twice; it eventually recognized the violation and
returned incomplete with evidence, entering normal backoff. In
`compaction-3-candidate`, a second production attempt wrote the same review again
instead of reusing the first attempt's accepted artifact.

The full accepted result and reuse instruction were visible in the two reuse
trials' initial model inputs. Missing metadata, failed refresh, truncation or
unavailable files do not explain those two decisions. The experiment cannot
separate a presentation effect from sampling variation, or identify which part
of the bundled PR caused the efficiency difference.

The behavior comparison has one candidate-only pass and three baseline-only
passes; 26 pairs passed on both versions. The exploratory exact paired test is
`p = 0.625`, which does not establish superiority or a population regression.
Five repetitions of six templates are not a representative real-world frequency
estimate. The observed failures are still useful counterexamples to a blanket
claim that improved context delivery guarantees better behavior.

## The scoring and review also needed checking

The frozen exact checker initially scored 17/30 baseline and 20/30 candidate.
It required the outstanding-ID list to equal the expected list. That rejected
grounded additional observations such as `day-mismatch` even when the correction
and required approval were right. We retained that original score and added a
separate factual/semantic assessment. Required obligations must remain present;
additional supported facts do not automatically make an outcome wrong.

An independent execution of the same model reviewed all 60 outcomes with arm
labels hidden. It supported the additional observations but initially made two
material classification errors: it missed a new write duplicating a retained
review, and treated absent optional prose as missing delivery even though the
accepted Task result returned the receipt. Exact tool/attempt evidence exposed
both. A second blinded review of those two cases, clarifying the existing
contract, corrected them. All original judgments and clarification outputs are
retained. A comment conflating a whole run with its final attempt was also
checked against the actual attempt sequence.

The reported 29/30 versus 27/30 therefore combines objective action evidence,
blinded interpretation of extra observations, and explicit contract review. It
is not an unquestioned model grade or a retroactive alteration of raw receipts.
Code should score objective identity/actions; model judgment should assess
meaning within that evidence and state its coverage.

## Decision and next experiment

The [focused follow-up](task-context-reuse-followup-20260926.md) separates optional
workspace discovery from the full Host change and tests clearer App/tool reuse
wording. Its new runs and controls are reported separately; they preserve the
earlier results.

Keep the demonstrated claim narrow: the candidate reduced discovery/model work
in this cohort and preserved current facts at predictable boundaries. Behavioral
reliability did not improve in the observed sample; reliable reuse is unfinished.
Passing Host tests and a concise current brief do not replace behavior evaluation.

The next focused iteration should examine reuse decisions with already-visible
accepted evidence. Test smaller presentation changes and separate the effect of
on-demand workspace discovery from the full refreshed brief before adding more
Host machinery. No new recovery queue, approval rule, metadata registry or
missing-data guard is justified by these reuse examples. Preserve the comparison
fixtures so the same decision criteria can be applied to the next candidate.

## Evidence and reproduction

Start at
`/app/.state/review-pilots/task-context-comparison-20260926/FINAL.md`.
The `matched/` directory contains `manifest.json`, frozen `PLAN.md`, all 60 run
receipts, fixtures, actual provider inputs/outputs, tool interactions, raw scores,
`SUMMARY.json`, and `BEHAVIOR-REVIEW.json`. Each receipt has its harness hash;
the summary indexes receipt hashes. Blinded inputs, separate identity mapping,
original judgments and contract clarification remain alongside them.

The experiment branch retains `experiments/task-context-comparison/`. Its
`compare.py` runs a fresh cohort and `summarize.py` verifies paired fixture
identity and reports raw/supplemental metrics. `prepare-blind.py` strips version
labels; `blind-review.ts` performs the separate bounded review. Review labels do
not enter the measured worker runs. The common implementation/CI/deployment
evidence remains in the preceding integration record; this experiment neither
changes nor redeploys the production candidate.
