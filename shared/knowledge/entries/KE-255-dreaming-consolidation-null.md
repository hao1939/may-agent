# KE-255: Dreaming/Consolidation Has Zero Effect on Agent Behavior

**Date**: 2026-04-18
**Source**: EXP-183
**Confidence**: High
**Connects**: KE-001, KE-002, KE-011, KE-025

## Core Finding

Dreaming/consolidation (distilled rules OR raw session logs in context.md) has zero effect on agent behavior — 0/15 across 3 arms. Form of memory is irrelevant when context.md injection itself doesn't change procedural behavior.

## Evidence

- EXP-183: 3 arms × 5 trials on `stale-approach-fixation`
- Baseline: 0/5, Consolidated: 0/5, Raw logs: 0/5
- All 15 runs failed only `read-workspace-notes` — identical failure pattern
- Task explicitly instructs reading the file; agent ignores both task instruction AND context.md reminder

## Mechanism / Why

Context.md is read but doesn't override the agent's default approach. The agent jumps to work instead of reading referenced files. This is procedural (how to behave) not environmental (what exists), and KE-001 showed only environmental knowledge transfers via context.md.

## Implications

### 1. Context.md behavioral injection is a dead end
Three experiments now confirm this: EXP-180 (dead ends), EXP-182 (fragility tracking), EXP-183 (consolidation). Stop testing text-based behavioral interventions in context.md.

### 2. OpenClaw's dreaming pattern may need structural mechanisms
The pattern may work there via forced tool calls or system prompt changes, not passive file injection. If we want consolidation to work, it needs guards/workflows, not text.

## Actionable

- Do NOT implement dreaming/consolidation via context.md injection
- If behavioral change is needed, use structural mechanisms (guards, workflows, forced steps)
- Mark this pattern category exhausted for context.md-based approaches

## Open Questions

- Would consolidation work if injected into the system prompt instead of context.md?
- Would a guard that forces reading WORKSPACE_NOTES.md before proceeding actually change outcomes?
