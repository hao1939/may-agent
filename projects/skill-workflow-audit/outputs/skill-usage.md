# Skill Usage Audit

**Date:** 2025-01-27  
**Method:** Searched agent `.state/`, `sessions/`, and `context.md` files for references to deployed skill names.

## Deployment Inventory

10 agents have local skill directories: amy, bob, coder, coach, evaluator, optimizer, qa, scout, tech-lead, may.

## Top 10 Most-Deployed Shared Skills — Usage Evidence

| Skill | Deployed To (N agents) | Evidence of Usage | Usage Count | Notes |
|-------|----------------------|-------------------|-------------|-------|
| evidence-over-narrative | 5 (bob, coach, optimizer, scout, tech-lead) | ❌ No | 0 | Skill file present in agents' `skills/` dirs but no references found in `.state/`, sessions, or `context.md` |
| verification | 4 (amy, bob, coder, tech-lead) | ❌ No | 0 | Same — deployed but no runtime evidence |
| state-check-before-action | 4 (amy, bob, coder, tech-lead) | ❌ No | 0 | Same |
| plan-once-amend | 4 (amy, bob, coder, tech-lead) | ❌ No | 0 | Same |
| obstacle-pivot | 4 (amy, bob, coder, tech-lead) | ❌ No | 0 | Gym scenario exists but no real-session usage found |
| know-when-blocked | 4 (amy, bob, coder, tech-lead) | ❌ No | 0 | Same |
| reading-metrics | 3 (amy, coach, tech-lead) | ❌ No | 0 | Same |
| creating-projects | 3 (amy, coach, tech-lead) | ❌ No | 0 | Same |
| closing-the-loop | 3 (amy, coach, tech-lead) | ❌ No | 0 | Same |
| prerequisite-gap-protocol | 1 (optimizer) | ❌ No | 0 | Same |

## Overall Metric

**skill.usage-rate = 0% (0/10)**

Zero of the top 10 deployed skills show evidence of being referenced or applied in actual agent work.

## Why Zero Usage?

1. **No `.state/` data exists** — Agent state directories are empty or absent for all checked agents (amy, bob, coder, coach, evaluator, optimizer, qa, scout, tech-lead, may).
2. **No session logs exist** — No `sessions/` directories were found under agent dirs.
3. **No context.md references** — No agent `context.md` file mentions any skill by name.
4. **Skills are deployed as files but never loaded** — The `.md` skill files sit in `agents/*/skills/` directories but there's no evidence the agent runtime reads, injects, or references them during sessions.

## Interpretation

Skills have been **deployed** (copied to agent dirs) but appear to be **inert** — there is no observable mechanism by which agents discover, load, or apply these skill files during their actual work. The deployment pipeline puts files in place, but the consumption pipeline is missing or unobservable.

### Recommendations

1. **Instrument skill loading** — Add logging or state tracking when an agent's session loads a skill file.
2. **Verify injection mechanism** — Confirm that the agent runtime actually reads `skills/*.md` and injects content into agent context.
3. **Search for behavioral evidence** — Some skills may influence behavior without being named explicitly; this audit only checked for explicit references.
