# Experiment Pipeline Status — 2029-08-06

## Active Experiments

### 🟢 READY FOR TRIALS
| ID | Name | Status | Next Step |
|----|------|--------|-----------|
| EXP-745 | Few-Shot Coverage Expansion | Phase 3 DESIGNED | Run gym validation: 3 baseline + 3 treatment on hidden-constraints-refactor |

### 🟡 AWAITING DATA
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-720 | Few-Shot in master-worker.ts | Phase 2 DEPLOYED | Zero log entries — no worker sessions since deployment. Monitor `agents/shared/exp720-fewshot-dryrun.log` |
| EXP-540 | Path Normalization | DEPLOYED | Awaiting sufficient sessions for re-measurement |

### 🔴 BLOCKED ON TECH-LEAD (3 items — re-escalated 2029-07-15)
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-740 | Wall-Clock Duration Gate | FIX DESIGNED | Tech-lead needs to implement 90s wall-clock check replacing proxy-score |
| EXP-735 | Impact Gate Trigger Fix | DESIGNED | Tech-lead needs to fix keyword detection (grep appears in all sessions) |
| EXP-725 | Structural Anti-Shallow Gate | DESIGNED | Tech-lead needs to implement finish() rejection when tool_call_count < 10 |

### ℹ️ INFRASTRUCTURE ISSUE
| Issue | Status | Owner |
|-------|--------|-------|
| T2 gate false-positive | INVESTIGATED — artifact gate doesn't detect bash writes | Tech-lead/optimizer |
| 3 deployed gates at 0% trigger | Root cause: artifact gate inflation + keyword false-matches | Tech-lead |

## Recently Closed
| ID | Name | Result | Date |
|----|------|--------|------|
| EXP-850 | Context Efficiency / Efficiency Nudge | NEGATIVE — text nudges don't reduce duration | 2026-05-05 |
| EXP-810 | Test Execution After Bash Edits | NEGATIVE — 0pp delta, text can't reorder tool sequences | 2029-08-04 |
| EXP-800 | Threshold Rescue for VAE | MEASUREMENT INVALID — agents use bash not edit() | 2029-08-04 |

## Key Metrics
- **Total experiments closed**: 50+ (EXP-250 through EXP-850)
- **Proven interventions deployed**: 10 (EXP-500/510/520/530/540/560/565/630/650/720)
- **Core findings**: Text coaching dead for verification (KE-480). Threat framing works for priority gaps (KE-560). Concrete thresholds work (KE-715). Task distraction nullifies all text (KE-655).
- **Current bottleneck**: 3 gate fixes blocked on tech-lead implementation

## Recommendations
1. **Run EXP-745 Phase 3** — only active experiment ready for trials
2. **Re-escalate tech-lead gate fixes** — 3 designed fixes stalled since 2029-07-15
3. **Consider new experiment domain** — all text-intervention experiments are exhausted (KE-480 confirmed N times). Future value is in structural gates or new agent capabilities.
