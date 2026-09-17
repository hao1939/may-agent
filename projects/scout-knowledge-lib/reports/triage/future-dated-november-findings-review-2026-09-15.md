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

## Remaining observable batch

Nine future-dated paths remain and require content-by-content identity reconciliation rather than blind renaming:

- `knowledge/findings/2026-11-12-arxiv-agent-triage.md`
- `knowledge/findings/2026-11-13-hn-scan-278.md`
- `knowledge/findings/2026-11-14-hn-scan-279.md`
- `knowledge/findings/2026-11-15-arxiv-scan-283.md`
- `knowledge/findings/2026-11-15-hn-scan-280.md`
- `knowledge/findings/2026-11-15-hn-scan-282.md`
- `knowledge/findings/2026-11-16-hn-scan-284.md`
- `knowledge/findings/2026-11-17-hn-scan-285.md`
- `knowledge/findings/2026-11-18-hn-scan-286.md`

The arXiv item already has multiple July candidates with overlapping paper IDs, and the later HN scan numbers also have July candidates. Those collisions make a bulk filename rewrite unsafe. The next smallest batch should reconcile scans 278 and 279 against their July candidates, preserving any content-distinct observations.
