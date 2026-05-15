# Finding: Session Archaeology — 6h Scan (Apr 19 ~09:30 UTC)

## Summary

3 sessions ≥40 ops in the last 6h. Two are legitimate high-quality work; one is significant waste.

## Sessions Analyzed

| Session | Agent | Ops | Quality | Verdict | Task |
|---------|-------|-----|---------|---------|------|
| s_1776589474334_49 | coach | 74 | 1.0 | good | EXP-188: finish-guard experiment |
| s_1776578913159_18 | coder | 59 | 0.9 | good | Feedback Loop M3 implementation |
| s_1776584132394_9 | bob | 58 | 0.22 | needs_improvement | EXP-177 recognition threshold test |

## Analysis

### Coach 74-op (EXP-188) — LEGITIMATE
- Zero evaluator issues. q=1.0, e=0.8.
- 74 ops for a full experiment design + gym execution is within expected range for growth-cycle work.
- **No action needed.**

### Coder 59-op (M3 Feedback Loop) — LEGITIMATE
- q=0.9, e=0.75. Minor issues: one failed grep, one no-op edit, one commit-to-main attempt (recovered).
- 59 ops for implementing a DB-backed feature with schema + subscribers + review branch is reasonable complexity.
- ~3 ops wasted on minor flails. Not worth a systemic fix.
- **No action needed.**

### Bob 58-op (EXP-177) — WASTE ⚠️
- q=0.22, e=0.28. Five evaluator issues flagged.
- **No deliverable produced** — experiment not completed, no results.md written.
- Root causes:
  1. **Path discovery spiral**: `rg` not installed, wrong directory assumptions (`agents/shared/gym/...`), repeated failed lookups
  2. **Schema guessing**: queried non-existent `tag` column, had to recover via PRAGMA
  3. **Scope drift**: pivoted from executing the experiment to redesigning hint injection mid-stream, editing scenario artifacts
  4. **Aborted batch run**: final `gym-batch.sh` command was aborted, session ended with no results
- 58 ops spent, zero useful output. This is the "investigation spiral → scope drift → incomplete" anti-pattern.
- **Pattern**: Bob EXP sessions have shown this before — see EXP-177 prior runs. The issue is bob entering experiment execution without a clear, pre-validated plan.

## Recommendation

- **NO_DISPATCH** — Bob's EXP-177 failure is a behavioral pattern (scope drift + path discovery waste), not a tooling gap. Per KE-002, text rules don't fix judgment failures. The evaluator already flagged it at q=0.22 which feeds back into bob's metrics.
- Monitor whether bob retries EXP-177 and whether the retry is leaner.

## System Health

- 3 sessions ≥40 ops in 6h is low volume — system is running lean.
- Average quality of high-op sessions: 0.71 (dragged down by bob's 0.22).
- Excluding bob: avg quality 0.95 — excellent.
