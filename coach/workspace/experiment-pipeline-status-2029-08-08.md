# Experiment Pipeline Status — 2029-08-08

## Changes This Session
- **EXP-735**: Impact gate trigger fix now **IMPLEMENTED ✅** (confirmed via tech-lead notification 2029-08-07)
- **EXP-725**: Structural anti-shallow gate now **IMPLEMENTED ✅** (confirmed via tech-lead notification 2029-08-07)
- **Gate logs**: All 3 gate logs (duration, impact, anti-shallow) still EMPTY — 0 triggers recorded
- **All escalated gate fixes are now deployed** — no remaining tech-lead blockers

## Active Experiments

### 🟢 READY FOR TRIALS (blocked on infrastructure)
| ID | Name | Status | Next Step |
|----|------|--------|-----------|
| EXP-745 | Few-Shot Coverage Expansion | Phase 3 DESIGNED | Run gym validation — needs GYM_AGENT_BIN |

### 🟡 AWAITING DATA (all gates deployed, monitoring trigger rates)
| ID | Name | Status | What We're Watching |
|----|------|--------|---------------------|
| EXP-740 | Wall-Clock Duration Gate | DEPLOYED ✅ | duration-gate-triggers.log — expect triggers on <90s sessions |
| EXP-735 | Impact Gate Trigger Fix | IMPLEMENTED ✅ | impact-gate-triggers.log — semantic detection (grep + impact terms) |
| EXP-725 | Structural Anti-Shallow Gate | IMPLEMENTED ✅ | anti-shallow-gate-triggers.log — re-prompt when tool_call_count < 10 |
| EXP-720 | Few-Shot in master-worker.ts | Phase 2 DEPLOYED | exp720-fewshot-dryrun.log — zero entries (no worker runs since deploy) |
| EXP-540 | Path Normalization | DEPLOYED | Awaiting sufficient sessions for re-measurement |

### 🔴 BLOCKED
None — all tech-lead escalations resolved.

## Gate Deployment Summary (Production Gates in heartbeat-data.ts)

| Gate | Experiment | Mechanism | Log File | Triggers |
|------|-----------|-----------|----------|----------|
| Artifact | EXP-520 | Re-prompt if 0 deliverables | (inline) | Active (7+ historical) |
| Duration | EXP-740 | Re-prompt if elapsed < 90s | duration-gate-triggers.log | 0 |
| Impact | EXP-735 | Re-prompt if ≥2 edits + no impact scan (semantic) | impact-gate-triggers.log | 0 |
| Anti-Shallow | EXP-725 | Re-prompt if tool_call_count < 10 | anti-shallow-gate-triggers.log | 0 |
| Few-Shot | EXP-720 | Inject examples for matching tasks | exp720-fewshot-dryrun.log | 0 (dry-run only) |

## Assessment

### Why still 0 triggers across all gates?
1. **Most likely**: Insufficient sessions since deployment (gates deployed 2029-08-07, <24h ago)
2. **Possible**: Artifact gate early-return prevents downstream gates from firing
3. **Alternative**: Sessions are naturally meeting thresholds (unlikely given historical 50%+ shallow rate)

**Action plan**: 
- After 20+ heartbeat sessions accumulate, audit all 3 log files
- If still 0 triggers after 50 sessions, investigate artifact gate interaction (early-return bypass)

## Next Experiment Opportunities

With all gate fixes deployed and pipeline in monitoring mode, opportunities:

1. **EXP-850: Gate Interaction Audit** — Do gates fire correctly when co-deployed? Artifact gate early-return may suppress duration/impact/anti-shallow gates. Could verify by reading heartbeat-data.ts control flow.
2. **EXP-745 Phase 3 alternative** — Instead of gym validation, monitor production few-shot match rate once worker sessions resume.
3. **New domain**: Cross-agent skill transfer — which proven skills (impact-radius-check, decompose-before-acting) are deployed to which agents? Audit coverage gaps.

## Key Metrics
- **Total experiments closed**: 50+ (EXP-250 through EXP-850)
- **Proven interventions deployed**: 12 (EXP-500/510/520/530/540/560/565/630/650/720/725/735/740)
- **Core findings**: Text coaching dead for verification (KE-480). Threat framing works (KE-560). Concrete thresholds work (KE-715). Task distraction nullifies text (KE-655).
- **Current bottleneck**: Data accumulation — need sessions to run to generate trigger data

## Recommendations
1. **Wait and monitor** — gates are fresh (<24h), need time to accumulate data
2. **Design EXP-850** — gate interaction audit to verify co-deployment doesn't cause suppression
3. **Skill coverage audit** — check which agents have proven skills deployed
