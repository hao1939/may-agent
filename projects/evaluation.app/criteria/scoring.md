# Evaluation Scoring

This file defines the current numeric and verdict mapping used by automatic
session aftermath. Scores are numbers from `0.0` to `1.0`.

## Required Output

One completed evaluation contains:

```json
{
  "sessionId": "s_...",
  "agent": "agent-name",
  "quality": 0.0,
  "efficiency": 0.0,
  "productiveCalls": 0,
  "wastedCalls": 0,
  "verdict": "good | acceptable | needs_improvement | low_quality",
  "issues": ["concrete evidence-backed issue"],
  "lane": "routine_ok | success_candidate | needs_triage",
  "reason": "why this is the final route",
  "signals": ["specific observed signal"],
  "overall": {
    "resultDelivered": true,
    "valueProduced": "specific result",
    "evidence": ["specific transcript, result, or artifact evidence"]
  }
}
```

The workflow validates the exact schema. Do not return a 1–5 score, nested
per-role score object, issue objects, or prose outside the structured result.

## Quality

Quality measures whether the requested outcome is correct, complete, useful,
safe, and verified.

| Range       | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `0.90–1.00` | Complete, correct, well verified, and unusually strong                   |
| `0.70–0.89` | Good result with only minor limitations                                  |
| `0.40–0.69` | Useful but partial, weakly verified, or needing bounded follow-up        |
| `0.10–0.39` | Main outcome missed, wrong, misleading, or materially unsafe             |
| `0.00–0.09` | No usable result, fabricated completion, or severe destructive violation |

Do not award high quality merely because a session wrote files, made a commit,
or ended with `done`. Verify the requested outcome and its canonical output.

## Efficiency

Efficiency measures how directly the session converted calls into useful
progress.

| Range       | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `0.90–1.00` | Nearly every call materially advanced or verified the result         |
| `0.70–0.89` | Small amount of harmless exploration or repetition                   |
| `0.40–0.69` | Noticeable waste, avoidable retries, or excessive context collection |
| `0.10–0.39` | Repeated dead ends or mostly unproductive work                       |
| `0.00–0.09` | No meaningful progress relative to the calls consumed                |

Estimate `productiveCalls` and `wastedCalls` from the bounded transcript. They
are explanatory counts, not a replacement for judgment. Environment failures
outside the agent's control do not become wasted calls unless the agent handles
them poorly or repeats them without adaptation.

## Verdict

- `good`: quality and efficiency are both at least `0.70`, and the requested
  result was delivered or the proven no-op was the requested outcome.
- `acceptable`: useful value exists and quality and efficiency are both at
  least `0.40`, but the result is partial, has material limitations, or needs a
  bounded follow-up.
- `needs_improvement`: either score is below `0.40`, or the main requested
  outcome was not reliably delivered.
- `low_quality`: the result is unusable or dangerously misleading, including
  fabricated evidence, severe safety violations, or a false completion claim.

Verdict follows the evidence, not a mechanical average. A severe quality fault
cannot be offset by efficient execution.

## Lane

- `routine_ok`: straightforward successful/no-op work without a reusable
  concern.
- `success_candidate`: a substantive successful result worth calibration or
  positive learning review.
- `needs_triage`: a concrete issue, ambiguous attribution, or owner follow-up
  may be useful.

Lane selects follow-up; it does not change the score.

## Unavailable Evidence

If the transcript or necessary output is unavailable, do not manufacture an
evaluation. Return the workflow's structured `skip` result with the exact
reason. Provider failure or incomplete evaluator output is an Evaluation
attempt failure, not a low score for the target agent.

## Findings

Findings are separate from scores. Emit one only when another App owner has a
specific actionable concern supported by exact evidence. Address the
accountable App. Request human action only for a concrete decision, approval,
or input needed now.
