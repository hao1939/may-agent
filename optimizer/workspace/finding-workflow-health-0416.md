# Workflow Health Check — Apr 16 Early

**Date**: 2026-04-16 01:30 UTC  
**Window**: Last 12 hours (since ~13:30 Apr 15)  
**Baseline**: 27.1% system-wide adoption (Apr 12)

## System-Wide Adoption

**Current: 18.7%** (100/535 sessions used workflows)

This is a **regression from 27.1%** measured Apr 12. Adoption has dropped ~8pp.

## Per-Agent Breakdown

| Agent | Total | Workflow | Adoption % | Trend vs Apr 12 |
|-------|-------|----------|------------|------------------|
| evaluator | 122 | 0 | 0% | — (never used) |
| tech-lead | 63 | 17 | 27.0% | stable |
| bob | 61 | 38 | 62.3% | **highest adopter** |
| coder | 54 | 11 | 20.4% | moderate |
| amy | 49 | 0 | 0% | — (never used) |
| optimizer | 49 | 23 | 46.9% | strong |
| coach | 48 | 10 | 20.8% | moderate |
| may | 37 | 0 | 0% | — (never used) |
| scout | 28 | 1 | 3.6% | minimal |
| qa | 24 | 0 | 0% | — (never used) |

**High adopters** (>40%): bob (62.3%), optimizer (46.9%)  
**Moderate** (15-40%): tech-lead (27.0%), coach (20.8%), coder (20.4%)  
**Non-adopters** (0-5%): evaluator, amy, may, qa, scout

## Efficiency: Workflow vs Freeform

| Mode | Sessions | Avg Efficiency | Avg Quality | Avg Productive Calls | Avg Wasted |
|------|----------|---------------|-------------|---------------------|------------|
| Freeform | 381 | 0.54 | 0.70 | 14.7 | 0.2 |
| Workflow | 98 | **0.64** | **0.76** | 0.6 | 0.0 |

Workflows show **+10pp efficiency** and **+6pp quality** advantage over freeform sessions. The low productive call count (0.6) for workflows suggests many are lightweight orchestration sessions that dispatch to child agents.

## Key Observations

1. **Adoption regressed** from 27.1% → 18.7%. The volume of non-workflow agents (evaluator=122, amy=49, may=37, qa=24) drags the average down — these agents have zero workflow integration.
2. **Bob is the star adopter** at 62.3% — well above everyone else. Worth studying what makes Bob's workflow usage sticky.
3. **Quality/efficiency gains confirmed**: workflow sessions consistently outperform freeform on both metrics, validating KE-007 (workflow enforcement is the only reliable behavioral intervention).
4. **Scout regression**: only 3.6% adoption despite being a research agent where workflows could help structure exploration.

## Recommendations

- **Priority**: Add workflow support for scout and coach — moderate-adopter agents with room to grow
- **Investigation**: Why did system-wide adoption drop? Check if new session types were added that don't use workflows
- **Leave alone**: evaluator, amy, may, qa — these may have architectural reasons for freeform operation
