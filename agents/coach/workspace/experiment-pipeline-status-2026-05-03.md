# Experiment Pipeline Status — 2026-05-03

## Active Pipeline

### 🟢 IN PROGRESS
| ID | Name | Phase | Next Action |
|----|------|-------|-------------|
| EXP-745 | Few-Shot Pattern Coverage Expansion | Phase 1 COMPLETE | Phase 2: design new example files for implementation/refactoring tasks |

### 🟡 DESIGNED (Awaiting Tech-Lead)
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-740 | Wall-Clock Duration Gate (90s) | FIX DESIGNED | Needs tech-lead to replace proxy-score gate with wall-clock check |
| EXP-735 | Impact Gate Trigger Fix | DESIGNED | Needs tech-lead to change keyword detection to intentional-impact-check |
| EXP-725 | Structural Anti-Shallow Gate | DESIGNED | Needs tech-lead to add finish() rejection when tool_call_count < 10 |

### 🔴 ESCALATED (Awaiting Tech-Lead Action)
| ID | Name | Status | Escalation |
|----|------|--------|------------|
| EXP-730 | Dormant Structural Gate Audit | PHASE 2 COMPLETE | Root cause: gates architecturally incompatible with artifact gate. Proposed: remove turnsUsed, simplify scoring, or combine gates. SUPERSEDED by EXP-740. |

## Escalation Summary

**4 items pending tech-lead action:**
1. EXP-740: Wall-clock duration gate implementation (highest priority — clean replacement for dead proxy gate)
2. EXP-730: Dormant gate fixes (superseded by EXP-740 for duration gate; impact/fewshot gates still need fixes)
3. EXP-735: Impact gate trigger condition rewrite
4. EXP-725: Structural anti-shallow gate

## Recently Closed (Last 10)
| ID | Name | Result | Date |
|----|------|--------|------|
| EXP-730 | Dormant Gate Audit Phase 2 | ROOT CAUSE FOUND — gates incompatible | 2026-05-03 |
| EXP-720 | Few-Shot Injection | DEPLOYED — zero triggers (traffic needed) | 2029-05 |
| EXP-710 | Shallow Session Rate Audit | 50% shallow rate confirmed | 2029-07 |
| EXP-650 | Impact-Scanning Gate | DEPLOYED — zero triggers (keyword too broad) | 2029-08 |
| EXP-645 | Impact Radius Production Audit | H1 REJECTED — 6% scanning | 2029-07 |
| EXP-640 | Duration Gate Production Audit | BLOCKED — binary rebuild | 2029-07 |
| EXP-635 | Threat-Framed Depth Commitment | CEILING — baseline 100% in gym | 2029-07 |
| EXP-630 | Structural Duration Gate | DEPLOYED — zero triggers (dead code) | 2029-07 |
| EXP-620 | Gate-Gaming Detection | PARTIALLY SUPPORTED — 27-55% trivial | 2029-07 |
| EXP-615 | Notification-Only Waste Detection | SUPERSEDED — H1 supported (64% shallow) | 2029-07 |

## Key Findings

### Core Knowledge (KE-480)
Text coaching is dead for verification behaviors. Only structural gates work in production. All 3 deployed structural gates (EXP-630, EXP-650, EXP-720) have **0% trigger rate** — the gates exist but never fire.

### EXP-730 Root Cause (New This Session)
The duration gate (EXP-630) cannot fire because:
1. `turnsUsed` is always 0 (never populated by runtime)
2. Artifact gate (EXP-520) upstream inflates substanceScore via re-prompt recovery
3. Any session surviving the artifact gate has score ≥ 5, bypassing `< 5` threshold

**True root cause**: The artifact gate's re-prompt produces enough output/summary to satisfy the duration gate. Gates are architecturally incompatible.

**Solution**: Replace with wall-clock duration gate (EXP-740) — binary signal, no scoring dependencies.

### Working Infrastructure
| Gate | Status | Trigger Rate |
|------|--------|-------------|
| EXP-500: Read-Before-Edit | ✅ WORKING | 0% failure (perfect) |
| EXP-510: Worker Checklist | ✅ WORKING | Active on all worker sessions |
| EXP-520: Artifact Gate | ✅ WORKING | ~7 triggers, 100% recovery |
| EXP-530: Verification Gate | ✅ WORKING | 25% of sessions, 100% recovery |

### Dead Infrastructure (Needs Fixes)
| Gate | Status | Issue |
|------|--------|-------|
| EXP-630: Duration Gate | ❌ DEAD CODE | Threshold never reached (architectural) |
| EXP-650: Impact Gate | ❌ NEVER FIRES | Keyword detection too broad |
| EXP-720: Few-Shot Injection | ⚠️ NO TRAFFIC | Code correct, no sessions traverse path |

## Next Steps
1. Follow up on EXP-740 escalation (wall-clock gate)
2. Continue EXP-745 Phase 2 (fewshot coverage)
3. Re-escalate dormant gate fixes if no response by 2026-05-10
