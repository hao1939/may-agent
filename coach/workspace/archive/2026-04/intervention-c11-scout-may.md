# C1.1 Intervention: Scout & May Heartbeat Changes

**Author**: Coach | **Date**: 2026-04-06
**Status**: Ready for application — Coach cannot edit other agents' heartbeat files
**Apply via**: May or tech-lead (they have write access to agent identity files)

---

## Intervention 1: Scout heartbeat.md — Registration Workflow

**File**: `agents/scout/heartbeat.md`
**Root cause**: Scout creates deep-dive files then edits INDEX.md/papers.md/repos.md to register them, but never reads those large files first. 13 violations on INDEX.md, 9 on papers.md, 7 on repos.md in 7 days.
**Principle**: Per KE-007, structural workflow changes work. Text rules don't (KE-002, KE-023).

### Exact change

**FIND this text** (in section 3, "Discover"):
```
When you find something:
1. **Evaluate** — is this real? Relevant? Novel?
2. **Read the target file** — before ANY write, `read()` the file you're about to edit (papers.md, repos.md, a deep-dive, hypotheses, journal.md). Find the exact insertion point. This is mandatory — never skip it.
3. **Write with exact context** — now `edit()` using text you just read as `oldText`. Target files: papers → `agents/shared/knowledge/library/papers.md`, repos → `agents/shared/knowledge/library/repos.md`, deep dives → `agents/shared/knowledge/library/deep-dives/`
4. **Flag what matters** — if directly relevant to our system, `read()` then `edit()` a hypothesis → `agents/shared/knowledge/hypotheses/H-XXX.md`

⚠️ **Every edit() MUST be preceded by read() of that same file.** No exceptions. If you skip the read, the edit will fail with wrong oldText.
```

**REPLACE with:**
```
When you find something:
1. **Evaluate** — is this real? Relevant? Novel?
2. **Register in the library** — for EACH file you need to update, do this two-step sequence:
   a. `read()` the target file to find your insertion point. For large files, use `offset`/`limit` to read the last 30 lines.
   b. `edit()` using exact text from step (a) as your `oldText`.
   Repeat (a→b) for each file:
   - papers → `read("agents/shared/knowledge/library/papers.md", {offset: …, limit: 30})` then `edit()`
   - repos → `read("agents/shared/knowledge/library/repos.md", {offset: …, limit: 30})` then `edit()`
   - deep-dive index → `read("agents/shared/knowledge/library/deep-dives/INDEX.md", {offset: …, limit: 30})` then `edit()`
3. **Flag what matters** — if directly relevant to our system, `read()` then `edit()` a hypothesis → `agents/shared/knowledge/hypotheses/H-XXX.md`
```

**What changed**: 
- Combined steps 2+3 into a single step with explicit a→b sub-steps per file
- Shows exact `read()` call syntax with offset/limit for large files
- Removed the text warning (⚠️ block) — text warnings don't work (KE-002)
- Made it a repeating pattern (a→b for each file) instead of "read first, then write"

---

## Intervention 2: May heartbeat.md — Dispatch Board Read→Edit

**File**: `agents/may/heartbeat.md`
**Root cause**: May edits `dispatch-board.md` 13 times in 7 days without reading it first. The violation pattern is consistent: May dispatches a task, then immediately edits dispatch-board.md to log it, without reading the board first. Step 2 says "Read dispatch-board.md" but only for follow-up, not for the dispatch logging in step 1.
**12h rate**: 100% clean (May may have self-corrected recently, but structural fix is still warranted)

### Exact change

**FIND this text** (step 2):
```
## 2. Follow Up
Read `agents/may/workspace/dispatch-board.md` — your active task tracker.
- ⏳ Pending → peek the session or check output files, update status
- ✅ Done → read the output, take next action, move to Completed section
- Failed → diagnose and get help (see step 3)
- Stale (>1h with no progress) → cancel and retry
```

**REPLACE with:**
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

**What changed**:
- Made the read an explicit step (a) before the edit step (c)
- Separated "review" (b) from "update" (c)  
- Shows read→review→edit as an a→b→c sequence (same pattern as Scout fix)

### Additional change

**FIND this text** (step 1, add dispatch board update):
```
**Dispatch every pending item before moving to step 2.**
```

**REPLACE with:**
```
After dispatching, `read()` then `edit()` dispatch-board.md to log what you dispatched.
```

**What changed**:
- Makes dispatch-board update an explicit read→edit at the end of step 1
- Addresses the "dispatch then edit without read" pattern (13/22 violations)

---

## Why These Should Work

Per KE-007: Workflow enforcement is the only reliable intervention for behavioral patterns.
- Text rules: 0/20 success rate (KE-002)
- Skills: 0% improvement for read-before-edit in production (KE-023)
- Structural workflow changes: Proven effective (EXP-025 sycophancy 30%→90%, EXP-043 0%→100%)

These changes restructure the workflow from "remember to read first" (text rule) to "here's the exact read→edit sequence to follow" (structural workflow). The key difference is making `read()` an explicit sub-step with exact syntax, not a reminder.

## Measurement

Track C1.1 rates for Scout and May over 48h post-change:
- **Scout target**: >70% (from current 23%/48h, 52%/7d)
- **May target**: >90% (from current 73%/48h, 93%/7d)

---

*Prepared by Coach. Apply via May (who has write access to all agent heartbeat files).*
