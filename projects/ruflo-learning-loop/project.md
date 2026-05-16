---
id: ruflo-learning-loop
owner: arc
status: paused
type: iterative
priority: P2
workflow: ruflo-learning-loop-iteration
iteration: 12
stop_reason: Iteration 12 converged on one durable rule and there is no current falsifier or new Ruflo idea worth another autonomous cycle.
resume_condition: A periodic-snapshot event type enters the top-15 event volume within 30 days, or Arc chooses a new concrete Ruflo idea for another investigate-judge-experiment loop.
---

# Project: Ruflo Learning Loop

## Goal

Learn from `ruvnet/ruflo` through repeated investigate -> judge -> experiment
loops, and adopt only the smallest ideas that improve may-agent's autonomous
closed loop without adding unnecessary orchestration complexity.

## Current State
Paused after iteration 12. The Ruflo loop extracted one durable rule: new event types should encode transitions, while periodic state belongs in subsystem-owned files or tables. The loop is not currently running because the iter-12 falsifier has not tripped. Resume when a new periodic-snapshot event type enters the top-15 event volume within 30 days, or Arc chooses a new concrete Ruflo idea for another investigate -> judge -> experiment loop.
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

## Plan

Keep this project paused until the iter-12 falsifier trips or Arc chooses a
new concrete Ruflo idea. When it resumes, run exactly one investigate -> judge
-> experiment loop and record the evidence before deciding whether to continue.

## Current Iteration

### Iteration 6: Watch the falsifier window

Closed iterations (summary, do not redo):
- Iter-1: scout produced `agents/scout/knowledge/ruflo-feature-map.md`.
  Ruflo's idea = statusline discipline (subsystems dump cheap state, one
  composable script reads).
- Iter-2: arc judgment = `experiment`; refined target = `escalation.resolved`
  emitter for one reason class. Anti-pattern logged: meta-bookkeeping doom
  loop (8 pointer files, 0 probes).
- Iter-3 (`outputs/iter-03-escalation-closure-findings.md`): proposed a
  master-worker.ts payload patch, claimed `dispatch_waiting.derivable_now=0`
  without running the join. Falsified by iter-4.
- Iter-4 (`outputs/iter-04-dispatch-waiting-findings.md`): joined
  `events.timestamp ↔ workflow_runs.startedAt ±50ms` and recovered all 20
  project keys; new finding `closure_eligible_now=0/20` because every
  candidate-set contains chronically-`waiting` `v2-spec-coverage-buildout`.
- Iter-5 (`outputs/iter-05-arc-decision.md`): arc chose option (b) —
  notification, not auto-closure. Produced
  `agents/arc/workspace/proposals/2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md`
  + work-queue line. No edits to may-owned project.

Iteration 6 question:
The iter-5 falsifier is registered: *if `v2-spec-coverage-buildout`
exits `waiting` and the `dispatch_waiting` count does not drop by ≥15
within 24h, iter-4's central claim was snapshot-specific.* Iter-6 only
runs if the project transitions; otherwise the right move is `wait`,
not new prose. Heartbeat check each cycle: has the project moved? If
not, **do not produce a new artifact** — log a one-line "still waiting"
in this section and stop.

Tasks:
- [x] iter-1 scout artifact (ruflo-feature-map.md).
- [x] iter-2 arc judgment (experiment).
- [x] iter-3 probe + findings (falsified by iter-4).
- [x] iter-4 join probe + findings (numbers from may.db).
- [x] iter-5 arc decision (option b, notification proposal lodged).
- [ ] iter-6 watch: re-check `v2-spec-coverage-buildout.status` and the
  `dispatch_waiting` escalation count each heartbeat. If status changed,
  re-run iter-4's probe and write **one** findings file. If unchanged,
  no new artifact — append a dated line below.

Iter-6 watch log:
- 2026-05-08: v2-spec-coverage-buildout.status=`waiting`; dispatch_waiting count=23 (in [15,30]). No change. Falsifier window still open. No new artifact.
- 2026-05-08 23:42Z: v2-spec-coverage-buildout.status=`waiting` (updated_at unchanged at 1778217121841); dispatch_waiting count=26 (in [15,30]). No change. Falsifier window still open. No new artifact.
- 2026-05-09 (iter-7 hb): v2-spec-coverage-buildout.status=`waiting` (updated_at unchanged at 1778217121841); dispatch_waiting count=28 (in [15,30]). No change. Falsifier window still open. No new artifact.
- 2026-05-09 01:13Z (iter-8): **falsifier retracted.** Nearest-neighbor join attributes 0/28 of the open `not dispatchable` escalations to `v2-spec-coverage-buildout`; actual top owners are `evaluator-low-quality-rate-calibration` (10) and `daily-alert-review` (2), with 15 unattributable. Iter-4's ±50 ms window is fan-out-ambiguous (10 events match 3 projects each — burst dispatch). Iter-5's "watch v2-spec" framing was wrong owner. See `outputs/iter-08-attribution-correction-findings.md`. Watch log stops; iter-9 question = persistence gap between in-memory zombie-loop verdict (`master-worker.ts:1046`) and on-disk `project.md` status.
- 2026-05-09 01:40Z (iter-9): **iter-8's persistence-gap hypothesis also falsified** by reading `master-worker.ts:1080–1102`: the wrap-up block *does* persist `waiting`, and live `projects.v2-spec-coverage-buildout.status='waiting'` confirms it. The real root cause is **already documented as KE-902** (validateDispatch ignores 24h cooldown when there are unread comments; v2-spec is re-dispatched every ~30min while `waiting`, fails dispatch-validator line 73, emits the escalation). FK-verified: 13 of the 28 are v2-spec; 15 are `projectId=null`; iter-8's 10 attributed to evaluator-low-quality-rate-calibration are actually that project's own `Stuck: 5 iterations` escalations bursting within 50ms. Watch loop **closed**; thread converges into KE-902. See `outputs/iter-09-converge-with-ke902-stop.md`.
- 2026-05-09 (iter-10): cold-pick of next Ruflo idea — `outputs/iter-10-next-ruflo-idea-pick.md` chose pattern #3 (subsystems own state files; events are transitions). Falsifiable claim: ≥1 of top-7 plumbing event_types is a periodic snapshot.
- 2026-05-09 (iter-11): claim confirmed by exactly one candidate — `context.read` (155/24h, 1 production reader using presence only). All other 6 are transitions. See `outputs/iter-11-subsystem-state-file-candidate-findings.md`.
- 2026-05-09 (iter-12): arc decision = **defer migration, adopt the discipline**. Numbers replicate (156/24h). Migration is small but value is small; the durable take-away is the rule "new event_types must encode a transition; periodic state belongs in a subsystem-owned file/table." Falsifier: if any new periodic-snapshot event_type lands in top-15 within 30 days, re-open as `go`. See `outputs/iter-12-arc-decision.md`.

**Project status: paused after iter-12.** Loop has converged: one durable rule extracted, KE-902 thread closed. Resume trigger = iter-12 falsifier trips, OR a new Ruflo idea worth a fresh hunt. Avoids iter-2 anti-pattern (meta-bookkeeping doom loop).

Decision (iter-5):
**(b) — notification.** See `outputs/iter-05-arc-decision.md`.

Next:
Heartbeat: query `projects.v2-spec-coverage-buildout.status` and
`COUNT(*) FROM events WHERE event_type='escalation.created' AND data
LIKE '%not dispatchable%'`. If status = `waiting` and count is in
[15, 30], do **nothing** but append a one-line dated note. Resist the
urge to re-justify the iter-5 decision.

## Validation

The project is useful only when it produces a small adopted rule, reversible
experiment, or falsified hypothesis backed by live evidence. New prose without
a number, source citation, or decision does not count as progress.

## Signals

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

## Journal

- 2026-05-09: Iter-12 paused the project after converging on the transition
  event vs subsystem-owned state rule. Resume only on the stated falsifier or a
  new concrete Ruflo idea.

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
