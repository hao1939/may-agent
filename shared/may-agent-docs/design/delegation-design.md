# Delegation Design

## Status: Design Phase

## Core Insight

Agents are good at **decisions** (read code, find bugs, choose approach). Agents are bad at **process** (remembering to include context, formatting returns, following review steps). The infra should handle all process; agents only make decisions.

## Current Problem

Today, agents manage their own delegation process:
- May decides what context to include in the task (often too little)
- Coder decides what to return in finish() (often just a summary)
- Tech-lead manually orchestrates the coder→qa→fix loop in heartbeats
- QA decides how to review (often just confirms "looks good")

Result: context lost at every handoff, 30-50% ops wasted on rediscovery, QA rubber-stamps.

## Design: Infra Does Process, Agents Do Decisions

### Sending: Infra auto-gathers context

When `agents.call("coder", task)` is invoked, the infra should automatically:

1. **Attach the caller's relevant tool history** — what files were read, what errors were seen, what commands ran. The caller doesn't write this — infra extracts it from the session transcript.

2. **Attach related file contents** — if the task mentions file paths, pre-read them and include snippets. The delegate doesn't re-read what the caller already read.

3. **Attach the verification command** — if the task was dispatched from a workflow, the workflow defines how to verify. Not up to the agent.

The agent writes: "Fix the off-by-one in the discount calculation."
The infra adds: here are the files, here's the error, here's how to verify.

### Returning: Infra structures the result

When an agent's turn completes, the infra should automatically:

1. **Extract deliverables** from the transcript — what files were written/edited. Not from finish() args (agent may forget), but from actual tool calls.

2. **Extract verification evidence** — what commands were run and their exit codes. Not from agent self-report, but from tool results.

3. **Build the handoff summary** — ctx.summarize() already does this. Make it the default return, not optional.

The agent just works. The infra captures what happened.

### Reviewing: Infra frames the review

When QA reviews coder's work, the infra should:

1. **Provide the diff** — not "review the last commit" but the actual file changes, extracted from coder's tool history.

2. **Provide the verification results** — what commands coder ran and whether they passed.

3. **Frame the question** — "Does this change solve [original task]? Check [these specific files]. Run [this verification command]."

QA's job is reduced to: read the diff, check the logic, run the test, say pass/fail with specifics. The process framing comes from infra.

### Looping: Infra manages the loop

The coder→qa→fix cycle is a workflow, not agent initiative:

1. Infra runs coder with task + auto-gathered context
2. Infra extracts coder's deliverables + verification from transcript
3. Infra runs QA with deliverables + diff + verification framing
4. Infra checks QA result: PASS → done, FAIL → back to step 1 with QA findings
5. After N rounds, infra escalates to human

No agent decides the process. Each agent just answers its question.

## What Changes

| Today | Proposed |
|-------|----------|
| Agent writes task description | Infra auto-gathers context from caller's transcript |
| Agent formats finish() args | Infra extracts deliverables from tool calls |
| Agent decides review process | Workflow defines review steps |
| Agent decides when to escalate | Workflow escalates after N rounds |
| Tech-lead orchestrates in heartbeat | Workflow orchestrates mechanically |
| QA decides what to check | Infra frames the review question |

## What Stays the Same

| Aspect | Why |
|--------|-----|
| Separate sessions for coder/QA | Accountability — can't mark own homework |
| Agent has full tool access | Agent decides HOW, infra decides WHAT and WHEN |
| finish() exists | Agent signals "I'm done with my decision" — infra captures the rest |
| context.md injection | Environmental knowledge still needed |

## Implementation Approach

### Phase 1: Auto-context on call (infra change)

When `agents.call` or `ctx.runAgent` is invoked, the infra automatically appends the caller's recent tool history (files read, commands run, errors seen) to the task. This is a change in `manager.ts` — extract from the calling session's messages and append to the delegate's task.

Measure: do delegates use fewer ops for context discovery?

### Phase 2: Auto-extract on return (infra change)

When a session completes, the infra auto-extracts deliverables and verification from the transcript (like ctx.summarize but always-on). The caller gets structured data without depending on the agent's finish() discipline.

Measure: do callers have better information to audit with?

### Phase 3: Review workflow (workflow)

Build the code-review-loop workflow that uses Phase 1 + 2 for the coder→qa→fix cycle. QA gets auto-framed review questions.

Measure: does QA catch more issues? Does the fix cycle complete faster?

## Evidence Questions

Before building any phase:

1. **Phase 1 test**: Manually add caller's tool history to 5 delegation tasks. Compare delegate ops vs 5 without.
2. **Phase 2 test**: For 5 completed sessions, compare ctx.summarize() output vs what the agent put in finish(). Which gives the caller more useful information?
3. **Phase 3 test**: Run 5 code reviews with auto-framed QA questions vs 5 with current "review the commit" framing. Compare issue detection rate.
