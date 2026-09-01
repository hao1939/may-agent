<ai_context>
summary: "Living reconciliation ledger for the human's collected Xiaohongshu seed set. It records observation boundaries and seed deltas without treating retained Scout XHS records as proof of collection membership."
triggers: ["XHS collected posts", "XHS seed reconciliation", "human collection", "seed ledger", "Xiaohongshu collection changes"]
last_updated: "2026-09-01"
source_basis: "Observational XHS browser preflights and accepted Scout repository inventories at 2026-09-01T09:53:22Z and 2026-09-01T10:00:06Z."
</ai_context>

# Xiaohongshu Human-Collection Seed Ledger

This is the comparison surface for the human's collected Xiaohongshu posts.
Only a post observed on the human-collection surface may be marked as a
confirmed seed. Search results, feed results, and existing Scout notes remain
useful evidence, but do not prove collection membership.

## Current reconciliation state

| Field | State |
|---|---|
| Observation time | 2026-09-01T10:00:06Z |
| Current direct collection snapshot | **Unobserved** |
| Prior goal-owned collection snapshot | 2026-09-01T09:53:22Z, also unobserved |
| Confirmed new / changed / removed seeds | Unknown / unknown / unknown |
| Removal policy | No post is marked removed while the collection surface is unobservable |

The repository-native observational preflight
`node agents/scout/tools/xhs-browse.mjs status` ran in the goal-owned worktree
and failed before any XHS page or credential check: `connect ECONNREFUSED
127.0.0.1:9222`. A Chrome process exists outside this worker's network
namespace with `--remote-debugging-port=9222`, but the endpoint is unreachable
through localhost, the container host aliases, and the container gateway. This
worker ran as `uid=1000(hao)`, with no effective Linux capabilities, and cannot
enter that process's network namespace (`nsenter: ... Permission denied`).
Membership in the local `docker` group did not make the endpoint reachable.
Therefore this checkpoint does not know whether the browser session is logged
in and does not reinterpret the failure as an empty collection.

Smallest enabling change: make that existing Chrome DevTools endpoint reachable
inside this worker container, or start an observational Chrome session with an
XHS tab in this worker's network namespace. No credential value needs to be
copied into this repository.

## Retained local XHS evidence (not confirmed seeds)

The accepted repository contains **104 unique stable XHS post IDs** across
**125 URL occurrences in 24 files** under `knowledge/` and `reports/`. The
sorted, token-free ID set has SHA-256 fingerprint
`889d3247e9fd0d7a2772a2901cfa69ff27387de96ea4bf15dfcd21241228d8fb`.
This is a baseline for local source maintenance, not a collection snapshot.

Exact URL repetition is deduplicated by stable post ID. For example:

| Stable post ID | Occurrences | Disposition |
|---|---:|---|
| `6a22e99a000000002202c22d` | 4 | One source; inbox, scan, later scan, and retained trend copy are provenance lineage, not four confirmations. |
| `6a1ec0de0000000038021a31` | 4 | One ICML-memory compilation source; preserve the detailed scan and focused finding, count once. |
| `6a59efef0000000010026a8f` | 2 | One long-horizon survey source used by two differently scoped findings; preserve both scopes, count once. |
| `6a51b2d600000000110115df` | 2 | One proactive-reminding source used by the same two scopes; preserve both scopes, count once. |

This ledger does not collapse materially different analysis merely because it
shares a source. It does prevent repeated storage locations from inflating the
evidence count.

## Cycle-order evidence

This cycle reconciled the seed boundary before discovery. The second XHS
endpoint preflight and local stable-ID inventory completed at
`2026-09-01T10:00:06Z`; the inventory remained 104 IDs with fingerprint
`889d3247e9fd0d7a2772a2901cfa69ff27387de96ea4bf15dfcd21241228d8fb`.
Only after that recorded comparison did the GitHub, arXiv, and Reddit topic
queries begin (`2026-09-01T10:02:47Z`). The selected arXiv paper therefore
cannot be mistaken for a seed or used to retroactively redefine collection
membership.

## Reconciliation protocol for the next readable snapshot

1. Observe the human's collection surface without liking, saving, deleting, or
   otherwise changing account state.
2. Record observation time, stable post ID, visible title/author/date, and the
   evidence scope actually readable. Do not store browser tokens.
3. Compare stable IDs with the preceding readable snapshot. Classify additions,
   metadata changes, apparent removals, and temporarily unavailable posts
   separately.
4. Require a second readable snapshot before treating an absent post as removed
   when pagination, rate limits, or partial rendering could explain absence.
5. Link each confirmed seed to the living topic map and to any derived finding;
   deduplicate by stable ID before interpreting engagement or claims.

## Reconciliation log

| Observed at | Snapshot | New | Changed | Removed | Unavailable | Decision |
|---|---|---:|---:|---:|---:|---|
| 2026-09-01T09:53:22Z | Direct snapshot unavailable | unknown | unknown | unknown | unknown | Preserve collection state as unobserved; continue from explicitly non-seed local evidence. |
| 2026-09-01T10:00:06Z | Direct endpoint preflight still unavailable; local stable-ID fingerprint unchanged | unknown | unknown | unknown | unknown | Seed reconciliation completed before related discovery. Preserve unknown direct state; the arXiv query followed this snapshot and cannot retroactively establish seed membership. |
