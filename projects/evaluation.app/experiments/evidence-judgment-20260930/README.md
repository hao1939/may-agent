# Evidence judgment comparison — September 30

Status: isolated experiment; no candidate has been applied. Two criteria
revisions and a presentation-only trial did not demonstrate an adequate fix.
Their negative results are retained. The active evaluator continues to use the
existing criteria; the unsuccessful criteria additions were removed from the
working source and retained here as explicitly rejected patches. A narrower
reader correction is now isolated for review; it changes evidence capture only.

## Observed problem

Sample delivered a useful review through a durable wait, observer notification
and same-Task resumption. The evaluator nevertheless described all observed work
as productive and sometimes described the observer as supplying the document.
The source supports a narrower account: the supervisor supplied the document;
the observer reported availability and resumed the Task.

In reviewer session
`s_1790767828043_f6e34d66-2ff7-4af2-9636-29ee36e54478`, the exact evidence helper
was read at raw line 12. A broad search followed at lines 13–14, returned unrelated
candidate-tree matches, and failed. The raw result ends with a 120-second timeout.
The public transcript retains its first 2,000 characters; Evaluation retains 800.
The error flag and ordering survive, but the timeout does not. The evaluator can
identify the failure from its snapshot; it cannot honestly assign its duration.

Source report:
`.state/evaluation/reports/task-outcomes/evaluator-deepseek/sample/task-outcome-v2/review-appdep_24762fbf9e0f5d75ab312f54-ba09e4fa1b7628e7.json`.
The subject is `sample:review/appdep_24762fbf9e0f5d75ab312f54`.

## Candidate and boundary

The first two candidates changed only `criteria/criteria.md`: use the recorded
actor, action and object throughout the report, and reconstruct call/result
order before judging efficiency. Keep successful delivery, partial output,
failed calls and justified recovery visible together. Their exact unsuccessful
diffs are [v1](v1-rejected.patch) and [v2](v2-rejected.patch).

The third candidate kept the original criteria and changed only JSON property
order: process first within read-back, read-back first within Task. Every fact
remained present. This tests presentation without adding instructions.

The existing exact session raw-log endpoint successfully returned the missing
error tail with matching session, source, line and tool-call identity. A fourth
bounded POC tested supplying the start and end of that result within the existing
800-character limit. Both candidate repeats cited the 120-second timeout while
retaining the supported review outcome; imprecise process wording remained.
This POC combined the raw excerpt with the earlier property-order change, so it
does not isolate the benefit of either change. Its expanded snapshot also kept
the old subject hash; it was an exploratory model input, not a publishable report.

The implemented reader candidate does **not** change property order or criteria.
It follows up to eight long error results per attempt through the public exact
raw-line read, validates correlation and the transcript prefix, retains an
800-character head/tail excerpt and hashes the complete raw result. Failed or
mismatched reads retain the existing projection with a coverage gap. No Host
change, verdict code, new workflow or report-result schema is added.

The real reader probe read the original two historical sessions from the live
Host. It needed one additional raw-line request. Comparing its output to the
original process snapshot showed changes only to that error's text/hash and
the declared coverage/read limit. `reader-live-probe.json` records the calls;
`reader-projection-diff.json` records those exact changed paths. The reader's
complete probe took tens of milliseconds locally; this is one observation, not
a latency guarantee. The four-call implementation comparison completed using
the actual captured reader output, original property order and criteria, and a
recomputed subject hash. Both candidate reports identified the retained
120-second timeout and preserved the useful delivered review. The second still
reversed the helper-read/search order. This is evidence of improved diagnostic
visibility, not a complete attribution or chronology fix. It also does not prove
that every failed search is wasteful. The final source check passed 234 tests
with 1,244 assertions, plus syntax, typecheck and formatting checks.

This correction trades middle text for a visible diagnostic in the same field
budget, and adds up to eight bounded HTTP reads per attempt (typically none).
The exact source coordinate and raw-result hash remain available. It does not
make an evaluator's attribution, chronology or judgment automatically correct.

## Method and limits

Local artifacts live under
`/app/.state/review-pilots/evaluator-evidence-judgment-20260930`.
`trace.json` records the raw/projected discrepancy. Each revision keeps its own
criteria, plan, prompts, cases, session logs and receipts. Baseline criteria match
the installed source used by the original review.

The runner uses the real Host `runDirectAgent`, evaluator-deepseek and
deepseek-v4-flash, with no fallback. Both arms receive identical frozen case
evidence, a fixed prompt timestamp and the production result schema. Both arms
have only the finish tool: external reads and writes would change the frozen
evidence. This is a model-judgment comparison, not a production tool-enabled
execution or an end-to-end Evaluation publication. Model rates are unavailable;
zero estimated cost in a receipt is not evidence of free execution.

Four cases, each repeated twice per arm, cover:

- The unchanged real Sample snapshot: preserve its useful delivery, identify
  the failed search without inventing duration, and attribute observation
  accurately throughout the report.
- A synthetic invoice review: a known helper precedes a wasted search; the
  producer and availability relay differ.
- A synthetic specification summary: the observer worker actually writes the
  summary and publishes availability after a proportionate transient retry.
  Credit both recorded actions and retain the recovery without calling it waste.
- A synthetic adoption recommendation: a readable report claims tests passed,
  but its required raw receipt is absent. Delivery cannot certify that claim.

The quality objective is improvement on the incident with no control regression.
Supervisor judgments assess attribution, process order/cost, retained useful
work and evidence limits separately. A correct sentence does not cancel a
contradiction elsewhere in the same report. Two repeats are exploratory evidence,
not a reliability estimate. The author sees the cases while preparing criteria;
these controls are not a blind held-out benchmark.

## First revision

Four incident calls completed. Both baseline results missed the failed broad
search. The candidate mentioned it once but called it cheap without cost evidence
and reversed the known-source/search order. Its other result missed the failure.
Both candidate results still attributed supplying the file to the observer.
May independently accepted the revise disposition. This revision does not qualify
for approval, despite the Evaluation source check passing 228 tests.

## Second revision and presentation trial

All 16 calls for the second revision completed; syntax, typecheck, formatting
and all 228 tests also passed. The real-incident candidate still reversed the
source-read/search order in one repeat. Its other repeat acknowledged a failed
search but did not establish the claimed usefulness or cost. Accurate wording
in one part of a report did not prevent imprecise attribution elsewhere.

The invoice candidate identified the avoidable search in both repeats. Both
opposite-case repeats preserved the proportionate transient recovery. These are
limited observations, not a clean control pass: the synthetic fixture called
every result tool `bash`, and its observer case retained session agent `reviewer`
despite assigning `document-observer`. It also described receipts without
supplying all underlying bytes or an independently recorded comparison output.
The candidate noticed several of these gaps. Those findings must not be counted
automatically as model regressions; the fixtures need correction before they
can support promotion claims.

The missing-receipt control remained unfit for adoption in both candidate
repeats, but one called the absent evidence a falsification of the test-pass
claim. The absence establishes that the claim is unsupported, not that the tests
failed. The other repeat preserved this distinction. Baseline reports also had
errors, including a claim that the subject stopped before recommending adoption.

The presentation-only trial completed four incident calls. Both candidate
reports kept observation attribution more precise in these samples, but the
first still called all observed calls productive and the second justified the
errored search without establishing its use or cost. This is insufficient to
promote the change as a fix for both concerns.

A failed search can return useful partial matches. Reading a source first does
not automatically make every subsequent search wasteful. Review therefore
checks the specific chronology, evidence of use and claimed cost; it does not
require a negative verdict because `isError` is true. The original snapshot
cannot support the raw 120-second duration, which is outside that snapshot.

## Ordinary improvement path

May owns `may:goal/app_7a4e8645-6d07-445a-86da-4a78cfc5a177` and requested Gym's
independent review through the ordinary dependency
`appdep_ebe7dad3a9be3d8c18c6b6a6`. Gym owns
`gym:goal/appdep_ebe7dad3a9be3d8c18c6b6a6-38c56949d58e`.

Gym's installed fixed comparison workflow supports May and Scout. It correctly
declined to relabel this evaluator candidate, and offered independent evidence
review on the same Task. That review is distinct from executing its fixed
comparison workflow. Gym initially returned an invalid waiting result and then
recovered on the same Task without a supervisor wake; the recovered error remains
part of the execution evidence.

No Evaluation self-review or fabricated publication is involved. If the candidate
is worthwhile, May can prepare the existing exact human approval packet. A
supported reject/revise outcome also completes the decision; approval is not a
success target for an ineffective candidate.

Gym completed its independent review on the same Task in attempt
`r_1_64a8861c-3c4b-4d86-bab0-3113f0752395` (12:12:08–12:13:22 UTC).
It rejected v1/v2/v3, independently identified the malformed controls, and
required a corrected benchmark before promoting a judgment change. That
verdict does not cover the later reader candidate. May retained the return
through the ordinary dependency; no fake approval was created to complete a loop.
