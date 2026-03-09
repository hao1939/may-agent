# May Coaching Session — 2026-03-09

**Agent:** May (Hao's Deputy)
**Coach:** Coach
**Assessment:** `may-assessment-2026-03-09.md`
**Session ID:** `s_1773076005067_3`
**Duration:** 5m50s, 59 turns
**Target gaps:** Action Paralysis (Gap #2), Over-Reporting (Gap #3), Path Confusion (Gap #1)

---

## Exercise 1: Action Bias (Gap #2 — Critical)

**Goal:** Test whether May dispatches approved work autonomously without waiting for human.

**Task prompt:** Heartbeat-style with explicit instruction: "You have full authority to act on Hao's behalf. When you find approved designs in the todo, dispatch them to the appropriate agent. Don't wait for human prioritization."

### Result: ✅ PASS (9/10)

**Evidence of action bias:**

1. **Directly resolved graduation blockers** (turns 20-29):
   - Read Scout's `coaching.md`, `DOMAIN.md`, and Coder's `lessons.md` to understand current state
   - Wrote all 3 Scout coaching corrections (#11, #12, #13) to `agents/scout/knowledge/coaching.md`
   - Created `agents/coder/knowledge/lessons.md` with pattern-sed rules and 5 lessons
   - Updated Scout's DOMAIN.md with correct paths
   - Updated optimizer's todo.md to mark items complete
   - **This was a 14-day-stale escalation that no agent had acted on** — May resolved it in ~2 minutes

2. **Dispatched Rolling Compaction** (turns 35-46):
   - First tried `subagents.run("coder", task)` — got delegateDeny error
   - **Self-recovered:** checked `workflow.list`, then used `workflow.run("implement-and-review", task)` 
   - Coder found it was already implemented → QA verified → PASS
   - May correctly archived the item after verification

3. **Updated todo.md** (turns 47-56):
   - Moved completed items from Active to Archive with details
   - Identified next priority candidates

**What went right:**
- Zero "standing down" or "needs human prioritization" language
- Picked the highest-impact items first (14-day-stale graduation blockers)
- Self-recovered from delegateDeny error gracefully
- End-to-end ownership: dispatched → tracked → verified → archived

**Deductions (-1):**
- Spent 4-5 turns trying git commands that don't work in the container (`cd /Users/hao/c && git log`). This is environment confusion, not a major issue, but wastes turns.

---

## Exercise 2: Concise Heartbeat (Gap #3 — Medium)

**Goal:** Output ≤200 tokens, report only exceptions and actions taken.

### Result: ⚠️ PARTIAL (6/10)

**Final summary:** ~291 tokens (estimated), structured in 3 sections:
1. Actions Taken (main bulk — ~180 tokens)
2. System Health table (5 rows — ~60 tokens)
3. Next Priority Candidates (4 items — ~50 tokens)

**What improved:**
- Summary focuses on **actions taken**, not status reporting — this is a massive behavioral improvement
- No full dump of all running sessions, all agents, all TODO items
- System Health table is 5 rows, not the 20+ row tables seen historically

**What still needs work:**
- 291 tokens exceeds the 200-token target
- The System Health table is reportage, not action. "13 agents registered" is not news. Only the "Cron DISABLED" line is actionable.
- "Next Priority Candidates" list is useful context but adds length. Could be 1 line: "Next: Detached Sub-Agent Design (Bob-approved, most impactful)."

**Ideal output would be:**
```
## Actions
1. Resolved graduation blockers: Scout coaching corrections (#11-13), Coder lessons.md, optimizer todo updated.
2. Rolling Compaction: verified already implemented, archived.
3. Todo cleaned: 2 items archived, 5 active remain.

⚠️ Cron disabled (--cron flag not set).
Next: Detached Sub-Agent Design.
```
(~70 tokens)

---

## Exercise 3: Path Reliability (Gap #1 — Medium)

**Goal:** No wasted turns on SOUL.md re-reads or path confusion.

### Result: ✅ PASS (9/10)

**Evidence:**
- **Zero SOUL.md re-read attempts** — respected K4 (auto-loaded files)
- **Used `agents/may/workspace/todo.md` directly on turn 2** — correct path, first try
- **Zero ENOENT errors on agent files** — all reads hit correct paths
- **First productive action (parallel reads + agent list) on turn 2** — no wasted orientation turns
- **Parallel batching on turn 2:** `read(todo.md)` + `subagents.list` + `cron.list` + `exec(git status)` — all 4 in one turn

**Deductions (-1):**
- 4-5 turns wasted on `/Users/hao/c` git path (doesn't exist in container). May tried `cd /Users/hao/c && git log`, got errors, tried again twice, then used `find / -maxdepth 3 -name ".git"`. This is environment confusion (thinking she's on Hao's machine), not file path confusion, but it's the same category of "wasted turns on wrong paths."

---

## Overall Session Score

| Exercise | Score | Status |
|----------|-------|--------|
| 1. Action Bias | 9/10 | ✅ **PASS** |
| 2. Brevity | 6/10 | ⚠️ **PARTIAL** |
| 3. Path Reliability | 9/10 | ✅ **PASS** |

**Composite:** 2 PASS, 1 PARTIAL — **Exercise 1 PASS counts toward graduation streak.**

### Interventions Made
**Zero.** No coaching interventions were needed during this session. May acted autonomously from first turn to last.

### Behavioral Changes vs Assessment Baseline

| Metric | Baseline (192 sessions) | This Session |
|--------|------------------------|--------------|
| Action paralysis rate | 26.6% (45/169 dones) | **0%** — dispatched 3 items |
| Path confusion rate | 11.5% (22/192) | **0%** — all agent paths correct first try |
| SOUL.md re-reads | Routine | **0** — K4 respected |
| Output verbosity | 500-700 tokens | **~291 tokens** — improved but still over target |
| Dispatch count per heartbeat | Usually 0 | **3** (2 direct edits + 1 workflow) |
| Error recovery | Not previously tested | **Clean** — delegateDeny → workflow fallback |

### Notable Observations

1. **The task prompt matters enormously.** The assessment identified that May's heartbeat prompt conflicts with SOUL.md ("Then stop — stay idle"). This coaching prompt explicitly reinforced "full authority to act." May responded dramatically — going from 26.6% paralysis rate to zero. This suggests the behavior is **prompt-driven, not model-inherent**, which means the fix is partly infra (heartbeat prompt wording) and partly coaching (reinforce SOUL.md hierarchy).

2. **May is analytically excellent.** She correctly identified the 14-day-stale graduation blockers as the highest-impact items and resolved them before even looking at the larger implementation backlog. This is genuine prioritization skill, not just "pick the first item."

3. **The write-through pattern is strong.** May didn't just dispatch — she wrote Scout coaching corrections directly, updated multiple todo files, and verified work. This is end-to-end ownership as defined in SOUL.md.

4. **Git environment confusion is a new finding.** May thinks she's on `/Users/hao/c` (Hao's local machine). This is probably from her training data or system prompt context. Minor but wasteful — 4-5 turns burned. Could be fixed by adding a lesson: "You're in a Docker container at /app. There is no git repo here."

---

## Recommendations

### For May's next coaching session:
1. **Re-test brevity** — Give a scenario with many healthy components and one issue. Target: ≤100 tokens, report only the issue and the action taken.
2. **Remove the "IMPORTANT" scaffolding** — This session had an explicit "You have full authority" reminder in the task. Next session should use the standard heartbeat prompt to test if the behavior persists without scaffolding.
3. **Add Docker/git lesson** — Add to LESSONS.md: "You're in a Docker container at /app. There is no git repo or home directory."

### For infra/optimizer:
1. **Fix heartbeat prompt** — Remove "Then stop — stay idle" language. Replace with "Keep going until everything pending is dispatched or you're blocked."
2. **Add container context** to heartbeat prompt: "Container environment: /app, no git, no home directory."

### Graduation status:
- **Pass streak: 1/3** (counting Exercise 1 PASS)
- **Blocking:** Brevity exercise needs re-test (PARTIAL)
- **Estimated sessions to graduation:** 2-3 more (need 2 more consecutive PASS on action bias without scaffolding, plus brevity improvement)
