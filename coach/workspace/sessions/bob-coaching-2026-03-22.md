# Bob Coaching Report — Session 1 (Exercise Design + Dry-Run Analysis)

**Date:** 2026-03-22
**Agent:** Bob (Design Philosopher, Gemini 3 Pro)
**Coach:** Coach (via human-delegated priority coaching)
**Session type:** Exercise design + historical analysis (live spawn blocked by model proxy unavailability)

---

## Executive Summary

Bob could not be spawned live in the coaching sandbox — the `gemini-3-pro-preview` model requires the `MODEL_BASE_URL` proxy which is not available in this context. Instead, this session:

1. **Performed deep forensic analysis** of Bob's 15 most recent evaluations
2. **Designed 3 targeted exercises** ready to run when infra is available
3. **Identified root causes** beyond what was previously documented
4. **Proposed structural fixes** that don't rely on Bob reading instructions

---

## Forensic Analysis: Bob's Failure Patterns (15 most recent evaluations)

### Pattern 1: Truncated Writes (8/15 sessions — 53%)

| Session | Quality | Evidence |
|---------|---------|----------|
| s_1772884954184_21 | 0.15 | Review file ends mid-word: `"...not to conflate **Mechanism** (how the code works) w"` |
| s_1772884337758_19 | 0.20 | `allowShrink:true` used twice; doc ends `\| **Role** \| Interface` |
| s_1772875163238_57 | 0.35 | Review truncated at `"### 1."` — didn't address any required questions |
| s_1772894810512_17 | 0.30 | Overwrote 7 heartbeat.md files after truncated reads, bypassed shrink guard |
| s_1772894822524_18 | 0.30 | Same session duplicate eval — SOUL.md ends `"## Core Principles 1. **The …"` |
| s_1772872918428_47 | 0.55 | Review ends mid-heading: `"## Strengths 1. **Philosophy Alignm…"` |
| s_1772871011505_45 | 0.05 | No deliverable at all — transcript ends after two reads |
| s_1772869412260_43 | 0.10 | No deliverable — session ends after reading files |

**Root cause analysis:** Bob's model (Gemini 3 Pro) appears to hit output token limits during long `write()` calls. The content is generated but truncated mid-stream. Bob doesn't verify writes by reading back, so he never detects the truncation. His SOUL.md says "Surgical Edits Only" but he ignores it because full-file writes are the path of least resistance.

**Why instructions failed:** Bob's lessons.md already contains the anti-truncation rules. But Gemini 3 Pro's context-learning reliability is low (per Bob's own domain.md: "context learning success rate: 17.2%"). The rules are prose in a knowledge file — they need to be **structural constraints**, not just advice.

### Pattern 2: Incomplete/Missing Deliverables (6/15 sessions — 40%)

| Session | Quality | What happened |
|---------|---------|--------------|
| s_1772871011505_45 | 0.05 | Required `task-notification-review.md` — never created |
| s_1772869412260_43 | 0.10 | Same deliverable — never created |
| s_1772902546390_1 | 0.10 | Read only 5 of required 20 eval files, then stopped |
| s_1772875163238_57 | 0.35 | Review exists but answers 0 of 5 required questions |
| s_1772884954184_21 | 0.15 | Review exists but truncated mid-word |
| s_1772878441779_0 | 0.20 | SKILL.md written but never verified for format compliance |

**Root cause:** Bob runs out of turn budget or hits output limits before completing deliverables. He spends too many turns on context gathering (reading many files) and not enough on output. The "gather everything first, then write" pattern is fundamentally incompatible with his output token limits.

### Pattern 3: Scope Violations (4/15 sessions — 27%)

| Session | Quality | What happened |
|---------|---------|--------------|
| s_1772880841489_12 | 0.30 | Task was "design analysis" → Bob delegated to optimizer AND coder (both failed) |
| s_1772872918428_47 | 0.55 | Task said "DO NOT read manager.ts" → Bob read philosophy.md (scope creep) |
| s_1772884954184_21 | 0.15 | Used `allowShrink:true` to overwrite shared docs (operational meddling) |
| s_1772894810512_17 | 0.30 | Mass-edited 7 agents' heartbeat.md files (outside his domain) |

**Root cause:** Bob's system prompt includes meta-loop orchestration instructions that prime him to delegate. When given a review task, the delegation instructions in his context compete with the task-specific constraints.

### Where Bob Succeeds (the L3 ceiling)

| Session | Quality | What worked |
|---------|---------|-------------|
| s_1772875429911_59 | 0.80 | Clean review, referenced principles, complete deliverable |
| s_1772893975036_6 | 0.75 | Good review, 3 productive calls, zero waste |
| s_1772903107360_10 | 0.55 | Acceptable review, correct scope, minor truncation |

**Pattern in successes:** Short tasks, single deliverable, no delegation attempted, output small enough to avoid truncation. **Bob succeeds when the task is small and focused.**

---

## Exercise Designs (Ready to Run)

### Exercise 1: Surgical File Update (Data Integrity)
**File:** `.state/coaching/bob-exercise-1-task.txt` (staged)
**Tests:** Can Bob edit a 302-line file without destroying content?
- Must use line-range reads (not full-file read)
- Must use sed/append (not full-file write)
- Must verify edits by reading back
- **PASS:** Zero data loss, edits correct, verified
- **FAIL:** File corrupted, content missing, or unverified write

### Exercise 2: Focused Design Review (Scope + Completeness)
**File:** `agents/coach/workspace/exercises/bob-exercise-2-review-target.md` (staged)
**Tests:** Can Bob produce a complete review without scope drift?
- Must answer all 5 specified questions
- Must produce exactly 1 output file
- Must NOT delegate to any agent
- Must NOT create extra files
- **PASS:** Complete review, no scope drift
- **FAIL:** Incomplete, extra files created, or delegation attempted

### Exercise 3: Dual Deliverable (Integration)
**Design:** Ask Bob to update todo.md AND write a philosophy observation
- Tests all three skills simultaneously
- Both deliverables must be complete and verified

---

## Structural Recommendations (Beyond Coaching)

Coaching alone will not fix Bob. His model (Gemini 3 Pro) has structural output limits that create truncation. Recommended fixes:

1. **Reduce `maxTurns` from 50 to 25** — Forces Bob to be more focused; fewer turns means less context gathering and more output
2. **Add a post-write verification cron** — Infrastructure checks: did Bob's last write produce a file that ends mid-sentence? If so, flag it
3. **Remove meta-loop orchestration from Bob's system prompt for review tasks** — The delegation instructions prime scope violations during pure review work
4. **Add `allowShrink` denial to Bob's exec policy** — Structurally prevent `allowShrink:true` which he uses to bypass the shrink guard

---

## Scoring (Deferred)

Exercises not yet run. Session score: **N/A — DEFERRED**
Bob's pass streak remains **0/3**.

**Next step:** Run Exercise 1 when model proxy is available. Priority: HIGH.
