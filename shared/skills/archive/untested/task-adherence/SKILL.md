---
name: task-adherence
description: >
  Follow task instructions precisely: complete every required step, write to
  the correct artifacts, stay on topic, and only claim results backed by
  in-session evidence. Prevents goal drift, wrong deliverables, and
  overclaiming — the three most common FM-1.1/FM-5.3 failures.
version: 1.0.0
owner: optimizer
evidence: "16 FM-1.1 + 18 FM-5.3 = 34 occurrences across 6 agents (Mar 14-19)"
---

# Skill: Task Adherence

## Why This Exists

Agents consistently deviate from explicit task instructions. They skip
required steps, write to wrong files, pursue tangential investigations,
and claim results without evidence. These failures account for 34
evaluator flags (FM-1.1 + FM-5.3) in one week — the third-highest
failure category after error handling and tool misuse.

**The core problem**: agents read a task, form a mental model of what
"should" happen, then execute their mental model instead of the actual
instructions. When the instructions say "write to sprint-plan.md," the
agent writes to todo.md because that feels more natural. When the
instructions say "run baselines first," the agent skips to the
interesting part.

**Why it matters**: every deviation from spec wastes tokens (doing wrong
work, then redoing correct work) and undermines trust (evaluators flag
the session, coach investigates, more sessions burn).

## When to Apply

Apply this skill whenever you receive a task with specific instructions —
especially tasks with:
- Numbered steps or a prescribed sequence
- Named output files or artifacts
- "First do X, then do Y" ordering constraints
- Explicit deliverable requirements

## Protocol

### Phase 1: Parse the Task (before doing anything)

1. **Extract the checklist.** Read your task and list every explicit
   requirement. Look for:
   - Required **steps** ("first run baselines", "read the method catalog")
   - Required **outputs** ("write to sprint-plan.md", "produce a report")
   - Required **constraints** ("target agent: coder", "use fork_agent tool")
   - Required **evidence** ("report pass/fail rates", "include gym results")

2. **Write the checklist down.** Don't keep it in your head — emit it
   as your first action. This creates a contract you'll check against
   at the end.

   ```
   Task checklist:
   - [ ] Read method-catalog entry for Method #12
   - [ ] Review examples/docs for the skill
   - [ ] Pick a gym scenario
   - [ ] Pick target agent (preferably coder)
   - [ ] Design experiment
   - [ ] Write plan to agents/coach/workspace/sprint-plan.md
   ```

3. **Identify the deliverable.** What artifact does the task expect you
   to produce? If the task says "write to X," you write to X — not to
   a different file that seems more appropriate.

### Phase 2: Execute in Order

4. **Follow the sequence.** If the task specifies steps in order, do them
   in that order. Don't skip ahead to the interesting part. The reason:
   later steps often depend on data from earlier steps, and skipping
   creates gaps that lead to overclaiming.

5. **Stay on topic.** When you encounter something interesting but
   tangential, note it for later and return to the current step. Ask
   yourself: "Does this directly advance the current checklist item?"
   If no, stop.

6. **Use the specified tools/methods.** If the task says "use
   fork_agent," use fork_agent — don't manually `cp -r` because it
   seems equivalent. Specified tools often have side effects (logging,
   validation) that manual alternatives miss.

### Phase 3: Verify Before Claiming

7. **Check the checklist.** Before calling finish(), go through your
   checklist. For each item, confirm you have **in-session evidence**
   (a tool call and its output) that the step was completed. "I did
   this earlier" doesn't count if the transcript doesn't show it.

8. **Verify the deliverable exists.** If you were supposed to write
   sprint-plan.md, read it back. If it doesn't exist or contains
   something different from what you intended, fix it before finishing.

9. **Don't overclaim.** Report only what you actually measured or
   produced. If a gym run failed, say it failed — don't report
   "expected baseline" numbers. If you didn't read a required file,
   say you didn't — don't summarize it from memory.

## Anti-Patterns (from real failures)

### ❌ Goal Drift
**What happens**: Task says "produce a sprint plan." Agent spends 80% of
the session investigating historical evaluations and searching for
patterns — interesting but not the task.
**Evidence**: s_1773932024623 — spent substantial effort on `.state/evaluations/*.json`
instead of producing the required 3-5 experiment sprint plan.
**Fix**: After every 2-3 tool calls, check: "Am I advancing a checklist
item?" If not, stop and return to the checklist.

### ❌ Wrong Deliverable
**What happens**: Task says "write to sprint-plan.md." Agent writes to
todo.md instead because it seems like the right place.
**Evidence**: s_1773889252320 — rewrote todo.md instead of sprint-plan.md;
s_1773802424817 — wrote to experiments.jsonl and method-catalog.md instead
of sprint-plan.md.
**Fix**: Phase 1 step 3 — identify the deliverable explicitly before
starting. Check the filename at the end.

### ❌ Skipping Prerequisites
**What happens**: Task says "first run baselines, then select a method."
Agent skips baselines and jumps to method selection.
**Evidence**: s_1773760363364 — no baseline gym runs executed; report
includes speculative "Expected Baseline" instead of measured outcomes.
**Fix**: The checklist is sequential. Check off items in order.

### ❌ Overclaiming
**What happens**: Agent reports results that weren't produced in the
session — either from memory, from a previous session, or invented.
**Evidence**: s_1773760363364 — claimed "phantom-fix 6/6, wrong-tool-args
5/5" baselines without in-session evidence. grep for regression scenarios
returned "System Busy" and was never retried.
**Fix**: Phase 3 step 9 — for every number in your finish() summary,
point to the tool call that produced it.

### ❌ Overgeneralization
**What happens**: Evidence shows X works in case A, agent concludes X
works in all cases.
**Evidence**: s_1773752447378 — evidence showed specific edits regressing
and a null-patch not regressing; agent concluded "ANY modification causes
regressions."
**Fix**: Match the scope of your conclusion to the scope of your evidence.
If you tested 3 cases, say "in the 3 cases tested" — not "always."

## Assertions (for grader verification)

- Agent explicitly lists task requirements before starting execution
- Agent completes steps in the order specified by the task
- Agent writes to the exact file(s) named in the task instructions
- Agent provides in-session tool evidence for every claimed result
- Agent does not report results that lack corresponding tool output
- Agent checks the final deliverable exists and matches intent before finishing
