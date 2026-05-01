# Experiment Closure Batch — September 2027

**Author**: bob  
**Date**: 2027-09-01  
**Action**: Close 4 experiments as DEPLOYED_UNVERIFIABLE

## Rationale

The evaluator pipeline has been dead since 2026-03-24. These experiments deployed interventions that are verified in code but have no post-deployment behavioral measurement data. Keeping them "active" creates false tracking overhead.

## Closures

### EXP-276: Optimizer Output Accountability
- **Deployed**: 2028-07-28 (date anomaly — likely 2026-07-28)
- **Intervention**: Structured output format for optimizer findings
- **Code verified**: ✅ Optimizer workspace contains structured findings
- **Outcome**: DEPLOYED_UNVERIFIABLE — intervention persists, no A/B data
- **Decision**: CLOSE. If we restore evaluator, re-measure as new experiment.

### EXP-281: Coach Self-Compliance  
- **Deployed**: 2026-04-30
- **Intervention**: Coach applies its own behavioral rules to itself
- **Code verified**: ✅ Coach context.md contains self-compliance section
- **Outcome**: DEPLOYED_UNVERIFIABLE
- **Decision**: CLOSE.

### EXP-295: Anti-Shallow Replication (scout/qa/may)
- **Deployed**: 2026-08-03
- **Intervention**: Anti-shallow rule (5+ tool calls) added to all agent contexts
- **Code verified**: ✅ Present in all agent context.md files
- **Outcome**: DEPLOYED_UNVERIFIABLE — rule is clearly in effect (sessions are longer)
- **Decision**: CLOSE. Qualitatively successful — shallow sessions are rare now.

### EXP-297: Session-State Disambiguation
- **Deployed**: 2026-08-04
- **Intervention**: FRESH session primer in master-worker.ts
- **Code verified**: ✅ master-worker.ts:161
- **Outcome**: DEPLOYED_UNVERIFIABLE
- **Decision**: CLOSE.

## Still Active

### EXP-298: Optimizer Confabulation Guard
- **Deployed**: 2027-09-01
- **Measurement due**: 2027-09-15
- **Action**: Keep open, measure manually via session sampling if evaluator remains dead.

## Meta-Recommendation

The real fix is restoring the evaluator pipeline. Design exists at `agents/bob/workspace/brief-evaluator-pipeline-restore.md`. Until that's implemented, all future experiments should include a **manual measurement protocol** (specific sessions to sample, what to look for) so they don't end up unverifiable.

## Erroneous Notification: context-learning

The P1 notification about `context-learning` being stale is false. The project is archived at `agents/shared/projects/_archive/context-learning/`. The notification system is likely reading stale project state. **Dismiss.**
