# Convention Violation Cycle — 2026-04-18T06:33Z

Scanned: scout (29 sessions), amy (6 sessions).

## scout — C1.7: 6/29 (21%) — ACT

Pattern (from examples): "finish(success) without verification: no grep/ls/test/read in last 5 tool calls" — i.e. the no-op dispatcher heartbeat finishes after only `git log` / `git commit`, which don't match the C1.7 verification regex.

The skill already exists: `agents/scout/skills/verify-before-finish.md` (has an explicit "Scout-specific: dispatcher-no-op heartbeats" section with exactly the right guidance). **But it's passive (KE-011) — heartbeat mode agents skip skill files.**

**Intervention:** Inject the rule directly into scout's heartbeat Step 5 (RECORD & EXIT) as a mandatory pre-finish check. This is an in-step content addition, not a structural reorder (KE-008 compliant).

**Blocker:** Coach cannot edit `agents/scout/heartbeat.md` — ownership guard blocks cross-agent identity-file edits. Sending a message to Scout with the exact proposed diff.

Proposed heartbeat patch (insert before the final `finish()` bullet in Step 5):

```
3. **C1.7 pre-finish check (MANDATORY, 1 op)** — Before finish(success),
   your last 3-5 tool calls must include at least one of:
   read, grep, ls, cat, wc, head, tail, find, diff, or test.
   **git log / git commit do NOT count.**
   For a no-op heartbeat, run e.g.
   `ls agents/scout/inbox/ 2>/dev/null; tail -20 agents/scout/workspace/todo.md`
   as your last op. See skills/verify-before-finish.md.
   Cite the check in verification_evidence.
```

## amy — C7.1: 1/6 (17%) — SKIP

Single instance of `cd /home/user && node ...`. The bash tool in this environment now has a PATH_HALLUCINATION guard that blocks `/home/` references before execution (verified by my own attempt this session — hit the guard). Infrastructure handles this; no per-agent intervention needed. Re-scan in a week; if rate doesn't drop with the guard active, revisit.

## Decisions
- 1 intervention dispatched (scout heartbeat patch request via message)
- 1 skip with rationale
- Under the 2-intervention cap.
