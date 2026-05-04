# Experiment Pipeline Status — 2029-07-15

## Executive Summary

**Active experiments**: 2 (EXP-800, EXP-745)
**Blocked on tech-lead**: 3 (EXP-740, EXP-735, EXP-725)
**Deployed, awaiting data**: 3 (EXP-650, EXP-630, EXP-540)
**Total closed**: 50+ (EXP-250 through EXP-745)

## Priority Ranking

### 🔴 P0 — Run Now
| ID | Name | Status | Blocker | Next Action |
|---|---|---|---|---|
| EXP-800 | Threshold Rescue (VAE) | READY TO RUN | Gym runner needs `GYM_AGENT_BIN` | Set env var or run manually via agent dispatch |

### 🟡 P1 — Blocked on Tech-Lead
| ID | Name | Status | What's Needed |
|---|---|---|---|
| EXP-740 | Wall-Clock Duration Gate | Fix designed | Replace proxy-score gate with `Date.now()` check (90s threshold) |
| EXP-735 | Impact Gate Trigger Fix | Fix designed | Replace keyword detection with intentional-impact-check |
| EXP-725 | Structural Anti-Shallow Gate | Fix designed | `finish()` rejection when `tool_call_count < 10` |

### 🟢 P2 — Monitoring / Low Priority
| ID | Name | Status | Next Check |
|---|---|---|---|
| EXP-745 | Few-Shot Coverage Expansion | Phase 2 complete (80% coverage) | Monitor production match rate |
| EXP-650 | Impact Scanning Gate | Deployed | Check `impact-gate-triggers.log` after 30+ multi-edit sessions |
| EXP-630 | Duration Gate | Deployed | Check `duration-gate-triggers.log` after 50+ sessions |
| EXP-540 | Path Normalization | Deployed | Re-measure path violation rate |
| EXP-720 | Few-Shot Master-Worker | Dry-run deployed | Parse `exp720-fewshot-dryrun.log` after 50+ worker sessions |

## Key Knowledge Entries (Active)

| KE | Finding | Impact |
|---|---|---|
| KE-715 | Text rules work WITH concrete thresholds + P0 framing (≥90% compliance) | Challenges KE-480's absolutism |
| KE-655 | Task distraction nullifies ALL text interventions | Challenges KE-715 |
| KE-480 | Text coaching dead for verification behaviors — structural only | Foundation law |
| KE-645 | Cognitive skills also fail without structural enforcement | Extends KE-480 |
| KE-401 | Activation gaps (not reasoning) are skill-addressable | Taxonomy |

## Contradiction to Resolve

**KE-715 vs KE-655**: Does a concrete-threshold P0 rule survive task distraction?
- EXP-800 is designed specifically to answer this.
- This is the most consequential open question in our training research.
- If KE-715 wins → we can rescue VAE and potentially other failed text interventions.
- If KE-655 wins → structural gates are the ONLY path for all verification behaviors.

## Deployed Infrastructure Stack

| Gate | Location | Status | Trigger Rate |
|---|---|---|---|
| Read-before-edit (EXP-500) | master-worker.ts:423-448 | ✅ Active | ~19 injections/session |
| Worker checklist (EXP-510) | master-worker.ts:~460 | ✅ Active | 100% of workers |
| Artifact gate (EXP-520) | heartbeat-data.ts:440-462 | ✅ Active | ~7/session, 100% recovery |
| Verification gate (EXP-530) | master-worker.ts | ✅ Active | 25% fire, 100% recovery |
| Path normalization (EXP-540) | master-worker.ts:451 | ✅ Active | Unknown |
| Threat gates (EXP-560/565) | master-worker.ts:454 | ✅ Active | Unknown |
| Duration gate (EXP-630) | heartbeat-data.ts:463-486 | ⚠️ Dead code | 0% (proxy-score broken) |
| Impact gate (EXP-650) | heartbeat-data.ts:524-555 | ⚠️ Dead code | 0% (keyword too broad) |
| Few-shot dry-run (EXP-720) | master-worker.ts:458-472 | ⚠️ No data | 0 log entries |

## Stale Project: skill-workflow-audit

Status: "blocked" but milestones 18/18. Project is in `_archive/`. 
**Recommendation**: Close project — all milestones complete, archived. "Blocked" status is stale metadata.

## Next Heartbeat Actions

1. **EXP-800**: Attempt to run via `GYM_AGENT_CMD` or agent fork dispatch
2. **Gate liveness**: Check deployed gate logs for any new trigger data
3. **Tech-lead escalation**: Re-notify on EXP-740/735/725 if no progress
