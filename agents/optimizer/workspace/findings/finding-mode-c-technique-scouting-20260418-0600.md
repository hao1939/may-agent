# Mode C — Skill & Technique Scouting: Lean-vs-Bloated (6h, 2026-04-18 06:00 UTC)

**TL;DR — R1 = NO_DISPATCH.** The 6h bloated cohort (4 work sessions, opCount 33/37/42/49) is dominated by a **one-off P1 "own-your-metrics" batch dispatch** (bob 49, scout 33, coach 37+42 — all forked from the same /tmp/own-your-metrics.md + /tmp/metric-autonomy-project.md prompts) plus one heartbeat-propagation may-job (123 ops). Divergence from lean sessions is **filesystem path-hunting via find/ls** before the first SQL/read — which is the **same "anchor-first" pathology** already flagged in Mode C 01:30 (s_1776475866053_759). No new, distinct technique clears the ≥3-sessions × ≥2-agents threshold.

**Window:** 2026-04-18T00:00Z → 2026-04-18T06:00Z. Author: optimizer (s_1776492086685_912).

- R1 = **NO_DISPATCH** — KE-123 stacking (Mode A may/convention-check.ts patch + Mode C 23:30 tech-lead inline-verify tweak still in observation; neither landed) + KE-026 Level-4 ceiling + duplicate-shape-of-prior-finding (anchor-first / Mode C 01:30). Next rotation = **D**.

## 1. Cohort (last 6h, `opCount > 0`, work/call kind)

Per-agent distribution (all sessions, 140 rows):

| agent | n | p50 | p90 | max |
|---|---:|---:|---:|---:|
| may | 14 | 2 | 19 | **123** |
| coach | 25 | 10 | 38 | 73* |
| optimizer | 27 | 6 | 28 | 55 |
| bob | 23 | 10 | 18 | 49 |
| scout | 13 | 1 | 6 | 33 |
| coder | 9 | 13 | 28 | 28 |
| tech-lead | 20 | 8 | 17 | 21 |
| qa | 12 | 9 | 10 | 13 |

*coach 73-op outlier (s_1776476963182_766) is C1.7 convention-regression — already targeted by Mode A 00:30 may/convention-check.ts dispatch.

**Bloated cohort (opCount ≥ p90 for agent, excluding pre-targeted coach-conv-regression):**

| sessionId | agent | ops | task (trim) | origin |
|---|---|---:|---|---|
| s_1776491341154_891 | may | **123** | [P1] Propagate "Step 1 = React to Metrics" pattern | heartbeat-dispatched P1 |
| s_1776488657583_864 | bob | 49 | [P1 own-your-metrics] Refine bob's 3 metrics | /tmp/own-your-metrics.md |
| s_1776491724294_901 | coach | 42 | metric-autonomy Iter 1 — build scenario + baseline | /tmp/metric-autonomy-project.md |
| s_1776491570288_893 | coach | 37 | [P1 NEW PROJECT] Create and start metric-autonomy project | /tmp/metric-autonomy-project.md |
| s_1776488657736_869 | scout | 33 | [P1 own-your-metrics] Refine scout's 3 metrics | /tmp/own-your-metrics.md |

**Lean comparison cohort (opCount ≤ p50, same agents where possible):**

| sessionId | agent | ops |
|---|---|---:|
| s_1776490239736_876 | optimizer | 10 (hb) |
| s_1776490242015_878 | tech-lead | 7 (hb) |
| s_1776489838743_874 | coach | 9 (hb) |
| s_1776483117777_824 | tech-lead | 10 (call) |
| s_1776491639385_899 | coach | 11 (hb) |

## 2. Divergence point (first 8 tool calls, classified)

| session | agent | ops | first-write pos | EXPLORE-calls | first8 signature |
|---|---|---:|---:|---:|---|
| s_891 | may | 123 | 15 | 0 | SQL→SQL→OTHER→OTHER→GIT→GIT→OTHER→READ |
| s_864 | bob | 49 | 18 | 11 | READ→EXPLORE→SQL→SQL→EXPLORE→EXPLORE→EXPLORE→EXPLORE |
| s_893 | coach | 37 | 16 | **21** | EXPLORE×8 |
| s_869 | scout | 33 | 27 | 8 | EXPLORE→SQL→EXPLORE→EXPLORE→EXPLORE→EXPLORE→OTHER→OTHER |
| **lean** s_876 | optimizer | 10 | **6** | 1 | SQL→READ→OTHER→OTHER→EXPLORE→WRITE→… |
| **lean** s_899 | coach | 11 | **4** | 1 | EXPLORE→SQL→READ→WRITE→OTHER→… |
| **lean** s_874 | coach | 9 | — | 0 | SQL×7 (pure DB probe) |
| **lean** s_824 | tech-lead | 10 | 8 | 3 | EXPLORE→READ→EXPLORE→READ→READ→… |

Pattern: **bloated = 8-21 EXPLORE calls (find/ls/grep for paths) before first write.** Lean = ≤1-3 EXPLORE before anchoring (either writes a skeleton at position 4-8, or runs a single SQL probe and stops).

## 3. Why this is not dispatch-worthy

This is the **same "anchor-first vs explore-first" technique gap** already documented in:

- Mode C 01:30 UTC (`finding-mode-c-technique-scouting-20260418-0130.md`) — anchoring-by-reading-prior-finding
- Mode C 03:30 UTC (`finding-mode-c-technique-scouting-20260418-0330.md`) — query-unit-asserts-first probe
- Mode C 23:30 UTC Apr 17 (tech-lead inline-diagnostic tweak — **still in observation, not landed**)

Also: **3 of the 4 bloated sessions** (s_864, s_869, s_893) were **forked from the same P1 prompt batch** within a ~60-second window (1776488657583 / 1776488657736 / 1776491570288). Their EXPLORE-heavy opening is an artifact of:

1. The shared prompt pointing to `/tmp/own-your-metrics.md` and `/tmp/metric-autonomy-project.md` — paths agents had to hunt for shared knowledge dirs (`agents/shared/knowledge/hypotheses/`, `agents/gym/scenarios/...`) that are not in their context.md.
2. A new project kickoff with no prior finding to anchor to.

This is a **one-off structural issue in the dispatch prompt, not a recurring per-agent technique pathology.** Adding another context.md "Lean Session Heuristic" bullet to bob/scout/coach would stack on top of tech-lead's still-unlanded inline-verify tweak and optimizer+tech-lead's already-present "Write within 5 / Bash streak ≤5" bullets — a textbook KE-123 stack.

**Threshold check:** ≥3 sessions × ≥2 agents converging on a *new* shape? No. All 4 bloated sessions trace to the same P1 dispatch or heartbeat propagation; their "shape" replicates prior Mode C finding.

## 4. Minor observations (logged, not actioned)

- **bun require('better-sqlite3') anti-pattern**: s_891 (may) call 1 used `bun -e "const db=require('better-sqlite3')..."` → silent `(no output)` failure → 1 wasted call. Agent correctly switched to `node -e` at call 2. Occurred 1× in 6h. Below dispatch threshold. The root cause is **context.md line 75 in may/**: `sqlite3 CLI is not available — query .state/may.db with better-sqlite3 via node` — this instructs `node`, not `bun`; agent picked `bun -e` anyway. Flag for future Mode B tool-gap rotation if it rebounds.
- **Shared-knowledge path discovery**: bob + scout each spent 4-8 calls discovering `agents/shared/knowledge/hypotheses/` path. If `/tmp/own-your-metrics.md` cited the path inline, waste would drop to 0. This is a **dispatcher-side fix** (spec owner / Hao), not an agent-side dispatch from optimizer.

## 5. Cost/benefit of the non-dispatch

Even if we dispatched another "anchor-first" context.md bullet to bob+scout+coach now, expected impact:

- Level-4 intervention (context.md mention) → ~0-5% adoption per KE-011 + tool-adoption-hierarchy finding.
- Stacking cost: ~12-15pp degradation per KE-123 across the affected agents, risking regression on already-clean metrics.
- Bloated cohort is **not recurring** — next 6h unlikely to see another 3-session P1 metric batch.

**Better action: wait for Mode A may/convention-check.ts patch to land, observe post-land coach cohort behavior, then re-examine.**

## 6. Verification commands (reproducibility)

```bash
# Cohort
bun -e "import {Database} from 'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); const cutoff=Date.now()-6*3600*1000; console.log(JSON.stringify(db.query(\`SELECT sessionId,agent,opCount,kind,substr(task,1,70) task FROM sessions WHERE startedAt>? AND opCount>0 ORDER BY opCount DESC LIMIT 15\`).all(cutoff),null,2));"
# Transcript classification: see §2 (first-8-call signature pipeline, same method as Mode C 01:30)
```

---
**Decision:** R1 = NO_DISPATCH. Next rotation = **D** (Workflow Health).
