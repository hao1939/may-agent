# Task-Native Documentation and Behavior Review

**Design status:** Proposed for review.
**Implementation status:** Not implemented.
**Extends:** [Project/App Evaluation](project-app-evaluation.md)

## Purpose

Give Hao one independent reviewer for each Agent App's current documentation,
implementation, and observed behavior without creating another review state
machine beside the App task system.

The existing `evaluator` remains the reviewer. May remains the natural human
interface. The target App remains responsible for deciding and applying any
repair. Gym remains responsible for controlled May experiments and benchmark
evidence.

## Decision Summary

Use one standing `maintain` task per watched App:

```text
runtime/project-audit/<target>
```

Schedules, important evaluation facts, source observations, and manual requests
wake that task. Its current task receipt is the sole mutable review checkpoint.
The workflow writes reports as durable evidence, but reports do not schedule
work or become another state authority.

```text
schedule, fact, or human request
  -> wake the target's existing review task
  -> compare current evidence with the prior task receipt
  -> return the same checkpoint when no review is due
  -> otherwise run one bounded evaluator judgment
  -> publish one report and a new task receipt
  -> route actionable findings to the target owner
```

## Why This Belongs In Evaluation

Evaluation already owns independent session aftermath and project/App health
review. Documentation/implementation alignment and behavior-cohort examination
are additional audit questions, not target-domain work and not a new learning
system.

The responsibility boundary remains:

- Evaluation observes and judges.
- The target App owns remediation.
- Gym produces controlled May behavior evidence and tests proposed changes.
- May carries a concrete human decision or presents a requested result.

Evaluation never edits a target merely because a review found drift.

## Review Task Contract

The existing task keeps a stable desired specification. Wake-specific facts do
not change its generation.

```ts
{
  targetProject: "may-agent.app",
  authoritativeDocs: [
    "README.md",
    "docs/INDEX.md",
    "docs/1-principles",
    "docs/2a-design"
  ],
  behaviorAgents: ["may"]
}
```

Desired outcome:

> Keep the target's authoritative documentation, implementation, and observed
> behavior independently reviewed and aligned.

Acceptance requires:

1. Current authoritative documentation and relevant implementation were
   compared at an exact source revision.
2. Recent behavior received a bounded, evidence-backed examination when due.
3. Every conclusion is `aligned`, `drifted`, `healthy`, `watch`, `concern`, or
   `inconclusive`; unavailable evidence is never guessed.
4. Actionable findings are deduplicated and routed to the accountable target
   owner.
5. Human delivery occurs only for an exact decision, approval, or missing input.

The profile is explicit because archived proposals, historical incident logs,
and stale generated files must not be mistaken for current design authority.

## Task Receipt As The Checkpoint

The workflow reads its bounded current task projection through
`ctx.read.tasks.get(ctx.reconciliation.taskId)`. The prior summary and evidence carry
the last accepted review checkpoint:

```text
docs-revision:<sha256>
implementation-revision:<sha256>
behavior-through:<evaluation-or-session-identity>
behavior-window-end:<epoch-ms>
full-review-at:<epoch-ms>
verdict:<ok|watch|concern|urgent|blocked-on-human>
report:<relative-report-path>
```

These entries are task evidence, not a separate cursor protocol. They are
bounded and sufficient to decide whether the next wake has new evidence.
Long-form observations remain in the cited report and structured sidecar.

Implementation must include a regression test proving that a running maintain
attempt can read the previous accepted summary and evidence through `AppRead`.
If that projection loses the prior receipt during a claim, repair the bounded
projection rather than introducing a private state file.

## Wake Policy

The task system remains the only work scheduler and deduplicator.

| Wake                                      | Policy                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Two-hour scheduled check                  | Calculate cheap source hashes and review due times; do not call an agent when nothing is due. |
| Daily behavior review                     | Examine one bounded recent cohort and advance `behavior-through`.                             |
| Weekly baseline                           | Run a complete review even when no material delta was detected.                               |
| Material source change                    | Review documentation and implementation alignment.                                            |
| `needs_improvement` or `low_quality` fact | Wake an immediate bounded behavior review for the affected target.                            |
| Manual `review-agent-app` request         | Force one complete review and return its report.                                              |

Routine successful session evaluations do not each cause a project-level LLM
review. They remain available to the daily cohort. Multiple wakes for the same
target converge through its one stable task key.

## Workflow

Refactor `project-health-evaluator` into a deterministic gate followed by one
optional evaluator call:

1. Validate the target against the declared review profiles.
2. Read the previous review checkpoint from the current task projection.
3. Hash only declared authoritative documentation and relevant implementation
   inputs. Never crawl archives or arbitrary worktrees.
4. Interpret the exact wake and determine which review dimensions are due.
5. If no dimension is due, return `converged` with the accepted checkpoint and
   no report, agent call, or delivery.
6. Otherwise call `evaluator` once with the target profile, previous checkpoint,
   exact trigger, bounded recent behavior window, and prior report reference.
7. Validate the structured result and bind it to the requested target and
   evidence window.
8. Write one Markdown report and one structured facts sidecar.
9. Re-open both artifacts before claiming convergence.
10. Return the new checkpoint in task evidence and emit owner or human requests
    only when policy requires them.

The workflow must not read Host-private task storage, write target files, send
unstructured messages, or use its report directory as a queue.

## Review Result

One structured judgment covers three related dimensions:

```json
{
  "targetProject": "may-agent.app",
  "documentation": {
    "status": "aligned | drifted | inconclusive",
    "evidence": []
  },
  "implementation": {
    "status": "aligned | drifted | inconclusive",
    "evidence": []
  },
  "behavior": {
    "status": "healthy | watch | concern | inconclusive",
    "sessionsExamined": [],
    "evidence": []
  },
  "rootCause": "documentation | implementation | behavior | evidence-gap | none",
  "findings": []
}
```

A difference between prose and code is not automatically an implementation
bug. The reviewer must establish whether the accepted documentation is stale,
the implementation drifted, behavior violates both, or current evidence cannot
decide.

Findings are bounded to the three most material actionable gaps. Each finding
names exact evidence, impact, accountable target, smallest useful correction,
and observable verification.

## Behavior Examination

The daily live-behavior cohort is deliberately bounded:

- a trailing 24-hour window;
- at most 12 relevant sessions;
- failed, interrupted, `needs_improvement`, and `low_quality` evidence first;
- a small success control sample;
- transcript inspection only when aggregate facts do not establish the claim;
- repeated issues grouped by evidence-backed cause rather than wording alone.

Evaluation judges observed behavior. It may cite the latest compatible Gym run
as controlled evidence, but it does not run Gym's campaign or decide benchmark
truth. Gym independently decides whether a May finding teaches something
reusable and whether an isolated candidate is better.

## Reports And Delivery

Reports remain under:

```text
reports/project-health/<target>/<timestamp>.md
reports/project-health/<target>/<timestamp>.facts.json
```

They are durable evidence linked from the task receipt. Retention may keep the
latest bounded report/facts pairs, but deletion or retention policy cannot
change task state.

An actionable result emits `project.owner.requested` to the target App. A
specific human decision uses the existing correlated May request path. An
unchanged concern, successful notification, or report write is not domain
resolution.

## Natural Human Interface

The existing `review-agent-app` action remains the machine interface. May turns
natural conversation into that addressed App request:

> Review may-agent's current design and recent behavior.

The request completes only when the exact Evaluation task result and report are
available. Optional UI or slash-command presentation is an adapter concern; it
does not introduce another review object.

## Migration

1. Add explicit review profiles for the currently watched Apps.
2. Add tests for reading the prior maintain-task receipt and preserving it on a
   deterministic no-op.
3. Move project-health dedupe fields from
   `.state/project-health/targets/*.json` into task evidence.
4. Delete the private project-health cursor and its read/write helpers.
5. Add the deterministic due gate before `ctx.agents.call`.
6. Extend the judgment schema, reports, and tests with documentation,
   implementation, and behavior dimensions.
7. Route serious behavior facts to the matching project-audit task and add the
   daily/weekly due policy.
8. Verify manual conversation-to-action-to-report delivery.
9. Retire Gym's duplicate generic design-alignment review after Evaluation has
   equivalent evidence coverage; keep Gym's improvement and benchmark work.
10. Update the accepted project/App evaluation design only after this proposal
    passes review and implementation verification.

Migration must preserve the last valid report reference where practical. It
must not copy private cursor state into a new database or compatibility store.

## Non-Goals

- Creating a new reviewer agent or App.
- Building a documentation synchronization engine.
- Automatically changing docs or code after a finding.
- Treating every session as a project-level review.
- Moving Gym's controlled experiments into Evaluation.
- Introducing another request, queue, cursor, or review lifecycle.
- Making report publication itself proof that the target improved.

## Review Questions

1. Are the explicit authoritative-document profiles small and stable enough, or
   should each target declare its own review profile in `project.json`?
2. Does the bounded current-task projection reliably expose the prior accepted
   receipt during a running maintain attempt?
3. Is a daily 24-hour, 12-session cohort the right initial cost/coverage tradeoff?
4. Which source changes should count as implementation inputs for each target?
5. What exact parity evidence is required before retiring Gym's daily generic
   design-alignment review?
