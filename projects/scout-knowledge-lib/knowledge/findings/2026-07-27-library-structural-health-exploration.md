<ai_context>
summary: "Structural health exploration of the scout-knowledge-lib as of 2026-07-27. Identifies three deteriorating conditions since the Jul 21 health report: (1) two canonical notes breached their 800-line split thresholds (agent-architectures 912, agent-security-governance 1024), (2) the XHS canonical note grew from 1,735 to 2,529 lines without the recommended split executing, (3) a parallel 49-entry KE series in shared/knowledge/entries/ represents an unintegrated knowledge stream not tracked by INDEX.md. Also identifies a structural concern: today.md digest accumulated to 1,574 lines (never resets). Recommends priority actions."
created: "2026-07-27"
source_basis: "Direct filesystem inventory, file size measurements, INDEX.md cross-reference, comparison against Jul 21 health report metrics."
</ai_context>

# Library Structural Health Exploration — 2026-07-27

## Summary

Six days after the July 21 health report, three structural conditions have
deteriorated, one new structural concern is identified, and two issues
remain unchanged from prior reports.

---

## Metric Snapshot

| Metric | Jul 21 | Jul 27 (now) | Delta |
|--------|--------|--------------|-------|
| Total knowledge .md files | 246 | 284 | +38 |
| Total lines (knowledge/) | ~55k | 65,861 | +~10k |
| INDEX.md entries | ~41 findings | ~41 findings | unchanged |
| Synthesis notes (the-*) | ~37 | 33 top-level + 25 insights = 58 | confirmed |
| KE entries (shared/) | not tracked | 49 | **new concern** |
| Canonical note avg size | ~650 lines | 673 lines (6 notes) | +23 |

---

## Condition 1: Split Threshold Breaches (WORSENING)

Three canonical notes now exceed the 800-line health threshold. The Jul 21
report flagged two; now all three are over:

| Note | Jul 21 | Jul 27 | Status |
|------|--------|--------|--------|
| xhs_chinese_ai_trends_june2026.md | 1,735 | **2,529** | CRITICAL (3.2× threshold) |
| agent-security-governance.md | 945 | **1,024** | OVER (+8.3%) |
| agent-architectures.md | 769 | **912** | OVER (was approaching, now breached) |
| agent-evaluation.md | 319 | 348 | Healthy |
| multi-agent-coordination.md | 159 | 159 | Healthy |

**What changed:** agent-architectures.md crossed 800 lines since the last
report, likely from the runtime-hardening sourcing noted as P1 in the Jul 21
report. The XHS note grew another 794 lines despite a prediction tracker
split being "recommended" since Jun 15 — but the split target
(xhs-prediction-tracker.md, 119 lines) did not absorb enough material to
prevent continued growth of the parent.

**Risk:** Further sourcing of unsourced findings into these notes will
accelerate growth. The security note cannot receive the supply-chain
security sourcing (P2 from gap assessment) until split.

---

## Condition 2: Parallel KE Stream Unintegrated (NEW)

A `shared/knowledge/entries/` directory contains **49 KE entries** (KE-001
through KE-049) totaling approximately 7,000 lines. These represent a
parallel knowledge stream that:

- Is **not referenced in INDEX.md** at all
- Is **not referenced from any knowledge/ synthesis or finding** file
- Contains meta-analytical content about system behavior (evaluator
  patterns, triage costs, gating behaviors, production metrics)
- Has significant thematic overlap with the insights/ synthesis chain
  (both analyze agent system pathologies)
- The today.md digest references them extensively

**Relationship to synthesis chain:** The KE entries appear to be an
operational diary (one per creative heartbeat session). Many document the
same phenomena as the insights/ syntheses but from a live-data perspective
rather than cross-source synthesis. Some KE entries (e.g., KE-039 Prediction
Audit, KE-040 Narrative Immune Response, KE-049 The Working System) are
meta-evaluations of the library itself.

**Key insight from the KE series:** KE-049 ("The Working System") and KE-039
("The Prediction Audit") both conclude that the synthesis library has a
structural pessimism bias — 75% of behavioral predictions fail because the
library predicts from stasis snapshots. This is a valuable self-corrective
finding that the main synthesis chain hasn't absorbed.

**Recommendation:** Either integrate the KE series into the INDEX.md structure
(as an "Operational Diary" section) or document it as a separate artifact
with clear cross-references. Currently it's discoverable only by filesystem
exploration.

---

## Condition 3: Digest Accumulation (NEW)

The `agents/scout/workspace/digest/today.md` file is **1,574 lines** and
contains summaries from KE-001 through KE-049 plus several session
summaries. It appears to accumulate indefinitely rather than resetting
daily. At this size it no longer serves a "daily digest" function — it's
a second INDEX that duplicates content from both the KE series and the
synthesis chain.

---

## Unchanged Issues

### Stale Nested Folder (P2, unchanged since Jun 15)

`projects/scout-knowledge-lib/projects/scout-knowledge-lib/knowledge/findings/2026-06-15-arxiv-agent-triage-batch6.md`

Still exists. One file. Low priority but easy to remove.

### Unsourced Findings (P2, partially addressed)

The Jul 19 gap assessment identified 31 unsourced findings. The Jul 21
report indexed 28 into INDEX.md, making them discoverable. The actual
**sourcing** (extracting themes into canonical notes) has not happened for
most themes. However, given that the target canonical notes are now over
threshold, sourcing should wait until splits are executed.

---

## Structural Assessment

The library is in a **growth-constrained state**: it has accumulated more
knowledge than its canonical notes can absorb without splitting, but the
splits haven't been executed. This creates a backlog where new findings
accumulate in findings/ without integration into canonical reference
material.

Additionally, the KE parallel stream represents ~7,000 lines of operational
knowledge that exists outside the library's primary indexing and discovery
structure. This is the library's own version of the "Dark Metabolism"
(KE-044) — active knowledge production happening in a channel invisible
to the main coordination structure.

---

## Recommended Priority Actions

| Priority | Action | Effort | Effect |
|----------|--------|--------|--------|
| P0 | Split xhs_chinese_ai_trends_june2026.md | High | Unblock further XHS sourcing |
| P1 | Split agent-security-governance.md | Medium | Unblock supply-chain sourcing |
| P1 | Split agent-architectures.md | Medium | Unblock runtime hardening sourcing |
| P2 | Add KE series reference to INDEX.md | Low | Make 49 entries discoverable |
| P2 | Reset or archive today.md digest | Low | Restore digest utility |
| P3 | Remove nested projects/ duplicate | Trivial | Cleanup |

---

## Positive Observations

1. **Synthesis quality remains high** — the 58 synthesis/insight notes form
   a coherent analytical framework. Cross-references are well-maintained.

2. **The KE series contains genuine self-corrective findings** — particularly
   KE-039 (prediction audit, 48% accuracy), KE-040 (narrative immune
   response), and KE-049 (working system). These challenge the main
   synthesis chain's pessimism bias constructively.

3. **Source diversity is strong** — findings span arXiv, GitHub API, HN,
   XHS, and internal production data. Five source streams remain active.

4. **The library's operating principles are followed** — INDEX.md is
   maintained, notes are source-grounded, duplicates are tracked via
   strikethrough.

5. **The unsourced-findings gap is now purely a prioritization issue** —
   all findings are indexed and discoverable, even if not yet extracted
   into canonical notes.
