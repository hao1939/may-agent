# Experiment Backlog Audit — 2025-05-04

## Summary
30 experiments have design docs but no results.md. After review, **17 are actually complete/closed** (missing results files or status updated in design only), **8 are genuinely stale**, and **5 are ready to run**.

## Triage

### ❌ KILL — Already Complete/Closed (status says done, no results.md needed or should be written)
| EXP | Status | Action |
|-----|--------|--------|
| EXP-031 | COMPLETED (behavioral) | Write results.md from behavioral-results.md |
| EXP-119 | CANCELLED | No action needed |
| EXP-133 | COMPLETE (null result) | Write results.md summarizing null finding |
| EXP-134 | COMPLETED | Write results.md |
| EXP-135 | COMPLETED | Write results.md |
| EXP-136 | COMPLETED | Write results.md |
| EXP-137 | COMPLETED | Write results.md |
| EXP-152 | COMPLETE (inconclusive) | Write results.md |
| EXP-153 | COMPLETE (not supported) | Write results.md → KE-175 |
| EXP-170 | CONCLUDED (ceiling) | Write results.md |
| EXP-193 | PHASE-1-COMPLETE | Decide: run phase 2 or close |
| EXP-211 | CLOSED | No action |
| EXP-214 | CLOSED (superseded) | No action |
| EXP-222 | CLOSED (inconclusive) | Write results.md from phase3-results.md |
| EXP-242 | PHASE-2-COMPLETE (confirmed!) | Write results.md — **this is high-value confirmed result** |
| EXP-850 | CLOSED (negative) | No action |

**Key finding**: EXP-242 confirmed H-181 (44% fix rate vs 0% baseline, p=0.015) but has no results.md. This is a completed experiment with a significant positive result that needs writeup.

### 🟡 STALE — Designed but never run, questionable value
| EXP | Title | Recommendation |
|-----|-------|----------------|
| EXP-005 | Worked Examples Break Skill Self-Locking | OLD. Kill unless someone champions it |
| EXP-033 | Digest-Based Recovery | Awaiting deployment for years. Kill |
| EXP-035 | Diagnostic-Before-Fix | Needs scenario hardening. Deprioritize |
| EXP-075 | Classify-Then-Act for Bob | Bob's dispatch has changed. Reassess |
| EXP-191 | Evaluator Anonymization | "implementing" — check if abandoned |
| EXP-230 | Evidence Grading (dup of EXP-193?) | Likely duplicate. Kill |
| EXP-270 | Structured Taint Tokens | "Ready to run" but dated 2028. Stale |
| EXP-276 | Phantom Completion for Optimizer | Assess if problem still exists |

### 🟢 READY TO RUN — High value, designed, actionable
| EXP | Title | Why |
|-----|-------|-----|
| EXP-800 | Threshold Rescue for VAE | **Most consequential open question**: resolves KE-715 vs KE-655 contradiction |
| EXP-900 | Pre-Finish Externalization Gate | Builds on EXP-RECOGNITION (100% structural > 0% text). Ready for Phase 0 |
| EXP-267 | Finish-Guard Evidence Specificity | Addresses known weak spot in finish() quality |
| EXP-275 | Anti-Shallow Enforcement Efficacy | Tests our most-used rule |
| EXP-231 | Skill Contracts | Novel approach worth testing |
| EXP-192 | Self-Lesson Replay vs Curated Few-Shot | Important learning question |

## Recommended Actions (Priority Order)

1. **Write results.md for EXP-242** — Confirmed positive result (p=0.015) sitting without writeup
2. **Run EXP-800** — Resolves the biggest open theoretical question (threshold rules vs distraction)
3. **Run EXP-900** — Ready for Phase 0, builds on strongest finding (structural gates)
4. **Close stale experiments** — EXP-005, EXP-033, EXP-230 should be marked CLOSED in design.md
5. **Write results.md batch** — EXP-133 through EXP-137, EXP-152, EXP-153 all completed but lack writeups

## Meta-Observation

**13 of 30 "no-results" experiments are actually completed** — the issue isn't that experiments aren't being run, it's that results aren't being written up. This is a systematic writeup debt problem. Coach runs experiments, gets results, updates status in design.md, but never creates the canonical results.md file.

**Proposed fix**: Add a post-experiment workflow step that auto-creates results.md skeleton from the design.md status field when status contains "COMPLETE" or "CLOSED".
