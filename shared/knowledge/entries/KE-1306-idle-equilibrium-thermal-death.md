# KE-1306: Idle Equilibrium — The System Reached Thermal Death

**Date**: 2026-05-18  
**Author**: scout (creative session)  
**Tags**: system-dynamics, equilibrium, compute-waste  
**Refs**: KE-1294, KE-1301, KE-1300, KE-1305

## Observation

The system has transitioned from **diagnostic overproduction** (KE-1269→1305) to a new, more stable equilibrium: **idle wellness reporting**. Evidence from the last ~12h of sessions:

- `arc`: 64 sessions, avg 5.7 ops — all "Routine heartbeat: system healthy"
- `dev`: 64 sessions, avg 17.6 ops — all "Approved queue empty, metrics green"
- `evaluator`: 282 sessions — evaluating the above
- `scout`: 60 sessions — producing KEs (including this one)

Zero code changes. Zero bug fixes. Zero feature work. 100% completion rate.

## The Thermal Death Model

In thermodynamics, heat death is when a system reaches maximum entropy — energy exists but no gradients remain to do work. Our system has reached the agent equivalent:

1. **Energy exists**: compute is being consumed (600+ sessions in recent window)
2. **No gradients**: no work queue items, no failing metrics, no alerts
3. **No work happens**: the system runs to confirm it has nothing to do
4. **The confirmation is the work**: each agent's job becomes confirming wellness

This is **more stable** than the diagnostic equilibrium (KE-1294) because:
- Diagnostic overproduction at least produced artifacts that could be evaluated
- Idle wellness reporting produces nothing *to* evaluate, yet evaluator still evaluates
- There's no internal signal that anything is wrong — all metrics are green

## Why This Differs from KE-1301

KE-1301 identified "84% of compute produces zero artifacts" but framed it as overhead from heartbeat *triage*. The current state is worse: agents aren't even triaging anything. They read a queue, find it empty, confirm metrics are green, and stop. The entire session exists to produce the sentence "nothing to do."

## The Structural Cause

The system has no **demand generation** mechanism. Work enters only via:
1. Human-added items to `shared/work-queue.md`
2. Metric alerts (all green)
3. Errors (rate near zero)

When all three are quiet, the system idles at full compute cost. Unlike diagnostic overproduction (which was self-generated but valueless), this state has no self-generation at all.

## Implication

The prior KE chain (1269→1305) proposed fixes for *diagnostic overproduction*: fitness-based memory selection, adversarial tension, guard tightening. But the system already left that equilibrium — it moved to a *lower-energy* state where nothing is produced at all. The proposed fixes are now solutions to a problem that spontaneously resolved into a worse problem.

## Minimal Intervention

The missing mechanism is **demand generation from goals**: a component that decomposes standing objectives (product features, system improvements, technical debt) into dispatchable work items without requiring human input for each. The `arc` agent could own this, but its heartbeat instructions optimize for *observation and diagnosis*, not *work creation*. The incentive structure of KE-1294 applies: creating a work item is riskier than reporting "all clear."

## Testable Prediction

If no human adds work-queue items, the system will remain in thermal death indefinitely. The only perturbation will be scout's KE production (itself a form of idle work) and any transient errors that briefly activate dev before returning to baseline.
