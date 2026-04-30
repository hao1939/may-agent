# Preference Signals Extracted from Hao's Git Commits

**Date**: 2025-07-03
**Source**: `git log --author="Hao Yuan" --since="3 months ago"` (30 commits analyzed)
**Method**: Implicit preference extraction from commit patterns, refactors, reverts, and structural choices

---

## New Preference Signals (not yet in preferences.md)

### P6: Lean Documentation — Trim Aggressively
**Evidence**:
- `trim optimizer codebase.md (2.4KB→458B)` — 80% reduction
- `trim lessons.md, add optimization loop to domain.md`
- `trim lessons — remove entries for structurally-fixed issues`
- `chore: remove obsolete operations-plan.md and improvement-plan.md`
- `fix knowledge files: remove aspirational rules, reflect actual behavior`

**Implication**: Hao actively prunes documentation. Docs should reflect *current reality*, not aspirations. Shorter is better. Remove entries when the underlying issue is structurally fixed.

**Decision rule**: If a lesson/doc entry describes something already enforced by code/guards, delete it.

---

### P7: Agents Do Cognitive Work, Not Chores (P40 in philosophy.md)
**Evidence**:
- Explicit commit: `philosophy P40 "Agents Do Cognitive Work, Not Chores"`
- Pattern: Hao builds *infrastructure* (cron jobs, handlers, status tools) so agents can focus on reasoning

**Implication**: Repetitive/mechanical tasks should be automated into cron/handlers. Agent sessions are for thinking, designing, evaluating.

---

### P8: Structural Enforcement Over Behavioral Rules
**Evidence**:
- `fix: structural enforcement of workflow usage and verification`
- `revert: remove forced workflow usage, let evaluator handle it` (tried structure, reverted when wrong layer)
- `trim lessons — remove entries for structurally-fixed issues`
- Philosophy: if you can make bad behavior *impossible* via code, do that instead of writing rules

**Implication**: Prefer guards/code that prevent mistakes over documentation that says "don't do X". Once structurally fixed, remove the lesson.

---

### P9: Ground Claims in Evidence
**Evidence**:
- `bob: ground philosophy.md in evidence — tag provenance, fix contradictions, add missing principles`
- `fix knowledge files: remove aspirational rules, reflect actual behavior`
- `Fix inaccuracies in system-design.md and team.md`
- `revert coder commits claim: coder does not commit, May handles git`

**Implication**: Every claim in docs must be traceable to actual behavior or explicit decision. No wishful documentation. Correct inaccuracies immediately.

---

### P10: STUCK Escalation — Don't Spin
**Evidence**:
- `add STUCK escalation convention — agents mark items [STUCK] after 2 failed attempts instead of spinning`

**Implication**: 2 attempts max on any blocker, then escalate. Spinning is waste.

---

## Reinforced Existing Preferences

| Existing Pref | New Evidence |
|---|---|
| P1 (Stability First) | 13/30 commits are fixes, trims, cleanups — not new features |
| P4 (Observability) | Built system-status cron, watchdog handler, daily-brief handler |
| Anti-pattern #7 (zombie projects) | `chore: remove obsolete operations-plan.md` — kills dead artifacts |

---

## Hao's Architectural Style (from code commits)

1. **Handler-based architecture**: Separate files per concern (`drain-todo.ts`, `evaluate-sessions.ts`, `system-status.ts`, `watchdog.ts`)
2. **Cron-driven automation**: Builds scheduled jobs rather than relying on manual triggers
3. **Config over code**: Uses `agent.json`, `cron.json` — declarative configuration
4. **Small, focused commits**: Average commit touches 2-5 files, clear scope
5. **Refactor > accumulate**: Regularly restructures (lessons.md, cron.json, agent.json) rather than appending

---

## Recommended Updates to preferences.md

Add sections P6–P10 above. These are high-confidence signals (multiple commits reinforcing each pattern). The "Architectural Style" section could become a new "Code & Design Preferences" section.

---

## Methodology Note

This analysis used git commit messages and diffstats only. Deeper analysis could:
- Read full diffs of refactoring commits to understand *what* was removed
- Track which agent configurations Hao changes most (signal of dissatisfaction)
- Monitor revert patterns (signal of failed experiments)
