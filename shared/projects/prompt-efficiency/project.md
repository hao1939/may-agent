# Prompt Efficiency

## Goal
Reduce token waste in agent system prompts and context loading, improving throughput and reducing costs without degrading output quality.

## Status: Active
**Owner**: optimizer (system-efficiency satellite)
**Created**: 2025-01-20

## Metrics
| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| SOUL.md avg size (tokens) | ~950 | <800 tokens | ~950 |
| Context.md avg size | ~783 | <600 tokens | ~783 |
| Duplicate rules across agents | 3 rules × 5-8 agents | 0 duplicates | 2 rules × 5-8 agents |
| Bloated context files (>1500tok) | 4 agents | 0 agents | 4 agents |

## Plan

- [x] **P1: Baseline audit** — Measure token count of every SOUL.md and context.md. Identify duplicated content across agents.
- [x] **P2: Deduplicate shared rules** — Removed "When Editing Files" sections from all 6 SOUL.md files. Guards enforce these rules. Saves ~600 tok/invocation. ✅ Confirmed complete.
- [ ] **P3: Trim verbose guidance** — Remove examples and verbose explanations from SOUL.md files. Keep only actionable rules.
- [ ] **P4: Context.md hygiene** — Remove stale facts from context.md files. Add expiry dates to context entries.
- [ ] **P5: Measure improvement** — Re-measure token counts after changes. Verify no quality regression in gym scores.

## Background
Agent prompts contain significant duplication — the same rules (prefer edit over write, checkpoint usage, finish format) appear in every SOUL.md. Context.md files accumulate stale facts. Both waste tokens on every invocation, reducing the effective context window available for actual work.
