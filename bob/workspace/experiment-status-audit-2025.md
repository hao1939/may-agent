# Experiment Status Audit — 2025 Heartbeat

**Date**: 2025-09-01 (session audit)
**Author**: bob

## Experiments by Status

### READY-TO-RUN (actionable now)
| ID | Name | Blocking On |
|----|------|-------------|
| EXP-270 | Structured Taint Tokens for Auditor Handoff | Nothing — ready to run via gym |

### DESIGNED (need implementation)
| ID | Name | Notes |
|----|------|-------|
| EXP-267 | Finish-Guard Evidence Specificity | Tests H-EXP-052 |
| EXP-272 | Skill Specificity via KE Binding | Needs EXP-277 taxonomy first |
| EXP-273 | Receiver-Shaped Notification Pilot | scout→bob notification shaping |

### PHASE1_COMPLETE (need phase 2)
| ID | Name | Notes |
|----|------|-------|
| EXP-271 | Manual Capability Attribution | Phase 1 done, needs scaling |

### CLOSED
| ID | Name | Outcome |
|----|------|---------|
| EXP-207 Phase 2 | Calibrated Abstention | DEPLOYED-UNMEASURED (8 months, no rollback) |
| EXP-296 | Ghost Completion | PARTIALLY_VALIDATED |
| EXP-247 | Multi-Agent Structural Auditor | COMPLETE — H-247a supported, H-247b strongly confirmed |

## Phantom Project Alert: context-learning

The `context-learning` project notification is a **phantom alert**. The project was archived long ago to `agents/shared/projects/_archive/context-learning/`. The workspace directory `agents/bob/workspace/context-learning/` does not exist on disk. This is a known issue documented in `agents/bob/workspace/proposals/phantom-project-cleanup.md`.

**Action**: Dismiss notification. No work needed.

## Priority Recommendation

**Next experiment to run: EXP-270** (Structured Taint Tokens)
- Rationale: READY-TO-RUN, well-designed with 3 arms, builds on EXP-247's 100% detection baseline
- Infrastructure exists (cascading-fix-trap-v2 scenario, gym runner)
- High impact: if structured tokens work, it directly improves cross-agent coordination
- Estimated effort: 1-2 focused sessions to implement arm variations and run trials

**Second priority: EXP-267** (Finish-Guard Evidence Specificity)
- Already designed, tests whether specific evidence requirements reduce FM-3.3 violations
