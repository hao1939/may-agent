# Experiment Status Tracker

**Last updated**: 2025-05-06 (bob heartbeat — tracker sync, EXP-860 measurement written)

## Active Experiments

### EXP-580: SOUL.md Placement — Verify-After-Write
- **Status**: KILLED (2029-09-03 — contradicts key finding: SOUL.md text ≠ judgment fix, 0/18 success rate)
- **Hypothesis**: Moving VAW nudge to SOUL.md will increase compliance from ~5% to ≥30%
- **Outcome**: Killed before measurement. Our strongest evidence (KE) shows SOUL.md text interventions never change behavior. Continuing would waste gym trials.
- **Details**: `.state/experiments/EXP-580-soul-placement-vaw.md`

### EXP-700: Parallel Independent Tool Calls
- **Status**: KILLED (2026-06-01 — stalled >3 months, scenario mismatch unresolved)
- **Hypothesis**: Batching independent tool calls reduces tool-call blocks per session by ≥15%
- **Outcome**: Promising signal (21% faster) but confounded by scenario mismatch. Killed per staleness policy.
- **Details**: `EXP-700-phase0-results.md`

### EXP-800: Threshold Rescue — Concrete Rules for Verify-After-Edit
- **Status**: CLOSED (2029-08-04 — MEASUREMENT INVALID, agents use bash not edit())
- **Details**: `agents/coach/workspace/EXP-800-results.md`

### EXP-850: Context-Window Efficiency — Summarize-Before-Reread
- **Status**: CLOSED — NEGATIVE (2026-05-05)
- **Hypothesis**: Summarize-before-reread skill reduces redundant file reads by ≥30% without reducing correctness
- **Outcome**: Text-based efficiency nudges (vague and concrete) showed no duration reduction vs baseline on multi-file-refactor. Both arms slightly slower (+9.5%, +4.8%) within noise. Task too simple to differentiate.
- **Key Finding**: Agents are already near-optimal on simple tasks; text instructions don't improve efficiency.
- **Details**: `agents/coach/workspace/EXP-850-arm-b-c-results.md`

### EXP-745: Few-Shot Pattern Coverage Expansion
- **Status**: PHASE 2 COMPLETE (2029-07-03) — ⚠️ VELOCITY CHECK: 2+ heartbeats in same state
- **Hypothesis**: Broadening trigger patterns to match implementation/refactoring tasks achieves ≥25% match rate
- **Outcome**: Match rate 45% → 80% (+35pp). Two new examples: incremental-implementation, safe-refactoring.
- **Next**: Phase 3 gym validation or production monitoring
- **Velocity decision (2029-09-04)**: BLOCKED(infra) — gym runner issues prevent Phase 3 trials. Paused, not killed. Resume when gym infra fixed.
- **Details**: `agents/coach/workspace/EXP-745-phase2-results.md`

### EXP-870: Structural Enforcement of Read-After-Edit
- **Status**: PARTIALLY DEPLOYED (2025-06-05 — Option B already exists as `verify-after-write.ts`)
- **Hypothesis**: Structural/environmental enforcement of read-after-edit achieves ≥80% compliance vs <50% with text-only rules
- **Discovery (2025-06-05)**: Option B (finish-block) was ALREADY IMPLEMENTED in `agents/shared/guards/verify-after-write.ts` before this experiment was designed. The guard blocks finish(success) if any edit/write lacks a subsequent read().
- **Remaining**: Option C (auto-inject read into edit response) is the only novel proposal — would eliminate agent overhead entirely.
- **Next**: Measure verify-after-write guard fire rate and retry cost. If significant, pursue Option C with infra team.
- **Details**: `agents/bob/workspace/EXP-870-discovery-already-implemented.md`, `agents/bob/workspace/EXP-870-option-c-implementation-rfc.md`

## Closed Experiments

| ID | Name | Outcome | Skill Promoted? | Key Finding |
|----|------|---------|-----------------|-------------|
| EXP-276 | Phantom Completion (prove-it-gate) | **CLOSED — DEPLOYED_UNVERIFIABLE** | Skill deployed to optimizer | Intervention structurally sound; no post-deployment evals exist to measure |
| EXP-600 | Bash waste reduction (diagnose-before-retry) | **CLOSED — NEGATIVE** | Skill deployed to tech-lead but no measured impact | 23.3% baseline waste → intervention did not achieve ≥25% reduction target |
| EXP-350 | Phantom nudge resistance | **COMPLETE — POSITIVE** | `verify-notification-targets` skill validated | Baseline 34/100 → Treatment 80/100 (+46pp). Skill works. |
| EXP-188 | Recognition Intervention Dose-Response | **COMPLETE** | See results file | Coach ran extensive trials; see `EXP-188-results.md` |
| EXP-248 | Belief Externalization | **COMPLETE** | See folder | See `EXP-248/` |
| EXP-860 | Zombie Task Circuit Breaker | **COMPLETE — DEPLOYED_POSITIVE** | Infrastructure guard (heartbeat-data.ts) | 3-layer dedup guard prevents zombie dispatch loops. Post-deployment measurement: structural validation confirmed 2025-05-06. |
| EXP-850 | Context-Window Efficiency (Summarize-Before-Reread) | **CLOSED — NEGATIVE** | None | Text efficiency nudges showed no improvement; agents already near-optimal on simple tasks. |

## Observations from Audit (2025-05-03)

### Pattern: Experiment Stall & Abandonment
- EXP-700 has been in "Phase 0" with only 2 trials for an extended period
- EXP-600 was listed as "awaiting measurement" in the tracker but the actual file says CLOSED — NEGATIVE
- **Gap**: Tracker was last updated 2025-01-16 — 4 months stale. Experiment statuses diverged from tracker.

### Pattern: Zombie Experiment Dispatch
- EXP-188 was dispatched 15+ times by coach (visible in system_status) before completing
- This mirrors the broader zombie-task pattern (see `ANALYSIS-zombie-task-repetition-2025-05-03.md`)

### Recommendation
1. **Kill or redesign EXP-700** — stalled experiments waste cognitive overhead each heartbeat
2. **Add "staleness check" to experiment protocol** — if no progress in 3 heartbeats, auto-flag for review
3. **Sync tracker with source-of-truth files** — results files should be canonical, tracker should aggregate

## Priority Queue (Next Experiments)

1. **EXP-900: DAF Retrofit** (BLOCKED 2025-09-03): Evaluation DB (`agents/may.db`) is empty — no tables, no data. Cannot run 2D masking analysis without evaluation records. Blocked until evaluator actually persists data. Details: `agents/bob/workspace/EXP-900-daf-retrofit-design.md`, `agents/bob/workspace/EXP-900-phase0-schema-assessment.md`
2. **EXP-950: Retry-Budget Guard** (CLOSED ✅ 2025-09-07): M4 monitoring complete. Zero zombie loops in production. Closeout: `agents/bob/workspace/EXP-950-closeout.md`
3. **New: Context-window efficiency**: Agents re-read files they already processed. Could a "read-cache" skill help?

## How to Use This Tracker

- **Before starting an experiment**: Check here for conflicts and dependencies
- **After completing a phase**: Update status, results summary, and next action
- **Every 3 heartbeats**: Audit for stale entries (>3 heartbeats without progress = flag for review)
