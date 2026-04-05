---
name: structured-plan-writing
description: >
  Use when starting any multi-step task — before writing code, before running
  a sequence of operations, before any work with more than 2 steps. Forces
  agents to write plans that include dependency ordering, risk identification,
  and progress checkpoints. Complements plan-once-amend (which teaches don't
  replan) by teaching HOW to plan well.
version: 1.0.0
owner: coach
inspired_by: obra/superpowers writing-plans skill
complements: plan-once-amend
---

# Structured Plan Writing: Plans That Survive Contact with Reality

## When to Apply

Apply this skill **at session start for any multi-step task**:
- Implementing a feature that touches multiple files
- Running an investigation with multiple data sources
- Executing a sequence of operations with dependencies
- Any task where step N depends on the outcome of step M

**Skip for**: Single-step tasks, pure read-only exploration, tasks with
fewer than 3 steps.

## The Iron Law

```
EVERY PLAN STEP MUST HAVE: WHAT (action), WHY (purpose), and VERIFY (how you'll know it worked)
```

A plan without verification criteria is a wish list, not a plan.

## Steps

### Step 1: DECOMPOSE — Break the task into atomic steps

Read the task requirements and break them into steps where each step:
- Does exactly ONE thing
- Has a clear done condition
- Can be verified independently

```
Bad:  "Fix the auth system and update tests"
Good: "1. Fix token expiry check in auth.ts"
      "2. Add test for expired token path"
      "3. Run test suite to verify no regressions"
```

**Why**: Multi-action steps hide dependencies and make it impossible to
track progress. When step 1 is "do three things," you can't mark it
partially done.

### Step 2: ORDER — Identify dependencies between steps

For each step, ask: "What must be true before I can do this?"

Write dependencies explicitly:

```
Plan:
1. [ ] Read existing auth.ts to understand current flow
2. [ ] Fix token expiry check in auth.ts  (depends: 1)
3. [ ] Read test file to understand test patterns  (depends: 1)
4. [ ] Add expired-token test case  (depends: 2, 3)
5. [ ] Run full test suite  (depends: 4)
6. [ ] Write summary of changes  (depends: 5)
```

Rules for dependency analysis:
- **Independent steps can run in any order** — note this explicitly when
  steps have no dependency (e.g., "2 and 3 are independent, do either first")
- **Blocked dependencies cascade** — if step 2 is blocked, steps 4-6 are
  also blocked. Know this upfront so you don't waste time on doomed steps.
- **Read-before-write is always a dependency** — never edit a file you
  haven't read. This is implicit but worth making explicit in your plan.

**Why**: Without explicit dependencies, agents attempt steps in random
order and discover mid-execution that prerequisites aren't met. This
causes replanning (violating plan-once-amend) or wasted tool calls on
impossible steps.

### Step 3: RISK — Identify what could go wrong

For each step (or at least the critical ones), note:
- What could block this step?
- What's the fallback if it fails?

```
Plan:
1. [ ] Read auth.ts
   Risk: File might not exist → ONE quick search (find/ls), then mark BLOCKED if not found
2. [ ] Fix token expiry check
   Risk: Logic more complex than expected → read tests first to understand edge cases
3. [ ] Run test suite
   Risk: Tests may fail for unrelated reasons → check only auth-related tests if full suite fails
```

You don't need to mitigate every risk — just acknowledge the non-obvious
ones. The act of thinking "what if this fails?" prevents surprise and
enables faster pivots.

**Critical rule for missing files**: If a file doesn't exist at the
expected path, you get **at most 2 attempts** to find it (one read, one
search). If it's still not found, **mark the step BLOCKED and move on
to the next independent step**. Do NOT keep searching — hunting for
files is the #1 cause of wasted operations.

**Why**: Agents that don't anticipate risks spend 5-10 tool calls
recovering from predictable failures. A 30-second risk assessment saves
minutes of flailing. But the fallback must be bounded — "search until
found" is worse than "try once, then pivot." This is especially true for
missing files (ENOENT), broken tests (unrelated failures), and
permission issues.

### Step 4: CHECKPOINT — Define progress verification points

Insert checkpoint markers at natural boundaries in your plan:

```
Plan:
1. [ ] Read auth.ts
2. [ ] Fix token expiry check  (depends: 1)
── checkpoint: auth fix applied, file saved ──
3. [ ] Read test file
4. [ ] Add expired-token test  (depends: 2, 3)
5. [ ] Run test suite  (depends: 4)
── checkpoint: all tests pass, changes verified ──
6. [ ] Write summary
```

At each checkpoint:
- **Verify** all completed steps actually worked (re-read edited files,
  check command output)
- **Reassess** the remaining plan — do dependencies still hold?
- **Save progress** if your environment supports it (call checkpoint())

**Why**: Without checkpoints, agents build on unverified assumptions.
Step 4 assumes step 2 worked, but maybe the edit was malformed. A
30-second verification at checkpoint time prevents cascading failures.

### Step 5: WRITE IT DOWN — Materialize the plan

Write the complete plan before executing any step:

```markdown
## Plan

1. [ ] Read auth.ts to understand current token flow
2. [ ] Fix token expiry: change `>` to `>=` on line ~45  (depends: 1)
   Risk: Logic might be more complex → read tests first
3. [ ] Read auth.test.ts for test patterns  (independent of 2)
4. [ ] Add test: expired token returns 401  (depends: 2, 3)
── checkpoint: verify fix + test ──
5. [ ] Run `node auth.test.ts`  (depends: 4)
   Risk: Unrelated failures → focus on auth tests only
6. [ ] Write changes to session-summary.md  (depends: 5)
── checkpoint: all done, verify deliverables ──
```

The plan is now a living document. Use plan-once-amend discipline:
amend in place, never redeclare.

## Anti-Patterns

### AP-1: The Wish List Plan
**Pattern**: Agent writes "1. Fix bug 2. Update tests 3. Deploy" — no
dependencies, no risks, no verification points. This is a to-do list,
not a plan.
**Fix**: Every step needs WHAT + WHY + VERIFY. Add dependencies between
steps. Insert at least one checkpoint.

### AP-2: The Waterfall Trap
**Pattern**: Agent creates an elaborate 15-step plan with deep dependency
chains before reading any code. The plan becomes obsolete after step 2
when reality diverges from assumptions.
**Fix**: Plans should be 4-8 steps. If you need more, you're planning
too far ahead. Plan the first phase in detail, sketch the rest. Refine
at checkpoints.

### AP-3: No Risk Awareness
**Pattern**: Agent plans as if every step will succeed on the first try.
Step 3 depends on step 2, which depends on a file existing, which it
doesn't. Agent discovers this at step 3 and has to replan.
**Fix**: At minimum, identify risks for steps that involve reading
files (might not exist), running commands (might fail), or editing
code (might have unexpected structure).

### AP-4: Checkpoint-Free Marathon
**Pattern**: Agent executes 8 steps without ever verifying intermediate
results. Step 8 fails because step 3 silently produced wrong output.
Agent now has to debug 5 steps of cascading errors.
**Fix**: Insert checkpoints every 2-3 steps. At each checkpoint: verify
completed work, reassess remaining plan.

### AP-5: Over-Planning
**Pattern**: Agent spends 40% of session writing a perfect plan and 60%
executing. The plan was beautiful but there wasn't enough time to finish
the work.
**Fix**: Plan writing should be 10-15% of session time. A good-enough
plan executed fully beats a perfect plan executed halfway. Use the
"4-8 steps" guideline — if your plan is longer, you're over-planning.

## Assertions

1. The agent writes a plan before executing the first action step. The
   plan appears as a structured list (not just prose) with numbered steps.
2. At least one step in the plan has an explicit dependency noted
   (e.g., "depends: 1" or "after step 2").
3. At least one risk is identified for a non-trivial step — the agent
   acknowledges something could go wrong and notes a fallback.
4. The plan includes at least one verification checkpoint where the
   agent confirms intermediate results before proceeding.
5. The plan has between 3 and 10 steps — not a single mega-step and
   not a 20-step waterfall. (Exception: very simple or very complex
   tasks may fall outside this range.)
6. The agent does not spend more than 20% of total tool calls on
   planning — the plan serves execution, not the other way around.

## Synergies

- **plan-once-amend**: This skill writes the initial plan; plan-once-amend
  ensures you don't throw it away and rewrite. Use both together.
- **brainstorm-before-build**: For design tasks, brainstorm BEFORE planning.
  Brainstorming explores the design space; planning structures the execution.
- **check-state**: At each checkpoint, use check-state to verify file
  contents match expectations.
- **budget-before-act**: Before writing the plan, estimate total ops needed.
  If the plan exceeds budget, simplify.
- **obstacle-pivot**: When a planned step is blocked, use obstacle-pivot
  to decide: retry, skip, or escalate — don't just stall.

## Measurement

- **Plan quality**: Does the plan have dependencies, risks, and checkpoints?
  Score 0-3 (one point each).
- **Plan accuracy**: What % of planned steps executed as planned vs.
  required mid-session amendment? Target: >70%.
- **Plan efficiency**: Tool calls spent planning / total tool calls.
  Target: 10-15%. Red flag: >25%.
- **Checkpoint adherence**: Did the agent actually verify at checkpoint
  markers? Count verifications performed vs. planned.
