# Context Cost Analysis

**Date**: 2026-04-29

## Per-Agent Skill Context Cost

| Agent | Skills | Total Bytes | Total Lines | Avg Lines/Skill |
|-------|--------|-------------|-------------|-----------------|
| amy | 11 | 57656 | 1204 | 109 |
| amy-kimi | 5 | 11473 | 291 | 58 |
| bob | 18 | 92032 | 1922 | 106 |
| coach | 11 | 51071 | 1110 | 100 |
| coder | 11 | 59508 | 1255 | 114 |
| evaluator | 7 | 25055 | 524 | 74 |
| may | 6 | 10000 | 226 | 37 |
| optimizer | 8 | 37716 | 840 | 105 |
| qa | 4 | 11409 | 265 | 66 |
| scout | 9 | 23238 | 523 | 58 |
| shared | 78 | 480123 | 10223 | 131 |
| tech-lead | 17 | 82817 | 1791 | 105 |

## Shared Skills Detail

387 agents/shared/skills/skill-lifecycle/SKILL.md
292 agents/shared/skills/archive/untested/check-state/SKILL.md
270 agents/shared/skills/materialize-intermediate-findings/SKILL.md
268 agents/shared/skills/archive/untested/search-strategy-escalation/SKILL.md
267 agents/shared/skills/archive/untested/incremental-context-loading/SKILL.md
266 agents/shared/skills/budget-before-act/SKILL.md
265 agents/shared/skills/request-triage-memoization/SKILL.md
254 agents/shared/skills/deliverable-integrity/SKILL.md
236 agents/shared/skills/structured-plan-writing/SKILL.md
236 agents/shared/skills/obstacle-pivot/SKILL.md
236 agents/shared/skills/archive/disproven/classify-then-act/SKILL.md
233 agents/shared/skills/coder-edit-discipline/SKILL.md
230 agents/shared/skills/archive/untested/stale-approach-fixation/SKILL.md
226 agents/shared/skills/error-handling/SKILL.md
225 agents/shared/skills/delegation-verification/SKILL.md
224 agents/shared/skills/state-check-before-action/SKILL.md
221 agents/shared/skills/prerequisite-gap-protocol/SKILL.md
216 agents/shared/skills/archive/untested/scope-discipline/SKILL.md
215 agents/shared/skills/archive/unreferenced/extract-directives.md
214 agents/shared/skills/evidence-over-narrative/SKILL.md

## Key Findings
- Total context cost of ALL skills: 1008278 bytes (~1008KB)
- Context windows are typically 100-200K tokens (~400-800KB)
- Skills consume approximately 252% of a typical context window
