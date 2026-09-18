# Future-dated November findings review — 2026-09-15

## Trigger

The 2026-09-15 owner review found 11 finding filenames dated after the current date. All 11 first appear in commit `a2d3df9f847459d464360835ef2831e95f470e8c`, authored 2026-07-13, so their November observation identities cannot be literal.

## Repaired batch

This pass repaired the two exact duplicate HN aliases with unambiguous July identities:

| Removed false identity | Retained canonical | Evidence |
|---|---|---|
| `knowledge/findings/2026-11-11-hn-scan-276.md` | `knowledge/findings/2026-07-11-hn-scan-276.md` | Files were byte-identical before repair; the scan cites a 2026-07-10 story, and the retained heading now says 2026-07-11. |
| `knowledge/findings/2026-11-12-hn-scan-277.md` | `knowledge/findings/2026-07-12-hn-scan-277.md` | Files were byte-identical before repair; the retained heading now says 2026-07-12. |

A repository-wide Markdown reference search found no incoming links to either removed November path, including the working digest tree. Source URLs, HN IDs, claims, and prose remain in the retained files.

## 2026-09-17 bounded follow-up

The two arXiv paths have unambiguous July counterparts. Commit
`a2d3df9f847459d464360835ef2831e95f470e8c`, authored 2026-07-13, introduced
both November aliases; content comparison showed each differs from its July
counterpart only in date metadata. This pass therefore corrected their internal
observation identities and added an inline link to the retained July finding:

| Published historical path | Verified observation identity | Retained finding |
|---|---|---|
| `knowledge/findings/2026-11-12-arxiv-agent-triage.md` | 2026-07-12 | `knowledge/findings/2026-07-12-arxiv-agent-triage-b.md` |
| `knowledge/findings/2026-11-15-arxiv-scan-283.md` | 2026-07-12 | `knowledge/findings/2026-07-12-arxiv-scan-283.md` |

The false filename dates remain visible because these exact paths are published
interfaces and this maintenance call has no explicit deletion approval. Keeping
the aliases readable avoids breaking retained consumers; their contents now
state the truthful July observation date rather than presenting November as a
real scan date.

## 2026-09-18 HN follow-up

The remaining seven HN aliases and their retained July counterparts were
reviewed as one provenance batch:

| Published historical path | Retained July finding | Scan |
|---|---|---|
| `knowledge/findings/2026-11-13-hn-scan-278.md` | `knowledge/findings/2026-07-12-hn-scan-278.md` | 278 |
| `knowledge/findings/2026-11-14-hn-scan-279.md` | `knowledge/findings/2026-07-12-hn-scan-279.md` | 279 |
| `knowledge/findings/2026-11-15-hn-scan-280.md` | `knowledge/findings/2026-07-12-hn-scan-280.md` | 280 |
| `knowledge/findings/2026-11-15-hn-scan-282.md` | `knowledge/findings/2026-07-12-hn-scan-282.md` | 282 |
| `knowledge/findings/2026-11-16-hn-scan-284.md` | `knowledge/findings/2026-07-12-hn-scan-284.md` | 284 |
| `knowledge/findings/2026-11-17-hn-scan-285.md` | `knowledge/findings/2026-07-12-hn-scan-285.md` | 285 |
| `knowledge/findings/2026-11-18-hn-scan-286.md` | `knowledge/findings/2026-07-12-hn-scan-286.md` | 286 |

Commit `a2d3df9f847459d464360835ef2831e95f470e8c` introduced all seven
November aliases on 2026-07-13. Before repair, six pairs were byte-identical;
scan 282 differed only because its July counterpart already stated the correct
2026-07-12 observation date. Every finding now states 2026-07-12 internally.
Each historical path also records why its filename is false and links directly
to its retained July finding. Six July files whose bodies still repeated the
false November date were corrected as part of the same batch; scan 282 needed no
canonical-file date correction.

No file was deleted or renamed. Source URLs, HN scan IDs, claims, and prose were
preserved. The false November filenames remain observable because the paths are
published interfaces, but they no longer assert a future observation inside the
finding.
