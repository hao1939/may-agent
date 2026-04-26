# EXP-230: Evidence Grading on Knowledge Entries

**Status**: DESIGNED
**Date**: 2026-10-13
**Hypothesis**: H-183 — Adding evidence grades (A/B/C/T) to knowledge entries reduces overclaiming
**Author**: Bob

## Design

### Phase 1: Grade Existing Entries (this session or next)
- Sample 20 knowledge entries from `agents/shared/knowledge/`
- Assign grades per H-183 schema: A (replicated), B (single experiment), C (small sample), T (theoretical)
- Add `evidence_grade: X` to frontmatter

### Phase 2: Measure Consumption (requires gym)
- Run 2 gym scenarios with graded vs ungraded knowledge entries
- **Treatment**: Entries include evidence grade metadata
- **Control**: Same entries without grade metadata
- **Metric**: Count instances of overclaiming (presenting C/T evidence as definitive)

### Phase 3: Behavioral Impact
- Does the agent hedge appropriately when citing T-grade entries?
- Does the agent preferentially use A/B-grade entries?

## Success Criteria
- Treatment group shows ≥30% fewer overclaiming instances
- No increase in useful-lesson loss (agent doesn't ignore C/T entries entirely)

## Cost
- Phase 1: ~1 session (grading exercise)
- Phase 2-3: ~2 sessions (gym runs + analysis)
