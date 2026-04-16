# Tool Quality Report

**Generated**: 2026-04-11T15:24  
**Window**: 24h  
**Total calls**: 2167  
**Wasted calls**: 31  
**Waste rate**: 1.4% ↓  
**Sessions with failures**: 4  

## Waste Rate Trend

2.6% → 2.7% → 2.9% → 2.5% → 2.3% → **1.4%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 9
- **Wasted**: 24
- **Agents**: bob(9)
- **Examples**:
  - `[bob] exec failed: {"command":"grep -n \"EXP-122\\|DD-739\\|DD#739\" agents/shared/knowledge/INDEX. — (no output)

Command exi`
  - `[bob] exec failed: {"command":"grep -n \"^| ✅ | \\*\\*EXP-121\" agents/shared/knowledge/INDEX.md"} — (no output)

Command exit`
  - `[bob] exec failed: {"command":"grep -n \"EXP-121\" agents/shared/knowledge/INDEX.md"} — (no output)

Command exited with code `

### bash:nonexistent-path
- **Count**: 2
- **Wasted**: 4
- **Agents**: bob(2)
- **Examples**:
  - `[bob] exec failed: {"command":"cd /root/the-hierarchical-council && git status --short agents/share — /bin/bash: line 1: cd: /`
  - `[bob] exec failed: {"command":"cd /root/the-hierarchical-council && git status --short agents/share — /bin/bash: line 1: cd: /`

### read:other
- **Count**: 2
- **Wasted**: 2
- **Agents**: bob(2)
- **Examples**:
  - `[bob] read failed: Offset 695 is beyond end of file (688 lines total)`
  - `[bob] read failed: Offset 695 is beyond end of file (688 lines total)`

### edit:other
- **Count**: 1
- **Wasted**: 1
- **Agents**: bob(1)
- **Examples**:
  - `[bob] edit failed: No changes made to agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md. The replacement produced identic`

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 9 | 24 | bob(9) |
| bash:nonexistent-path | 2 | 4 | bob(2) |
| read:other | 2 | 2 | bob(2) |
| edit:other | 1 | 1 | bob(1) |