# Architecture Review: src/app/chat-session.ts

**Date**: 2026-04-15  
**Reviewer**: tech-lead  
**File**: `src/app/chat-session.ts` (295 lines)  
**Verdict**: Clean module with well-defined boundaries. One dead method to remove, one DRY opportunity.

---

## 1. Responsibilities (4 — reasonable)

| # | Responsibility | Lines | Notes |
|---|----------------|-------|-------|
| 1 | **Session lifecycle** (create, resume, close, /new) | 75-112, 373-381 | Clean — resume logic handles overflow and stale states |
| 2 | **Input routing** (commands, @agent prefix, normal messages) | 120-190 | Linear if-chain, not a switch jungle |
| 3 | **Message delivery** (sendMessage + retry on session-gone) | 195-270 | Good retry guard with `sendRetryDepth` capping at 2 |
| 4 | **Request tracking** (trackRequest calls for SQLite logging) | 168, 204, 231, 392 | 4 call sites — slightly repetitive (see DRY note below) |

**Assessment**: 4 responsibilities is fine for a 295-line class. No single responsibility is oversized. The class acts as a thin orchestration layer between human input and SubagentManager, which is the right abstraction level.

## 2. Coupling Surface with manager.ts

**7 methods called on SubagentManager**:

| Method | Call count | Purpose |
|--------|-----------|---------|
| `status()` | 9 | Session listing, state checks |
| `cancel()` | 4 | Cancel running sessions |
| `close()` | 3 | Archive stale/overflow sessions |
| `run()` | 2 | Create new sessions |
| `input()` | 1 | Wake idle session with new message |
| `waitForIdle()` | 1 | Track chat session completion |
| `waitFor()` | 1 | Track direct session completion |

**Assessment**: Coupling is **interface-level only** — ChatSession calls public methods on manager and reads status objects. No shared mutable state, no reaching into manager internals, no circular dependencies. This is healthy coupling. The `status()` call at 9 occurrences is high but each usage needs current state, so it's inherent to the design.

## 3. Dead / Redundant Code

### DEAD: `startDirectSession()` — severity: LOW

- **Location**: Lines 385-419 (35 lines)
- **Evidence**: `grep -n 'startDirectSession' src/app/chat-session.ts` returns only the declaration at line 385. Zero call sites.
- **History**: The `@agent` prefix routing was changed to go through May's session (line 162: `Route through May so she can orchestrate via agents fork`), making the direct-session approach dead code.
- **Contains**: Its own `trackRequest` call (line 392) and `manager.run` + `manager.waitFor` usage.
- **Recommendation**: Delete `startDirectSession()` in a cleanup pass. ~35 lines recovered.

### DRY opportunity: `trackRequest` boilerplate — severity: LOW

- **Evidence**: 4 call sites (lines 168, 204, 231, 392) all follow the same pattern: check `this.persistDir`, try/catch with empty catch, same shape of options object.
- **Recommendation**: Extract a `private trackHumanRequest(task, agent, source)` helper. Would reduce ~40 lines of boilerplate to ~10. Not urgent — the repetition isn't causing bugs.

## 4. Input Routing Quality

`handleInput()` (lines 120-190) uses a linear if-chain for 7 built-in commands:

```
status → handleStatus()
cancel all → handleCancelAll()
cancel → handleCancel()
reload → onReload callback
close → onClose callback
restart → onRestart callback
/new → handleNew()
```

Then two code paths: `@agent` prefix → delegation through May, else → normal `sendMessage`.

**Assessment**: This is **clean and readable**. The if-chain is ordered correctly (`cancel all` before `cancel` to avoid prefix match). Each handler is a separate method. The `@agent` routing is well-isolated. No jungle — this would only become a concern at ~15+ commands.

## 5. Resilience Observations

**Good patterns**:
- `sendRetryDepth` guards against infinite recursion when sessions vanish (line 61, checked at line 254)
- Overflow detection in `resumeExistingSession` and `trackCompletion` — prevents crash loops on context overflow
- All `trackRequest` calls wrapped in try/catch with empty catch — logging never breaks chat

**Minor concern**: `resumeExistingSession()` (line 84) is called from the constructor before `onDone` callback could be set up. This is fine because the constructor just sets `this.sessionId` — no callbacks fire. But `resumeAfterLoad()` (line 79) also calls it, and that path *does* call `trackCompletion` which uses `this.onDone`. This works correctly since `resumeAfterLoad` is called after construction.

## 6. Summary & Recommendations

| Item | Severity | Action |
|------|----------|--------|
| Dead `startDirectSession()` method | LOW | Delete in cleanup pass |
| Repeated `trackRequest` boilerplate | LOW | Extract helper (optional) |
| High `status()` call frequency | INFO | Acceptable — no perf concern at current scale |

**Overall**: This is a well-structured module. 295 lines, 4 clear responsibilities, clean interface coupling with manager.ts, no architectural concerns. The single dead method is the only concrete cleanup item.
