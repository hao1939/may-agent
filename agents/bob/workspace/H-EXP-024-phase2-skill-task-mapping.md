# H-EXP-024 Phase 2: Skill-Task Mapping

**Date**: 2026-05-02 | **Author**: bob

## Summary

Maps task types to relevant skills. Currently 52 shared skills + per-agent skills loaded into every session. Phase 1 showed most sessions reference only 2-4 skills. This mapping enables selective loading.

## Task Type Taxonomy

Based on analysis of 50 recent sessions, agent tasks fall into 7 categories:

### 1. `heartbeat` — Periodic check-in, triage, planning
**Always relevant (3-4 skills):**
- budget-before-act
- request-triage-memoization
- closing-the-loop
- reading-metrics

**Sometimes relevant:**
- escalation (when blocked items found)
- state-check-before-action

### 2. `code-edit` — Modify source files, fix bugs, implement features
**Always relevant (4-5 skills):**
- coder-edit-discipline (read-before-edit)
- verification (verify after change)
- tool-discipline
- structured-plan-writing
- file-safety

**Sometimes relevant:**
- test-integrity-check (when tests involved)
- test-mock-awareness (when mocking)
- error-handling (when debugging)
- baseline-before-change

### 3. `research` — Investigate, analyze data, write findings
**Always relevant (3-4 skills):**
- evidence-over-narrative
- materialize-findings-concise
- consolidate-memory.md
- knowledge-sharing

**Sometimes relevant:**
- contradiction-detection
- sanitize-memory.md

### 4. `evaluation` — Score sessions, assess quality
**Always relevant (3 skills):**
- evaluator-scoring
- deliverable-integrity
- evidence-over-narrative

**Sometimes relevant:**
- verification-consistency

### 5. `delegation` — Assign work to other agents
**Always relevant (3 skills):**
- delegation-verification
- handoff
- agent-coordination

**Sometimes relevant:**
- l3-delegation-metrics
- helping-others

### 6. `project-work` — Multi-session project advancement
**Always relevant (4 skills):**
- working-in-projects
- creating-projects
- progressive-work-persistence
- plan-once-amend

**Sometimes relevant:**
- obstacle-pivot
- know-when-blocked
- idempotent-work-detection

### 7. `experiment` — Design/run/analyze experiments (bob-specific)
**Always relevant (4 skills):**
- baseline-before-change
- evidence-over-narrative
- verification
- materialize-findings-concise

**Sometimes relevant:**
- agent-gym
- prototype-skill-package
- skill-lifecycle

## Universal Skills (load for ALL task types)
These 2 skills are critical safety nets regardless of task:
- **verification** — always verify deliverables
- **state-check-before-action** — check state before acting

## Token Budget Estimates

| Scenario | Skills loaded | Est. tokens |
|----------|--------------|-------------|
| Current (all) | 52 shared + agent-specific | 12K-21K |
| Selective (heartbeat) | 6 | ~1.5K |
| Selective (code-edit) | 7 | ~2K |
| Selective (research) | 6 | ~1.5K |
| Selective (average) | ~7 | ~2K |
| **Reduction** | | **~80%** |

## Implementation Approach

### Option A: Rule-based (recommended for Phase 3)
Detect task type from prompt keywords:
- Contains "heartbeat" → `heartbeat`
- Contains "edit", "fix", "implement", "bug" → `code-edit`
- Contains "research", "investigate", "analyze" → `research`
- Contains "evaluate", "score" → `evaluation`
- Contains "delegate", "assign" → `delegation`
- Contains project name → `project-work`
- Default → `code-edit` + `heartbeat` (safe fallback)

### Option B: LIBRARY.md as index only
Instead of loading skills, load only LIBRARY.md (5K tokens) and let agents `read()` specific skills on-demand. Agents already do this sometimes — make it the standard.

### Recommendation
**Start with Option B** (simplest, no new infrastructure):
1. Stop auto-loading all skill files into context
2. Keep LIBRARY.md as the skill index
3. Add a 1-line instruction: "Consult LIBRARY.md to find relevant skills for your task. Read only what you need."
4. Measure compliance and token usage

If Option B shows agents don't self-serve well, upgrade to Option A (rule-based pre-loading).

## Phase 3 Plan
1. Implement Option B for one agent (bob, since I can self-monitor)
2. Run 10 sessions, measure: which skills I read, token savings, any compliance drops
3. If successful, propose rollout to other agents

## Success Criteria (from hypothesis)
- Token reduction ≥50% on skill context ✅ (projected 80%)
- No compliance regression on critical skills
- At least one measurable improvement
