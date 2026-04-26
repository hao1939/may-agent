---
name: idempotent-work-detection
description: >
  Before starting work, check whether the task has already been completed by a
  previous session. 10% of observed sessions (6/60) wasted 3-8 turns rediscovering
  that work was already done. This skill saves those turns by front-loading a
  quick state check. Targets FM-1.1 (Action Repetition) and the "already applied"
  anti-pattern unique to multi-session agents.
version: 1.0.0
owner: coach
evidence: >
  6 out of 60 sessions ended with "already done/already applied" in finish summary.
  Agents: coder (3), may (1), scout (1), coder-dup (1). Average wasted: 4 turns each.
  Sessions: s_1774167612839, s_1774167463032, s_1774156249139, s_1774168848565.
tested: true
---

# Idempotent Work Detection: Check Before You Redo

## The Problem

Multi-session agents frequently receive tasks that were already completed by a prior
session (same agent or different agent). The agent then spends 3-8 turns investigating
before discovering "oh, this was already done." This wastes ~$0.15-0.40 per incident.

**Observed examples:**
- Coder dispatched for "Phase 2: FIX" — the fix was already applied in Phase 1
- Coder dispatched for "fix process-data.js" — already fixed by a previous gym run
- May dispatched for "ghost deliverables" — Bob already dispatched the same to tech-lead
- Coder dispatched to fix QA heartbeat — changes already present from earlier session

## When to Apply

Apply this skill **in the first 2 turns of any session** where:
- The task mentions fixing, updating, or changing a specific file/artifact
- The task is a "Phase 2" or follow-up to previous analysis
- The task was dispatched by a coordinator who may not have checked current state
- You're working on a file that multiple agents can modify

## The Pattern (2 turns max)

### Turn 1: Quick State Check
Before analyzing the problem deeply, do a fast check:

```
# For file-change tasks: read the target file and check if change is already there
read(target_file)  # Look for the expected state, not the broken state

# For "fix X" tasks: run the test/validation first
bash("node test.js")  # or whatever the verification command is

# For dispatch tasks: check request DB for duplicates
agents("requests", filter="active")  # See if same task already pending
```

### Turn 2: Decide
Based on Turn 1 results:

| State Check Result | Action |
|---|---|
| Fix already applied, tests pass | `finish(status="success", summary="Already done by prior session. Verified: [evidence]")` |
| Task already dispatched to target agent | `finish(status="success", summary="Already dispatched: req:XXXX")` |
| Work partially done | Continue from where it left off (don't restart) |
| Work not done | Proceed with normal task execution |

## Key Discipline

**Run verification FIRST, investigate SECOND.** The natural instinct is to read the
task, understand the problem, then look at the code. But if the fix is already applied,
all that understanding was wasted. Instead:

1. Read just enough of the task to know what "done" looks like
2. Check if "done" is already the current state
3. If not done, THEN investigate

## Anti-patterns

- ❌ Reading 5+ files before checking if the fix is already applied
- ❌ Re-running the full investigation pipeline when a simple `node test.js` would show success
- ❌ Dispatching work to an agent without checking `agents.requests()` for existing active requests
- ❌ Assuming the task needs doing because someone asked you to do it

## Integration with Other Skills

- **investigate-and-fix**: Step 2 (Reproduce) naturally catches already-fixed issues.
  This skill adds a deliberate "check done first" step BEFORE Step 1 (Understand Context).
- **state-check-before-action**: Complementary — SCBA checks state before mutating.
  This skill checks completion state before starting any investigation at all.
