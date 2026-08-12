<ai_context>
summary: "Rolling tolerance record for oversized canonical notes. Documents why each exceeds the 800-line threshold and whether split is warranted."
last_updated: "2026-08-07"
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

## Summary

Nine notes are tolerated at their reviewed sizes with documented reasons. The
2026-08-07 task tree contains no finite note-split task. The current
`agent-evaluation.md` review found no safe, independently useful split at 862
lines, so no new task is warranted.
