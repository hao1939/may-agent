# EXP-183 Results: Dreaming/Consolidation

**Date**: 2026-04-18
**Status**: COMPLETE

## Summary

**NULL RESULT**: Neither consolidated distilled rules nor raw session logs changed agent behavior. All 3 arms scored identically: 0/15 pass (0%).

## Raw Results

| Arm | Variant | Pass Rate | Failed Criterion | N |
|-----|---------|-----------|-----------------|---|
| A | baseline | 0/5 (0%) | read-workspace-notes | 5 |
| B | exp183-consolidated | 0/5 (0%) | read-workspace-notes | 5 |
| C | exp183-raw-logs | 0/5 (0%) | read-workspace-notes | 5 |

All 15 runs passed 6/7 criteria — only `read-workspace-notes` consistently failed across all arms.

## Analysis

### What happened

The agent never reads WORKSPACE_NOTES.md despite:
- The task explicitly saying "read the WORKSPACE_NOTES.md file"
- Arm B: 2-line distilled rule saying "ALWAYS read referenced context files FIRST"
- Arm C: 20 lines of raw session logs with repeated emphasis on reading WORKSPACE_NOTES.md

### Why consolidation didn't help

1. **The knowledge is procedural, not environmental** (KE-001): "Read referenced files" is a behavioral instruction. Context.md injection works for facts ("npx is unavailable") but not for behavioral changes.

2. **Instruction overhead paradox** (KE-025): Adding more instructions to context.md doesn't change behavior — the agent has its own approach and follows it regardless.

3. **The task itself says to read the file**: If the agent ignores the explicit task instruction, it will also ignore the context.md reminder. The problem isn't *knowing* to read the file — it's *prioritizing* it over jumping straight to work.

### Connection to prior results

- **EXP-180** (Dead Ends Memory): Also 0pp effect — general advice in context.md doesn't change behavior
- **KE-002**: Identity/preference/procedural knowledge in context.md has zero impact
- **KE-011**: Knowledge files are passive — agents skip them in oneshot mode

## Conclusion

**Dreaming/consolidation as context.md injection does NOT work.** The form of memory (distilled vs raw) is irrelevant when the injection mechanism itself has no behavioral effect. This is the 3rd experiment (EXP-180, EXP-182, EXP-183) confirming that context.md text changes don't fix behavioral patterns.

The "dreaming" pattern from OpenClaw may work in their system because of different injection mechanisms (e.g., system prompt modification, forced tool calls, or structural guards). In our system, context.md is passive and ignored for procedural knowledge.

## Decision

**REJECT** — Dreaming/consolidation via context.md injection has no measurable effect. Do not implement.

## Cost

~15 gym runs × ~$0.08 = ~$1.20
