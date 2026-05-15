# Todo Archive

*Completed and historical sections split from [todo.md](./todo.md)*

### Completed Experiments (86 total: EXP-020 through EXP-100)
- Full results in `agents/shared/knowledge/experiments/EXP-{NNN}/results.md`
- Synthesis documents in `agents/shared/knowledge/synthesis/`
- Knowledge entries in `agents/shared/knowledge/entries/KE-{NNN}-*.md`

---

## Promoted Skills (monitor for regression)

| Skill | Promoted | Last Verified | Result |
|-------|----------|--------------|--------|
| efficient-file-reading | 2026-04-03 | 2026-04-11 | ✅ PASS (4/4 product, 2/4 convention — same as prior; convention checks are grep-usage which bob doesn't match) |
| structured-plan-writing (plan-once-amend) | 2026-04-03 | 2026-04-11 | ✅ 8/8 PASS (all product/behavior/efficiency) |
| convention-verify-edit | 2026-04-03 | 2026-04-11 | ⚠️ 3/5 — product 3/3 ✅, convention 0/2 ❌ (infrastructure: transcript.jsonl not written to workdir, so C2.3/C3 can't evaluate). NOT a regression — scenario criteria expects transcript at `envDir/transcript.jsonl` but gym runner writes `_transcript.txt` to separate path. |
| cross-reference-source-code | 2026-04-09 | 2026-04-09 | Deployed to Bob, 3/4 scenarios pass |

**Apr 11 regression notes**:
- Agent `coder` no longer registered in runtime binary — ran with `bob` instead
- efficient-file-reading: bob passes all product checks; convention checks for grep usage fail because bob uses different reading strategy (still efficient, just not grep-based)
- plan-once-amend: perfect pass, 8/8 all checks
- convention-verify-edit: product perfect (3/3), but convention checks broken by infrastructure — `transcript.jsonl` never created in environment dir. This is a gym runner issue, not an agent regression. **TODO**: Fix gym runner to write transcript where success_criteria.js expects it.

---

## Strategic Context

**The gym taught us**: Structural interventions change behavior, text interventions don't (0/32+). Four mechanisms work. The gym is in steep diminishing returns (25/26 ceiling). Graduate it — but keep infrastructure sharp.

**Next frontier**: Production A/B testing of the four mechanisms on real tasks with real failure rates. Multi-session harness bridges the gap. Few-shot pipeline is the first deployment.

---

## Archived Sprint History

Previous sprint details (1-33) archived on 2026-04-09. See git history or experiment results for details.
Individual experiment reports: `agents/shared/knowledge/experiments/EXP-{NNN}/results.md`

---
*27 completed/historical sections moved to [todo-archive.md](./todo-archive.md)*
