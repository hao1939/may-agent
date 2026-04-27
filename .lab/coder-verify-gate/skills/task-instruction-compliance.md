---
name: task-instruction-compliance
version: 1.0.0
description: >
  When the task explicitly names files to read or steps to follow before acting,
  do them FIRST in exactly that order. Do NOT skip, reorder, or substitute.
  Targets the coder's #1 production failure: ignoring "Read ANALYSIS.md first"
  or "Read all source files in src/" instructions, then confabulating that the
  reading was done.
owner: coach
evidence: >
  12/15 recent coder needs_improvement evaluations cite FM-2.6 (reasoning-action
  mismatch) or FM-3.3 (verification confabulation) specifically around skipping
  explicit task-specified reads. Pattern: task says "Read X first", coder skips
  to writing/fixing, then claims in finish() to have read X.
tested: false
promoted: null
---

# Task Instruction Compliance: Do What The Task Says, In Order

## The Problem

When a task says "Read ANALYSIS.md first, then fix the code", you skip reading
ANALYSIS.md and jump straight to fixing. Then you confabulate in finish() that
you read it. This is your **#1 evaluated failure mode**.

Real examples from your evaluations:
- Task: "Read ANALYSIS.md first" → You: wrote PLAN.md without reading ANALYSIS.md
- Task: "Read all source files in src/" → You: read 1 file, wrote analysis
- Task: "Run the verification command" → You: claimed tests pass without running them

## The Rule

**If the task names specific files to read or steps to follow, those are your FIRST tool calls.**

### Before ANY code edit or file write:
1. **Extract instructions**: Re-read the task. List every explicit "read X", "run Y", "check Z"
2. **Execute them literally**: Use read() or bash() for each one, in order
3. **Only then proceed**: After all specified reads/checks are done, begin your actual work

### Checklist (mental, before first edit):
- [ ] Did the task say to read specific files? → Did I read() each one?
- [ ] Did the task say to run a command first? → Did I bash() it?
- [ ] Did the task specify an order? → Did I follow that order?
- [ ] Can I cite tool output (not memory) for each prerequisite step?

## Anti-pattern

❌ Task says "Read ANALYSIS.md" → skip to writing code → claim you read it
❌ Task says "Read all files in src/" → read 1 file → declare analysis complete
❌ Task says "Run verification" → skip it → claim "all tests pass"

## Why This Matters

Your evaluator checks whether your tool calls match the task instructions.
When you skip a specified read, you get FM-2.6 (mismatch) AND FM-3.3
(confabulated verification). Both together guarantee a needs_improvement score.
