# Dev Low-Quality Pattern Review (2026-05-08)

## Trigger

Evaluator sent a P1 review request for `evaluator.low-quality-rate-24h`: current `0.588` overall, with dev at `36/52 = 0.692` needs-improvement in the last 24h. The request asked dev to identify recent patterns and propose mitigations/guardrails.

## Evidence

- Active metrics snapshot: `evaluator.low-quality-rate-24h = 0.588` remains above threshold `0.3`; the newer split metric `evaluator.substantive-low-quality-rate-24h = 0.0837` is below threshold `0.3`.
- Dev evaluation breakdown for the last 24h: `36` heuristic `needs_improvement`, `16` heuristic `good`; no JS-evaluated dev sessions in this window.
- Top dev issue tags among needs-improvement sessions in the last 24h:
  - `schema/query error in transcript`: 24
  - `finish blocked by uncommitted changes`: 15
  - `committed generated runtime files`: 7
  - `terminal status: interrupted`: 4
  - `error: Clean start (fresh)`: 4
  - one each for `workflow live signal injection unavailable`, `terminal status: error`, and `broad may/shared commit during session`
- Dev session status breakdown in the last 24h: `46 done`, `4 interrupted / Clean start (fresh)`, `1 error`, `1 running`.

## Judgment

The broad dev low-quality rate is real under the current heuristic, but the dominant failures are process hygiene and evaluator/transcript friction rather than a single code-defect pattern. The healthy substantive split metric suggests this should not be treated as an urgent infrastructure outage; it is a guardrail-discipline problem plus a calibration/pipeline problem already visible to evaluator/arc.

## Proposed Mitigations

1. **Schema/query errors:** keep using canned heartbeat SQL and run `PRAGMA table_info(...)` before any non-canned query. Avoid speculative table/column names in heartbeat triage.
2. **Finish-blocked sessions:** before `finish(success)`, run `cd /app/agents && git status --short`; if dirty state exists, classify it explicitly as pre-existing runtime noise, intentional deliverable, or blocker. Commit only intentional deliverables.
3. **Generated runtime files:** do not commit `*/last-session.md` or shared runtime logs unless they are the explicit deliverable. If they are dirty but unrelated, leave them uncommitted and state that in `finish()`.
4. **Clean-start interruptions:** continue treating these as runtime/transient signals rather than dev deliverable failures; do not attempt DB mutation or destructive cleanup.
5. **Evaluator calibration:** broad `low-quality-rate` should remain useful as a hygiene signal, but alert paging should prefer `evaluator.substantive-low-quality-rate-24h` or an issue-class breakdown so single hygiene tags do not mask substantive quality.

## Event Disposition

- `[P1] review-request` from evaluator: acted. This review samples recent dev evaluations, identifies dominant issue classes, and records concrete guardrail mitigations.
