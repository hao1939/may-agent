# EXP-217: Knowledge Compression Level Audit

**Date**: 2026-04-25
**Status**: DESIGNED
**Predecessor**: EXP-195 (direct hints), EXP-210 (schema context)
**Hypothesis**: H-195 (Adaptive Compression Selection)

---

## Research Question

Do compression-level mismatches between knowledge served and task type correlate with lower session quality?

## Hypothesis

- **H-217a**: Sessions where the knowledge compression level matches task novelty will have higher evaluator scores than mismatched sessions
- **H-217-null**: No correlation between compression match and session quality

## Design

### Phase 1: Observational Audit (this experiment)

**Method**: Sample 20 recent agent sessions. For each:
1. Classify task type: **routine** (familiar pattern), **novel** (new problem), **mixed**
2. Classify knowledge accessed: **declarative** (context.md rules, KEs), **procedural** (skills, workflows), **episodic** (session logs, examples)
3. Score match: **matched** (novel+episodic/procedural, routine+declarative) vs **mismatched**
4. Record session outcome: evaluator score, compliance, success/failure

### Data Sources
- Session logs from `.state/sessions/`
- Evaluator reports
- Context.md entries read by each session (from tool call logs)

### Metrics

- Primary: correlation between compression match and session quality score
- Secondary: mismatch rate (% of sessions with wrong compression level)

### Decision Rule

- **Proceed to Phase 2** if: mismatch rate >30% AND mismatched sessions score ≥10pp lower
- **Stop** if: mismatch rate <15% OR no quality difference between matched/mismatched
- **Pivot** if: mismatch rate high but no quality difference (suggests compression isn't the bottleneck)

### Phase 2 (contingent on Phase 1 results)

3-arm gym experiment per H-195 test plan: same knowledge presented at declarative vs procedural vs episodic level. 10 runs per arm × 1 scenario = 30 runs (~$3).

## Execution

Phase 1 is manual analysis — no gym runs needed. Bob will sample sessions in a dedicated work session.

## Cost

- Phase 1: ~1 bob session (analysis only)
- Phase 2: ~$3 gym cost if triggered
