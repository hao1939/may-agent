# Audit: manager.ts runTurn() Flow — Lens B

**Date**: 2026-04-14  
**Scope**: Hot path from LLM response → tool parse → tool execution → guard interception → result assembly → next LLM call  
**Files traced**: `src/lib/manager.ts` (2477 lines), `src/lib/manager-receipts.ts` (~300 lines), `src/lib/tools/compose-guards.ts` (~80 lines)

---

## 1. Architecture Finding: There Is No runTurn()

**manager.ts does not have a runTurn or handleToolCalls method.** The inner loop is entirely delegated to `@mariozechner/pi-agent-core`'s `Agent` class. Manager.ts is a lifecycle orchestrator, not a runtime loop.

This is a **good** architectural decision — it means the hot path has exactly one owner (pi-agent-core) and manager.ts only wraps it with cross-cutting concerns.

## 2. The Actual Hot Path (per tool call)

```
pi-agent-core Agent loop
  │
  ├─ LLM response parsed → tool calls extracted (pi-agent-core internal)
  │
  ├─ For each tool call → wrapped execute() in wrapToolsWithReceipts()
  │   │
  │   ├─ Layer 1: beforeToolCall guard chain (composeGuards)
  │   │   ├─ 1. emptyArgsGuard
  │   │   ├─ 2. toolSchemaGuard
  │   │   ├─ 3. pathHallucinationGuard
  │   │   ├─ 4. completenessGuard
  │   │   ├─ 5. finishGuard
  │   │   ├─ 6. commitGuard
  │   │   ├─ 7. verificationDepthGuard
  │   │   ├─ 8. readDedupGuard
  │   │   ├─ 9. sessionReadGuard
  │   │   ├─ 10. scrapeDedupGuard
  │   │   └─ 11. costLimitGuard (auto-appended by composeGuards)
  │   │
  │   ├─ Layer 2: Tool Pivot Heuristic check (identical-args failure count)
  │   │
  │   ├─ Layer 3: Actual tool.execute() (bash, read, write, edit, etc.)
  │   │
  │   ├─ Layer 4: Post-execution bookkeeping
  │   │   ├─ opCount increment (state-changing tools only)
  │   │   ├─ totalToolCalls increment (all tools)
  │   │   ├─ HMAC receipt signing
  │   │   ├─ receipt JSONL logging
  │   │   ├─ Tool Pivot error tracking
  │   │   ├─ Cost Signal injection (>2s or >10KB)
  │   │   ├─ Guard warning injection
  │   │   ├─ Stuck detection warning
  │   │   └─ <tool_output> XML wrapping
  │   │
  │   └─ Layer 5: finish() special case → queueMicrotask abort
  │
  ├─ Tool results assembled → sent back to pi-agent-core
  │
  └─ pi-agent-core builds next message → next LLM call
```

## 3. Layer Count: 5 Layers of Interception

| Layer | Purpose | Lines | Necessary? |
|-------|---------|-------|------------|
| Guard chain (11 guards) | Pre-execution validation | ~80 + individual guards | **Mixed** — see §4 |
| Pivot Heuristic | Block identical failing calls | ~15 | **Yes** — prevents infinite retry loops |
| Tool execution | The actual work | varies | **Obviously yes** |
| Post-exec bookkeeping | Signing, counting, logging | ~80 | **Mostly yes** — some is redundant |
| finish() abort | Session termination | ~5 | **Yes** — clean shutdown |

**Total indirection per tool call**: The wrapped `execute()` function in `wrapToolsWithReceipts` is ~200 lines. Every single tool call — including simple reads — runs through all of this.

## 4. Complexity Assessment

### What's Good
- **Single interception point**: `wrapToolsWithReceipts` is the ONLY place tool calls are intercepted. No scattered hooks.
- **Guard composition is clean**: `composeGuards()` is a straightforward pipeline — first blocker wins, warnings propagate.
- **Fail-open guards**: Guard crashes don't block tool execution. Good resilience.
- **Clear ownership**: pi-agent-core owns the loop, manager-receipts.ts owns wrapping.

### What's Concerning

**C1: 11 guards is a lot.**  
Every tool call runs through 11 sequential async guards. Most are no-ops for most tools (e.g., commitGuard only fires for bash+git), but they still run. KE-134 says 2-3 gates is optimal, 4+ starts declining. We have 11.

*Mitigation idea*: Guards could declare which tool names they care about. composeGuards() could skip inapplicable guards. Zero behavioral change, just skip obvious no-ops.

**C2: wrapToolsWithReceipts is a 200-line god function.**  
It handles:
- Guard execution + redirect/steer injection
- Op budget enforcement (commented out but code present)
- Pivot heuristic (error tracking + blocking)
- HMAC signing
- Receipt logging
- Cost signal injection
- Guard warning injection  
- Stuck detection injection
- finish() abort scheduling
- `<tool_output>` XML assembly

This is the most critical function in the system and it mixes 8+ concerns in one closure. A bug here affects every agent, every tool, every call.

**C3: Session lookup indirection.**  
`getSession()` has a lazy-cache pattern with null vs undefined semantics — it tries the Map, caches null on miss, retries on null. This is defensive but the comments explain why it's needed (race condition with activeSessions.set timing). Not a bug, but subtle.

**C4: Guard blocking returns tool_output XML, but the blocked call still increments totalToolCalls.**  
Line ~180 of manager-receipts.ts: `if (blockedSession) blockedSession.totalToolCalls++`. This means guard blocks count toward shallow heartbeat detection. Could cause false positives on sessions with many guard-blocked calls.

**C5: Multiple message injection paths.**  
Guards can:
1. Block → return error as tool result
2. Redirect → steer() a new user message + return error
3. Steer → inject guidance via steer() (non-blocking)
4. Warn → append to tool output text

Post-execution can also:
5. Inject pivot critique text
6. Inject cost signal text  
7. Inject stuck warning text

That's 7 different ways a tool call can inject extra content into the conversation. Each has different delivery mechanisms (steer vs tool output text).

### Not Found (Good News)
- **No unnecessary async boundaries**: Guards are async but that's because the interface requires it. No gratuitous Promise wrapping.
- **No double-wrapping**: Tools are wrapped once in `createAgent()`, not re-wrapped on resume.
- **No hidden state machines**: The flow is linear — guards → execute → post-process. No state transitions to track.

## 5. Recommendations

| Priority | Item | Effort |
|----------|------|--------|
| P1 | Extract wrapToolsWithReceipts into focused functions: `runGuards()`, `runTool()`, `postProcess()`, `assembleResult()` | Medium |
| P2 | Add tool-name filtering to composeGuards (skip guards for irrelevant tools) | Low |
| P3 | Audit whether guard-blocked calls should increment totalToolCalls | Low |
| P3 | Document the 7 message injection paths — they interact with each other | Low |

## 6. Summary

The hot path is **well-structured at the macro level** (single owner, single interception point) but **complex at the micro level** (200-line god function with 11 guards and 7 injection paths). The main risk isn't performance — it's maintainability. A bug in `wrapToolsWithReceipts` is a system-wide bug, and the function does too many things to review confidently.

The pi-agent-core delegation is correct. The guard composition pattern is clean. The main technical debt is in `wrapToolsWithReceipts` itself.
