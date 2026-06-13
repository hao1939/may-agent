# P2: Shared Rule Deduplication Analysis

## Finding: Guard-Enforced Rules Duplicated in SOUL.md

Three tool-usage rules appear in 6+ SOUL.md files but are **already enforced by guards**:

| Rule | SOUL.md appearances | Guard enforcement |
|------|-------------------|-------------------|
| Read before edit | 6 agents | `guards/read-before-edit.ts` |
| Verify after write | 6 agents | `guards/verify-after-write.ts` |
| Prefer edit() over write() | 6 agents | `guards/verify-after-write.ts` (implicit) |

### Affected SOUL.md files
- `agents/amy/SOUL.md`
- `agents/arc/SOUL.md`
- `agents/bob/SOUL.md`
- `agents/coach/SOUL.md`
- `agents/dev/SOUL.md`
- `agents/scout/SOUL.md`

### Token cost per invocation
Each agent's "When Editing Files" section: ~80-120 tokens × 6 agents = **~600 tokens wasted per parallel invocation**.

Over a typical heartbeat cycle with 4-6 agent invocations: **~2400-3600 tokens/cycle**.

## Recommendation

**Remove the "When Editing Files" section from these 6 SOUL.md files.** The guards already enforce the behavior. Keeping the rules in SOUL.md provides no additional benefit since:

1. Guards block non-compliant tool calls regardless of SOUL.md content
2. The `vae-primer.ts` and `rbe-primer.ts` guards likely inject reminders when violations are detected

### Risk: Low
If an agent somehow bypasses the guard, the worst case is a missed verification — which the guard would catch anyway.

### Implementation
For each affected SOUL.md, remove the "When Editing Files" section (or equivalent block containing these 3 rules). Estimated effort: 1 session.

## Status
Analysis complete. Ready for implementation pending approval.
