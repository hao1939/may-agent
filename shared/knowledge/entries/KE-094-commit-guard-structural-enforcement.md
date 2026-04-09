# KE-094: Commit Guard — Structural Enforcement Eliminates Agent Laziness

**Created**: 2026-04-09  
**Status**: Verified  
**Evidence**: 48h measurement, 862 commits, 6 time windows  

## Finding

A commit guard (infrastructure-level enforcement requiring agents to commit their own work) reduced agent-laziness auto-commits from 58% to 1.0% (−57pp) within 48 hours. This is the largest behavioral effect size observed in any intervention deployed to this system.

## Mechanism

- **Before**: Auto-commit safety net ran every 2h, catching 15–100 uncommitted agent files per cycle. Agents learned to rely on it.
- **After**: Guard enforces that agents commit their own work. Safety net still runs but catches near-zero files.
- **Result**: Agent substantive commit volume increased 33× (14 → 460 per 48h), with each agent committing its own work with descriptive messages.

## Key Insight

This confirms the pattern established by other experiments (EXP-020 through EXP-100): **structural/workflow enforcement changes behavior; text/skill/instruction interventions do not** (0/32+). The commit guard is a structural intervention — it changes the environment, not the prompt.

## Measurement Nuance

The raw `chore(auto)` metric is misleading post-deployment because federation sync introduced `commit before sync` infrastructure commits (189 in 48h). Three-tier measurement needed:
1. `commit before sync` — infrastructure noise (exclude)
2. Descriptive auto-commits, shared-only — cross-instance sync artifacts (expected)
3. Descriptive auto-commits with agent paths — actual agent laziness (guard target)

## Trend

| Period | Agent-Laziness Rate |
|--------|:------------------:|
| Baseline | 58.0% |
| W1 (first 8h) | 11.1% |
| W3 (16–24h) | 1.1% |
| W4–W6 (24–48h) | 0.0% |

Rapid adoption with sustained zero-laziness in the final 24h.

## Cross-References

- Report: `agents/coach/workspace/commit-guard-48h-report.md`
- Regression analysis: `agents/coach/knowledge/brief-commit-guard-regression.md`
- Related: KE-059 (mechanism hierarchy — structural > text), KE-054 (ext boundary)
