# Todo File Bloat Analysis — 2026-03-16

## Problem

Agent todo.md files have grown to the point where they cause measurable waste:

| Agent | File Size | Completed [x] | Open [ ] | Completed % |
|-------|-----------|---------------|----------|-------------|
| May | 123KB (626 lines) | 472 | 9 | 98.1% |
| Tech-Lead | 120KB (642 lines) | 272 | 118 | 69.7% |

## Impact

### Redundant Reads (direct cost)
- **30.5% of sessions** (61/200 sampled) read the same file 3+ times
- **todo.md accounts for 42 of 61** redundant-read sessions (69%)
- May alone: 32 instances of redundant todo.md reads
- Each read sends ~50KB (12,500 tokens) of mostly completed items back to the model
- **Estimated waste: $3.75 per affected May session** (redundant output tokens + context carry-forward)

### Context Pollution (indirect cost)
- When May reads her todo.md, 98% of what she sees is completed work
- The model processes 30,750 tokens of todo.md content, of which ~30,000 tokens are irrelevant
- This crowds out useful context and contributes to step-order violations (May's #1 failure mode)

### Connection to EvoSkill findings
- EvoSkill analysis (2026-03-16) identified "May dominates failures (22/41 issues, 54%) — almost all heartbeat step-order violations"
- Recommendation was "truncate/archive completed todo items to reduce context pressure"
- This analysis confirms the scale: **123KB of context noise**

## Proposed Fix

### For May: Archive completed items
1. Move all `- [x]` items and their sub-items to `agents/may/workspace/archive/todo-completed-2026-03-16.md`
2. Remove system-status noise lines (8 lines of duplicate anomaly alerts)
3. Keep only open items, section headers, and strategic context
4. **Expected result**: 123KB → ~15KB (88% reduction)

### For Tech-Lead: Archive completed items
1. Move all `- [x]` items to `agents/tech-lead/workspace/archive/todo-completed-2026-03-16.md`
2. Keep only open items and section headers
3. **Expected result**: 120KB → ~50KB (58% reduction)

### Ongoing prevention
Add a heartbeat step or handler that warns when todo.md exceeds 30KB and suggests archiving.

## Evidence

```
$ wc -c agents/may/workspace/todo.md
122995 agents/may/workspace/todo.md

$ grep -c "\- \[x\]" agents/may/workspace/todo.md
472

$ grep -c "\- \[ \]" agents/may/workspace/todo.md
9
```

Redundant read analysis: 200-session scan showed 42 sessions with 3+ reads of todo.md.
Top affected agents: may (32), tech-lead (13), amy-kimi (8), amy-kimi-c40 (4).
