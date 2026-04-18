# Mode A: Session Archaeology — 6h Scan (2026-04-18 17:30)

## Summary

Quality average across non-evaluator agents in last 6h: **tech-lead 0.748, bob 0.793, coach 0.852** are the three agents dragging the overall quality metric below 0.9. Scout (0.861) is borderline.

## Key Findings

### 1. Tech-lead is the worst-performing non-evaluator agent (avg quality 0.748, 9/25 sessions < 0.7)

Top issues in low-quality tech-lead sessions:
- **DELIVERABLE_MISSING**: Required output files never written (s_1776517584598_213, q=0.05)
- **REQ_MISS**: Didn't answer core questions with structural evidence (s_1776513677868_160, q=0.35)
- **FM-2.6 reasoning-action mismatch**: Assertions without evidence (s_1776521193037_265, q=0.28)
- **FM-3.3 verification failures**: Claims verification steps that didn't happen (s_1776528383930_382, q=0.35)

**Pattern**: Tech-lead sessions frequently end without producing their required deliverable or with shallow analysis that doesn't match the task's depth requirements.

### 2. Bob has 3 sessions scored 0 due to "duplicate agent name" evaluator bug

Sessions s_1776523959873_311, s_1776527558020_363, s_1776531172415_415 all got quality=0 with issue "evaluator did not score this session (duplicate agent name)". These are research work sessions (DD-765, DD-774, DD-768) with 5-6 ops each that appear functional but are artificially dragging bob's average down. **This is a measurement artifact, not a real quality problem.**

### 3. FM-3.3 (verification failures) remains the dominant failure mode

Across all low-quality sessions, FM-3.3 variants appear in coach, tech-lead, scout, and bob. Agents attempt `finish(success)` without proper verification evidence and get blocked, wasting their remaining budget on retry loops.

### 4. parse_error verdicts are widespread (29 sessions, 9.6% of all evaluated)

Coach leads with 9 parse_errors, followed by tech-lead (5), qa (5), bob (5). These represent evaluator failures to parse the session, not necessarily agent failures — but they contribute noise to the quality metric.

### 5. Evaluator "skipped" sessions dominate low-quality counts (137 sessions, all quality=0)

All 137 evaluator sessions are self-evaluated as "skipped" with quality=0. These should be excluded from quality calculations. If they're included in the 0.893 metric, that's the primary reason it's below 0.9.

## New Patterns (not seen in previous Mode A scans)

- **"Duplicate agent name" evaluator bug** affecting bob's research sessions — 3 instances in 6h, systematic
- **Tech-lead consistently underperforming** — not a single-session anomaly but a structural pattern (9 of 25 sessions below 0.7)

## Recommendations

1. **Exclude evaluator self-evals from quality metric** if not already done — 137 skipped sessions at q=0 are the biggest drag
2. **Investigate "duplicate agent name" evaluator bug** — bob's research sessions are unfairly scored
3. **Tech-lead needs intervention** — consider task boundedness improvements (per KE-013) since tech-lead's investigation tasks seem too open-ended
4. **FM-3.3 guard is working** (blocking bad finishes) but agents need to internalize the pattern rather than retry-loop
