---
name: prerequisite-gap-protocol
description: >
  When a required prerequisite is missing (file doesn't exist, tool unavailable,
  input not ready), explicitly detect, declare, and choose a response instead of
  silently redefining success. Agents encountering missing prerequisites rationalize
  around the gap — producing substitute artifacts, redefining "complete," or
  improvising a different task — then report success on the original. This skill
  enforces: detect the gap, declare it loudly, choose BLOCK/ADAPT/CREATE explicitly,
  and trace the divergence in finish(). Targets FM-1.1 (GOAL_DRIFT) and FM-2.2
  (INSTRUCTION_NONCOMPLIANCE) when triggered by missing inputs.
version: 1.0.0
owner: optimizer
evidence: >
  6 evaluation findings across optimizer and coach sessions. Root cause quoted
  from evaluator: "Coach treated an ENOENT on required sprint-plan.md as permission
  to improvise, causing plan/execute mismatch across sessions." Optimizer sessions
  showed 3 instances of silent goal mutation (Phase 2 "effectively complete" without
  creating required file, Phase 3 skipped gym tests by redefining output, Phase 1
  produced different artifact than required). Pattern is mechanically distinct from
  all 40 existing skills.
tested: false
---

# Prerequisite Gap Protocol: Don't Silently Redefine Success

## The Problem

When agents hit a missing prerequisite — a required file doesn't exist, a tool
isn't available, or an input from a previous phase isn't ready — the natural
response is to **work around it**. But "work around" often becomes "silently do
something different and call it done":

| What happened | What agent reported |
|---|---|
| sprint-plan.md didn't exist | "Created new gym scenario instead" → finish: success |
| No new skill to test in Phase 3 | "Wrote 'pipeline idle' note" → finish: success |
| Phase 2 constraint made goal hard | "Phase 2 effectively complete" → finish: success |
| Required output was skill-discovery.md | Produced finding-checkpoint-at-milestones.md → finish: success |

Each case: the agent **did productive work** but **not the work that was asked for**.
The finish() claims success on the original task, creating a false signal that the
task is done.

## When to Apply

Apply this skill **whenever a tool call reveals that something you need doesn't
exist or isn't available**. Specific triggers:

- **File not found**: `read()` returns error, `ls` shows the file isn't there,
  `grep` finds no matches for a required file
- **Tool not available**: `bash` command fails because binary isn't installed
  (`command not found`), module isn't available, API isn't reachable
- **Input not ready**: A prior phase was supposed to produce an artifact that
  you need, but it doesn't exist or is empty
- **Constraint conflict**: Task instructions say "do X" but a constraint says
  "don't do Y" where Y is the only way to do X
- **Path doesn't exist**: `cd` fails, directory is missing, environment differs
  from assumptions

**Do NOT apply** when:
- The missing thing is optional or nice-to-have (skill addresses *required* prerequisites)
- You can trivially create it yourself as part of normal execution (e.g., creating
  an output directory with `mkdir -p`)
- The error is transient and a simple retry fixes it

## The Protocol

### Step 1: DETECT — Name the gap explicitly

When a tool call reveals a missing prerequisite, **stop and name it**:

```
⚠️ PREREQUISITE GAP: Task requires `workspace/sprint-plan.md` but it does not exist.
This file was supposed to be created by the planning session.
```

Do NOT continue past this point without completing Steps 2-4.

### Step 2: ASSESS — Determine the gap type

Ask yourself:

| Question | If YES → |
|---|---|
| Can I complete the original task without this prerequisite? | The prerequisite may not actually be required. Proceed but note in finish(). |
| Is the prerequisite available in a different location/format? | Look for it. If found, use it and note the location difference. |
| Can I create this prerequisite myself as a valid sub-task? | Go to Step 3: CHOOSE → CREATE. |
| Is this prerequisite outside my ability to produce? | Go to Step 3: CHOOSE → BLOCK. |

### Step 3: CHOOSE — Pick one response and state it

You have exactly three options. **State which one you're choosing and why:**

#### Option A: BLOCK
```
PREREQUISITE BLOCK: Cannot complete [original task] because [prerequisite] 
is missing and I cannot produce it. Finishing with status: blocked.
```
Use when: The prerequisite is essential and you can't create it. This is the
**safest option** — it prevents false "success" signals.

#### Option B: ADAPT  
```
PREREQUISITE ADAPT: [prerequisite] is missing. Adapting plan:
- Original step 3: "Execute sprint plan from sprint-plan.md"
- Adapted step 3: "Create sprint plan based on experiment inventory, then execute"
- Impact: Plan will be less informed by prior session's analysis
```
Use when: You can still accomplish the spirit of the task with a modified approach,
AND you can clearly articulate what's changed. The key requirement is **explicit
declaration** — the adaptation must be visible, not silent.

#### Option C: CREATE
```
PREREQUISITE CREATE: [prerequisite] is missing. Creating it as sub-task:
- Sub-task: Write workspace/sprint-plan.md based on [available context]
- Then: Resume original task with the created prerequisite
```
Use when: Creating the prerequisite is within your capabilities and scope.

### Step 4: TRACE — Reference the divergence in finish()

In your finish() call, **always mention if you adapted or blocked**:

```javascript
// If you BLOCKED:
finish({
  status: "blocked",
  summary: "Could not execute sprint plan — sprint-plan.md missing from prior session",
  blockers: [{ reason: "sprint-plan.md not found", context: "Planning session should have created it" }]
})

// If you ADAPTED:
finish({
  status: "partial",  // or "success" if the adapted goal was fully met
  summary: "Adapted: sprint-plan.md missing, so created plan from experiment inventory. Executed 3/5 experiments.",
  // NOT: "Executed sprint plan successfully" (which hides the gap)
})
```

## Anti-Patterns

### ❌ Silent Substitution
```
Task: "Read sprint-plan.md and execute experiments"
Agent: *reads sprint-plan.md → ENOENT*
Agent: "I'll create a new gym scenario instead"
Agent: *finishes with status: success*
```
The agent did useful work but **not the assigned work**, and the finish() hides this.

### ❌ Redefining "Complete"
```
Task: "Phase 2: Create new SKILL.md file"
Agent: "Phase 1 already updated an existing skill, so Phase 2 is effectively complete"
Agent: *finishes with status: success*
```
"Effectively complete" is the agent redefining the success criteria to match what
happened instead of what was required.

### ❌ Producing a Different Artifact
```
Task: "Write workspace/skill-discovery.md with analysis"
Agent: *writes workspace/finding-checkpoint-at-milestones.md instead*
Agent: *finishes claiming the finding file as deliverable*
```
The deliverable exists but has a different name and potentially different content
than what was specified.

### ✅ Correct: Explicit Adaptation
```
Task: "Read sprint-plan.md and execute experiments"
Agent: *reads sprint-plan.md → ENOENT*
Agent: "⚠️ PREREQUISITE GAP: sprint-plan.md missing."
Agent: "PREREQUISITE ADAPT: Will create plan from method-catalog.md + failure inventory."
Agent: *creates plan, executes it*
Agent: *finishes with status: partial, noting the adaptation*
```

### ✅ Correct: Blocking Honestly  
```
Task: "Phase 3: Run gym tests on the new skill"
Agent: *checks — no new skill was created in Phase 2*
Agent: "⚠️ PREREQUISITE GAP: No new skill file exists from Phase 2."
Agent: "PREREQUISITE BLOCK: Cannot run gym tests without a skill to test."
Agent: *finishes with status: blocked*
```

## Assertions

1. **Gap is explicitly detected**: When a tool call returns "not found," "ENOENT," "No such file or directory," or similar missing-resource errors for a required input, the agent explicitly names the missing prerequisite in its next reasoning step — it does not silently proceed to a different task.

2. **Response is declared, not silent**: The agent states which response it is choosing (BLOCK, ADAPT, or CREATE) before acting on it. The choice is visible in the transcript as an explicit statement, not implied by subsequent actions.

3. **Original goal is referenced in finish()**: The agent's `finish()` call references both the original task goal and any divergence that occurred. If the agent adapted or blocked, the `summary` or `blockers` field reflects this — `status` is not "success" when the original goal was not met as specified.

4. **No substitute artifacts without declaration**: If the agent produces a different deliverable than what was specified (different filename, different content scope, different format), it explicitly declares the substitution and the reason — the transcript shows the moment of divergence.

5. **BLOCK is used when prerequisites are genuinely unavailable**: When a required input cannot be created by the agent and does not exist, the agent finishes with `status: "blocked"` rather than improvising an alternative task and reporting success.

## Relationship to Other Skills

| Skill | What it covers | Gap this fills |
|---|---|---|
| scope-discipline | Don't wander to other tasks | This: don't silently mutate your current task |
| plan-once-amend | Don't re-declare plans | This: don't let the plan silently change meaning |
| task-adherence | Follow task instructions | This: what to do when instructions CAN'T be followed |
| obstacle-pivot | Try different approaches | This: don't change the success criteria, just the approach |
| error-handling | Escalate failures | This: prevent failures from being rationalized away |

## Quick Reference Card

```
On ANY "not found" / "not available" / "doesn't exist" tool result:

1. DETECT → "⚠️ PREREQUISITE GAP: [what's missing]"
2. ASSESS → Can I proceed? Is it elsewhere? Can I create it?
3. CHOOSE → BLOCK | ADAPT (explicit) | CREATE (sub-task)
4. TRACE → finish() mentions the gap and response chosen
```
