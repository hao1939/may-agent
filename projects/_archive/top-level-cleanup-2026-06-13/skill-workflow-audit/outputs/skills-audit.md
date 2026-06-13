# Skills Audit Report

**Date**: 2026-04-25
**Auditor**: coach
**Scope**: All shared skills (53 items) + per-agent skills (47 items)

## Summary

- **Total shared skills**: 53 (38 directories + 6 standalone .md + LIBRARY/README/DELIVERY-GUIDE)
- **Referenced by agents**: 12/53 (23%) — most skills are NOT referenced anywhere
- **With SKILL.md**: 38/47 directories (81%)
- **Unreferenced orphans**: 35 skills with zero references

## Key Finding

**Most shared skills are orphaned.** Only 12 of 53 shared skills are referenced in any agent context.md, heartbeat.md, or workflow. The remaining 35+ exist but have no delivery mechanism to agents.

## Shared Skills — Directory-based

| # | Skill | Lines | Referenced By | Quality | Verdict |
|---|-------|-------|---------------|---------|---------|
| 1 | agent-coordination | 76 | — | mediocre | archive — unreferenced, generic |
| 2 | agent-growth | 65 | — | mediocre | archive — unreferenced, generic |
| 3 | agent-gym | 142 | — | good | keep — useful for coach/gym runners |
| 4 | archive (dir, no SKILL.md) | 18 files | amy, amy-kimi, scout | good | keep — actively used |
| 5 | baseline-before-change | 163 | — | good | keep — useful pattern, needs delivery |
| 6 | budget-before-act | 266 | — | good | keep — important for cost control |
| 7 | build-activation-verification | 206 | — | mediocre | archive — never tested/referenced |
| 8 | cli-coding | 51 | — | mediocre | archive — too short, niche |
| 9 | closing-the-loop (no SKILL.md) | 1 file | bob | mediocre | fix — needs SKILL.md |
| 10 | coder-edit-discipline | 233 | — | good | keep — relevant, needs delivery to coder |
| 11 | contradiction-detection | 30 | — | junk | archive — too short (30 lines), vague |
| 12 | creating-projects (no SKILL.md) | 1 file | — | mediocre | archive — unreferenced |
| 13 | delegation-verification | 225 | — | good | keep — useful for tech-lead |
| 14 | deliverable-integrity | 254 | — | good | keep — important pattern |
| 15 | document-collaboration | 89 | — | mediocre | archive — niche |
| 16 | error-handling | 226 | — | good | keep — universal need |
| 17 | escalation (no SKILL.md) | 1 file | coach, may, optimizer, shared | good | fix — needs SKILL.md, widely referenced |
| 18 | evaluator-scoring | 82 | — | mediocre | keep — evaluator-specific |
| 19 | evidence-over-narrative | 214 | shared | good | keep — core skill, widely deployed as per-agent copies |
| 20 | file-safety | 77 | — | mediocre | archive — covered by C1.1/C1.3 rules |
| 21 | growth-cycle (dir, no SKILL.md) | 3 files | coach, shared | good | fix — needs SKILL.md |
| 22 | handoff | 35 | optimizer | mediocre | fix — too short, needs expansion |
| 23 | helping-others (no SKILL.md) | 1 file | — | junk | archive — unreferenced, no SKILL.md |
| 24 | idempotent-work-detection | 88 | — | good | keep — prevents duplicate work |
| 25 | know-when-blocked | 131 | shared | good | keep — critical for agent autonomy |
| 26 | knowledge-sharing | 101 | — | mediocre | archive — generic |
| 27 | l3-delegation-metrics | 66 | — | mediocre | archive — niche |
| 28 | materialize-findings-concise | 36 | — | mediocre | archive — too short |
| 29 | materialize-intermediate-findings | 270 | — | good | keep — useful for research agents |
| 30 | obstacle-pivot | 236 | — | good | keep — important resilience skill |
| 31 | patterns | 72 | bob, coach, may, optimizer, qa, scout, shared, tech-lead | good | keep — widely referenced |
| 32 | plan-once-amend | 191 | bob, coder | good | keep — actively used |
| 33 | prerequisite-gap-protocol | 221 | — | good | archive — never tested |
| 34 | progressive-work-persistence | 181 | — | good | keep — useful for long tasks |
| 35 | prototype-skill-package (no SKILL.md) | 4 files | — | mediocre | archive — template, not a skill |
| 36 | reading-metrics (no SKILL.md) | 1 file | bob | mediocre | fix — needs SKILL.md |
| 37 | request-triage-memoization | 265 | — | good | archive — never tested |
| 38 | skill-lifecycle | 387 | — | good | keep — meta-skill for coach |
| 39 | state-check-before-action | 224 | — | good | keep — good defensive pattern |
| 40 | structured-plan-writing | 236 | — | good | keep — useful |
| 41 | test-integrity-check | 46 | — | mediocre | archive — too short |
| 42 | test-mock-awareness | 55 | — | mediocre | archive — niche |
| 43 | tool-discipline | 194 | — | good | keep — covered by C-rules already |
| 44 | verification-consistency | 191 | — | good | keep — complements verification |
| 45 | verification | 147 | ALL agents | good | **keep — most widely referenced skill** |
| 46 | web-scraping | 52 | — | mediocre | archive — niche |
| 47 | working-in-projects (no SKILL.md) | 1 file | — | mediocre | archive — unreferenced |

## Shared Skills — Standalone .md files

| # | Skill | Referenced By | Verdict |
|---|-------|---------------|---------|
| 1 | consolidate-memory.md | evaluator | keep |
| 2 | experience-replay.md | — | archive — unreferenced |
| 3 | growth-cycle.md | — | archive — duplicate of growth-cycle dir |
| 4 | sanitize-content.md | — | archive — unreferenced |
| 5 | sanitize-memory.md | — | archive — unreferenced |
| 6 | transient-skill.md | — | archive — unreferenced |

## Per-Agent Skills Summary

| Agent | Skills | Notes |
|-------|--------|-------|
| amy-kimi | 2 | verify-after-edit.md, xhs-browse.mjs (code skill) |
| bob | 10 | Most per-agent skills. 1 demoted (diagnosis-before-action). Well-maintained |
| coach | 8 | Includes red-team dir. Good coverage |
| coder | 3 | Lean and focused |
| evaluator | 19 | Mostly .cjs code skills (automation). Different paradigm |
| may | 4 | Includes blocked-capability-escalation dir |
| optimizer | 5 | Standard set |
| qa | 4 | Standard set |
| scout | 9 | Well-covered for research tasks |
| tech-lead | 6 | Standard set |

## Recommendations

### Immediate Actions
1. **Archive 18 unreferenced, untested skills** — reduce noise in the skill library
2. **Add SKILL.md to 6 directories missing it** — escalation, growth-cycle, closing-the-loop, reading-metrics, helping-others, working-in-projects
3. **Remove duplicate growth-cycle.md** (standalone) — dir version exists

### Strategic Actions
4. **Skill delivery problem**: Most skills exist but aren't injected into agents. The per-agent skills/ directory IS the delivery mechanism (auto-loaded). Shared skills need to be copied/linked to agents that need them.
5. **Top candidates for deployment**: coder-edit-discipline → coder, delegation-verification → tech-lead, error-handling → all, obstacle-pivot → all
6. **Verify top skills still work**: verification (most referenced) and evidence-over-narrative (most duplicated) should be gym-tested to confirm they still help.

## Scoring

- **Keep**: 22 shared skills worth maintaining
- **Fix**: 5 skills need SKILL.md or expansion  
- **Archive**: 20 skills are unreferenced orphans with no evidence of impact
- **Per-agent**: 70 skills across 10 agents, mostly good
