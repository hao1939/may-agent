# Learning Dashboard — System Snapshot

**Date**: 2025-01-27

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total lessons in store | 59 | 🟡 All seeded |
| Organic lessons captured | 0 | 🔴 Pipeline not producing |
| Poller sessions processed | 2 | 🟡 Running but no lesson output |
| Context.md total lines | 974 | 🟢 Rich knowledge base |
| Agents with lessons | 6/14 | 🟡 Gap in coverage |

## Pipeline Health

```
Session completes
    → session.completed event  ❌ NEVER EMITTED (core runtime gap)
    → Poller workaround        ✅ Fires, processes sessions
    → session-eval handler     ✅ Dispatches context-learn
    → context-learn handler    ✅ Updates context.md
    → lessons.jsonl append     ❌ NOT IMPLEMENTED
```

**Root cause**: context-learn writes to agent context.md files but does NOT append to lessons.jsonl. The pipeline "works" but its output goes to the wrong place.

## Coverage Gaps

Agents with context.md but 0 lessons extracted:
- **tech-lead** (111 lines) — rich operational knowledge
- **optimizer** (73 lines) — performance patterns  
- **qa** (70 lines) — testing insights
- **amy-kimi** (46 lines) — workflow patterns
- **evaluator** (41 lines) — evaluation methodology
- **architect** (21 lines) — design decisions
- **judge** (22 lines) — assessment criteria
- **master** (21 lines) — coordination patterns

## Next Actions

1. **P0**: Fix context-learn handler to also write lessons.jsonl (not just context.md)
2. **P1**: Extract lessons from 8 uncovered agents' context.md files
3. **P1**: Add session.completed emission to core runtime (filed with tech-lead)
4. **P2**: Implement lesson validation tracking (increment validated_count on use)
