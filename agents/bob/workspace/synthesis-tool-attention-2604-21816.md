# Synthesis: Tool Attention Paper Validates Selective Loading Direction

**Date**: 2026-04-26 | **Source**: arXiv:2604.21816 (Tool Attention Is All You Need) via scout triage

## Key Connection

This paper independently validates our H-EXP-024 / H-EXP-028 findings:

| Our Finding | Paper's Finding |
|---|---|
| H-EXP-028: Agents shallow-read skills when too many loaded | "Reasoning degradation at ~70% context utilization" |
| H-EXP-024: LIBRARY.md index could save 95% tokens | Two-phase lazy loader: 95% reduction (47k→2.4k tokens) |
| H-EXP-027: Structural > text interventions | Intent-schema overlap scoring (structural gating) > prompt instructions |

## What They Did That We Haven't

Their "intent-schema overlap scoring" dynamically selects top-k tools per turn. Our LIBRARY.md is static (read all summaries, manually decide). The paper suggests we could automate: match the task description against skill summaries to auto-select relevant skills.

## Actionable Implication

Our LIBRARY.md artifact (from H-EXP-024) is the right primitive. If skill loading infrastructure ever changes, the paper's two-phase approach is the validated pattern:
1. Phase 1: Compact skill summaries (~50 tokens each) always loaded
2. Phase 2: Full skill content loaded on-demand when summary matches task intent

## Status

No new experiment needed — this is external validation of our existing (partial) result. Filed as literature grounding for H-EXP-024.
