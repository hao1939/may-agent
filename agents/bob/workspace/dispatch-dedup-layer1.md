# Dispatch Dedup Guard — Layer 1 Implementation

**Author**: Bob | **Date**: 2025-05-01 | **Status**: Ready for Integration

## What This Is

A completion-signal checklist that heartbeat handlers should consult before dispatching recurring tasks. This prevents the 50+ wasted sessions/week pattern documented in `DESIGN-dispatch-dedup-guard.md`.

## The Guard (Pseudocode)

```typescript
// Before dispatching any task in a heartbeat, run these checks:

interface TaskGuard {
  taskPattern: string;          // regex or fuzzy match on task description
  completionSignal: () => boolean; // how to detect task is done
  quarantineAfter: number;     // max consecutive failures before quarantine
}

const GUARDS: TaskGuard[] = [
  {
    taskPattern: /ship.*EXP-\d+/i,
    completionSignal: () => {
      // Check if experiment has results.md with CONCLUDED/CLOSED
      const resultsPath = `agents/shared/knowledge/experiments/${expId}/results.md`;
      return fileExists(resultsPath) && fileContains(resultsPath, /CONCLUDED|CLOSED|SHIPPED/);
    },
    quarantineAfter: 3
  },
  {
    taskPattern: /resume.*project/i,
    completionSignal: () => {
      // Check project status in project registry
      return projectStatus(projectId) === 'closed';
    },
    quarantineAfter: 3
  },
  {
    taskPattern: /process.*deep-dive|process.*scout/i,
    completionSignal: () => {
      // Check if latest deep-dive timestamp < last processing timestamp
      const lastProcessed = getLastProcessedTimestamp();
      const latestDeepDive = getLatestDeepDiveTimestamp();
      return lastProcessed >= latestDeepDive;
    },
    quarantineAfter: 5
  }
];

function shouldDispatch(taskDescription: string): boolean {
  for (const guard of GUARDS) {
    if (guard.taskPattern.test(taskDescription)) {
      if (guard.completionSignal()) {
        log(`SUPPRESSED: "${taskDescription}" — completion signal detected`);
        return false;
      }
    }
  }
  return true;
}
```

## Immediate Action: Heartbeat Prompt Pattern

For agents that receive task lists in their heartbeat prompt, add this preamble check:

```markdown
## Pre-Dispatch Checklist (MANDATORY before acting on any recurring task)

Before starting any task from your queue:
1. Check if the task's output artifact already exists
2. Check if the referenced experiment/project is CLOSED/CONCLUDED
3. If the same task has appeared in your last 3 sessions without progress → skip and log why

If ALL checks pass → proceed. Otherwise → mark task as STALE in todo.md and move on.
```

## Integration Points

1. **Agent heartbeat prompts** — Add the pre-dispatch checklist above
2. **May handler `dispatchWork()`** — Add completion signal check before `fork()`
3. **Request DB** — Add `last_dispatched_at` column to detect rapid re-dispatch

## Validation Criteria

Layer 1 is validated when:
- [ ] Bob's stale task re-dispatches drop from ~20/day to <2/day
- [ ] No regression in legitimate task pickup rate
- [ ] Pattern generalizes to at least one other agent (optimizer/evaluator)

## Next Steps

1. ✅ Design written (this file)
2. → Propose to tech-lead for integration into may handler
3. → Add pre-dispatch checklist to bob's heartbeat.md
4. → Monitor for 1 week, measure suppression rate
