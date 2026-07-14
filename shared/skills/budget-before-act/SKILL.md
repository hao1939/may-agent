---
name: budget-before-act
description: >
  Turn-budget awareness and delivery assurance. Before starting work, agents estimate
  how many turns each requirement costs, scope down if over budget, create deliverable
  skeletons early, and checkpoint progress at 50% and 75% marks. Targets FM-3.1
  (premature termination / non-delivery) — the #1 uncovered failure mode at 31
  occurrences across all agents.
---

# Budget-Before-Act: Estimate Turns, Guarantee Delivery

## When to Apply

Apply this skill **at the start of every task that requires producing a deliverable**
(file, code change, analysis report, brief, plan). Specific triggers:

- **Multi-requirement tasks** ("analyze X, implement Y, verify Z") — these are the
  most likely to exceed turn budget. The more requirements, the more critical budgeting
  becomes.
- **Implementation tasks** ("write code", "create file", "update config") — these
  require both reading and writing phases, and agents commonly spend too long reading.
- **Tasks with unfamiliar codebases** — exploration can consume unlimited turns if
  not bounded. Set a hard exploration cap.
- **Any task where you don't know how many turns you have left** — if you can't
  estimate your remaining budget, assume you're at 50% and act accordingly.

**Do NOT apply** to pure-analysis tasks where the deliverable IS the thinking
(e.g., "what do you think about X?" in a conversation), or to tasks that are
explicitly open-ended exploration with no required output.

## Why This Matters

Premature termination (FM-3.1) is the most costly failure mode that has no
dedicated skill. Data from all agents shows **31 FM-3.1 occurrences** — sessions
where the primary deliverable was never produced. The breakdown:

| Agent | FM-3.1 Count | % of Total |
|-------|-------------|-----------|
| optimizer | 12 | 39% |
| tech-lead | 8 | 26% |
| bob | 4 | 13% |
| may | 3 | 10% |
| coach | 2 | 6% |
| amy-kimi | 2 | 6% |

The root cause is consistent: agents treat turns as unlimited, dive deep into
analysis/exploration, and discover too late that they've consumed their budget
without writing output. The fix is simple: budget upfront, write early, checkpoint
at milestones.

**Key insight from the data**: Sessions rated highest are NOT the ones that explore
most thoroughly — they're the ones that produce deliverables. A partial deliverable
with honest `status: "partial"` beats a complete analysis with no output file.

## Steps

### Step 1: BUDGET — Estimate turn cost per requirement (Turn 1)

In your **first response** after receiving the task, before any tool calls,
estimate the turn cost:

```
Task breakdown:
- Read/understand context: ~3 turns
- Implement change A: ~4 turns
- Implement change B: ~3 turns
- Verify both changes: ~2 turns
- Write up / finish: ~1 turn
Total estimated: ~13 turns
Budget available: ~20 turns
→ Feasible. Proceeding with full scope.
```

**If estimated turns exceed 80% of your budget**, scope down immediately:

```
Total estimated: ~25 turns
Budget available: ~20 turns
→ Over budget. Scoping down:
  - MUST: Implement change A (highest priority per task)
  - SHOULD: Implement change B (if turns remain after A)
  - DEFER: Verify with full test suite (report as partial)
```

**Rules of thumb for turn estimation**:
- Reading one file + understanding: 1 turn
- Reading multiple files for context: 2-3 turns
- Writing/editing one file with verification: 2-3 turns
- Running tests + interpreting results: 1-2 turns
- Each failed attempt + recovery: 2 turns (assume at least 1 failure)
- Finish/cleanup: 1 turn

**Do NOT skip this step.** The #1 predictor of FM-3.1 is diving into work
without estimating whether the work fits in the session. Even a rough estimate
("this is a 10-turn task, I have ~20 turns, so I'm fine") prevents most
non-delivery failures.

### Step 2: DELIVERABLE-FIRST — Create output skeleton early (Turns 2-4)

After initial reading (max 3 turns of exploration), create your deliverable
file with a skeleton structure. Don't wait until you have all the information —
write the structure first, fill in details as you go.

**For code changes:**
```
// Create the file/function with TODO comments for each section
function newFeature() {
  // TODO: Read config from X
  // TODO: Process data
  // TODO: Write output
  return placeholder;
}
```

**For analysis/reports:**
```markdown
# Analysis of X
## Finding 1: [placeholder — will fill after reading Y]
## Finding 2: [placeholder — will fill after reading Z]
## Recommendation: [placeholder]
```

**For briefs/plans:**
```markdown
# Brief: Task Name
## Problem: [1-sentence summary]
## Approach: [placeholder]
## Deliverables: [list from task requirements]
```

**Why skeleton-first works**: Even if the session ends unexpectedly, the skeleton
file exists and communicates structure/intent to the next session. A skeleton
with placeholders is infinitely more useful than no file at all.

### Step 3: CHECKPOINT at 50% — Verify partial deliverable exists (Mid-session)

At approximately the halfway point of your session (or after ~10 turns if you
don't know your total), pause and check:

**Checkpoint checklist:**
1. ✅ Does the deliverable file exist? (If not: STOP exploring, write it NOW)
2. ✅ Does it contain real content, not just placeholders? (If not: fill in
   what you know NOW)
3. ✅ Have you addressed the highest-priority requirement? (If not: skip to it)
4. ✅ Are you on track to finish within budget? (If not: scope down NOW)

**If the deliverable doesn't exist at 50%**: This is a RED ALERT. You've spent
half your session without producing output. Immediately:
- Stop all exploration/analysis
- Write the deliverable with what you know so far
- Mark incomplete sections as `[TODO: needs X]`
- Then continue working to fill in the TODOs

**This is the most important step in the skill.** Data shows that 80%+ of
FM-3.1 failures could have been caught by a mid-session checkpoint. The agents
had enough information to write *something* — they just kept exploring instead
of writing.

### Step 4: VERIFY DELIVERY at 75% — Ensure output is coherent (Late session)

At approximately 75% of your turns, verify the deliverable:

1. **Read back your output file** — does it make sense as a standalone document?
2. **Check task requirements** — did you address the primary ask? If not, address
   it now, even if briefly.
3. **Check for placeholders** — replace any remaining `[TODO]` with either real
   content or honest `[Not completed: reason]` notes.
4. **Plan your finish** — allocate your remaining turns: what MUST be done vs.
   what's nice-to-have?

**At this point, you should NOT start any new multi-turn exploration.** Your
remaining turns are for refinement, verification, and clean finish only.

### Step 5: FINISH HONESTLY — Declare what's done and what's not (Final turn)

When finishing your session:

- **If everything is complete**: `finish(status: "success")` with specific
  deliverables listed.
- **If partially complete**: `finish(status: "partial")` with explicit list of
  what's done and what remains. **This is correct behavior, not failure.**
- **If blocked**: `finish(status: "blocked")` with clear description of the
  blocker and what was attempted.

**Never claim "success" if requirements were silently dropped.** The evaluator
catches this (FM-3.1 sub-pattern: "Announced completion without actual delivery")
and it scores worse than honestly reporting partial completion.

## Assertions

1. The agent estimates turn budget in the first response, before any tool calls —
   a rough plan with turn-count estimates appears in the first assistant message.
2. The deliverable file/artifact exists by turn 4 or by 25% of the session,
   whichever comes later — even if it's a skeleton with placeholders.
3. At the mid-session point (~50% of turns), the agent has written real content
   (not just placeholders) to the deliverable — if not, exploration stops and
   writing begins immediately.
4. The agent does not start new multi-turn exploration after 75% of turns are
   consumed — remaining turns are used for refinement, verification, and finish.
5. The agent's finish declaration (`finish()` call or final message) accurately
   reflects what was delivered — no silent omissions of unaddressed requirements.

## Anti-Patterns

### AP-1: Bottomless Exploration (read everything, write nothing)
The agent reads 10+ files, analyzes the codebase thoroughly, understands the
problem deeply — and then runs out of turns before writing any output. The
exploration was valuable but produced zero deliverable.

**Why it happens**: Reading feels productive. Each file read teaches something
useful. But without a turn budget, there's always "one more file to check."
The agent never transitions from reading to writing because there's no trigger
to make that transition.

**Fix**: Apply Step 1 (budget) to cap exploration turns. Apply Step 2
(deliverable-first) to force early writing. The rule: exploration cannot exceed
30% of your turn budget. After that cap, you MUST write, even if your
understanding feels incomplete.

### AP-2: Scope Creep Without Scoping Down
The agent discovers the task is more complex than initially estimated (more
files to change, deeper dependencies, unexpected test failures). Instead of
scoping down to fit the budget, the agent tries to do everything and delivers
nothing.

**Why it happens**: The agent treats all requirements as equally mandatory.
But the task description usually has implicit priorities — the first/main
requirement is highest priority, and later requirements are "also do X if
possible." Without explicit scoping, the agent spreads effort too thin.

**Fix**: Apply Step 1 (budget) with the MUST/SHOULD/DEFER framework. When
discovered complexity exceeds the budget, immediately re-scope: identify the
one highest-priority deliverable and ensure IT gets done, then work on lower
priorities if turns remain.

### AP-3: Optimistic Non-Checkpointing
The agent assumes it will have enough turns and doesn't check progress at
milestones. It works steadily until suddenly the session ends or turns run out,
with work-in-progress scattered across the context window but not persisted to
any file.

**Why it happens**: The agent doesn't track its own turn count and has no
internal trigger to pause and assess progress. Each turn feels like there's
"plenty of time left."

**Fix**: Apply Step 3 (50% checkpoint) as a hard rule. After approximately
half your turns, you MUST pause and verify the deliverable exists with real
content. This is not optional — it's the single most effective intervention
against FM-3.1.

### AP-4: Silent Requirement Dropping
The agent completes 3 of 4 requirements, silently drops the 4th, and reports
"success." The dropped requirement is discovered later (by evaluator or by
the next session that depends on it), causing rework.

**Why it happens**: The agent runs low on turns, realizes it can't do
everything, and quietly skips the lowest-priority item without reporting it.
This feels like "being efficient" but is actually dishonest delivery.

**Fix**: Apply Step 5 (finish honestly). If any requirement was not addressed,
report `status: "partial"` with a clear note of what remains. A partial
completion that's honestly reported is always better than a "success" with
hidden gaps.
