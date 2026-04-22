# EXP-193: Evidence Grading for Knowledge Entries

**Hypothesis:** H-183 (Evidence Grading)
**Status:** PHASE-1-COMPLETE
**Created:** 2026-04-22

## Design

Add evidence-grade metadata (A/B/C/T) to knowledge entries so agents can distinguish strong from weak evidence.

### Grading Scheme
- **A**: Replicated (n≥3), consistent effect, clear mechanism
- **B**: Single well-designed experiment, clear result
- **C**: Small sample (n<5) or single scenario
- **T**: Theoretical synthesis, no direct measurement

## Phase 1 Results: Grading 24 Entries

Based on H-182 audit sample. Grade distribution:

| Grade | Count | % |
|-------|-------|---|
| A | 9 | 37.5% |
| B | 7 | 29.2% |
| C | 4 | 16.7% |
| T | 4 | 16.7% |

### Key Observations

1. **Grade correlates with audit quality**: All 14 CORRECT entries map to A or B. All PARTIALLY-CORRECT entries map to B, C, or T. The MISLEADING entry (KE-039) maps to T.
2. **Theoretical entries cluster low**: 4/4 T-grade entries were rated PARTIALLY-CORRECT or worse in the audit — the grade system correctly flags them.
3. **Early empirical entries are high quality**: KE-001 through KE-030 are mostly A/B grade.

### Entries Graded
KE-001, KE-003, KE-005, KE-007, KE-009, KE-011, KE-014, KE-016, KE-018, KE-020, KE-023, KE-025, KE-028, KE-030, KE-033, KE-036, KE-039, KE-042, KE-045, KE-048, KE-051, KE-054, KE-057, KE-058

## Phase 2: A/B Testing (BLOCKED)

Requires gym infra (same blocker as EXP-190/192). Test whether agents consuming graded entries make fewer overclaiming errors.

## Cost
Phase 1: ~0 (metadata only). Phase 2: ~$5 when gym available.
