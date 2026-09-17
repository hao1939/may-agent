<ai_context>
summary: "Rolling review record for oversized canonical notes. Documents why each exceeds the 800-line threshold and whether a split is warranted."
last_updated: "2026-09-11"
</ai_context>

# Oversized Notes Tolerance Record — 2026-07-19

The library health scanner flags notes exceeding 800 lines. This record documents
the disposition of each currently-oversized note to prevent the signal from
repeating without review.

## Tolerated — Append-Only Logs (splitting loses chronological value)

| Note | Lines | Reason |
|------|-------|--------|
| `xhs-scan-log-june2026.md` | 2216 | Already an extraction from the canonical XHS note. Chronological scan log; splitting further fragments the timeline. Tolerated as archive. |
| `agent-security-event-log.md` | 1070 | Chronological event log. Value is in contiguous timeline. Tolerated as append-only log. |
| `xhs-prediction-tracker.md` | 966 | Prediction tracker with status table. Splitting would break cross-reference. Tolerated. |
| `hn-agent-operational-memory.md` | 967 | Operational memory log. The 2026-07-19 review referenced `split-hn-operational-memory`, but that task is absent from the 2026-08-07 tree. Ten completed tracking items were trimmed 2026-07-19; remaining bulk was active research tracking. |

## Tolerated — Dense Reference Notes (high internal cross-reference)

| Note | Lines | Reason |
|------|-------|--------|
| `the-oversight-inversion.md` | 1327 | Single-thesis analytical essay with dense internal structure. Splitting would fragment the argument. Tolerated as monograph. |
| `agent-architectures.md` | 866 | Taxonomy reference. Sections are tightly cross-referenced. Tolerated at current size; review if >1200 lines. |
| `agent-protocols-mcp-a2a.md` | 826 | Protocol comparison reference. Just over threshold. Tolerated. |
| `agent-security-defense-architectures.md` | 805 | Just over threshold. Tolerated. |
| `agent-evaluation.md` | 862 | Reviewed 2026-08-07. The parent already delegates research-frontier material to `agent-evaluation-research.md` and `agent-evaluation-research-beyond-outputs.md`; its remaining bulk is the durable practice/tooling reference plus 237 lines of recent, source-grounded benchmark and harness updates. A further split at only 62 lines above threshold would fragment that core, and both the parent and first companion currently contain active uncommitted updates. Re-review at 1,000 lines or when a stable thematic block exceeds roughly 150 lines. |
| `agent-evaluation-research-beyond-outputs.md` | 849 | Reviewed 2026-09-11. A split is warranted rather than permanent tolerance: §37–§40 form a cohesive 231-line diagnostic-layers block (candidate selection, trace integrity, specification-gap localization, and human convention recovery). Extracting that block would leave the §23–§36 substrate foundations at about 600 lines and create a reusable August–September companion of about 230 lines. The canonical note currently has active uncommitted source additions for §39–§40, so this review does not rewrite or move those sections in place; the split should be performed as one isolated change after preserving that work. |

## Summary

Nine notes remain tolerated at their reviewed sizes. The newly flagged tenth
note has a safe, independently useful split boundary at §37: move §37–§40 into
an August–September diagnostic-layers companion, then update both notes'
`<ai_context>` metadata, coverage prose, exact section links, and library
navigation. This review intentionally leaves the actively modified canonical
note untouched.
