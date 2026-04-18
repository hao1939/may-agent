# Lens D Assessment: verify-wrap Integration for Scout FM-3.3

**Date**: 2026-04-11  
**Author**: Tech Lead  
**Input**: EXP-138 (Coach), verify-wrap workflow  
**Verdict**: **DO NOT wire in as proposed. Address root cause instead.**

---

## What Coach Proposed

Wire `verify-wrap` into scout's heartbeat dispatch so forked work sessions run through `workflow.run('verify-wrap', task)` instead of raw `agents.fork()`. This would add a Phase 2 verification session that reads back all written files.

## What I Found

### Problem 1: Scout doesn't fork work sessions

The entire premise — "replace raw `agents.fork()` with `workflow.run('verify-wrap', ...)`" — assumes scout forks work sessions from its heartbeat. **It doesn't.**

DB evidence (last 7 days):
- 0 scout sessions with task NOT matching `[heartbeat]`  
- All 30+ daily sessions are heartbeat sessions dispatched by cron  
- High-op heartbeats (22-62 ops) are doing inline research, writing deep dives, editing papers.md — all within the heartbeat session itself

Scout's heartbeat.md says "fork substantive work into separate sessions" and has detailed fork templates. But scout ignores this entirely and does everything inline. This means there is **no dispatch point to intercept** — you can't replace `agents.fork()` calls that don't exist.

### Problem 2: verify-wrap hard-codes "scout"

`verify-wrap.ts` lines 88 and 128:
```typescript
const phase1 = await ctx.runAgent("scout", ctx.task);
const phase2 = await ctx.runAgent("scout", verifyPrompt);
```

For a "shared" workflow in `shared/workflows/`, it hard-codes the agent name. If optimizer or may wanted to use it, they'd need to modify the source. This should take the agent name from context or as a parameter.

### Problem 3: The real FM-3.3 failure is C1.3 convention violations

The "67-71% FM-3.3 block rate" from EXP-137 maps to **convention check failures**, specifically:

| Convention | Pass Rate | What It Checks |
|---|---|---|
| C1.3 (verify-after-write) | 70.0% | `write()` followed by `read()` back |
| C1.1 (read-before-edit) | 74.1% | `read()` before `edit()` |
| C12.1 (context file first) | 75.2% | Read context file in first 5 tool calls |

Recent C1.3 violations (last 3 days):
```
write(agents/shared/deep-dives/DD-713-*.md) not verified with subsequent read
write(agents/shared/deep-dives/DD-714-*.md) not verified with subsequent read
write(agents/scout/workspace/deep-dives/dd705-*.md) not verified with subsequent read
```

Scout writes deep dives and papers updates without reading them back. This happens in **production heartbeat sessions**, not in forked work sessions.

### Problem 4: verify-wrap can't wrap heartbeat sessions

Heartbeat sessions are dispatched by `cron.ts fireHeartbeat()` → `manager.run()`. This is the system scheduler, not agent-level dispatch. You'd need to modify `src/app/cron.ts` to route scout's heartbeat through verify-wrap — which would mean:

1. The heartbeat itself becomes Phase 1 of verify-wrap
2. After the heartbeat finishes, verify-wrap spawns a Phase 2 session to read back everything

This is technically possible but architecturally wrong:
- Heartbeats are supposed to be fast (triage + dispatch). Adding a Phase 2 verification session doubles the cost.
- The real issue is that scout doesn't follow its own heartbeat pattern (triage → fork). Adding a verification wrapper around a broken pattern doesn't fix the broken pattern.

### Problem 5: Gym can't validate this

EXP-138 results confirm what we already knew: scout passes gym verification scenarios at **100% baseline** (8/8). The gym tests simple focused tasks where the agent remembers to verify. Production sessions are 30-62 ops of multi-concern work where verification habits degrade. There's no way to A/B test this in gym.

---

## Root Cause Analysis

The root cause is not "scout lacks workflow-level verification enforcement." The root cause is:

1. **Scout doesn't fork** — All work happens inline in heartbeats. This means:
   - Sessions are long (30-62 ops) with mixed concerns
   - Context pressure causes verification habits to degrade
   - No natural "phase boundary" where verification could be enforced

2. **C1.3 violations are writes without read-back** — When scout writes 5 deep dives in a session, it doesn't read any of them back. This is a discipline issue that verify-wrap *could* address if it could wrap scout's work, but it can't because of Problem 1.

## What Would Actually Work

### Option A: Fix the dispatch pattern first (recommended)

Get scout to actually fork work sessions as its heartbeat instructs. Then verify-wrap becomes viable as a wrapper around those forked sessions.

This requires:
1. Understanding WHY scout doesn't fork (is the heartbeat instruction unclear? Does scout not have the `agents` tool? Is the fork pattern not modeled in few-shots?)
2. Fixing the root cause of inline work
3. THEN evaluating verify-wrap as a wrapper

### Option B: System-level post-session verification (alternative)

Instead of wrapping individual sessions, add a post-session convention checker in `cron.ts` that:
1. After any scout heartbeat completes
2. Extracts files written (same logic as verify-wrap's `extractWrittenFiles`)
3. Spawns a quick verification session that reads them back
4. Logs violations

This doesn't require changing scout's dispatch pattern and addresses the problem where it actually occurs.

### Option C: Strengthen the C1.3 guard (cheapest)

The C1.3 convention check already catches 30% of violations. Instead of adding a verification workflow, invest in making the guard more actionable:
1. Move C1.3 from "convention check" to "session gate" — block `finish()` if there are unverified writes
2. This is what FM-3.3 does for other agents (tech-lead, bob) and it works well for them

---

## verify-wrap Code Quality Notes

The implementation is clean and well-structured (154 lines). The `extractWrittenFiles()` function is thorough — covers tool calls, tool results, and compacted context. The Phase 2 prompt is well-designed with clear instructions.

Issues to fix before any production use:
1. **Hard-coded "scout"** → Should be parameterized or use a context variable
2. **No retry on Phase 2 failure** → If verification fails, the entire workflow escalates with no recovery path
3. **bash-created files invisible** → `extractWrittenFiles()` only catches `write()`/`edit()` tool calls, not `bash` commands that write files

## Recommendation

**Do not wire verify-wrap into scout's heartbeat.** The integration point doesn't exist (scout doesn't fork).

Instead:
1. **P1**: Investigate why scout doesn't fork work sessions (Option A) — this is a more fundamental issue worth fixing independently
2. **P2**: Fix verify-wrap's hard-coded agent name before any production use
3. **P3**: Consider Option B (post-session verification) as a system-level alternative

---

## Tags
`fragility-lens`, `FM-3.3`, `verify-wrap`, `scout`, `convention-C1.3`, `dispatch-pattern`
