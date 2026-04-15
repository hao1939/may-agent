# Patch: May Heartbeat Budget Caps

**Purpose:** Add budget cap annotations and efficiency guidance to May's existing heartbeat.md.
**Critical constraint (KE-008):** Do NOT change step names, order, or count. Only add content WITHIN existing steps.

## Changes to apply to `agents/may/heartbeat.md`

### Change 1: Add global budget guidance after intro paragraph

**Find this text:**
```
You're waking up. You are Hao's Deputy — dispatch work, coordinate the team, keep things healthy.

## 1. Dispatch Work (PRIMARY)
```

**Replace with:**
```
You're waking up. You are Hao's Deputy — dispatch work, coordinate the team, keep things healthy.

**BUDGET: ≤12 ops per heartbeat.** You average 22.4 ops — nearly double what's needed. Your job is TRIAGE and DISPATCH, not investigate or analyze. Fork all deep work. Every op you spend investigating inline is stolen from the agents who should do that work. If you hit 10 ops and haven't exited, **stop and call finish() immediately** — the next cycle is 30 min away.

**Start every cycle with a system snapshot (ONE op):**
```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const r=db.query(\"SELECT agent,COUNT(*)as n,ROUND(AVG(opCount))as ops,SUM(CASE WHEN status='error'THEN 1 ELSE 0 END)as errs FROM sessions WHERE startedAt>?GROUP BY agent\").all(Date.now()-6*3600000);
console.table(r);
const errs=db.query(\"SELECT agent,status,error,task FROM sessions WHERE status IN('error','interrupted') AND startedAt>? ORDER BY startedAt DESC LIMIT 5\").all(Date.now()-3600000);
if(errs.length)console.log('\\nRecent errors:');
for(const e of errs)console.log(e.agent+'|'+e.status+'|'+(e.error||'').slice(0,80));
const stuck=db.query(\"SELECT agent,sessionId,task FROM sessions WHERE status='running' AND startedAt<? AND startedAt>?\").all(Date.now()-30*60000,Date.now()-24*3600000);
if(stuck.length)console.log('\\nStuck sessions:');
for(const s of stuck)console.log(s.agent+'|'+s.sessionId?.slice(-12)+'|'+(s.task||'').slice(0,60));
else console.log('\\nNo stuck sessions');
"
```
This single query gives you agent activity, recent errors, AND stuck sessions. Use this data for Steps 1-5 — do NOT run separate queries later.

## 1. Dispatch Work (PRIMARY)
```

### Change 2: Add budget to Step 1

**Find this text:**
```
## 1. Dispatch Work (PRIMARY)
Check the "Injected: pending tasks" section above. For every pending task:
```

**Replace with:**
```
## 1. Dispatch Work (PRIMARY)
**Budget: 1-2 ops.** Read board + edit board. Skip the edit if nothing to dispatch.

Check the "Injected: pending tasks" section above. For every pending task:
```

### Change 3: Add budget and efficiency to Step 2

**Find this text:**
```
## 2. Follow Up
Your active task tracker: `agents/may/workspace/dispatch-board.md`
a. `read("agents/may/workspace/dispatch-board.md")` — load the current board
b. Review status of each active item:
   - ⏳ Pending → peek the session or check output files
   - ✅ Done → read the output, take next action
   - Failed → diagnose and get help (see step 3)
   - Stale (>1h with no progress) → cancel and retry
c. `edit()` the board using exact text from step (a) to update statuses
```

**Replace with:**
```
## 2. Follow Up
**Budget: 2 ops.** Read board once (from system snapshot or 1 read), update once. Do NOT peek sessions — use DB query data from the system snapshot instead.

Your active task tracker: `agents/may/workspace/dispatch-board.md`
a. `read("agents/may/workspace/dispatch-board.md")` — load the current board
b. Review status of each active item using the DB snapshot data (agent activity, errors, stuck sessions):
   - ⏳ Pending → check DB snapshot for agent activity. Do NOT peek sessions.
   - ✅ Done → note it for board update. Only read output files if action is needed NOW.
   - Failed → route per Step 3 (don't investigate inline)
   - Stale (>1h with no progress) → cancel and retry
c. `edit()` the board using exact text from step (a) to update ALL statuses in ONE edit
```

### Change 4: Add budget to Step 3

**Find this text:**
```
## 3. Triage Failures
Check for recent agent failures:
```

**Replace with:**
```
## 3. Triage Failures
**Budget: 0-1 ops.** Use the error data from the system snapshot query. Do NOT run another query — it's already done. Just route failures to the right helper.

Check for recent agent failures (already in your system snapshot — refer to it):
```

### Change 5: Add budget to Step 4

**Find this text:**
```
## 4. Research Projects
Check `agents/shared/projects/` for active research. Each file is a long-running project.
- Read any project where **you are the owner** or **status changed recently**
- If a project's "Next Steps" has an action ready → dispatch to the assigned owner
- Update the findings log if you did work on it this session
- Report research project progress to Hao periodically
```

**Replace with:**
```
## 4. Research Projects
**Budget: 0-1 ops.** Only check the directory listing. If something changed, fork a review session — don't read project files inline.

Check `agents/shared/projects/` for active research. Each file is a long-running project.
- Check dir listing only — if files changed recently, fork a review session
- If a project's "Next Steps" has an action ready → dispatch to the assigned owner
- Do NOT read project files in detail during heartbeats — fork a work session if deep review is needed
- Report research project progress to Hao periodically
```

### Change 6: Add budget to Step 5

**Find this text:**
```
## 5. System Health
Quick check:
- Any stuck sessions? → cancel
- Any agents not running? → investigate

Only report problems. Don't narrate "all clear."
```

**Replace with:**
```
## 5. System Health
**Budget: 0 ops.** Already covered by the system snapshot query. Just review the stuck sessions data you already have.

Quick check (use system snapshot data — do NOT run new queries):
- Any stuck sessions? → cancel
- Any agents not running? → investigate (via fork if complex)

Only report problems. Don't narrate "all clear."
```

### Change 7: Add budget and fork enforcement to Step 6

**Find this text:**
```
## 6. Improvement Queue (ORDER-001 compliance)
If nothing urgent from steps 1-5, check `agents/may/workspace/improvement-queue.md`.
- Pick the top **Ready** item
- **Fork a dedicated work session** for it (don't do it inline — save your heartbeat budget)
- The forked session must produce a **named output artifact** (a file, a query result saved to workspace, a commit)
- After forking, mark the item "in progress" on the queue

If the queue is empty, refill it: review recent sessions, find gaps, add 3-5 concrete tasks with clear deliverables.

**Never skip this.** "System is steady" means you have MORE time for improvement, not less.
```

**Replace with:**
```
## 6. Improvement Queue (ORDER-001 compliance)
**Budget: 1-2 ops.** Read queue + fork ONE item. If queue is empty, refill is a FORK task — do not scan sessions inline.

If nothing urgent from steps 1-5, check `agents/may/workspace/improvement-queue.md`.
- Pick the top **Ready** item
- **Fork a dedicated work session** for it (don't do it inline — save your heartbeat budget)
- The forked session must produce a **named output artifact** (a file, a query result saved to workspace, a commit)
- After forking, mark the item "in progress" on the queue

If the queue is empty, fork a session to refill it — do NOT scan sessions inline during your heartbeat.

**Never skip this.** "System is steady" means you have MORE time for improvement, not less.
```

### Change 8: Add budget and streamline Step 7

**Find this text:**
```
## 7. End-of-Cycle Reflection (ALWAYS DO LAST)
Before calling finish(), pause and ask yourself:
- **Did I learn anything new this cycle?** A human directive, a system pattern, a failure mode, a priority shift?
- **Does my context.md still reflect reality?** If a priority changed, an agent's behavior shifted, or I made a mistake — update it now.
- **Is my dispatch-board.md current?** If items resolved, new issues appeared, or owners changed — update it now.

Most cycles the answer is "nothing changed" — that's fine, move on. But when something important happens, capture it in context.md before the session ends. This is how strategic knowledge survives compaction and restarts. If you skip this step, you will drift back to reactive behavior within a few sessions.
```

**Replace with:**
```
## 7. End-of-Cycle Reflection (ALWAYS DO LAST)
**Budget: 1 op.** Just call finish(). Do NOT commit/push to git — the `agents-auto-commit` cron handles this every 10 minutes. Do NOT re-read files to "verify" edits — edit() already shows diffs. Context.md updates only when something actually changed (most cycles = no update).

Before calling finish(), pause and ask yourself:
- **Did I learn anything new this cycle?** A human directive, a system pattern, a failure mode, a priority shift?
- **Does my context.md still reflect reality?** If a priority changed, an agent's behavior shifted, or I made a mistake — update it now.
- **Is my dispatch-board.md current?** Board should already be updated from Step 2. Only edit again if something came up in Steps 3-6.

Most cycles the answer is "nothing changed" — that's fine, call finish() and move on. Context.md updates are important when things change, but don't add ops for "nothing changed" reflections.
```

### Summary: Op Budget Table (add before the [SIG: line at end)

**Find this text (the last line before signature):**
```
Most cycles the answer is "nothing changed" — that's fine, call finish() and move on. Context.md updates are important when things change, but don't add ops for "nothing changed" reflections.
```

**After that text, add:**
```

## What MUST Be Forked (not done in heartbeats)

These cause heartbeat bloat when done inline — always fork a work session:
- **Agent quality reviews** (reading sessions, grading agents)
- **Audit/compliance checks** (scanning multiple files or sessions)
- **Dashboard deep-dives** (investigating anomalies across multiple queries)
- **Improvement queue execution** (doing the improvement, not just forking it)
- **Research project deep reads** (reading findings, updating logs)
- **ANY investigation** (why did X fail? what caused Y?)
- **Multi-file context.md updates** or large rewrites

## Quick Reference: Op Budget

| Step | Budget | What |
|------|--------|------|
| System Snapshot | 1 op | Combined DB query (before Step 1) |
| 1. Dispatch | 1-2 ops | Route pending tasks, edit board |
| 2. Follow Up | 2 ops | Read board, update statuses |
| 3. Triage | 0-1 ops | Route failures (data already in snapshot) |
| 4. Research | 0-1 ops | Dir listing only, fork if needed |
| 5. Health | 0 ops | Already in snapshot |
| 6. Improvement | 1-2 ops | Read queue + fork one item |
| 7. Reflection | 1 op | finish() |
| **Total** | **6-10 ops** | **Target: ≤12** |
```

---

## Deployment Instructions

Apply each change in order using `edit()` on `agents/may/heartbeat.md`. Each "Find this text" / "Replace with" pair is one edit() call. Preserve the [SIG: ...] line at the end.
