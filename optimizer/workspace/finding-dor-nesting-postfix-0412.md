# Finding: D-o-R Nesting Post-Fix Measurement (Apr 12, 2026)

**Status**: INSUFFICIENT DATA — Only 1 post-fix D-o-R run observed, need n≥3

## Fix Recap

- **Commit**: 60a844e3, deployed ~03:54 UTC Apr 12
- **What changed**: Added "DO NOT call callAgent() or spawn sub-agents" to Phase 1 strict rules in `agents/bob/workflows/deliver-or-report.ts`
- **Target**: Eliminate recursive D-o-R nesting (Phase 1 calling callAgent → triggering another D-o-R)

## Pre-Fix Nesting Evidence

Three confirmed nesting incidents before the fix:

1. **s_1775863620725 → s_1775863680393** (Apr 10, 23:27 UTC): Phase 1 (17 ops) spawned a nested Phase 1 (90 ops) via callAgent. Total: 107 ops for what should have been ~15.
2. **s_1775863474313 → s_1775863548477** (same run): Phase 1 (11 ops) spawned a nested work session (18 ops).
3. **s_1775741114816 → s_1775741258083** (Apr 9): Phase 1 (42 ops) spawned a nested work session (23 ops).

**Pre-fix Phase 1 nesting cost**: 161 ops wasted across 3 incidents in 72h (~54 ops/day).

## Post-Fix Observations

### Only 1 post-fix D-o-R run exists (as of 04:24 UTC Apr 12)

| Session | Phase | Ops | Status | Started |
|---------|-------|-----|--------|---------|
| s_1775967905256 | Phase 1 | 5 | running | 04:25 UTC |

This is the **only** D-o-R session after the fix deployment at ~03:54 UTC. It's currently running with 5 ops (well within budget), but we can't draw conclusions from n=1.

### Pre-fix Phase 1 Stats (for comparison)

- **n=65** Phase 1 sessions total
- **Average**: 22.5 ops (far above the 15-op budget)
- **Max**: 100 ops
- **Min**: 1 op
- Outliers (>40 ops): 100, 93, 90, 42, 40, 37 — 6 sessions consumed 402 ops (28% of all Phase 1 ops)

### The 93-op P1 Cap Violation (s_1775960654420, Apr 12 02:24 UTC — PRE-FIX)

This session was a Phase 1 with task "KB INDEX batch integration — complete the backlog". Despite the 15-op budget text in prompt, it ran 93 ops. Key facts:
- **No children spawned** — this was NOT a nesting issue. The 93 ops were all inline work.
- The task involved adding missing entries to INDEX.md — inherently high-op (many file reads/writes needed).
- The "BUDGET: 15" text cap was simply ignored.

**Important distinction**: The 93-op P1 was a budget cap violation (text-based cap ignored), NOT a nesting issue. The anti-nesting fix addresses a different failure mode.

## Verdict

**Cannot confirm fix effectiveness yet.** Only 1 post-fix D-o-R run exists (still running). Need at minimum 3 completed post-fix D-o-R runs to assess whether nesting recurs.

However, the fix is structurally sound:
1. The "DO NOT call callAgent()" instruction directly addresses the observed nesting mechanism
2. Combined with the 15-op budget cap, even if nesting somehow occurs, the damage is bounded (though as the 93-op case shows, budget caps are unreliable too)

## Separate Issue Identified: Budget Cap Unreliability

The 93-op Phase 1 demonstrates that **text-based budget caps ("BUDGET: 15 TOOL CALLS MAX") are unreliable**. This is consistent with the broader finding that text rules don't change LLM behavior (agents/optimizer/workspace/todo.md notes this pattern repeatedly). 

The real fix needs infrastructure enforcement: `maxOps` parameter on `ctx.runAgent()` that terminates the session when the budget is exhausted. Without this, both the nesting fix and the budget cap are purely behavioral — they work when the LLM "decides" to respect them.

## Next Steps

1. **Wait for n≥3 post-fix D-o-R runs** — check again in ~2-3 hours
2. **Track budget cap compliance separately** — Phase 1 ops should average ≤15 post-fix if the text cap works
3. **Recommend infra `maxOps`** — the only reliable way to enforce both nesting prevention and budget caps
