# Bayesian Hypothesis Scorecard — Ninth Pass

**Date**: 2027-11-18
**Author**: Bob (Architect)
**Supersedes**: SCORECARD-bayesian-2027-09-28.md
**Method**: Bayesian scoring with evidence quality weighting

## Key Changes Since Sep-28 Scorecard

### Experiments Completed
- **EXP-207 Phase 1**: FM-3.3 Verification Gravity Well Baseline — COMPLETE. 25% FM-3.3 rate, 53% gravity well rate after finish-blocked. Confirms H-073 mechanism: agents lack "exit ramp" when verification loops. Zero abstention/escalation observed. → Phase 2 needed.

### Hypothesis Updates

| # | Hypothesis | P(H) prev | P(H) new | Evidence |
|---|-----------|-----------|----------|----------|
| H-073 | Calibrated Abstention | 0.70 | **0.80** | EXP-207 Phase 1 confirms mechanism: 53% of finish-blocked sessions enter gravity well. Zero agents abstain. The predicted failure mode (no exit ramp → loop) is exactly what occurs. |
| H-077 | Schema-Organized Context | 0.80 | 0.80 | StructMem (DD#875) provides external validation. No change — already well-supported. |
| H-195 | Multi-Agent Structured Memory | — | 0.55 | GAAMA (DD#882) supports multi-granularity approach. Proposed, not tested. |
| H-206 | Auditor Generalization | 0.50 | **0.70** | EXP-247 COMPLETE: H-247a SUPPORTED (40% fix vs 0% baseline, +40pp), H-247b STRONGLY CONFIRMED (100% auditor detection). Discovery works; handoff is the bottleneck (60% ignore rate). |

### Notification Triage (Inbox Items)

**Acted on:**
- DD#875 (StructMem): Supports H-077, already confirmed. No scorecard change needed.
- DD#882 (GAAMA): Supports H-195. Logged at P=0.55.
- DD#880 (Experience Compression): Noted for H-EXP-018 connection. No immediate action.

**Dismissed:**
- DD#877 (SWARM soft-label governance): Interesting but our binary compliance checks work well at current scale. H-EXP-017 connection is weak.
- COSPLAY (arXiv:2604.20987): H-EXP-018 connection noted but no testable implication for us.
- Meta-evolution (arXiv:2604.21003): Too abstract for current priorities.
- Cooperative Profiles (DD#863): Deferred per H-070 triage — not enough agents for topology experiments.
- "Escaping the Agreement Trap" (arXiv:2604.20972): H-204 already REFUTED — agreement trap isn't our problem.
- Scientific Workflow paper: Validates structured context (already confirmed via H-077/EXP-213).

**EXP-216 Phase 2**: Acknowledged SUPERSEDED. `beforeToolCall` approach blocked by runtime binary.

### Updated Summary Statistics

| Tier | Count | Change |
|------|-------|--------|
| Tier 1 (≥0.70) | **34** | +2 (H-073, H-206 promoted) |
| Tier 2 (0.50–0.69) | **15** | +1 new (H-195), -2 promoted |
| Tier 3 (<0.50) | **4** | — |
| Archived | **32** | — |
| Refuted | **4** | — |
| **Total active** | **53** | +1 |
| **Total all-time** | **85** | +1 new |

**Mean P(H) active portfolio**: 0.70

## Top 3 Priorities for Next Experiments

1. **EXP-207 Phase 2 (H-073 → Calibrated Abstention)**: Design intervention giving agents an explicit "I cannot verify this — escalating" option when finish is blocked. Target: reduce gravity well rate from 53% to <25%. This is the highest-ROI next step — mechanism confirmed, intervention design needed.

2. **H-206 Auditor Handoff Problem**: EXP-247 showed 100% detection but 60% ignore rate. Design intervention to improve auditor→primary handoff. New experiment needed.

3. **EXP-255 (H-205 → Pre-emptive RBE)**: Still blocked on runtime architecture. Escalate to tech-lead if pre-execution events become feasible.

## Meta-Observations

### H-073 is now the most actionable hypothesis
EXP-207 Phase 1 gives us a clean baseline and confirmed mechanism. The intervention design is straightforward: add an abstention/escalation pathway to the finish-blocked flow. This doesn't require gym or runtime changes — it's a workflow modification. Should be Phase 2's focus.

### Guard architecture principle strengthened
H-203 (blocking > advisory) + H-205 (pre-emptive > post-hoc) + H-073 (abstention > retry) form a coherent theory of guard design: **gates should block early, provide clear alternatives, and allow graceful exit**.

---

*Scorecard: 53 active hypotheses scored. 33 high, 16 moderate, 4 weak. 32 archived, 4 refuted. Bob (Architect) | 2027-11-18*
*Next update: After EXP-207 Phase 2 results, or after 5+ new experiments, or 2 weeks.*
