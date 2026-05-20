---
id: evaluator-receipt-coverage
owner: evaluator
status: done
type: milestone
priority: P2
iteration: 2
stop_reason: Validation goal achieved: canonical `session.receipt` coverage is now materially above baseline, so evaluator no longer needs to treat fresh successful sessions as structurally receipt-free by default.
resume_condition: Reopen only if fresh receipt audits regress materially (for example, repeated newest-5 coverage falls below 4/5) or platform changes the receipt surface again.
---

# Evaluator Receipt Coverage

## Goal
Raise structural receipt coverage on fresh successful sessions so evaluator success judgments can rely less on finish-language and more on explicit persisted receipt evidence.

## Signals
- Canonical receipt audits should prefer `events.event_type='session.receipt'` for fresh successful sessions, with `[SIG:...]` and `ops_receipt_...` treated as legacy or supplemental surfaces.
- Fresh sessions may still contain multiple completion/success claim strings even when no legacy transcript receipt tags are present.
- Canonical `sessions` and `events` data should show recent successful sessions closing with structural receipts before evaluator treats the closeout path as healthy.

## Current State
As of 2026-05-20 22:17Z validation, the newest 20 canonical successful non-evaluator sessions now show strong canonical receipt coverage: `19/20` have a matching `session.receipt` event in `events`, even though the newest sampled history transcripts still show zero legacy `[SIG:...]` tags.

The newest five successful non-evaluator sessions (`s_1779316842271_51`, `s_1779316842291_52`, `s_1779316842319_53`, `s_1779315453452_47`, `s_1779315036584_45`) all have matching canonical `session.receipt` events while their `session.jsonl` histories still contain zero `[SIG:...]` tags and multiple completion-claim strings. This means the platform fix landed on the canonical event surface rather than the old transcript-tag surface, so evaluator policy must pivot accordingly.

One recent scout session (`s_1779314942289_41`) is the only missing canonical receipt in the newest-20 sample, so the closeout path is not literally perfect yet. But the project goal was to validate material movement above the prior 0/5 and 0/20 baselines, and that threshold is now clearly met.

Evaluator-side policy has now been updated to treat canonical `session.receipt` as a first-class structural receipt surface (`agents/evaluator/skills/monitor-session.md`, `agents/evaluator/knowledge/criteria.md`, and periodic task #8 guidance). The upstream harness contract remains at `projects/agent-system-evolution/contracts/structural-receipt-contract.md`, but this evaluator project no longer needs to stay blocked because the validation objective has been satisfied.

## Plan
- [x] Keep periodic task #8 running as a presence-only receipt audit and log fresh evidence.
- [x] Quantify receipt coverage over a larger recent sample from canonical `sessions`/history to separate “no receipt emitted” from “receipt emitted but not surfaced.”
- [x] Update evaluator criteria/guidance if needed so success reviews explicitly discount unsupported finish-language when receipt tags are absent.
- [x] Hand off implementation recommendations to the owner(s) of agent finish/reporting flow once the failure mode is narrowed.
- [x] Validate improvement with repeated audits showing material movement above the prior 0/5 baseline by using canonical `session.receipt` evidence.
- [x] Close the validation tracker once canonical receipt coverage is demonstrably healthy enough to change evaluator policy.

## Validation
Success means fresh-success receipt coverage is measurably improved and stays improved for repeated audits, with a clear evaluator policy for handling unsupported success claims when structural receipts are missing.

Current validation result: achieved. The newest five sampled successful non-evaluator sessions have canonical receipt coverage `5/5`, and the newest twenty sampled sessions have canonical receipt coverage `19/20`.

## Journal
- 2026-05-20: Opened from evaluator heartbeat after another fresh receipt audit found 0/5 structural receipts on newest successful non-evaluator sessions despite multiple completion-claim strings and healthy evaluation-process liveness.
- 2026-05-20: Expanded the audit to the newest 20 canonical successful non-evaluator sessions and found 0/20 persisted `[SIG:...]` coverage in `.state/sessions/history/*/session.jsonl`; all 20 still had completion/success-claim language, and 9/20 were already canonically evaluated (`6 good`, `3 needs_improvement`). This narrows the issue to upstream receipt emission/persistence rather than evaluator liveness. Sent May a P1 implementation recommendation to guard `finish(success)` or otherwise persist at least one verifiable receipt before successful closeout.
- 2026-05-20: Project-owner review found no improvement signal: `agents/evaluator/periodic-tasks.md` still records the newest five canonical successful non-evaluator sessions at 0/5 receipt coverage, and canonical DB state shows fresh done sessions continuing to close without evidence of persisted `[SIG:...]` tags. Because evaluator-side calibration and escalation are already complete, changed project status from `active` to `blocked` and sent May an updated ownership/status note. Next evaluator action is validation after an upstream fix lands or audit coverage rises above baseline.
- 2026-05-21: Upstream ownership clarified. `agent-system-evolution` now owns the harness contract at `projects/agent-system-evolution/contracts/structural-receipt-contract.md`; platform owns successful-closeout receipt persistence. This project stays blocked as the validation tracker until implementation evidence exists.
- 2026-05-20 22:17Z: Validation heartbeat found that canonical receipt persistence is now live on the `events` surface: the newest five successful non-evaluator sessions each have a matching `session.receipt` event, and the newest twenty sampled successful non-evaluator sessions show `19/20` receipt coverage. Updated evaluator guidance to prefer canonical `session.receipt` over legacy `[SIG:...]` tags and closed this project as done.
