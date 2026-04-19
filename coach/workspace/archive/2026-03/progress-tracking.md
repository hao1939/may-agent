# Convention: Progress Tracking

*Created: H636. Owner: Coach. Source: Agent session analysis (2679+ evals, 21 active conventions).*

## Problem

Agents performing multi-step tasks (heartbeats, delegated implementation, complex refactoring) have no standard way to report progress. This causes:
1. **Invisible work** — orchestrator (May) can't tell if an agent is stuck or making progress
2. **Duplicate delegation** — May re-delegates tasks because she can't see prior progress
3. **Lost partial work** — sessions expire mid-task with no record of what was completed

Evidence: Tech-lead "Planning Without Executing" anti-pattern (14 occurrences in error-handling skill), optimizer reconnaissance-only sessions (C9, 3x), evaluator incomplete heartbeats (C5).

## Convention

### Rule: Write Progress Markers for Multi-Step Tasks

**When**: Any task with 3+ distinct steps (implementation, audit, multi-file edit).

**How**: After completing each major step, write a brief progress note to your workspace:

```bash
# Option A: Append to workspace journal
echo "## [PROGRESS] Task: <task-name> — Step 2/5 complete
- ✅ Step 1: Read requirements
- ✅ Step 2: Edited src/lib/foo.ts (lines 45-80)
- ⬜ Step 3: Update tests
- ⬜ Step 4: Run test suite
- ⬜ Step 5: Verify and report" >> agents/<agent>/workspace/journal.md
```

```bash
# Option B: For delegated tasks, write to the brief file
echo "STATUS: 2/5 steps complete. Last: edited foo.ts. Next: tests." >> agents/<delegator>/workspace/<brief>.md
```

### Rules

1. **Persist after every major step** — If your session crashes after step 3, the next session can resume from step 4 instead of starting over.
2. **Include what's done AND what's next** — "Step 2 done" is useless without "Step 3: run tests" context.
3. **Use the workspace, not stdout** — Progress in the transcript is lost. Progress in a file is durable.
4. **Budget for progress writes** — A progress update takes 1 tool call. Factor this into your work.

### What Counts as a "Major Step"

- File created or substantially edited
- Test suite run (pass or fail)
- Delegation sent to sub-agent
- Verification completed
- Decision made that changes approach

### What Does NOT Need Progress Tracking

- Reading files (reconnaissance)
- Single-step tasks (one edit, one check)
- Heartbeat routine steps (already tracked by heartbeat structure)

## Enforcement

- Evaluator: Flag sessions with 5+ tool calls and zero `write()`/`edit()` to workspace files as potential progress-tracking violations.
- Coach: When reviewing incomplete sessions, check if progress was persisted. If not, add to agent's LESSONS.md.

## Integration with Existing Conventions

- **C3 (Verify Before Claiming)**: Progress markers include verification evidence, not just "I edited the file."
- **C9 (Reconnaissance-Only)**: Progress tracking prevents pure-analysis sessions — if you tracked progress, you did something.
- **C13 (Embed in Workflow)**: For agents with recurring incomplete-task patterns, embed progress checkpoints directly in heartbeat.md.
