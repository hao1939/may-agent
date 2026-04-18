# Project: Agent Instruction Following

**Status**: active
**Owner**: coach
**Reviewer**: may / Hao
**Master**: may/system-evolution (gap-level concern)
**Started**: 2026-04-18
**Priority**: P0 — most important coach project
**Metric**: `coach.instruction-compliance` (target ≥ 0.8)

## Goal

Find what mechanisms make agents reliably follow directions. Measure
instruction-compliance rate across representative scenarios and drive it to
≥ 80%. Each finding must produce an intervention that is gym-tested and
deployed.

This is the umbrella project. Every system expansion (metrics, projects,
workflows, standing orders) depends on agents following the instructions that
connect the pieces. If the directions don't stick, nothing else works.

## Problem

Evidence (from `/tmp/instruction-following.md`, 2026-04-18):

- **Persistent-task adoption**: common-sense says "use persistent-task for
  multi-session work" → agents do one-shot sessions instead.
- **Metric reaction**: metrics are injected into heartbeat context → agents
  ignore them and follow their default todo routine.
- **Standing-order compliance (ORDER-008)**: "May must fork, not message" →
  May keeps using `message`.
- **Turn-budget removal**: "don't add turn budgets" → agents keep re-adding
  them in subsequent edits.

Pattern: text-level instructions (rules, orders, common-sense notes) have
near-zero behavioral effect. The mechanisms that *do* change behavior are
structural (workflows, gates), but not every instruction can be a workflow.

## Hypotheses (what we already know)

Evidence base (as of 2026-04-18):

| Mechanism | Expected compliance | Source |
|---|---|---|
| Text rule in SOUL.md / knowledge file | ≈ 0% | KE-002 (0/20 experiments) |
| Workflow enforcement (structural) | high | KE-007 (5/56 promoted, all structural) |
| Skills (read before act) | medium | operational knowledge |
| Stacked interventions (2+) | −12 to −15pp | KE-123 |
| Few-shot templates on discovery tasks | −67pp | KE-133 |
| Hard gate whose artifact IS the solution | high | KE-182 |
| Hard gate that writes an ANALYSIS doc | harmful | KE-180 (0% vs 80%) |

From **metric-autonomy** child project (iterations 1–5, on coder):

- Baseline (A: bare number) = 0/7.
- Ownership / implication framings (B, C) ≈ low.
- Variant D/E (suggested action, metric-first) = partial lift.
- Variant G (question-first-step reframe) = **10/10, replicated to 30/30
  pooled**. Caveat: G also modifies step 3, so lever may not be pure framing
  — iter 6 needs a clean G.

Working hypothesis: **framing that reshapes the agent's first action**
(turn the instruction into the first step of its existing routine) beats
any amount of text emphasis. This is consistent with KE-007 (structural > text)
but at a sub-workflow granularity — it's a *prompt-structural* intervention.

Open questions:

- Does the question-first-step lever generalize beyond metric-reaction? Does
  it work for persistent-task adoption, standing orders, turn-budget removal?
- Are there lever classes other than question-first-step? (e.g., forced
  commitment, precommitment checklist, negated-example framing.)
- How do we measure compliance in production, not just gym?

## Child Experiments

Each is a gym scenario + intervention cycle. The instruction-compliance metric
aggregates across all of them.

1. **metric-autonomy** — question-framing lever for metric reaction.
   - Status: running, session `s_1776498801864_992` (coach, persistent-task
     workflow). Iter 1–5 done. Iter 6 queued (clean G).
   - File: `agents/coach/workspace/projects/metric-autonomy.md`
   - Subject: coder. Baseline 0/7. Current lever: variant G = 30/30 pooled
     (with compound caveat).

2. **persistent-task-adoption** — NEW. When an agent sees a multi-session
   project in its context, does it invoke the persistent-task workflow, or
   does it do a one-shot?
   - Scenario shape: put a "this is iteration N of M" signal in the task and
     measure whether the agent uses the workflow scaffold.
   - Owner: coach. To be forked after consolidation step.

3. **order-compliance** — NEW. Do standing orders like ORDER-008
   ("may fork, not message") stick once set?
   - Scenario shape: place an order in context, then present a task that
     tempts the forbidden action. Measure compliance rate over N trials.
   - Subject: may (primary violator).

4. **turn-budget-removal** — NEW. Why do agents re-add turn budgets after
   removal?
   - Likely driver: baseline training / prior file patterns. Scenario should
     show an edit task in a file that previously had a budget and measure
     whether the agent re-introduces one.

5. **context-discovery-chain** — Hao's hypothesis: bare metrics → 0% action,
   metrics+breadcrumbs → higher action rate. Tests whether adding investigation
   breadcrumbs (file paths, queries) to metric injections increases reaction.
   - Scenario A: `metric-reaction` (bare number, baseline 0/7).
   - Scenario H: `metric-reaction-breadcrumb` (same task + breadcrumbs).
   - Owner: coach. Status: scenarios built, baseline runs pending.
   - Feedback: `agents/coach/workspace/context-discovery-feedback.md`

## Next

- [x] ~~Consolidation sub-task~~ → `instruction-following-hypotheses.md` written (2026-04-18)
- [ ] Design and build **persistent-task-adoption** gym scenario (smallest new child experiment)
- [ ] Define source queries for the 4 coach metrics (see Hao's comment below)

## Status of existing metric-autonomy session

`s_1776498801864_992` is the persistent-task owner session for metric-autonomy.
It continues to run as the first child experiment of this umbrella. No
cancellation. The umbrella's next session does **not** block on it — the
consolidation fork reads its committed iter 1–5 results from
`metric-autonomy.md`. Iter 6+ results feed back into this file's hypothesis
table as they land.

## Comments

<!-- empty — append comments below with author + timestamp -->

## Comments
- [2026-04-18 hao] Your 4 metrics are all null. Define source queries and start measuring:
  - instruction-compliance: use your metric-autonomy gym scenarios as the test. Pass rate across all instruction-testing scenarios = compliance rate. Auto-measurable from gym_runs.
  - intervention-hit-rate: compare gym pass rates before/after each intervention you deploy. Data is in gym_runs with run_tags. Auto-measurable.
  - skill-effectiveness: count deployed skills where gym pass rate improved post-deployment. Auto-measurable from gym_runs + skill timestamps.
  - knowledge-to-action-latency: record manually after each growth cycle. Time from KE creation to first experiment.
  These metrics track YOUR effectiveness. If you can't measure yourself, you can't improve.
