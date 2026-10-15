<ai_context>
summary: "Rolling review record for oversized canonical notes. Documents why each exceeds the 800-line threshold and whether a split is warranted; current through the October 15 review of eight recurring note-size signals and the unchanged unsourced-index backlog."
last_updated: "2026-10-15"
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

## Targeted recurrence — 2026-09-25 (evaluation, runtime, and enforcement)

The observer named three canonical notes. Direct counts again differ by one from
its physical-line convention: `agent-evaluation.md` is 2,561 newline-counted
lines, `agent-runtime-hardening.md` is 987, and
`agent-security-enforcement-evidence.md` is 1,467.

| Note | Observer / direct lines | Current evidence and disposition |
|------|------------------------:|----------------------------------|
| `agent-evaluation.md` | 2562 / 2561 | **Defer the already-planned split during current intake.** Two source publications landed on September 25 at 14:06 and 16:07 UTC, adding 112 net lines. `Durable Patterns` now reaches line 1,991 and the whole note has 66 level-three headings. Thirty-two distinct inbound fragments from knowledge, reports, and retained/working digests make a bulk move unsafe without exact forwarding anchors. The September 22 split direction remains useful, but the boundary must be frozen in an isolated pass after intake settles. |
| `agent-runtime-hardening.md` | 988 / 987 | **Retain the catalog.** It has 29 substantive level-two patterns plus one closing companion catalog; the patterns span runtime-state admission, bounded recovery, transactional effects, harness controls, restoration, and adaptation rather than one duplicate or independently reusable tail. The latest source addition was September 23, and only five inbound fragments were found, but line count alone does not establish a better boundary. Re-review if a coherent multi-pattern cluster emerges or growth materially exceeds 1,000 lines. |
| `agent-security-enforcement-evidence.md` | 1468 / 1467 | **Retain during continuing intake.** The dedicated enforcement review was refreshed earlier on September 25 at 1,365 newline-counted lines. Two later source publications at 14:03 and 18:06 UTC added 115 and removed 13 lines, so the newest landed effectively with this observer packet. The note now has 19 level-two studies and five level-three follow-ups. This strengthens the existing no-split reason: freeze a thematic boundary and preserve fragments only after the active source burst settles. |

No child task, second report, or threshold-only split is warranted. The existing
standing maintenance task can revisit the evaluation boundary after the source
lane stabilizes; the runtime catalog has no newly verified lossless boundary,
and the enforcement companion's dedicated review already defines the criteria
for a later second split.

## Targeted recurrence — 2026-09-26 (`agent-evaluation.md`)

The observer reports 2,761 physical lines; direct `wc -l` measures 2,760
newline-counted lines. This is a current but unchanged-in-kind signal, not a safe
split window:

- Four source-publication commits touched the note after the September 25 review,
  at 20:03, 20:06, and 22:03 UTC on September 25 and 00:05 UTC on September 26.
- Together they inserted 201 lines and removed two, a net increase of 199 lines.
- The note now has 70 level-three headings. The four new patterns—Vigiles,
  Caliper, AgentLens, and an imagined-grader pattern—were inserted at multiple
  positions within `Durable Patterns`, rather than forming one settled tail.
- The newest source publication landed about ten minutes before this observer
  packet, so the active-intake reason recorded on September 25 still applies.

**Disposition:** retain the published path and do not perform a threshold-only
split. Reconsider the already-planned verdict-and-evidence companion only after
source intake settles; freeze the exact heading boundary and preserve the
existing inbound fragments with exact forwarding links. This recurrence does
not justify a duplicate report, child task, or dependency.

## Targeted recurrence — 2026-09-26 (`agent-security-enforcement-evidence.md`)

The observer reports 1,654 physical lines; direct `wc -l` measures 1,653
newline-counted lines. The September 25 active-intake disposition remains the
smallest safe response:

- Three source-publication commits landed after the prior review, at 02:05,
  08:05, and 12:04 UTC on September 26.
- Together they inserted 196 lines and removed ten, a net increase of 186 lines.
- The three additions are distributed rather than a settled tail: a verifier
  follow-up near line 199, a sticky sensitive-access transition near line 1085,
  and a route-coverage study beginning near line 1581.
- The note now has 20 level-two headings and seven level-three follow-ups. Its
  latest publication landed about five minutes before this health packet.

**Disposition:** retain the published path for this cycle. This note was itself
created by a verified split on September 23, and the current growth remains an
actively changing implementation-evidence catalog rather than a clean second
companion boundary. Revisit after source intake settles; before moving any
section, freeze a thematic boundary and preserve every inbound heading fragment
with an exact forwarding link. This recurrence warrants neither a threshold-only
split nor a child task.

## Unsourced INDEX batch — 2026-09-18

The observer reported 200 entries still marked `Not yet sourced` after 34
unchanged windows. A five-entry batch was checked against the linked findings:
scans 155, 157, 160, 185, and 198 each contain stable HN and/or arXiv URLs or
IDs alongside their claims. Their stale markers were removed from `INDEX.md`,
reducing the exact marker count from 200 to 195. This is a metadata correction,
not a claim that every source was freshly retrieved during this review.

## Targeted recurrence — 2026-10-03 (`agent-runtime-hardening.md`)

The observer reported 1,037 physical lines; direct `wc -l` measured 1,036
newline-counted lines. The prior review explicitly called for reconsideration
once the note materially exceeded 1,000 lines or a coherent multi-pattern
cluster emerged. Both conditions now hold.

Five adjacent patterns (Bunker, Agent Harness, domain-native mutation, Mati, and
SafeHarness) form a 225-line enforcement-observability cluster: each separates a
configured or stated control from the execution surface and evidence needed to
show that it actually operated. They moved intact to
[Agent Runtime Enforcement Observability](../../knowledge/agent-runtime-enforcement-observability.md).
The parent retains each original level-two heading as an exact forwarding anchor;
the one editable knowledge-note deep link now targets the companion directly,
while six retained digest fragments continue to resolve through the parent.
The split reduces the parent to 832 newline-counted lines without changing the
source claims or their evidence limitations.

**Disposition:** split the verified cluster; retain the broader runtime catalog
and its published path. No child task is warranted.

## Targeted recurrence — 2026-10-04 (evaluation and enforcement evidence)

The observer reported `agent-evaluation.md` at 2,962 physical lines and
`agent-security-enforcement-evidence.md` at 1,980. Direct `wc -l` measurements
were again one lower: 2,961 and 1,979 newline-counted lines.

| Note | Observer / direct lines | Current evidence and disposition |
|------|------------------------:|----------------------------------|
| `agent-evaluation.md` | 2962 / 2961 | **The planned split is now a real maintenance target, but not a safe inline move in this signal review.** The note has 74 level-three headings. Its coherent `Durable Patterns` catalog now occupies lines 30–1810, after which the older benchmark, tooling, metrics, and research-navigation material remains. Intake has slowed but not stopped: four source publications touched the note after the September 26 review, most recently twice on October 2. A library-wide reference scan found 173 path mentions across 48 other Markdown files, consistent with the previously observed deep-link preservation burden. The next isolated pass should freeze the `Durable Patterns` heading set, move that catalog intact to one companion, leave exact heading-level forwarding links at the published parent path, and verify retained digest snapshots before publication. |
| `agent-security-enforcement-evidence.md` | 1980 / 1979 | **No-op for active intake.** This companion was updated at 00:13 UTC on October 4, about two minutes before the health observation. It now has 21 level-two studies and 11 level-three follow-ups; recent additions remain distributed across the evidence catalog rather than forming a verified second-companion boundary. A reference scan also found 24 path mentions across six Markdown files, including 14 fragment-bearing forms. Splitting immediately after the newest source landed would repeat the unsafe timing documented on September 26. Re-review after intake settles and only when a thematic block can be moved with exact forwarding anchors. |

This pass updates the existing rolling disposition rather than creating a
second report or a threshold-only rewrite. The evaluation split remains bounded
work for the standing maintenance task, so no duplicate child assignment is
created. The security signal is closed for this cycle by the exact active-intake
no-op above; its unchanged line-count fact alone does not justify moving content.

## Recurrence review — 2026-10-15 (seven canonical notes)

The observer named seven notes. Direct `wc -l` measurements were again one below
its physical-line values. Git history and heading structure support one existing
split target, two boundary-review targets, and four exact no-ops rather than a
threshold-only rewrite:

| Note | Observer / direct lines | Current evidence and disposition |
|------|------------------------:|----------------------------------|
| `agent-architectures.md` | 1709 / 1708 | **Boundary review warranted, but no inline split.** The old 1,200-line re-review threshold has been exceeded. The note has eight level-two and 59 level-three headings; the most recent source publication was 2026-09-24. A later isolated pass should map the large nested catalog and inbound fragments before choosing a lossless companion boundary. Line count alone does not authorize moving a published interface. |
| `agent-evaluation.md` | 2962 / 2961 | **Existing split target remains current.** The count is unchanged from the October 4 review and no source publication has touched the note since 2026-10-02. The already identified `Durable Patterns` catalog remains the next isolated extraction target, with exact heading-level forwarding links required across its 48-file reference surface. Repeating that move inside this multi-signal review would be unsafe and duplicate the recorded plan. |
| `agent-protocols-mcp-a2a.md` | 1371 / 1370 | **Boundary review warranted, but no line-count split.** The comparison note has ten level-two and 35 level-three headings; its last source publication was 2026-09-27. The long §8 MCP-spec follow-through is a plausible companion candidate, but its comparison and deep-link value must be mapped before extraction. |
| `agent-runtime-hardening.md` | 833 / 832 | **No-op.** The verified 2026-10-03 extraction already returned the parent close to threshold. Its 32 level-two patterns remain a runtime-hardening catalog, the companion handoff is intact, and no later source publication changed it. |
| `agent-runtime-verdict-integrity.md` | 978 / 977 | **No-op.** The note has 21 level-two studies and only one level-three follow-up; its latest source publication was 2026-09-30. No cohesive second-companion block is established by the current structure. |
| `agent-security-defense-architectures.md` | 1128 / 1127 | **No-op.** The count and content are unchanged since the September 18 recurrence review. Existing forwarding sections already distribute enforcement and research-frontier material; another move still requires an inbound-link and duplication review, not a repeated size response. |
| `agent-security-enforcement-evidence.md` | 1980 / 1979 | **No-op.** The count is unchanged from October 4 and the note has received no later source publication. Its 21 level-two studies and 11 distributed follow-ups still do not define a verified second-companion boundary. |

No child assignment is created. The standing maintenance task already owns the
isolated evaluation split and can separately freeze architecture or protocol
boundaries after reference mapping; creating parallel tasks from the same size
facts would duplicate project work.

## Recurrence review — 2026-10-15 (logs, ledgers, and governance notes)

A second October 15 packet named eight notes already covered by the September 18
review and reported an unchanged 195-entry unsourced backlog. Direct `wc -l`
measurements were again one below the observer's physical-line convention. The
new evidence supports two refreshed boundary dispositions and six exact no-ops:

| Note | Observer / direct lines | Current evidence and disposition |
|------|------------------------:|----------------------------------|
| `agent-security-event-log.md` | 1320 / 1319 | **No-op.** The count is unchanged from September 18. Its 16 level-two narratives remain a chronological security-event log, and no source publication has changed it since September 25. |
| `agent-security-governance.md` | 1412 / 1411 | **Boundary mapping warranted, but no inline split.** The note has 16 level-two sections and has not changed since September 24. Sections 6–14 now form a plausible authority-and-composition companion, extending the earlier sections 6–12 candidate with signed identity, authorization continuity, and effect-gate material. Before extraction, compare overlap with the existing defense and state-level-governance companions and preserve inbound fragments. |
| `hn-agent-operational-memory.md` | 1298 / 1297 | **Retain the published path.** The note grew after September 18 through source-grounded context-integrity and compaction patterns, most recently on October 3. Its existing extraction log already delegates the comprehension-cliff arc, while the current parent remains the operational-memory canon plus a long tracking tail. A later cleanup may compact stale tracking items, but the size signal alone does not establish a lossless companion boundary. |
| `the-oversight-inversion.md` | 2056 / 2055 | **No-op; existing boundary plan remains current.** Only 50 lines were added since September 18, and the note has not changed since September 22. The previously mapped `Verification Harness` block at roughly lines 730–1844 remains the isolated review target; repeating that mapping or moving it inside this multi-signal pass would add risk without new evidence. |
| `xhs-prediction-tracker.md` | 966 / 965 | **No-op.** The count is unchanged. Its status table, scan updates, and prediction history remain one cross-referenced tracker. |
| `xhs-scan-log-june2026.md` | 1989 / 1988 | **No-op.** The count is unchanged. This is a closed chronological June archive whose last publication was August 12. |
| `xhs-seed-ledger.md` | 2873 / 2872 | **No-op.** The count is unchanged. Cycle order, access-boundary evidence, and reconciliation history are the ledger's useful structure; its last publication was September 9. |
| `xhs-topic-map.md` | 18182 / 18181 | **No-op without opening or rewriting the large artifact.** The count and September 9 last-publication boundary are unchanged. App policy reserves this living ranked map for choosing unresolved questions or a separately scoped structural review, neither of which this packet requests. |

`INDEX.md` still contains exactly 195 `Not yet sourced` markers, matching the
observer's `delta: 0` after 64 unchanged windows. The backlog is not growing, so
this pass does not repeat the September five-entry metadata batch or bulk-edit
markers merely to lower a metric. A future evidence-checked batch remains useful
when a source-review pass identifies exact entries; no capacity blocker or child
assignment is created from an unchanged count.

## Current summary

The previously recommended diagnostic-layers and runtime-hardening splits are
complete. `agent-evaluation.md` remains the clearest next isolated split target;
`agent-architectures.md`, `agent-protocols-mcp-a2a.md`, and now
`agent-security-governance.md` merit boundary mapping, not immediate movement.
The oversight verification-harness boundary remains mapped for an isolated
review. Other oversized signals are format-appropriate logs, trackers, ledgers,
or notes with current evidence-backed no-op dispositions. The unsourced backlog
is stable at 195 after the earlier evidence-checked batch, so no threshold-only
or metric-only rewrite is warranted.
