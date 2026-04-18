# Finding: Tool Gap Fresh Scan — Apr 13 (6h window)

**Date**: 2026-04-13 ~17:52 UTC  
**Window**: ~12:00-18:00 UTC (53 sessions, 22 with ≥25 ops)  
**Method**: Queried may.db for high-op sessions, sampled 8 session transcripts from filesystem (history + active), cross-referenced with [Apr 11 bash-command-patterns](finding-bash-command-patterns-0411.md).

---

## 1. Tool Adoption Status

### code-search.sh — PARTIAL ADOPTION (tech-lead only)

`code-search.sh` is wired into 3 agent contexts: **coder, scout, tech-lead**. But actual usage in the last 6h is **tech-lead only**:

| Session | Agent | code-search calls | Total bash |
|---------|-------|-------------------|------------|
| s_1776100938153_311 | tech-lead | 8 (100% of bash) | 8 |
| s_1776098802804_286 | tech-lead | 4 (9% of bash) | 43 |
| s_1776097296861_278 | tech-lead | 7 (25% of bash) | 28 |
| s_1776096149719_270 | tech-lead | 3 (17% of bash) | 18 |

**Key observation**: Even when tech-lead uses code-search.sh, it still chains 4-8 calls of it in sequence with progressively narrower patterns. The tool reduces per-search cost (1 call vs 3-4 grep chains) but doesn't reduce the iterative exploration pattern.

Coach (0 calls), bob (0 calls), optimizer (0 calls) — none adopted despite coach and bob doing substantial grep work.

### session-query.ts — ZERO ADOPTION

`session-query.ts` is in **zero agent context files**. Nobody knows it exists. The optimizer session s_1776100932253_309 (48 ops) contains 18 DB queries and manually searches session history directories — exactly the pattern session-query.ts was built to replace.

**Root cause**: KE-020 confirmed — building a tool doesn't drive adoption. session-query.ts was never pushed to any agent context. It can't be adopted by agents who don't know about it.

---

## 2. New Patterns (vs Apr 11 finding)

### Pattern A: DB Query Chains Still Dominant

The Apr 11 finding identified DB queries as 23.2% of bash ops. This persists:

- Optimizer s_1776100932253_309: 18 DB queries (82% of bash calls)
- Tech-lead s_1776098802804_286: 12 DB queries (28% of bash)
- Tech-lead s_1776097296861_278: 10 DB queries (36% of bash)

**Convention-check drilling** (Apr 11's top DB pattern at 45.5%) was NOT observed in this window — coach is running experiments instead of convention audits. The current DB pattern is primarily **session metadata queries** (opCount, agent, status, startedAt).

### Pattern B: Gym-Run Chain (NEW)

Coach session s_1776100934336_310 (20 bash calls) shows a new pattern: gym experiment orchestration.

```
ls agents/.lab/
find agents/coach -name ...
ls agents/gym/scenarios/ | grep ...
diff -rq agents/.lab/coder-exp153-escalate/ agents/coder/
export PATH=... bun -e "..." (DB query × 6)
head -60 scripts/gym-batch.sh
export PATH=... bun ... (gym runs × 4)
cat /tmp/gym-batch-.../results.jsonl
export PATH=... bun -e "..." (DB query × 3)
```

This is experiment setup → run → verify, consuming ~20 ops per experiment phase. Not in the Apr 11 analysis.

### Pattern C: Session Archaeology Manual Pipeline (PERSISTS)

Optimizer s_1776100932253_309 follows the same pattern as always:
1. `bun -e "...SELECT sessionId, agent, opCount..."`  — find sessions
2. `ls .state/sessions/` — check if transcript exists
3. `ls .state/sessions/history/` — check archive
4. `grep ... .state/sessions/history/$sid/session.jsonl` — extract patterns

This is exactly what session-query.ts was built for. 4-6 ops wasted every time.

### Pattern D: Branch Review (PERSISTS but lighter)

Tech-lead s_1776097296861_278 shows the review workflow:
```
git log review/... --oneline --not main
git diff main...review/... -- src/ test/ --stat
git checkout main && git merge review/... -m "..."
git branch -d review/...
```

Still 4-5 ops, but lighter than the 7-step pattern from Apr 11 (no separate compile/test step observed). May have been streamlined naturally.

---

## 3. Comparative Summary

| Category | Apr 11 (6h) | Apr 13 (6h) | Change |
|----------|-------------|-------------|--------|
| Convention check drilling | 66 queries (top pattern) | 0 | **Gone** — coach doing experiments |
| DB session queries | 20 (13.8% of DB) | ~40+ (dominant) | **Increased** — more archaeology work |
| Fleet-status boilerplate | 10/18 sessions | Not observed in sample | Unclear — may be in unsampled heartbeats |
| Grep chains | 166 calls, 26.5% | ~30 in sample | **Reduced** — code-search.sh absorbing some |
| code-search.sh usage | 0 (didn't exist) | ~22 calls in 4 sessions | **New adoption** (tech-lead only) |
| session-query.ts usage | 0 (didn't exist) | 0 | **Dead tool** — no context wiring |
| Gym batch runs | Not identified | ~8 calls (new pattern) | **New** |

---

## 4. Recommendations

### Action 1: Wire session-query.ts into agent contexts (URGENT — KE-020)

The tool exists, it solves a real pain point, but nobody knows about it. Add to context.md for: **optimizer, tech-lead, coach**.

Example context line:
```
- Session query: `bun scripts/session-query.ts --agent bob --since 6h --min-ops 30 --tools` — replaces manual DB + ls chains
```

**Expected savings**: 4-6 ops per optimizer/tech-lead session that does session archaeology (~10-15 sessions/6h).

### Action 2: Push code-search.sh to coach and bob contexts

Coach does experiment-related grep chains but hasn't adopted code-search.sh. Bob does knowledge base searches. Both would benefit but currently don't know the tool exists in their context.

**Expected savings**: 2-3 ops per session for 4-6 affected sessions/6h.

### Action 3: Declare convention-dashboard and experiment-status tools as LOW PRIORITY

The Apr 11 analysis recommended these as P0/P2. But:
- Convention drilling disappeared when coach shifted to experiments
- Experiment status enumeration (3-5 ls calls) is real but low-frequency

These are nice-to-have, not urgent. The adoption gap on existing tools is a bigger win.

### Action 4: No new tool builds needed

The existing tools (code-search.ts, session-query.ts) cover the major patterns. The gap isn't tooling — it's **adoption wiring**. Build nothing new; push what exists.

---

## Bottom Line

**The tool gap has shifted from "missing tools" to "missing adoption wiring."** Two months ago, agents had no purpose-built search or query tools. Now code-search.ts and session-query.ts exist and work, but only tech-lead has adopted code-search, and nobody uses session-query. The fix is context injection (10 minutes of work), not new tool development. This validates KE-020 (capability adoption requires explicit wiring) and KE-026 (push, don't make them find it).
