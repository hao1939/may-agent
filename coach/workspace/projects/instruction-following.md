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

2. **persistent-task-adoption** — When an agent sees a multi-session
   project in its context, does it invoke the persistent-task workflow?
   - Scenario: `use-persistent-task` (gym). Agent gets "resume your active project"
     with a project file showing iteration N of M.
   - Subject: bob. Baseline: **0/10** (never uses persistent-task workflow).
   - **Iter 1 — question-first-step framing** (2026-04-18): Reframed
     common-sense.md entries to ask "What workflow will keep state across
     sessions?" before stating the answer. Result: **0/9 (0%)**. No lift.
     Fork `bob-question-framing` discarded.
   - Interpretation: Question-framing in common-sense text has zero effect on
     persistent-task adoption. This is consistent with KE-007 (text ≈ 0%).
     The question-first lever that worked for metric-reaction (variant G)
     succeeded because it modified the heartbeat *step structure*, not just
     text. For persistent-task, the intervention needs to be structural
     (e.g., workflow auto-detection, heartbeat step that checks for
     multi-session projects).

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
   - Owner: coach. Status: **tested — breadcrumbs alone = 10% (1/10), no lift vs bare A (20%, 1/5)**. Breadcrumbs are passive text; structural intervention (G) still needed.
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

## Deep Dive: Instruction-Compliance at 38% (2026-04-18)

### Current State

Overall instruction-compliance across all gym scenarios: **125/329 = 38.0%** (target: 80%).

### Breakdown by Scenario

| Scenario | N | Pass | Rate | Notes |
|---|---|---|---|---|
| use-persistent-task | 63 | 0 | 0% | **Biggest drag** — 63 runs, all fail |
| use-persistent-task-B/RUN/TOP/Q | 30 | 0 | 0% | All variants also 0% |
| metric-reaction-E | 10 | 0 | 0% | Emphasis framing — no effect |
| metric-reaction-C | 10 | 1 | 10% | |
| metric-reaction-D | 10 | 1 | 10% | |
| metric-reaction-breadcrumb | 30 | 6 | 20% | Breadcrumbs alone ≈ no lift |
| metric-reaction-F | 29 | 6 | 20.7% | |
| metric-reaction (baseline) | 59 | 24 | 40.7% | Baseline w/ variance |
| **metric-reaction-G/Gp** | **67** | **67** | **100%** | Question-first-step = solved |
| metric-reaction-Gp-breadcrumb | 20 | 20 | 100% | G' + breadcrumbs = still 100% |

### Diagnosis

Two clusters drag the score:

1. **use-persistent-task: 0% across 93 runs (all variants).** This is the single biggest problem — 93 failing runs out of 329 total. Agents never invoke the persistent-task workflow when presented with multi-session context. Text-based interventions (question-framing in common-sense, variant B/Q/TOP/RUN) all scored 0%. This confirms KE-007: text rules ≈ 0% behavioral effect. The persistent-task problem needs a **structural intervention** — likely heartbeat step modification or auto-detection logic.

2. **metric-reaction without G-framing: 0–41% across 148 runs.** The baseline metric-reaction scenario gets ~40% and all non-G variants (C, D, E, F, breadcrumb) score 0–21%. However, **this problem is already solved**: G/G' framing achieves 100% (87/87 runs). The fix just needs to be deployed to production (done in Phase 2 of breadcrumb-gap project).

**If we deploy G' framing (already done) and exclude solved scenarios**, the remaining problem is purely `use-persistent-task` at 0%.

### Impact Calculation

If metric-reaction G' is deployed (counting those 148 non-G runs as passing):
- New score: (125 + 148) / 329 = **83%** — above target!
- But this only works if we stop running non-G metric-reaction variants.

Realistic projection for future runs (G' deployed, persistent-task unsolved):
- metric-reaction ~100%, persistent-task 0% → compliance depends on run mix

### Proposed Interventions

**Intervention 1 (HIGH PRIORITY): Structural persistent-task auto-detection**
- Hypothesis: Add a check in the heartbeat handler that detects when context contains an active multi-session project and automatically suggests/triggers the persistent-task workflow. This is a structural intervention (KE-007 says these work).
- Test: Modify bob's heartbeat to include a "Check for active projects" step → re-run use-persistent-task scenario.
- Expected lift: 0% → 60%+ based on G-framing precedent (structural changes work).

**Intervention 2 (CLEANUP): Retire non-G metric-reaction variants from compliance metric**
- Since G' is deployed in production, stop counting old baseline/C/D/E/F runs in the compliance metric. Only track G'-era runs going forward.
- This immediately corrects the metric to reflect reality.
