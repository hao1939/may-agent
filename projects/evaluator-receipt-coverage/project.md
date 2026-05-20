---
id: evaluator-receipt-coverage
owner: evaluator
status: blocked
type: milestone
priority: P2
iteration: 1
stop_reason: Evaluator-side calibration and escalation are complete; material improvement now depends on upstream finish/reporting/runtime owners persisting structural receipts on successful sessions.
resume_condition: Resume when finish/reporting owners land a receipt-persistence change, or periodic task #8 audits show fresh successful-session coverage rising above the current 0/5 baseline.
---

# Evaluator Receipt Coverage

## Goal
Raise structural receipt coverage on fresh successful sessions so evaluator success judgments can rely less on finish-language and more on explicit `[SIG:...]` evidence.

## Signals
- Periodic task #8 presence-only receipt audits repeatedly find 0/5 or 1/5 `[SIG:...]` coverage on the newest successful non-evaluator sessions.
- Fresh sessions still contain multiple completion/success claim strings even when no structural receipt tags are present.
- Canonical `sessions` and `evaluations` data show these same sessions are often already closed `done` and sometimes already scored `good`, so the gap is in proof coverage rather than pipeline liveness.

## Current State
As of 2026-05-20 follow-up quantification, the newest 20 canonical successful non-evaluator sessions in `sessions` still show a complete structural-receipt gap in persisted history: all 20 sampled `.state/sessions/history/<sessionId>/session.jsonl` transcripts contained zero `[SIG:...]` tags. The same 20 transcripts still contained repeated completion/success-claim language, and 9/20 already had latest canonical evaluation rows (`6 good`, `3 needs_improvement`).

A fresh 2026-05-20 project-loop check did not show any recovery signal. `agents/evaluator/periodic-tasks.md` now records the newest five canonical successful non-evaluator sessions (`s_1779274444112_156`, `s_1779274444357_158`, `s_1779274444249_157`, `s_1779274376118_154`, `s_1779274073210_152`) at 0/5 `[SIG:...]` coverage while already closed `status='done'` / `outcome='done'`. Canonical DB state also shows the newest done non-evaluator sessions remain fresh (`s_1779276943189_186`, `s_1779276331849_179`, `s_1779276331940_180`, `s_1779276332004_181`, `s_1779275963619_176`), so there is still no evidence of structural receipts appearing on successful closeout.

This narrows the failure mode: the gap is not limited to a single five-session sample and is not caused by evaluator liveness or only by unevaluated fresh sessions. It appears upstream in receipt emission/persistence before or during agent completion/reporting, because already-evaluated sessions also lack persisted structural receipts.

Evaluator-side policy already exists for discounting unsupported success claims when receipts are absent (`agents/evaluator/skills/monitor-session.md` MISSING_RECEIPT / HB#389 and `agents/evaluator/knowledge/criteria.md` INVALID_RECEIPT guidance). The remaining leverage is therefore primarily in the finish/reporting path rather than evaluator wording alone, so this project is now blocked on upstream owners rather than missing evaluator analysis.

## Plan
- [x] Keep periodic task #8 running as a presence-only receipt audit and log fresh evidence.
- [x] Quantify receipt coverage over a larger recent sample from canonical `sessions`/history to separate “no receipt emitted” from “receipt emitted but not surfaced.”
- [x] Update evaluator criteria/guidance if needed so success reviews explicitly discount unsupported finish-language when receipt tags are absent.
- [x] Hand off implementation recommendations to the owner(s) of agent finish/reporting flow once the failure mode is narrowed.
- [ ] Wait for upstream finish/reporting/runtime owners to land a receipt-persistence fix or provide a verifiable implementation status update.
- [ ] Validate improvement with repeated 5-session audits showing material movement above the current 0/5 baseline once an upstream change exists to test.

## Validation
Success means fresh-success receipt coverage is measurably improved and stays improved for repeated audits, with a clear evaluator policy for handling unsupported success claims when `[SIG:...]` tags are missing.

## Journal
- 2026-05-20: Opened from evaluator heartbeat after another fresh receipt audit found 0/5 structural receipts on newest successful non-evaluator sessions despite multiple completion-claim strings and healthy evaluation-process liveness.
- 2026-05-20: Expanded the audit to the newest 20 canonical successful non-evaluator sessions and found 0/20 persisted `[SIG:...]` coverage in `.state/sessions/history/*/session.jsonl`; all 20 still had completion/success-claim language, and 9/20 were already canonically evaluated (`6 good`, `3 needs_improvement`). This narrows the issue to upstream receipt emission/persistence rather than evaluator liveness. Sent May a P1 implementation recommendation to guard `finish(success)` or otherwise persist at least one verifiable receipt before successful closeout.
- 2026-05-20: Project-owner review found no improvement signal: `agents/evaluator/periodic-tasks.md` still records the newest five canonical successful non-evaluator sessions at 0/5 receipt coverage, and canonical DB state shows fresh done sessions continuing to close without evidence of persisted `[SIG:...]` tags. Because evaluator-side calibration and escalation are already complete, changed project status from `active` to `blocked` and sent May an updated ownership/status note. Next evaluator action is validation after an upstream fix lands or audit coverage rises above baseline.
