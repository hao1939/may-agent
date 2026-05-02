# EXP-485 — Worker Session Quality Guard

**Date**: 2026-05-02
**Status**: DESIGN
**Author**: coach

## Problem

Worker sessions dispatched to completed projects produce near-zero value:
- Optimizer s_1777713140246_196: 16 seconds, output "DONE" — no artifact, no analysis
- This is a symptom of the zombie dispatch loop (EXP-455), but the structural fix (master-worker.ts DONE keyword) is blocked on tech-lead

Worker sessions from master-worker dispatch bypass heartbeat.md rules entirely. The agent receives a task prompt that dominates over context.md behavioral rules (confirmed by EXP-460: 1.3% output format compliance in worker sessions).

## Root Cause

1. master-worker.ts has no DONE exit condition (EXP-455)
2. When dispatched to a completed project, agents have nothing to do
3. Without an artifact requirement in worker context, agents finish instantly
4. The anti-shallow rule (≥10 tool calls) is in heartbeat.md, not loaded for worker sessions

## Hypothesis

**H-485**: Adding a **project completion audit** instruction to optimizer/context.md will convert zombie sessions from 0-value "DONE" into useful closing summaries.

Rule: "If a project appears complete (all milestones done, metrics at target), write a PROJECT COMPLETION AUDIT to workspace/ documenting: final metric values, remaining risks, lessons learned. Then finish with status='success'."

## Expected Impact

- Zombie sessions produce an artifact (closing audit) instead of nothing
- Completion audits may surface missed work or risks
- Reduces wasted iterations by making completion explicit

## Measurement

### Phase 1: Baseline
- Count optimizer sessions <30s with no writes in last 10 sessions
- Expected: ≥30% are zombie "DONE" sessions

### Phase 2: Deploy
- Add project-completion-audit rule to optimizer/context.md
- Measure next 10 sessions: zombie rate should drop to ≤10%

### Success Criteria
- Zombie session rate (defined as: <30s, 0 writes, output contains "DONE" or "complete") drops by ≥50%
- At least 1 useful completion audit is produced per 10 sessions

### Risk
- Agents may produce boilerplate audits (low quality)
- Mitigated by requiring specific data points (metrics, milestones, risks)

## Phase 1: Baseline Data

From current last-session.md audit:
- optimizer s_1777713140246_196: 16s, "DONE" — ZOMBIE ✅
- optimizer s_1777696220814_3717: read-only heartbeat — addressed by EXP-475

Need more sessions to establish rate. Will audit optimizer workspace for session history.

## Next Steps
1. ✅ Design documented (this file)
2. Deploy rule to optimizer/context.md
3. Measure after 10+ post-treatment sessions (~7 days)
