# Baseline Measurements

**Date**: 2025-07-30 (re-measured)
**Source**: may.db + filesystem scan

---

## M1: Project Creation Rate

| Metric | Value |
|--------|-------|
| Total projects | 52 |
| Status: done/complete | 44 |
| Status: active | 3 |
| Status: cancelled | 1 |
| Status: unknown/unparsed | 4 |

**Iteration counts** (projects with journals):
- Projects with iterations: 25 of 52
- Median iterations: 7
- Range: 1–22

**Completion rate**: 44/52 = 84%

---

## M2: Escalation Quality (Session Data)

| Metric | Value |
|--------|-------|
| Total tracked sessions | 218 |

**Sessions by agent (top 10)**:
| bob | 78 |
| coach | 58 |
| amy | 30 |
| may | 17 |
| tech-lead | 14 |
| optimizer | 9 |
| amy-kimi | 5 |
| qa | 4 |
| scout | 3 |

*Note: The requests table is empty (0 rows), so escalation pass/fail tracking is not yet instrumented. This is itself a baseline finding — escalation quality measurement requires request-tracking adoption.*

---

## M3: Skill Read Rate

| Metric | Value |
|--------|-------|
| Total file reads tracked | 143 |
| Skill-related reads | 8 |
| Skill read percentage | 5% |
| Shared skill files | 81 |

**Skill reads by agent**:
| Agent | Skill Reads |
|-------|-------------|
| coach | 7 |
| bob | 1 |

---

## Reading-Metrics Skill Status

- Path: `/app/agents/shared/skills/reading-metrics/skill.md`
- Has "close the loop" step: **Yes**

---

## Key Baseline Findings

1. **44/52 projects done** (84% completion rate)
2. **Request tracking empty** — 0 requests in DB; escalation quality can't be measured until agents use the tracking system
3. **Skill reads = 5% of all file reads** — skills are being consumed but we need post-change comparison
4. **81 shared skill files** available
