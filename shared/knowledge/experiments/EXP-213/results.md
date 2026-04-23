# EXP-213: Results — Schema-Organized Context for Bob

**Status**: DEPLOYED — Measuring
**Deployed**: 2026-04-23 (commit 63c24830c)
**Predecessor**: EXP-212 (confirmed: schema reduced tech-lead C1.1 by 54%, git confusion by 50%, npx by 63%)

## Deployment

Bob's context.md reorganized into activation-based schema sections:
- `## ⚡ [SESSION START]` — environment, tools, paths
- `## ⚡ [BEFORE EDITING ANY FILE]` — C1.1 read-before-edit
- `## ⚡ [AFTER EVERY write() CALL]` — C1.3 verify-after-write
- `## ⚡ [BEFORE CALLING finish()]` — C1.7, C12.1
- `## ⚡ [RESEARCH WORKFLOW]` — KB paths, scripts, gym
- `## ⚡ [GENERAL KNOWLEDGE]` — findings, preferences

Same content. Zero new facts. Only structural reorganization matching activation context.

## Pre-Deployment Baseline (days 3-10 before deploy)

| Convention | Fail | Pass | Total | Fail Rate |
|-----------|------|------|-------|-----------|
| C1.1 | 61 | 558 | 619 | 9.9% |
| C1.3 | 61 | 558 | 619 | 9.9% |

## Post-Deployment Data

Deployed ~hours ago. Insufficient post-deployment sessions for measurement. 

**Next**: Measure after 20+ post-deployment sessions (est. 2-3 days). Success criterion: ≥30% reduction in C1.1 or C1.3 fail rate (i.e., from 9.9% to ≤6.9%).

## Notes

- Pre-deployment baseline (9.9%) is lower than the 13.8%/13.5% cited in the design doc, suggesting bob's violation rates may have already been improving from other interventions (H-EXP-014 protocol, general maturation).
- Will need to control for this when assessing impact.
