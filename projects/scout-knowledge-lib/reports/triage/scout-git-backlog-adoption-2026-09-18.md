# Scout Git backlog adoption — 2026-09-18

This batch preserves existing Scout library work that had accumulated outside
Git. It is a historical adoption, not the output of one new exploration and not
a claim that every research conclusion has been independently reproduced.
The separate publication-workflow change is still under implementation review.

## Scope and checks

The reviewed inventory contains 97 untracked Markdown files, 50 modified
Markdown files, and two deleted duplicate aliases. All existing bytes were
preserved; no draft was hidden with an ignore rule and no unrelated App or
runtime files were selected. This report is the only newly authored file in
the adoption batch. Git records the exact adopted paths and bytes.

The 97 additions comprise 92 findings, two companion notes, two health reports,
and one triage report. The inventory had no byte changes between initial capture
and adoption review. All 1,006 relative links in the 147 existing files passed
Scout's link checker. This checks local file targets, not external availability,
fragment anchors, research acceptance, or the entire historical corpus.

A comparison of source URLs in the 50 modified files found removals in only two
reorganized notes. Every removed URL survives in its linked companion:

- [Evaluation beyond outputs](../../knowledge/agent-evaluation-research-beyond-outputs.md)
  points to [diagnostic layers](../../knowledge/agent-evaluation-research-diagnostic-layers.md).
- [Runtime effect integrity](../../knowledge/agent-runtime-effect-integrity.md)
  points to [runtime verdict integrity](../../knowledge/agent-runtime-verdict-integrity.md).

## Reviewed duplicate removals

The deleted November HN scan 276 and 277 aliases were byte-identical in the
previous Git revision to their July counterparts. The retained July files differ
only in their corrected first heading; source URLs and prose remain intact:

- [HN scan 276 — July 11](../../knowledge/findings/2026-07-11-hn-scan-276.md)
- [HN scan 277 — July 12](../../knowledge/findings/2026-07-12-hn-scan-277.md)

The [original triage report](future-dated-november-findings-review-2026-09-15.md)
explains the repair. No current Task resource or any of the 457 readable retained
Scout session results inspected referenced either deleted filename. That is a
bounded check of retained evidence, not a guarantee about expired history.
The report's nine other future-dated findings remain unresolved historical work.

## Evidence and ongoing behavior

The local operator evidence directory is
`/app/.state/review-pilots/scout-commit-results-20260918/backlog-review/`.
It contains the reviewed path/hash manifest, original bytes and the retained
output-reference check. `backlog-links-initial.json` in its parent contains the
link-check result. Git remains authoritative for this batch's committed bytes.

This adoption clears the existing backlog. Reliable publication of future
workflow results must be established by the separately reviewed implementation
and its tests; this cleanup alone does not establish that behavior.
