# Harness Experiment Impact Summary

**Project**: agent-system-evolution  
**Date**: 2026-05-28  
**Iterations covered**: 0–8 (9 iterations total)  

---

## Experiment Inventory

| # | Experiment | Iter | Finding | Promoted To | Adoption Status |
|---|-----------|------|---------|-------------|-----------------|
| 1 | **Structural Receipt Contract** | 0 | Defined minimal receipt shape for successful sessions | Contract + Platform Request | ✅ Implemented (platform iter39); receipt coverage project closed |
| 2 | **Evaluator Score-Batch Calibration** | 0 | 90% of sessions get identical scores (compression) | Platform Request (rubric patches + weighted sub-dimensions) | ⏳ Stale — escalated to human owner |
| 3 | **Cross-Agent Delegation Audit** | 0 | 22% waste from context loss, duplicates, orphans | Convention (delegation-memo) | ❌ 0% adoption despite enforcement attempts |
| 4 | **Project-Reconcile Behavior** | 0 | <5 violations found; no convention needed | None (closed clean) | N/A |
| 5 | **Metric Auto-Handler Pattern** | 0 | PoC validated; 48h stability confirmed | Convention (`contracts/metric-auto-handler-convention.md`) | ✅ Active — cron handlers running |
| 6 | **Scout Knowledge Adoption** | 0 | Injected 3 findings as context facts; reference rate measured | Context facts | ⚠️ Partial — depends on agent reading context |
| 7 | **Receipt Quality v2 Audit** | 0 | No actionable gaps found after persistence; v2 unnecessary | None (closed clean) | N/A |
| 8 | **Finish-Contract Quality Enforcement** | 1 | 96% quality baseline; no enforcement needed | Rubric documented (`outputs/finish-contract-quality-rubric.md`) | ✅ 100% compliance measured at iter 6 |
| 9 | **Context-Window Waste Audit** | 2 | Only 5.8% waste; below threshold for convention | None (closed clean) | N/A |
| 10 | **Agent Error-Recovery Patterns** | 2 | 50% failures are infra kills; pivot strategy 100% success | Recovery guide + graceful-degradation contract | ⏳ Contract published; platform hook stale |
| 11 | **Graceful-Degradation Contract** | 3 | Defined checkpoint-before-heavy-op and pre-kill hook | Contract + Platform Request | ❌ 0% adoption — requires platform pre-kill hook |
| 12 | **Evaluator Score-Compression Experiment** | 3 | Root causes: binary rubric, no partial credit, missing dimensions | Platform Request | ⏳ Stale — escalated to human owner |
| 13 | **Multi-Session Task Continuity** | 3 | 62% context loss across sessions; checkpoint convention drafted | Contract (`contracts/task-continuity-contract.md`) | ❌ 0% checkpoint file creation observed |
| 14 | **Delegation-Memo Enforcement** | 4 | Injected convention into fork/call prompts | Convention (auto-injection) | ❌ Still 0% — dispatch path didn't carry fields |
| 15 | **Dispatch-Path Delegation Fix** | 7 | Implemented context_files/success_criteria injection at harness level | Harness code change | ✅ Validated — fields appearing in prompts |
| 16 | **Self-Correction Patterns** | 6–7 | "Cognitive pivot" in 80% of sessions, 100% success rate | Convention (`contracts/self-correction-convention.md`) | ✅ Active — codifies existing good behavior |
| 17 | **Evaluator Feedback-Loop Closure** | 8 | Measured feedback-to-behavior closure rate | Feedback-echo mechanism + convention | ⚠️ Draft — awaiting 5-session validation |
| 18 | **Agent Capability-Routing Experiment** | 8 | Minimal misrouting found; no convention needed | None (closed clean) | N/A |
| 19 | **Feedback-Loop Amplification** | 9 | Designed & implemented `last-eval.md` injection via cron | Convention (`contracts/feedback-echo-convention.md`) | ⚠️ Draft — validating |

---

## Top 3 Highest-Value Techniques

| Rank | Technique | Why |
|------|-----------|-----|
| 1 | **Structural Receipt Contract** | Only experiment to complete the full loop: harness → contract → platform implementation → validation project → close. Proved the project's operating model works. |
| 2 | **Finish-Contract Quality** | Already at 100% compliance with zero enforcement cost. Demonstrates that well-designed conventions self-reinforce when aligned with agent incentives (evaluator already penalizes empty evidence). |
| 3 | **Dispatch-Path Delegation Fix** | Solved the root cause of delegation-memo failure (fields weren't carried through master-worker). Harness-level fix without needing platform changes. Unblocks future delegation improvements. |

---

## Top 3 Techniques That Failed to Stick

| Rank | Technique | Why It Failed |
|------|-----------|---------------|
| 1 | **Delegation-Memo Convention** | 0% adoption across 4 measurement attempts. Root cause: the dispatch infrastructure didn't propagate structured fields. Even after fix, no measurable uptake yet. Convention may be over-specified for how agents actually delegate. |
| 2 | **Graceful-Degradation Contract** | 0% adoption. Requires a platform pre-kill hook that was never implemented. Pure convention without runtime support cannot work for infra-kill scenarios. |
| 3 | **Task-Continuity Checkpoints** | 0% adoption. Agents don't create checkpoint files because there's no enforcement mechanism and the convention adds work without immediate payoff. Needs auto-checkpoint in master-worker.ts (platform request stale). |

---

## Platform Request Status

| Request | Days Stale | Blocking |
|---------|-----------|----------|
| Rubric Calibration Patches | 10+ | Score differentiation |
| Score-Compression Fix | 8+ | Score variance |
| Graceful Shutdown Hook | 9+ | Partial-result recovery |
| Auto-Checkpoint (master-worker) | 7+ | Multi-session continuity |

All 4 have been escalated to human owner. None accepted.

---

## Project Posture Recommendation: **Shift to Maintenance**

### Rationale

1. **Diminishing returns**: The last 3 iterations produced primarily measurement/validation tasks rather than new techniques. Clean audits (context waste 5.8%, misrouting minimal, project-reconcile clean) show the system is already well-behaved in most dimensions.

2. **Blocked by platform**: The 3 failed-to-stick techniques all require platform implementation (pre-kill hook, auto-checkpoint, rubric changes). No amount of harness-level R&D can unblock them.

3. **Success criteria met**: The project proved its operating model (structural receipt went full-loop), established 5 active contracts, and identified the actual bottleneck (platform request acceptance velocity).

4. **Active value already captured**: Finish-contract quality (100%), metric auto-handlers (running), self-correction convention (codifies existing behavior), and dispatch-path fix (validated) deliver ongoing value without further iteration.

### Recommended Actions

- **Close aggressive-push**; shift to `maintenance` posture.
- Keep project open for: (a) validating feedback-echo convention once 5 sessions pass, (b) re-activating if platform accepts any of the 4 stale requests.
- Archive the R&D backlog; new experiments should only be created when a concrete new signal emerges or a platform request is accepted.
- Final escalation: if platform requests remain stale after 14 more days, recommend closing those request lines and documenting them as "blocked indefinitely."
