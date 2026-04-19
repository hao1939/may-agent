# Skill Injection Reduction

**Problem**: Skills (agents/<name>/skills/*.md) are bulk-injected into every system prompt, adding 8-46KB (2-12K tokens) before any work begins. This is the #1 startup overhead contributor.

| Agent     | Skills bytes | Files | % of system prompt |
|-----------|-------------|-------|--------------------|
| bob       | 35KB        | 9     | ~55%               |
| coach     | 42KB        | 7     | ~62%               |
| optimizer | 26KB        | 6     | ~51%               |
| tech-lead | 23KB        | 6     | ~50%               |
| may       | 8KB         | 4     | ~22%               |

Key waste patterns:
1. **`evidence-over-narrative.md` (10KB)** — duplicated in bob, coach, optimizer, tech-lead (40KB total). Could be in shared common-sense.md as a 1-line reference.
2. **`read-only-finish-protocol.md` (8.6KB)** — duplicated in bob and optimizer. Very long for a procedural guard.
3. **`verify-after-edit.md` (2.6-3.5KB)** — duplicated in 5 agents. Universal behavior, belongs in common-sense.md.

## Proposed Fixes (ordered by impact)

### Fix 1: Deduplicate shared skills → common-sense.md summaries
Move `evidence-over-narrative.md` and `verify-after-edit.md` content into 2-3 line summaries in common-sense.md. Delete per-agent copies.

**Savings**: ~50KB across all agents (10KB evidence × 4 agents + 3KB verify × 5 agents)

### Fix 2: Compress verbose skills
`read-only-finish-protocol.md` (8.6KB) and `work-session-scaffold.md` (7KB) contain detailed procedures that could be summarized to 1KB each. The full versions could live in knowledge/ for reference.

**Savings**: ~15KB across agents with these skills

### Fix 3: Cap per-agent skill budget
Add a config option `maxSkillsBytes` (default 10KB). If skills exceed the budget, inject only the skill filenames with a note "read <path> if relevant to current task." This creates lazy loading.

**Savings**: Caps worst case (coach) from 42KB to 10KB.

## Expected Total Impact
- Current: 8-42KB skill injection (avg ~27KB across agents, ~7K tokens)
- After fixes 1+2: ~5-15KB (avg ~8KB, ~2K tokens)
- Overhead reduction: ~5K tokens per session = ~20% of current startup

## Implementation Order
1. Fix 1 first (pure data change, no code, biggest impact)
2. Fix 2 (data change, moderate effort)
3. Fix 3 (code change in manager.ts, safety net)
