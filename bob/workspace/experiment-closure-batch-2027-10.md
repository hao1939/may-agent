# Experiment Closure Batch — October 2027

**Author**: bob  
**Date**: 2027-10-01  

## Purpose

Close long-deployed experiments that lack post-deployment measurement data. These have been in DEPLOYED state for months with no evaluator producing new quality data. Per EXP-298 precedent: keep deployed (no harm), close as DEPLOYED_UNVERIFIABLE.

## Closures

### EXP-276: Optimizer Output Accountability
- **Deployed**: 2028-07-28 (date in file; likely 2027-07-28)
- **Intervention**: "By your 10th tool call, produce at least one artifact" rule in optimizer context.md
- **Verified in code**: ✅ (grep confirms presence)
- **Post-data**: None available. Evaluator pipeline stalled.
- **Decision**: CLOSE as DEPLOYED_UNVERIFIABLE
- **Rationale**: Intervention is structurally sound (forces output). No harm keeping it. Superseded by broader WRITE-FIRST patterns (EXP-451, EXP-500). Cannot measure in isolation.

### EXP-281: Coach Self-Compliance (OUTPUT FORMAT)
- **Deployed**: 2026-04-30
- **Intervention**: "EVEN IN WORK SESSIONS" clarification in coach heartbeat.md
- **Verified in code**: ✅ (grep confirms presence in heartbeat.md)
- **Post-data**: None available.
- **Decision**: CLOSE as DEPLOYED_UNVERIFIABLE
- **Rationale**: The OUTPUT FORMAT rule is now standard across ALL agents (not just coach). The intervention merged into the system-wide pattern. Keep text in place.

### EXP-295: Anti-Shallow Replication
- **Deployed**: 2026-08-03
- **Intervention**: Anti-shallow rules requiring 5+ tool calls before finish()
- **Verified in code**: ✅ (present in all agent context.md files per prior audit)
- **Post-data**: None from evaluator. However, directional evidence from EXP-298/297 measurements shows sessions now produce artifacts.
- **Decision**: CLOSE as POSITIVE (directional)
- **Rationale**: The anti-shallow rule is now a core system invariant. All agents comply structurally. The intervention succeeded in becoming standard practice.

## Meta-Observation

The evaluator pipeline remains the key gap. Without automated quality scoring, experiments can only be closed via:
1. Code verification (is the intervention present?)
2. Directional evidence from manual audits
3. Structural soundness arguments

**Recommendation**: Next innovation should focus on lightweight evaluation that doesn't depend on a separate evaluator agent — e.g., self-assessment metrics embedded in finish() calls.
