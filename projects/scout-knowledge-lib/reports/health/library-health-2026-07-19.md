# Library Health Report — 2026-07-19

## Signal: oversized-canonical-notes (P1, 9 consecutive packets)

**Decision: Tolerate with reasons.** These 8 notes are intentionally large reference documents. Splitting further would fragment their utility.

| Note | Lines | Tolerance Reason |
|------|-------|-----------------|
| xhs-scan-log-june2026.md | 2216 | Chronological scan log; already extracted from parent. Splitting by month would lose cross-scan continuity. |
| the-oversight-inversion.md | 1327 | Deep thesis note with 50 layers; reference integrity requires single document. |
| agent-security-event-log.md | 1070 | Companion event log already extracted from parent; further splits lose event sequence. |
| hn-agent-operational-memory.md | 978 | Active task `split-hn-operational-memory` exists for review. |
| xhs-prediction-tracker.md | 966 | Prediction tracker with 60+ tracked predictions; tabular format needs single doc. |
| agent-architectures.md | 866 | Already had research sections extracted to companion notes. Remainder is core patterns. |
| agent-protocols-mcp-a2a.md | 826 | Three-protocol comparison (MCP/A2A/AG-UI); splitting by protocol loses comparison value. |
| agent-security-defense-architectures.md | 805 | 33 defense architectures catalog; already extracted from parent with research frontiers split out. Near threshold. |

**Exception:** `hn-agent-operational-memory.md` has an active split-review task; the others are intentionally tolerated.

## Signal: future-dated-library-content (P1, 9 consecutive packets)

**Decision: No-op — all instances are historical references in tree.json progress notes.**

All 40 sampled future-dated strings are inside `.state/tasks/tree.json` progress/evidence fields that describe *completed* file-rename operations. The dates (2026-07-25, 2026-10-06, 2026-10-16, 2026-10-17, 2026-11-19) appear as:
- Old impossible-future filenames that were renamed to correct dates (batch 22/23 progress notes)
- The `xhs-cookie-refresh-blocked` task's fallback date (2026-07-25), which is an intentional future deadline
- Health-observer `why_signal_repeats` field quoting earlier evidence

These are not actual future-dated content — they are quoted historical references. The tree.json file cannot be edited by Scout (task-tree is reconciler-owned). This signal will continue to fire and is accepted as a scanner limitation.

## Signal: unsourced-backlog (P1)

217 INDEX entries marked "Not yet sourced." Active task `source-unsourced-high-value-findings` exists (revision 1). No action this pass; capacity constrained by other signals.

## Signal: repeated-library-health-signal (P1)

Both `oversized-canonical-notes` (9×) and `future-dated-library-content` (9×) are now explained above with explicit tolerance/no-op decisions recorded in this report.
