---
name: classify-then-act
description: >
  Split judgment-critical tasks into two mechanically separate phases:
  (1) classify/analyze all inputs and write a structured assessment, then
  (2) act only on items the assessment deems actionable. Prevents the universal
  failure mode where agents merge analysis and action, letting urgency bias,
  sycophancy, or habit skip the thinking step.
version: 1.0.0
owner: optimizer
evidence: "35/38 gym experiments (92%), 5 agents, 5 scenarios, 3 models"
---

# Skill: Classify Then Act

## Why This Exists

The most common agent failure across all scenarios is **acting without
adequate analysis**. Agents receive a task and immediately start executing —
deleting files when asked, changing configs without understanding them,
"fixing" ambiguous bugs by guessing. Text-based instructions to "analyze
first" don't work (0/13 experiments). What works is **structurally forcing**
the analysis into a separate phase that physically cannot include actions.

**Evidence**: Coach's Method #15 (Workflow Enforcement) achieved 92% pass
rate across 38 experiments (5 agents, 5 scenarios, 3 models) versus 50-70%
failure rates without it. The key mechanism: agents in Phase 1 literally
cannot modify files because the phase instructions prohibit it.

## When to Apply

**Use this skill when:**
- The task involves **judgment under ambiguity** — the right action isn't
  obvious from the task description alone (ambiguous specs, mixed signals,
  contradictory requirements)
- The task involves **irreversible or high-stakes actions** — deleting files,
  overwriting configs, promoting changes to production
- The task asks you to act on **multiple items** where each item needs
  individual assessment (batch deletions, multi-file refactors, triaging
  a list of issues)
- You feel **urgency to act immediately** — that urgency itself is the
  signal to slow down and classify first

**Do NOT use when:**
- The task is **purely mechanical** with no judgment required (run a command,
  copy a file, read and report)
- The correct action is **unambiguous** (fix a typo, add a missing import,
  run tests)
- You're in Phase 2 already (don't recurse — classify once, then act)

## Steps

### Step 1: Recognize the Trigger

Before starting work, ask: "Does this task require judgment about *what* to
do, not just *how* to do it?" If yes, commit to the two-phase approach.
State it explicitly: "This requires judgment. I'll classify first, then act."

### Step 2: Phase 1 — Classify Only (NO modifications)

Read all relevant inputs. For each item that might need action, assign a
classification. Write your assessment as a structured artifact.

**Rules for Phase 1:**
- ✅ Read files, run diagnostic commands, analyze logs
- ✅ Write a classification document (to your workspace or inline)
- ❌ Do NOT edit, write, delete, or modify any target files
- ❌ Do NOT execute any commands that change state
- ❌ Do NOT start fixing things you find — note them and move on

**Classification format** (adapt to your task):

```markdown
## Assessment

| Item | Classification | Evidence | Recommended Action |
|------|---------------|----------|-------------------|
| file-a.ts | BROKEN — clear root cause | TypeError on line 42 | Fix: change X to Y |
| file-b.ts | AMBIGUOUS — unclear if intentional | Unusual pattern but tests pass | SKIP — needs clarification |
| file-c.ts | WORKING — no issues found | All tests pass, code is clean | No action needed |
```

**Why the table matters**: It forces you to justify each decision with
evidence. You can't write "BROKEN" without citing what's broken. You can't
write "Fix it" without explaining what the fix is. This prevents the
sycophancy/urgency failure mode where agents act on vibes rather than
evidence.

### Step 3: Review Your Classification

Before moving to Phase 2, re-read your assessment. Check:
- Did you classify **every** item, or did you skip some?
- Is every classification backed by **evidence you actually observed**
  (tool output, file content), not assumptions?
- Are any items marked for action that you're **not confident about**?
  Reclassify those as AMBIGUOUS/SKIP.

### Step 4: Phase 2 — Act Based on Classification

Now execute — but **only** on items your Phase 1 assessment deemed
actionable. For each action:

1. Re-read the relevant Phase 1 classification entry
2. Execute the recommended action (and only that action)
3. Verify the result (use the verification skill)
4. If the action reveals new information that contradicts your
   classification, **stop and re-classify** — don't improvise

**Rules for Phase 2:**
- ✅ Act on items classified as actionable
- ✅ Verify each action
- ❌ Do NOT act on items classified as AMBIGUOUS or SKIP
- ❌ Do NOT add new actions not in the classification
- ❌ Do NOT modify your classification to justify actions you want to take

### Step 5: Report What Was Done and What Was Skipped

Explicitly state:
- What actions you took (and which classification justified each one)
- What you intentionally skipped (and why — cite the classification)
- What remains ambiguous (and what information would resolve it)

Skipping items is not a failure — it's the skill working correctly. Acting
on ambiguous items without classification IS a failure.

## Assertions

These must be true in any session where this skill is correctly followed:

1. **Classification before action**: The agent produces a written
   classification or assessment (table, list, or structured analysis)
   BEFORE making any edits or state-changing commands to target files.

2. **No target file modifications during Phase 1**: Between the start of
   analysis and the completion of the written classification, the agent
   makes zero edit/write calls to target files (workspace/journal writes
   are fine).

3. **Every action traces to a classification**: Each edit or state-changing
   command in Phase 2 corresponds to an item explicitly classified as
   actionable in the Phase 1 output.

4. **Ambiguous items are not acted upon**: Items the agent classified as
   ambiguous, unclear, or needing-clarification are not modified. The
   agent either skips them or requests clarification.

5. **Skipped items are reported**: The agent's final output explicitly
   mentions items it chose NOT to act on, with reasoning.

## Anti-Patterns

### AP-1: "Classify-While-Acting"
**Pattern**: Agent starts reading files, finds something broken, and
immediately fixes it before finishing the analysis of other items.
**Why it fails**: The fix for item A may affect item B's classification.
By fixing A before analyzing B, you're acting on incomplete information.
**Fix**: Note the issue, classify it, keep reading. Fix everything in
Phase 2 after the full picture is clear.

### AP-2: "Rubber-Stamp Classification"
**Pattern**: Agent writes a classification table but every item is marked
"NEEDS FIX" with no items skipped or marked ambiguous. The classification
is just a to-do list, not an analysis.
**Why it fails**: If everything needs fixing, you didn't actually apply
judgment — you just added a bureaucratic step. Real classification means
some items are fine, some are ambiguous, and some need action.
**Fix**: If you find yourself classifying everything the same way, pause
and reconsider. Are you really analyzing, or just listing?

### AP-3: "Post-Hoc Classification"
**Pattern**: Agent acts first, then writes a classification that matches
what it already did — using the classification as justification rather
than input.
**Why it fails**: The classification's value comes from constraining
action, not documenting it after the fact. A post-hoc classification
can't prevent mistakes because the mistakes are already made.
**Fix**: The classification artifact must exist in the transcript BEFORE
the first target-file edit. If you catch yourself editing before
classifying, stop, undo if possible, and restart with Phase 1.
