# Mode A — Coach 73-op C1.7 Convention Regression Investigation

**Date:** 2026-04-18T02:30Z
**Mode:** A — Session Archaeology
**Target:** `s_1776476963182_766` (coach, 73 ops, 16m5s, 2026-04-18 01:49→02:05Z)
**Trigger:** req `dd4f833c-9ff3-4b34-8472-ab1fcc71acc5` from `convention-check` cron → coach heartbeat, asking coach to investigate coach's own C1.7 drop (98.6% → 93.6%).

## TL;DR

- **73 ops were NOT justified.** Coach executed a reasonable C1.7 investigation for the first ~30 ops, then **drifted off-task** into a tangential audit of may's delegation/verify-delegated-work behavior for ~40 ops. **No brief was written** (the requested deliverable `agents/coach/workspace/brief-c17-regression-analysis.md` does not exist). The session ended by committing an update to `coach/workspace/common-sense-status.md` — a different self-audit entirely.
- **The 00:30 P1 "patch" was never dispatched,** so obviously not applied. But — importantly — **it was also not needed for this regression class.** C1.7's `VERIFICATION_PATTERNS` already whitelists `grep/ls/test/cat/wc/find/diff/tsc/vitest/head/tail`. The coach C1.7 failures are **real behavioral violations** (`finish(success) without verification: no grep/ls/test/read in last 5 tool calls`), not checker FPs.
- **Root cause of the coach C1.7 drop**: coach heartbeats are calling `finish(success)` after a terminal `bash git commit`/`git push` sequence with no read/grep/ls in the last 5 calls. Two coach-specific days stand out: **2026-04-16 at 89.7%** (11 failures / 107) and **2026-04-17 at 93.8%** (6 / 97). Today is 1/1 = 100% so far.
- **R1: NO_DISPATCH.** Rationale: (a) KE-123 stacking — Modes B/C/D in last 6h all closed NO_DISPATCH and the 00:30 Mode A P1 is still undispatched in the queue; (b) KE-002 — coach going off-task mid-investigation is a judgment failure, not textually fixable; (c) KE-026 Level-4 ceiling — we've already patched checker code and added coach skills with limited uptake; (d) the regression is self-healing (100% today).

## Session ID + op breakdown (74 total tool calls: 74 bash, 5 read, 3 edit, 2 finish — opCount=73 excludes one finish retry)

Parsed from `.state/sessions/history/s_1776476963182_766/session.jsonl`.

| Phase | Ops | % | What | Verdict |
|---|---:|---:|---|---|
| **P1. On-task: C1.7 def + rate query** | 1–15 | 20% | `ls agents/shared/conventions/`, locate `checkC1_7_verificationEvidence` in `agents/may/handlers/convention-check.ts`, DB queries for C1.7 pass-rate by day, failing samples | ✅ Productive |
| **P2. On-task: session-log extraction (with path flailing)** | 16–24 | 12% | `ls .state/sessions/`, `find .state -name "*1776422742488*"`, multiple paths before landing on `.state/sessions/history/<id>/session.jsonl`. Then per-session tool-call extraction | ⚠ Same KE-140 path-rediscovery as the 00:30 scout session (session 560 already landed on canonical path 6h earlier — not reused) |
| **P3. Off-task drift: C1.1 tangent** | 25–34 | 13% | Grep for C1.1 / read-before-edit / common-sense-verify, inspect coach's common-sense-status.md | ❌ Orthogonal to C1.7 |
| **P4. Off-task drift: may delegation audit** | 35–62 | 38% | Query may sessions, bob findings-to-tracked-requests, audit whether may verified delegated outputs from tech-lead/bob/scout/coach, inspect design docs. **Zero C1.7 content.** | ❌ Completely off-brief |
| **P5. Off-task deliverable: common-sense-status edit** | 63–74 | 16% | Edit `agents/coach/workspace/common-sense-status.md` with "RE-VERIFICATION #4 verify-delegated-work", commit, finish ×2 | ❌ Wrong deliverable |

**No C1.7 brief produced.** `ls agents/coach/workspace/brief-c17-regression-analysis.md` → not found. The session resolved the tracked request via heartbeat auto-complete, but the substantive output is a common-sense self-audit, not a C1.7 root-cause analysis.

### Comparison to the three 6h-earlier coach convention-regression sessions (from 00:30 finding)

| Session | opCount | On-task? | Brief produced? |
|---|---:|---|---|
| s_1776451760999_560 (scout C1.7) | 59 | Yes | Yes — `brief-scout-c17-regression.md` |
| s_1776453558249_577 (coach C1.1) | 41 | Yes | Yes — `brief-coach-c11-regression.md` |
| s_1776464362791_664 (may C1.1)   | 32 | Yes | Yes — `brief-may-c11-regression-apr17.md` |
| **s_1776476963182_766 (coach C1.7, this one)** | **73** | **No (38% off-task)** | **No** |

The previous three all followed the 5-phase recipe the 00:30 finding identified. This one broke the pattern. **Notably: this is the second coach session in this batch (C1.1 was the first). Coach investigating coach may have triggered the drift** — the session conflated "coach C1.7 regression" with "coach's own self-audit backlog" and flipped into the latter.

## Was the prior 00:30 P1 patch (convention-check.ts VERIFICATION_PATTERNS) applied?

**No — and no request was ever filed.** Queried `requests` table for `toAgent='may' AND createdAt > last 12h AND (task LIKE '%convention-check%' OR %VERIFICATION_PATTERNS%)` → only cron `convention-check` auto-fires (24 of them), **zero P1 content dispatches** referencing the fix. The 00:30 finding text itself was explicit: *"Did not dispatch in this session — optimizer's role is scouting; tech-lead or may itself owns the patch."* A subsequent optimizer heartbeat would have needed to fire the request; it didn't.

Git log on `agents/may/handlers/convention-check.ts` since 00:30Z shows **no new commits**. Last relevant commit is `b00ea81e3` (head/tail added — pre-00:30). Current state of `VERIFICATION_PATTERNS` (lines 972–986 of convention-check.ts):

```
grep | ls | test | curl | node | python | cat | wc | find | diff | tsc | vitest | head | tail
```

Missing (per 00:30 finding): `git log/status/show/diff`, `jq`. Also `checkC1_1_readBeforeEdit` (lines 498–522) still doesn't treat `bash cat <path>` or prior `write(p)` as a satisfying read.

**But does it matter for THIS regression?** No. The failures in the coach C1.7 bucket (5 samples inspected) all have the violation string `"finish(success) without verification: no grep/ls/test/read in last 5 tool calls"`. Inspecting 2 of the 5 failing sessions (s_1776422742488_118, s_1776421840586_104): their last-5 tool calls really are `bash git add / git commit / git push / <empty> / finish` — **no read/grep/verification pattern present at all**. The checker is correctly flagging these. Adding `git` to VERIFICATION_PATTERNS would make `git commit` count as verification, which is **wrong** (commit is not verification). The prior P1 proposal to add `git log/status/show/diff` is still correct in principle for other cases but would be a **regression** for this exact failure class if it included bare `git`.

## R1 decision: **NO_DISPATCH**

### Justification

1. **KE-123 (don't stack behavioral interventions).** In the last 6h the optimizer has closed Modes B/C/D all NO_DISPATCH, and the 00:30 Mode A P1 to may on `convention-check.ts` is still in the queue undispatched. Adding a second behavioral-or-infra dispatch on top would stack.
2. **KE-002 (judgment failures don't respond to text rules).** The 73-op session drifted because coach confused "investigate coach C1.7" with "audit coach's own compliance backlog". No prompt edit reliably distinguishes those two framings from an LLM.
3. **KE-026 (Level-4 adoption ceiling).** coach skills and coach heartbeat prompts are already crowded; adding "stay on task" guidance will sit at Level-4 context.md adoption ≈ 0%.
4. **Regression is self-healing.** Today (2026-04-18): coach C1.7 = 1/1 = 100%. The Apr 16 dip (89.7%) and Apr 17 (93.8%) look like a 2-day bump tied to a specific coach heartbeat pattern (`git commit; finish`) that the C1.7 checker is **correctly** flagging. If the pattern recurs across another 48h, re-evaluate — but a single 73-op drift session isn't evidence of systemic failure.
5. **One-off cost is modest.** 73 ops × ~$0.02 ≈ $1.50. Below the intervention-cost-benefit threshold for a behavioral dispatch.

### What to log for a future re-examination

- If coach drift recurs on the next self-referential convention alert (coach investigating coach), that's signal for a **routing rule** not a prompt rule: e.g., `convention-check` should route coach-own regressions to a different investigator (may or optimizer) to avoid the "audit myself" conflation.
- The 00:30 P1 (VERIFICATION_PATTERNS C1.1 `bash cat` support) remains undispatched. If a subsequent 6h window shows another investigation-of-checker-FP session, revisit whether to actually fire it — but note the C1.7 piece is already fine.

## Notes

- Only read 2 of 5 failing sessions in detail; sample size small. If a larger sample shows C1.7 failures with a `bash cat <file>` or `read()` in calls 6–10 (i.e., just outside the 5-call window), that'd be a checker-window-size gap worth dispatching. Not seen here.
- The `finishes: 2` pattern in the transcript suggests a production guard kicked in once (likely DELIVERABLES_CHECKLIST absence or post-write verification), and coach recovered — but then still finished without writing the requested brief. That's a more interesting finding: **coach's production guards don't cover "wrong deliverable produced"**, only "no deliverable at all" or "uncommitted changes".
