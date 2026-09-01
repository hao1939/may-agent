<ai_context>
summary: "Checkpoint for the first seed-first XHS research cycle: direct collection observation was blocked at the Chrome endpoint boundary, local retained sources were deduplicated, and the highest-value reliability cluster received a full-paper deep dive."
triggers: ["XHS seed-first checkpoint", "seed reconciliation report", "XHS topic map checkpoint", "coalition skill reliability"]
last_updated: "2026-09-01"
source_basis: "Goal-owned browser preflight, accepted repository inventory, arXiv API discovery, and arXiv 2608.22610v1 full source review on 2026-09-01."
</ai_context>

# XHS Seed-First Research Cycle — 2026-09-01

## What was wrong and what changes

Scout had many retained XHS references but no goal-owned collection snapshot or
living topic map, so repeated URLs could look like independent support and the
human's actual collected posts could not be distinguished from search results.
This checkpoint adds a durable [seed ledger](../../knowledge/xhs-seed-ledger.md)
that preserves unknown state honestly and a [living topic map](../../knowledge/xhs-topic-map.md)
that makes prioritization, connections, confidence, contradictions, and the next
exploration explicit.

## Seed reconciliation

At `2026-09-01T09:53:22Z`, the repository XHS tool could not connect to
`127.0.0.1:9222` from the goal-owned worktree. Chrome is running with that port
in a different network namespace, but localhost, host aliases, and gateway
checks were unreachable and this container identity was denied namespace entry.
The operation failed before a login or collection-page verdict. Consequently:

- the human's collection is **unobserved**, not empty;
- new, changed, removed, and unavailable seed counts are unknown;
- no retained Scout URL was relabeled as a human-collected seed; and
- no absent post was marked removed.

The accepted local library contains 104 unique token-free XHS stable IDs in 125
URL occurrences across 24 files. Repeated IDs now have an explicit policy:
lineage copies and differently scoped analyses may remain, but each stable ID
counts as one source.

## Discovery and deep dive

The fallback rubric ranked self-evolution reliability and evaluation authority
highest at 13/15. A current arXiv API query connected that cluster to
`2608.22610v1`, and the paper's full TeX source—not only its abstract—was
reviewed. The useful addition is that reliability of an evolved skill depends
on its surrounding bank and deployment domain. An aggregate bank gain does not
attribute the gain to the newly admitted skill.

The maintained
[self-improvement note](../../knowledge/findings/2026-07-23-hn-self-improving-agent-loops.md)
now records the paper's controlled results and limits: three seeds, a fixed
judge, one MemSkill-derived framework, a 20-query target probe, one directional
target reversal that is not statistically significant, and code/checkpoints
promised but not yet released.

## Current quality signal

- Provenance: stable XHS IDs, observation time, arXiv ID, and evidence scope are
  explicit; browser tokens and inaccessible post contents are absent.
- Deduplication: 104 unique IDs versus 125 occurrences; exact repeats count
  once while distinct analysis scopes are preserved.
- Uncertainty: collection membership and removal state remain unknown; XHS
  metadata claims remain separated from full-paper claims.
- Validation: 14 targeted library-health tests passed, TypeScript type-checking
  passed, all new relative Markdown links resolved, and `git diff --check`
  reported no whitespace errors.
- Health: the read-only scan returned 24 facts and 16 wake signals at the fixed
  observation time. A separate goal-owned worktree at accepted commit
  `ec317f8456` returned the same fact keys and fingerprints: 13 future-date
  facts, 10 oversized-note facts, and the existing 222-entry unsourced backlog.
  The candidate introduced no new health fact. The packet remains truncated,
  so this is a bounded health comparison rather than a claim of global health.
- Safety: no external account state was changed.

## Next exploration

First, make the existing observational Chrome endpoint reachable from this
worker and reconcile the collection against the seed ledger. If any collected
post concerns evaluator independence, skill banks, self-evolution, or memory
admission, deep-read it before broad search. Independently, watch for the
`2608.22610` code release and test whether coalition-conditioned admission holds
outside its fixed-judge, three-seed setup.
