# EXP-600 Phase 0 Results: Bash Waste Baseline

**Date**: 2026-05-03
**Agent**: tech-lead (primary)

## Baseline Data Source

Tool quality trend report (2026-04-16) — the most recent system-wide measurement.

## Baseline Metrics

| Metric | Value |
|--------|-------|
| Total bash calls (system-wide) | 3,148 |
| Wasted bash calls | 733 |
| System waste rate | 23.3% |
| bash:exit-code-nonzero occurrences | 170 |
| bash:exit-code-nonzero wasted calls | 404 |
| Top offender | tech-lead |
| bash:nonexistent-path occurrences | 26 |
| bash:nonexistent-path wasted calls | 112 |
| bash:git-error occurrences | 54 |
| bash:git-error wasted calls | 74 |

## Tech-Lead Specific

Tech-lead is the top contributor to `bash:exit-code-nonzero` (404 wasted calls). This is the primary target for the diagnose-before-retry skill.

## Waste Rate Trend (Pre-Treatment)

The waste rate has been **rising** over 3+ consecutive scans:
- 04-13: 0.0% → 04-16(final): 23.3%

## Phase 1 Decision

**PROCEED** — baseline shows clear, measurable waste. Deploying `diagnose-before-retry` skill to tech-lead.

### Deployment Checklist
- [x] Skill file written: `agents/.lab/diagnose-before-retry/skills/diagnose-before-retry.md`
- [x] Skill deployed to tech-lead's active skills (confirmed: `agents/tech-lead/skills/diagnose-before-retry.md`)
- [ ] Measurement period: next 50 tech-lead sessions (~2026-05-10)
- [ ] Success threshold: waste rate ≤ 17.5% (25% reduction from 23.3%)
