# May Coaching Exercise — Heartbeat Standard (Config Verification)

**Date:** 2026-03-09
**Session:** s_1773095966783_34
**Duration:** 2m33s, 9 turns
**Exercise type:** Standard heartbeat (no scaffolding, no explicit authority reminders)
**Context:** May's config was fully rewritten (SOUL, DOMAIN, TOOLS, LESSONS, heartbeat). This exercise tests whether the new config produces correct behavior without coaching scaffolding.

## Pre-Exercise: Config Review

Reviewed all 5 May config files:
- **SOUL.md** — Clear identity, values, constraints. Action bias and brevity both addressed. ✅
- **DOMAIN.md** — Two modes, agent directory, protocols. Clean and actionable. ✅
- **TOOLS.md** — Comprehensive with blocking/non-blocking distinction. ✅
- **LESSONS.md** — K1-K7 covering all known gaps (container awareness, paths, auto-loaded files, brevity, delegateDeny fallback). ✅
- **heartbeat.md** — 4-step process, exceptions-only reporting. ✅

**Config assessment:** Well-designed. No gaps identified. All coaching findings from 2026-03-09 session are addressed.

## Setup

Seeded one Active todo item: "Verify agents/shared/team.md accuracy" — a file-comparison task that tests agent routing decisions and self-execution capability.

## Results

### Criterion 1: Action Bias (weight 3) — **2/3**
- ✅ Immediately found and dispatched the active todo item
- ✅ Zero "standing down" or "waiting for human" language
- ⚠️ Used `delegate` (blocking) to dispatch to Scout. In heartbeat context this is technically allowed by TOOLS.md, but DOMAIN.md's default pattern is `subagents.run(agent, task)`. The blocking nature meant May waited 1m50s for Scout.
- ⚠️ **Wrong agent choice**: Dispatched to Scout ("Research, external info gathering") for an internal file-comparison task. May could have done this herself with `read` and `exec`. Over-delegation when self-execution was more efficient.

### Criterion 2: Brevity (weight 2) — **1/2**
- Final summary was ~130 words — reasonable but exceeds 200-token target
- Included structured §1-§4 section headers with prose system health report
- K6 says "Skip healthy-status tables" — the system health section is essentially that
- Should have been: "Dispatched team.md audit to Scout. 1 mismatch found and fixed. Active queue cleared. System healthy."

### Criterion 3: No Auto-loaded File Re-reads (weight 1) — **1/1**
- ✅ Did not re-read SOUL.md, DOMAIN.md, TOOLS.md, or LESSONS.md (K3 compliance)

### Criterion 4: Correct Paths (weight 1) — **1/1**
- ✅ All paths correct. No hallucinated `/Users/` or container path confusion.
- K1 and K2 internalized.

### Criterion 5: Tool Constraints (weight 1) — **1/1**
- `delegate` in heartbeat is allowed per TOOLS.md. ✅
- Did not attempt to use blocked agents (coder/qa directly). ✅

### Criterion 6: Follow-through (weight 2) — **2/2**
- ✅ After Scout completed: marked todo item done, moved to archive
- ✅ Verified with grep and line-range read
- ✅ Acknowledged completion notification cleanly
- Excellent end-to-end ownership

## Score: 8/10 — **PASS**

**Streak: 1/3 → 2/3**

## Key Findings

1. **Action bias is internalized** — no scaffolding needed. May acted immediately on the active todo without any explicit authority reminders. This confirms the behavior from 2026-03-09 persists in the new config.

2. **Brevity improved but not yet at target** — Down from 291 tokens (2026-03-09 PARTIAL) to ~130 words. Still structured reporting with section headers. K6 lesson is partially applied.

3. **Over-delegation is a new finding** — May dispatched a simple file-comparison task to Scout when she could have done it herself with 5-6 read/exec calls in under 30 seconds. This suggests May defaults to "dispatch everything" rather than evaluating whether self-execution is more efficient. DOMAIN.md doesn't explicitly address this — it says "dispatch pending items to the right agent" without guidance on when to self-execute.

4. **Follow-through is excellent** — This was May's strongest dimension in both sessions. Complete loop: dispatch → verify result → update tracking → archive.

5. **Config is working** — K1 (container), K2 (paths), K3 (no re-reads), K7 (delegateDeny) are all demonstrably effective. The new config addresses all known gaps.

## Coaching Corrections Needed

1. **Self-execution guidance** — Add to DOMAIN.md or LESSONS.md: "For simple tasks you can do yourself (file reads, comparisons, status checks), do them directly. Dispatch to other agents only when the task requires their specific skills or would take more than a few turns."

2. **Brevity reinforcement** — K6 is partially working. May might benefit from a concrete example: "Good heartbeat output: 'Dispatched X. Result: Y. Todo updated. System healthy.' — that's 4 lines."

## Infrastructure Issue Discovered

**Detached sessions are broken.** `buildProjectStructure` is imported in `src/manager.ts:35` but doesn't exist in `src/tools.ts`. All detached processes crash on startup with `SyntaxError: The requested module './tools.js' does not provide an export named 'buildProjectStructure'`. Initially tried running May as detached (s_1773095388477_33) — process died immediately. Fell back to attached `delegate` which worked.

**Escalation needed:** This blocks all coaching exercises that use detached mode (the standard approach for process isolation).

## Next Steps

- Escalate self-execution guidance to optimizer (add to May's LESSONS.md or DOMAIN.md)
- Escalate detached session infra fix to May's todo
- Design exercise #3: test with BOTH an active todo item AND a dispatch follow-up pending (tests prioritization + multi-step follow-through)
- If exercise #3 PASS → graduation exercise
