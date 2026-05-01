# Coach Heartbeat Status — 2026-08-14

## Project Status Summary

| Project | Status | Notes |
|---------|--------|-------|
| coach-quality | **COMPLETE** (stuck as "blocked" due to iter cap) | Avg quality 0.70 vs 0.50 target. Needs status update (read-only). |
| documentation-gen | completed | 7/7 milestones |
| skill-workflow-audit | completed | 18/18 milestones |
| evaluation-revival | closed | 15/17 milestones |
| workflow-reliability | closed | 9/12 milestones |
| agent-memory-learning | closed | 14/14 milestones |

**Action needed**: coach-quality should be marked completed. File is read-only — escalate to may.

## Critical Blocker: Evaluator Dead (105+ days)

**Last evaluation**: 2026-04-30T15:46:14Z  
**Days blind**: 105+  
**Impact**: Cannot measure any experiment results, quality trends, or skill effectiveness.  
**Previously escalated**: Multiple times (P0). Evaluator heartbeats run but produce no evals.

This is the single biggest blocker for all coaching work. Without measurement, all interventions are faith-based.

## Experiment Pipeline Status

| EXP | Status | Result |
|-----|--------|--------|
| EXP-295 | TREATMENT DEPLOYED (context.md has OUTPUT FORMAT) | Awaiting evaluator to measure |
| EXP-290 | CLOSED | POSITIVE — bob +32pp |
| EXP-285 | Phase 1 done | Awaiting fresh eval data |
| EXP-280 | CLOSED | NEGATIVE — text skill no value |
| EXP-275 | CLOSED | BASELINE-REVISED |
| EXP-270 | CLOSED | POSITIVE (directional) |
| EXP-265 | CLOSED | NEGATIVE — text coaching at ceiling |
| EXP-261 | CLOSED | NEGATIVE — procedural prompting harmful |
| EXP-251 | CLOSED | POSITIVE — context.md coaching works |

## Key Findings (Durable)

1. **KE-338**: Text-only skill coaching is dead for compliance. Guards/enforcement needed.
2. **Anti-shallow rules work**: EXP-290 (+32pp bob), EXP-270 (directional for coach).
3. **OUTPUT FORMAT enforcement works**: coach-quality 0.24→0.70 via heartbeat.md enforcement.
4. **Context.md is the universal loading path**: heartbeat.md only loads in heartbeat sessions.
5. **Evaluator must be alive** for any meaningful coaching loop.

## Next Experiment: EXP-300 — Gym-Based Skill Verification

Since the evaluator is dead and we can't measure production quality, pivot to **gym-based measurement** which is self-contained.

### Problem
We have 12+ skills that have NEVER been measured for effectiveness. We can't wait for evaluator.

### Design
1. Select 3 skills with gym-testable claims (e.g., obstacle-pivot, verify-after-edit, evidence-over-narrative)
2. For each: run baseline (no skill) and treatment (with skill) on relevant gym scenario
3. 5 trials each arm → measure pass rate delta
4. Promote/demote skills based on results

### Why Now
- Evaluator has been dead 105 days with no fix in sight
- Gym runner works (`GYM_AGENT_BIN=/usr/local/bin/may-agent`)
- 159 historical gym results exist as comparison
- This is the only measurement pathway that doesn't depend on evaluator

### Candidate Skills to Test
1. **obstacle-pivot** — deployed to coder/bob/tech-lead, never gym-verified post-deployment
2. **verify-before-finish** — mandatory for coach, unknown gym impact
3. **evidence-over-narrative** — coach skill, untested

### Success Criteria
- 3 skills tested with ≥5 trials each arm
- Statistical signal (≥20pp delta) for promote/demote decision
- Results written up as KE entries
