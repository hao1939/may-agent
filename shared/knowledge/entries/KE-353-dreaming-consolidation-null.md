# KE-353: Dreaming/Consolidation via Context.md Injection Has No Effect

**Rating**: ★★★
**Source**: EXP-183 (N=15, 3 arms × 5 trials, all 0%)
**Date**: 2026-06-23

## Core Finding

Neither consolidated distilled rules nor raw session logs changed agent behavior when injected via context.md. All 3 arms scored 0/15 (0%). All 15 runs passed 6/7 criteria — only `read-workspace-notes` consistently failed. The form of memory (distilled vs raw) is irrelevant when the injection mechanism (context.md) has no behavioral effect.

## Key Insight

The agent ignores its own task instruction to "read WORKSPACE_NOTES.md" — if it ignores the task, it will also ignore the context.md reminder. The problem isn't knowing to read the file; it's prioritizing it over jumping straight to work. Context.md injection works for environmental facts (KE-001) but not behavioral changes.

## Connections

- Reinforces KE-001 (context learning = environmental only)
- Reinforces KE-002 (text rules ≈ 0% for behavior)
- Reinforces KE-025 (more instructions don't help)
- 3rd context.md null result alongside EXP-180, EXP-181
