# Mode B Finding: Tech-Lead Tool Gaps
**Date**: 2026-04-19  
**Scope**: 20 tech-lead sessions with >20 ops (top session: 338 ops)  
**Data source**: .state/sessions/history/*/session.jsonl + meta.json

---

## Pattern #1: Redundant `export PATH` on Every Bash Call
**Frequency**: Present in 18/20 high-op sessions  
**Ops cost**: 5–119 occurrences per session (median ~30). In s_1775516539038_111: 119 PATH exports across 143 ops = 83% of bash calls include this boilerplate.  
**Root cause**: Tech-lead's context.md says `bun is at .state/.bun/bin/bun — add to PATH`. The agent prepends `export PATH=".state/.bun/bin:$PATH"` to nearly every bash command, even when bun isn't needed (e.g., `cat`, `grep`, `ls`).

**Proposal**: Add `.state/.bun/bin` to the default PATH in the shell environment (e.g., via `.bashrc` or the bash tool's env config). This is a zero-risk infrastructure change.  
**Estimated savings**: ~15-30 ops/session in wasted tokens (the command itself is harmless but adds ~50 tokens per call × 30 calls = 1,500 tokens/session).  
**Dispatch?**: ✅ YES — low risk, high frequency. Update shell env or bash tool default PATH.

---

## Pattern #2: Sleep-Poll Loop for Delegated Work
**Frequency**: Found in s_1776180568119_224 (the 338-op session) — 25 sleep calls  
**Ops cost**: ~25 ops per occurrence. Pattern is: `sleep N && echo done` → `cat result-file` → repeat with increasing sleep (60→120→180→300s).  
**Root cause**: Tech-lead delegates work via `agents.call()` or `agents.fork()`, then manually polls for results by sleeping and checking output files. The 338-op session burned ~50 ops (15%) just on sleep+check cycles.

**Proposal**: The `agents.call()` tool already blocks until completion. If tech-lead is using `agents.fork()` + manual polling, the fix is a SOUL.md/context.md note: "Use `agents.call()` for synchronous delegation instead of fork+sleep polling." If there's a legitimate async case, add an `agents.wait(sessionId)` tool that blocks until the forked session completes.  
**Estimated savings**: 20-50 ops in sessions where this occurs.  
**Dispatch?**: ⚠️ INVESTIGATE — need to confirm whether `agents.call` covers the use case. If it does, this is a context.md fix (free). If not, an `agents.wait` tool is needed.

---

## Pattern #3: Repeated `cat` of Same Files Across Retry Loops
**Frequency**: Found in s_1776158541712_115 (272 ops) — same 7 files read 29 times each (203 redundant reads).  
**Ops cost**: 203 redundant file reads × ~500 tokens avg = ~100K wasted tokens in one session.  
**Root cause**: The session was implementing a feature touching workflow.ts, workflow-tool.ts, workflow-guards.test.ts, etc. Each edit attempt re-read all files from scratch — likely due to context window limits or the agent losing track of file contents across long sessions.

**Proposal**: This is an inherent LLM context limitation, not easily toolable. However, two mitigations:
1. **Break large tasks into smaller delegations** — instead of one 272-op session editing 7 files, delegate focused sub-tasks to coder (each reads files once).
2. **Add a `workspace-snapshot` tool** that concatenates key files into a single cached reference, reducing re-read overhead.

**Estimated savings**: 50-100 ops in multi-file editing sessions.  
**Dispatch?**: ❌ NO immediate dispatch. The delegation pattern (mitigation 1) is a coaching concern, not a tool gap. Mitigation 2 has unclear ROI.

---

## Summary

| # | Pattern | Freq | Ops/Session | Fix Type | Dispatch? |
|---|---------|------|-------------|----------|-----------|
| 1 | Redundant PATH export | 18/20 sessions | 15-30 | Infra (env config) | ✅ YES |
| 2 | Sleep-poll delegation | 1-2/20 sessions | 25-50 | Context or new tool | ⚠️ INVESTIGATE |
| 3 | Repeated file reads | 3-5/20 sessions | 50-100 | Coaching/workflow | ❌ NO |

**Priority recommendation**: Pattern #1 is the highest-value fix — trivial change, massive frequency. Should be dispatched to coder or infra immediately.
