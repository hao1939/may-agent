<ai_context>
summary: "Rolling review record for oversized canonical notes. Documents why each exceeds the 800-line threshold and whether a split is warranted."
last_updated: "2026-09-23"
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

## Recurrence review — 2026-09-18

The health observer reported ten oversized notes. Direct `wc -l` counts were one
line lower than the observer values (newline-counting convention) and confirmed
that every named path still exists. This pass used the following dispositions:

| Note | Direct lines | Disposition |
|------|-------------:|-------------|
| `agent-runtime-effect-integrity.md` | 970 | No second split. The 2026-09-14 verdict-integrity extraction remains intact, and the newer tail still belongs to effect settlement and authorization rather than a distinct reusable topic. |
| `agent-security-defense-architectures.md` | 1127 | No split in this pass. Existing forwarding sections already distribute later material to companion notes; another move needs an inbound-link and duplication review rather than a line-count-only cut. |
| `agent-security-event-log.md` | 1319 | Tolerated as a chronological event log; splitting would weaken timeline lookup. |
| `agent-security-governance.md` | 1225 | No split in this pass. Sections 6–12 form a possible composition-and-authority block, but overlap with existing delegation notes must be checked before extraction. |
| `hn-agent-operational-memory.md` | 1113 | Tolerated as an operational-memory chronology with a current summary and next-steps tail. |
| `the-oversight-inversion.md` | 2005 | Next split-review target. The nested `Verification Harness` block runs from about line 730 to 1844 and contains layers 24–47; its links and source coverage should be mapped before any extraction. |
| `xhs-prediction-tracker.md` | 965 | Tolerated because the status table and prediction history are one cross-referenced tracker. |
| `xhs-scan-log-june2026.md` | 1988 | Tolerated as a closed chronological June archive. |
| `xhs-seed-ledger.md` | 2872 | Tolerated as a reconciliation ledger whose cycle order and access-boundary evidence are the useful structure. |
| `xhs-topic-map.md` | 18181 | No line-count-only edit. This is the living ranked question/evidence map and should be opened only for source-lane selection or a separately scoped structural review. |

No child assignment is justified from these repeated size facts alone. The
standing maintenance task can review `the-oversight-inversion.md` as the next
bounded split candidate without creating duplicate project work.

## Targeted recurrence — 2026-09-18 (runtime notes)

A later health packet on the same day named only the two runtime companions.
Direct `wc -l` counts were again one below the observer values:

| Note | Observer / direct lines | Disposition |
|------|------------------------:|-------------|
| `agent-runtime-effect-integrity.md` | 1145 / 1144 | No second split during active intake. The verified verdict-integrity extraction still resolves through its forwarding headings. Four source publications landed on 2026-09-18, and the recent growth remains within the effect-boundary scope, including unknown-effect quarantine, review-versus-commit atomicity, guarded configuration writes, and apply-time revalidation. This is growth after a successful split, not evidence that the split failed. Re-review after intake stabilizes and only if a cohesive block can materially reduce the parent. |
| `agent-runtime-hardening.md` | 805 / 804 | Tolerated at four lines above threshold. Its two 2026-09-18 additions compare harness controls by model/context budget and distinguish planning benefit from release-verification risk. Both belong with the existing harness-evolution catalog, while the effect-specific catalog is already delegated through the closing companion section. Re-review at 1,000 lines or when a stable thematic block exceeds roughly 150 lines. |

No note was split solely to lower a line-count signal, and no child assignment
is justified: both dispositions are independently closable in the standing
maintenance task.

## Targeted recurrence — 2026-09-22 (evaluation notes)

The observer reported `agent-evaluation.md` at 2,252 lines and
`agent-runtime-verdict-integrity.md` at 822 lines. Direct `wc -l` counts were
again one lower than the observer values.

| Note | Observer / direct lines | Disposition |
|------|------------------------:|-------------|
| `agent-evaluation.md` | 2252 / 2251 | Split warranted after the current source-intake burst stabilizes. The `Durable Patterns` block at lines 14–1146 is now a coherent 1,133-line September catalog with 21 source-grounded patterns. It can become a verdict-and-evidence companion while the existing published path retains the older benchmark, tooling, metrics, and research navigation. Preserve the 21 heading fragments through exact forwarding links and check digest snapshots before moving the block. |
| `agent-runtime-verdict-integrity.md` | 822 / 821 | No immediate second split. The note was reduced to 588 lines by the verified 2026-09-21 acceptance/reconciliation extraction, then received five same-day source publications and reached only 21 lines above threshold. The new sections still fit verdict integrity, and the companion forwarding link remains present. Re-review after intake stabilizes or when another cohesive block reaches roughly 150 lines. |

Four source publications touched `agent-evaluation.md` after the runtime split,
while five touched `agent-runtime-verdict-integrity.md`. This pass records the
clean evaluation boundary and the runtime note's recent-growth context rather
than moving actively changing source material. The standing maintenance task can
perform the evaluation split in a later isolated pass; no separate child task is
needed.

## Targeted recurrence — 2026-09-23 (`agent-evaluation.md`)

The observer now reports 2,450 physical lines; direct `wc -l` measures 2,449
newline-counted lines. The earlier split recommendation remains directionally
valid, but this is not a safe moment to move the block:

- Seven source-publication commits touched the note since 2026-09-22 08:02 UTC.
- Three landed on 2026-09-23, at 12:05, 14:02, and 18:02 UTC; the newest was
  published only minutes before this review.
- `Durable Patterns` now spans lines 17–1879 and contains 40 level-three
  headings. Its recent additions occur at both ends of the block: Nothing
  Threw and Life Forge lead the section, while ApprenticeBench closes it.
- Retained and current digest files contain fragment links to headings throughout
  this block, including all three 2026-09-23 additions. A split therefore needs
  exact forwarding links at the published parent path rather than a bulk move.

**Disposition:** do not split during the continuing intake burst. The next
isolated pass should first freeze the intended companion boundary—likely the
source-grounded verdict/evidence catalog rather than every subsection currently
nested under `Durable Patterns`—then preserve each moved heading fragment with
an exact forwarding link and verify the retained digest targets. No child task
is warranted because this is a bounded follow-up for the standing maintenance
task, not independent work.

## Unsourced INDEX batch — 2026-09-18

The observer reported 200 entries still marked `Not yet sourced` after 34
unchanged windows. A five-entry batch was checked against the linked findings:
scans 155, 157, 160, 185, and 198 each contain stable HN and/or arXiv URLs or
IDs alongside their claims. Their stale markers were removed from `INDEX.md`,
reducing the exact marker count from 200 to 195. This is a metadata correction,
not a claim that every source was freshly retrieved during this review.

## Current summary

The previously recommended diagnostic-layers split is complete.
`agent-evaluation.md` remains the next split candidate, but the 2026-09-23
recurrence confirms that source intake is still active and that its proposed
boundary now needs explicit heading-forwarding and digest-link preservation.
The 2026-09-22 review also defers a second
`agent-runtime-verdict-integrity.md` split during same-day source intake. Other
oversized signals are format-appropriate logs/ledgers or previously reviewed
notes. The unsourced backlog received a small evidence-checked batch rather than
a bulk metric edit.
