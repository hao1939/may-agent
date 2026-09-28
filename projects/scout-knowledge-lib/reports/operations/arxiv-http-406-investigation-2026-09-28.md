# arXiv HTTP 406 Investigation — 2026-09-28

## Decision

**Do not prepare a code candidate.** Keep the existing bounded policy—one primary
request and at most one smaller same-source fallback—without extra retries, and
let the next ordinary scheduled run test recovery. The current evidence does
not identify a reliable request adjustment that restores recent, relevant
inventory: the exact primary and fallback still fail, while only unrelated or
identity-specific controls succeed.

This is a **selective arXiv API search failure**, not evidence of a whole-site,
DNS, TLS, or general egress outage. The public export host, a known paper lookup,
an unrelated simple search, and the main arXiv abstract page were reachable from
the same environment. However, the evidence cannot distinguish an arXiv search
backend fault, edge/cache behavior, or another server-side request-selection
rule. HTTP 406 with an empty body provides no diagnostic explanation.

## Required history reviewed

The current `explore-arxiv` Task and its latest four accepted attempts were read
before probing. At 00:03, 04:01, 08:00, and 12:02 UTC on 2026-09-28, both the
20-result agent/agentic primary and six-result `all:agent` fallback returned HTTP
406 with zero-byte bodies. All four runs correctly made no library change.

Attempt `r_2_49c558a2-6f5d-4d96-807f-d5ff10171b6f` was also reviewed. On
2026-09-27 at 22:28 UTC it found that exact retries, header variants,
`max_results=31`, and nonzero-offset pagination did not help; start-zero queries
with 20 and six results did work then. Those disproved variants were not retried
in this investigation.

## Bounded current observations

Checks ran once per URL with redirects enabled, an 8-second connection timeout,
a 20- or 25-second total timeout, and no retry. All export-host responses used
remote address `146.75.115.42`; the main arXiv page used `151.101.195.42`.

| URL | Status | Body bytes | Interpretation |
|---|---:|---:|---|
| `https://export.arxiv.org/` | 200 | 38,051 | Export host is reachable. |
| `https://export.arxiv.org/api/query` | 406 | 0 | A parameterless query is rejected; this is not a valid discovery request. |
| `https://export.arxiv.org/api/query?id_list=2609.30266` | 200 | 2,747 | API route and known-ID retrieval work. One Atom entry returned. |
| `https://export.arxiv.org/api/query?search_query=all%3Aelectron&start=0&max_results=1` | 200 | 2,938 | A simple search query can return Atom. |
| `https://arxiv.org/abs/2609.30266` | 200 | 41,128 | Main-site paper access works. |
| `https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending` | 406 | 0 | Exact current primary still fails. |
| `https://export.arxiv.org/api/query?search_query=all%3Aagent&start=0&max_results=6&sortBy=submittedDate&sortOrder=descending` | 406 | 0 | Exact current fallback still fails. |
| `https://export.arxiv.org/api/query?search_query=all%3Arobot&start=0&max_results=6&sortBy=submittedDate&sortOrder=descending` | 406 | 0 | Failure is not specific to the word `agent`. |
| `https://export.arxiv.org/api/query?search_query=all%3Aelectron&start=0&max_results=1&sortBy=submittedDate&sortOrder=descending` | 406 | 0 | The sorted variant failed after the unsorted simple query worked; caching or time remains a confounder. |
| `https://export.arxiv.org/api/query?search_query=%28cat%3Acs.AI%20OR%20cat%3Acs.MA%20OR%20cat%3Acs.CL%29%20AND%20%28all%3Aagent%20OR%20all%3Aagentic%29&start=0&max_results=20` | 406 | 0 | Removing sort alone does not recover the complex primary. |
| `https://export.arxiv.org/api/query?search_query=all%3Aagent&start=0&max_results=6` | 406 | 0 | Removing sort alone does not recover the relevant fallback. |

The controls rule out a blanket source or egress outage. They also show that
`sortBy`/`sortOrder` is one failing dimension, but not the only one. A cached or
selectively healthy simple query cannot establish general search health. No
response body, request ID, or server diagnostic was available, so a more
specific root cause would be speculation.

## Coverage impact

The last full accepted discovery inventory was a 30-item `cs.AI` feed at
2026-09-27 16:01 UTC. A six-item recovery at 20:01 returned the same leading six
IDs, and the 22:28 investigation again obtained 20- and six-entry feeds. The
four later scheduled scans all failed, and the current relevant probes failed.
Therefore:

- no specific new paper or useful finding is **demonstrably** missed;
- recent inventory after the 22:28 successful probe is unknown;
- known-ID retrieval does not repair discovery coverage;
- using the successful unrelated `all:electron` query would be source-topic
  substitution, not a compliant recovery.

## Options

| Option | Benefit | Cost and risk | Decision |
|---|---|---|---|
| Keep one primary plus one fallback at the ordinary cadence | Preserves bounded recovery detection and the existing source-integrity contract. | Two failed requests per scheduled run while the incident persists; inventory remains unknown. | **Recommended for now.** Do not add ad hoc retries. |
| Remove sort parameters | Very small client change. | The relevant primary and fallback still returned 406 without sort; unsorted results would also weaken recency semantics. | Reject: no reliable recovery. |
| Use `id_list` | Reliable retrieval for already-known paper IDs. | Cannot discover new inventory and would falsely imply restored coverage. | Retain only for source verification, not discovery. |
| Substitute another simple query | Some Atom data is reachable. | Does not answer the assigned agent-topic discovery question; may be cache-selective. | Reject. |
| Pause or reduce cadence | Avoids repeated low-yield calls. | Requires an owner policy decision and delays detection of recovery; four failed cycles are not proof of permanence. | Not yet justified by this bounded investigation. |
| No change plus extra retries/header variants/pagination | None demonstrated. | Repeats disproved work, increases request load, and risks a retry loop. | Reject. |

## Reassessment trigger and limits

Reassess on the next normal scheduled run, not through polling. A code candidate
would become justified only after a bounded, relevant official-API query shape
reliably returns current ordered inventory and materially improves coverage over
the existing one-fallback policy. This review used direct HTTP behavior and
accepted Task evidence; it did not inspect arXiv server logs, CDN configuration,
or internal incident status, and it does not claim that the successful control
responses were uncached.
