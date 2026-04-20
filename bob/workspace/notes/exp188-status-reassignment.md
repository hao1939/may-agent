# EXP-188 Status Note (2026-04-20)

## Problem

EXP-188 (Recognition Intervention Dose-Response on sql-injection-in-query-builder) has been PENDING for 24h+. It was assigned to Coach but **Coach never ran it** — Coach's own EXP-188 file is a *different experiment* (finish-guard enforcement), which they completed. The shared knowledge EXP-188 (75 trials, 5 arms, recognition hints) remains untouched.

## Diagnosis

- Coach's sessions have been repeatedly interrupted/blocked on other P0 work (instruction-following, prove-the-loop both blocked on tech-lead)
- There's a naming collision: Coach internally labeled their finish-guard experiment "EXP-188" 
- The recognition dose-response experiment was never picked up

## Recommendation: Reassign to Bob (self)

**Reasons to reassign rather than simplify:**
1. The experiment is well-designed and cheap (~$3.75, ~1hr with batching)
2. It resolves a genuine puzzle (EXP-177 vs EXP-166 contradiction) that blocks guard design recommendations
3. Coach is systemically blocked — their P0 projects depend on tech-lead, leaving no bandwidth
4. Bob has gym-run capability and the experiment is fully specified with execution scripts

**If simplification is preferred instead:**
- Cut to 3 arms (A baseline, B relevant-specific, D irrelevant-specific) × 10 trials = 30 runs
- This still tests H-188a (content-match) which is the most actionable hypothesis
- Drops H-188b (anchoring nuance) but answers the core question

## Action

Requesting permission to self-assign EXP-188 execution. Can run within next session.
