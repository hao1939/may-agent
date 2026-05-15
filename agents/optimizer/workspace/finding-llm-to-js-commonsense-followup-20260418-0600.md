# Finding: common-sense-verify JS conversion — dead-on-arrival, needs one fix

**Date**: 2026-04-18 06:00 UTC · **Session**: s_1776492035942_904
**Mode**: C (Skill & Technique Scouting) — following up Apr 17 R1

## TL;DR

The Apr-17 R1 "convert common-sense-verify to JS" was built (`agents/coach/handlers/common-sense-audit.ts`, 260 lines on branch `review/common-sense-audit-handler`) but has **never run in production** and currently produces an empty placeholder report because of a data-source mismatch. One 10-line fix unlocks **~$2.40/day ($72/month) + 100 ops/day** savings. Dispatching to tech-lead.

## Evidence

| Metric | Value | Source |
|---|---|---|
| LLM sessions last 7d | **105** | `SELECT COUNT(*) FROM sessions WHERE task LIKE '%common-sense-verify%' AND startedAt >= now-7d` |
| Ops last 7d | **702** (~100/day) | same query, SUM(opCount) |
| Eval cost last 7d | **$16.87** | `SUM(json_extract(usage,'$.cost')) FROM evaluations JOIN sessions` |
| JS handler runtime | ~50ms, zero-op | local invocation below |
| JS handler output | **placeholder** — "No rule IDs found in common-sense.md" | local invocation |

## Root cause

The handler parses `agents/shared/common-sense.md` for rule IDs matching `/C\d+(\.\d+)?/` (line ~50 of the handler). But that file was **rewritten into narrative form** — it no longer contains `C1.1`/`C1.3`/etc. tokens. The actual rule taxonomy now lives hardcoded in `agents/may/handlers/convention-check.ts`:

```
const FINISH_DEPENDENT = ['C1.4', 'C8.2', 'C1.5', 'C1.7'];
// Implemented: C1.1, C1.3, C1.4, C1.5, C1.7, C2.1, C3.2, C3.3, C6.1, C7.1, C8.2, C12.1
```

The `convention_checks` table is populated fine (3,828 rows/rule/7d from C1.1, C1.3, C12.1, C2.1, C3.2, C3.3, C6.1, C7.1; plus C1.4/C1.5 slightly less). So the data is there — the handler just can't find the rule list.

## Secondary problem

The handler lives at `agents/coach/handlers/common-sense-audit.ts` but the cron loader (`src/app/agent-loader.ts:697`) only scans `agents/<cronOwner>/handlers/`. Only **may** has a cron.json that loads handlers. So even if fixed, the file must move to `agents/may/handlers/common-sense-audit.ts` and be wired in `agents/may/cron.json` replacing the LLM-based entry.

## One-fix proposal (≤30 lines changed)

1. **Hardcode the rule list** in the handler (source of truth = convention-check.ts):
   ```ts
   const RULES = ['C1.1','C1.3','C1.4','C1.5','C1.7','C2.1','C3.2','C3.3','C6.1','C7.1','C8.2','C12.1'];
   ```
   Delete the common-sense.md parsing block.
2. **Move** the file to `agents/may/handlers/common-sense-audit.ts`.
3. **Edit** `agents/may/cron.json`: replace the `common-sense-verify` entry (which uses `run-agent-task`) with a `handler: "common-sense-audit"` entry at the same schedule.
4. **Delete** the now-stale LLM prompt/cron row.

Output already targets `agents/coach/workspace/common-sense-audit.md` (mirrors `agents/bob/workspace/analysis.md` pattern from analyze-failures).

## Expected savings (7-day projection)

| | LLM (current) | JS (post-fix) |
|---|---|---|
| Sessions/week | 105 | 0 |
| Ops/week | 702 | 0 (cron-job, no LLM) |
| Cost/week | $16.87 | $0 |

## Verification plan for tech-lead

After fix, invoke locally:
```
bun -e "const {create}=await import('./agents/may/handlers/common-sense-audit.ts'); \
  await create({projectRoot:'/app',agentsRoot:'/app/agents',log:console.log, \
  getDb:()=>new (require('bun:sqlite').Database)('.state/may.db')},{})();"
cat agents/coach/workspace/common-sense-audit.md
```
Expected: non-placeholder output showing the rotated rule of the day + 7d pass-rate summary + sample violations.

## Rotation

Completed C-mode this cycle. Next cycle (06:00+6h = 12:00 UTC): **Mode D: Workflow Health**.

## Dispatched

→ tech-lead (P1) — see §One-fix proposal.
