# Prompt Efficiency

## Goal
Reduce token waste in agent system prompts and context loading, improving throughput and reducing costs without degrading output quality.

## Status: Active
**Owner**: optimizer
**Created**: 2025-01-20

## Metrics (updated 2025-07-02)
| Metric | Baseline | Target | Current | Status |
|--------|----------|--------|---------|--------|
| SOUL.md avg size (words) | ~950 | <600w | 461w avg (14 agents) | ⚠️ 3 agents >600w: qa(841), coach(793), eval(787). bob/master/amy/tech-lead trimmed. |
| Context.md avg size (words) | ~783 | <450w | 218w | ✅ Done |
| Duplicate rules across agents | 3 rules × 5-8 | 0 duplicates | 2 rules × 5 | ⚠️ Blocked: need tech-lead |
| Bloated context files (>1000w) | 4 agents | 0 agents | 0 agents | ✅ Done |

## Plan

- [x] **P1: Baseline audit** — Measure token count of every SOUL.md and context.md. Identify duplicated content across agents.
- [x] **P2: Deduplicate shared rules** — Removed "When Editing Files" sections from all 6 SOUL.md files. Guards enforce these rules. Saves ~600 tok/invocation. ✅ Confirmed complete.
- [ ] **P3: Trim verbose guidance** — 3 agents remain >600w: qa(841w), coach(793w), evaluator(787w). Trim each to <600w.
- [x] **P4: Context.md hygiene** — Context.md avg now 226w (target <450w). All files under 340w. ✅ Done.
- [ ] **P5: Measure improvement** — Re-measure token counts after changes. Verify no quality regression in gym scores.

### Re-plan (2025-07-15)
P3 is the blocker. Worker must trim qa, coach, evaluator SOUL.md files to <600w each. Then P5 measurement.

## Background
Agent prompts contain significant duplication — the same rules (prefer edit over write, checkpoint usage, finish format) appear in every SOUL.md. Context.md files accumulate stale facts. Both waste tokens on every invocation, reducing the effective context window available for actual work.
