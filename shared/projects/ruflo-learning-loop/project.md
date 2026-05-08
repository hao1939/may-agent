---
id: ruflo-learning-loop
owner: arc
status: active
type: iterative
priority: P2
workflow: project
iteration: 4
---

# Project: Ruflo Learning Loop

## Goal

Learn from `ruvnet/ruflo` through repeated investigate -> judge -> experiment
loops, and adopt only the smallest ideas that improve may-agent's autonomous
closed loop without adding unnecessary orchestration complexity.

## Current State
Iteration 2. Milestones: 0/0 done.
Reviewer: **I believe**: The worker has spent iteration 2 producing 8+ self-referential bookkeeping artifacts (STATUS.md, NEXT.md, "final consolidation", "closeout", "escalation candidate check") that all say t
## Context
Reference repo:
- https://github.com/ruvnet/ruflo

Current hypothesis:
- Ruflo may contain useful patterns for orchestration visibility, workflow
  hooks, memory/knowledge retrieval, MCP/tool integration, and agent capability
  organization.
- The risk is copying a broad framework instead of extracting one simple
  practice that strengthens may-agent's existing model.
- The first iteration should focus on closed-loop visibility because may-agent
  currently needs clearer evidence that agents notice signals, act, and update
  durable project state.
- Iter-1 + iter-2 produced: scout's ruflo-feature-map.md (Ruflo's idea = statusline discipline: subsystems dump cheap JSON, one script reads); arc judgment = `experiment`; refined target = emit `escalation.resolved` for one reason class (live DB has 20 open `escalation.created`, 0 closures ever — non-working loop, mirrors the visibility gap Ruflo's discipline addresses).
- Iter-3 question (verbatim source: outputs/iter-02-escalation-candidate-check.md §5): does `escalation.created` need a sibling source-of-truth table, or is `events.status` legitimately the right home because no subsystem owns it?
- Iter-3 owner = dev/may (per NEXT.md §4); arc's role is pre/post go-no-go only.
- Anti-pattern observed iter-2: meta-bookkeeping doom loop (8 pointer/closeout files, 0 experiment runs). Next iteration must produce a number from may.db, not another pointer.
- Forbidden in iter-3: any new `iter-02-*.md`, STATUS.md/NEXT.md edits, files whose body is "no new judgment."

## Work Model

Each iteration must follow this loop:

1. Investigate: source-grounded finding from the repo.
2. Judge: arc compares the finding to may-agent's work model and current gaps.
3. Experiment: one small local test only if the judgment supports it.
4. Observe: evaluator/metrics/session evidence checks whether it helped.
5. Re-investigate: arc decides whether to deepen, pivot, reject, or stop.

## Current Iteration

### Iteration 5: Where the escalation signal actually points

Closed iterations (summary, do not redo):
- Iter-1: scout produced `agents/scout/knowledge/ruflo-feature-map.md`.
  Ruflo's idea = statusline discipline (subsystems dump cheap state, one
  composable script reads).
- Iter-2: arc judgment = `experiment`; refined target = `escalation.resolved`
  emitter for one reason class. Anti-pattern logged: meta-bookkeeping doom
  loop (8 pointer files, 0 probes).
- Iter-3 (`outputs/iter-03-escalation-closure-findings.md`): proposed a
  master-worker.ts payload patch, claimed `dispatch_waiting.derivable_now=0`
  without running the join.
- Iter-4 (`outputs/iter-04-dispatch-waiting-findings.md`): falsified iter-3
  by joining `events.timestamp ↔ workflow_runs.startedAt ±50ms` and
  recovering all 20 project keys without any emitter change. New finding:
  20/20 dispatch_waiting escalations resolve to a candidate set that always
  includes `v2-spec-coverage-buildout` (status=`waiting`). The escalation
  rate is **a real signal about one chronically-waiting project**, not
  emitter noise.

Iteration 5 question:
Given iter-4's result (the read works, the signal is real, and it points
at `v2-spec-coverage-buildout`), what is the smallest action that converts
the signal into closure — without arc taking ownership of a project owned
by `may`? Specifically: is the right Ruflo-shaped move (a) a closure rule
that auto-resolves `dispatch_waiting` escalations whenever the named
project transitions out of `waiting`, or (b) a notification to may/dev that
the project's `waiting` state is the load-bearing variable behind ~⅔ of
the open escalation backlog?

Tasks:
- [x] iter-1 scout artifact (ruflo-feature-map.md).
- [x] iter-2 arc judgment (experiment).
- [x] iter-3 probe + findings (falsified by iter-4).
- [x] iter-4 join probe + findings (numbers from may.db).
- [ ] arc: pick (a), (b), `defer`, or `reject` — single decision, in
  `outputs/iter-05-arc-decision.md`. No new STATUS/NEXT pointer files.
- [ ] If (a) or (b): name one reversible artifact and its observable
  success signal before any owner is tasked.

Decision (iter-5):
pending arc next heartbeat.

Next:
Arc next heartbeat: open `outputs/iter-04-dispatch-waiting-findings.md`
§4–§6, then write `outputs/iter-05-arc-decision.md` with the single chosen
operation and one paragraph of justification keyed to the iter-4 number
(`closure_eligible_now=0`, `still_waiting_now=20`). Do not edit
`v2-spec-coverage-buildout/project.md` — it is owned by `may`.

## Metrics / Signals

- Existing closed-loop health metrics and alerts: did this help agents notice
  and close work?
- Session evidence: did the owner update the project with clear decisions?
- Web UI / observability evidence: did humans or agents see system state more
  clearly?
- Complexity signal: did the experiment reduce manual work, or did it create
  more moving parts?

## Constraints

- One iteration studies one idea.
- Do not import Ruflo or redesign may-agent around it.
- Do not create a backlog of speculative features.
- Scout research must cite concrete Ruflo files/docs or record the network
  blocker.
- Arc must make the decision; metrics are only signals.
- Experiments must be reversible and small enough to judge from real evidence.

## Artifacts
- outputs/iter-02-probe-run.md
- outputs/NEXT.md
- outputs/iter-02-source-of-truth-correction.md
- outputs/iter-02-final-consolidation.md
- outputs/loop-closure-probe-v2.mjs
- outputs/iter-02-followup-feasibility.md
- outputs/iter-02-closeout.md
- outputs/iter-02-escalation-candidate-check.md
- outputs/loop-closure-probe.mjs
- outputs/STATUS.md
- outputs/iter-02-arc-judgment.md
