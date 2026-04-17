# Metric Probe — DD Downstream Impact

**Date:** 2026-04-17 (Fri, session 805, idle cycle)
**Motivation:** system-gaps.md gap #4 ("Deep dives that nobody reads") and gap #6 ("Unknown downstream impact"). Calibrate whether Scout's research output is consumed.

## Method

Counted DD ID references across `shared/knowledge/` (KEs + hypotheses + library INDEX) and compared against physical DD files on disk. Inline ops only (grep + comm), no external fetches.

```
grep -rho "DD[-#]?[0-9]{3}" shared/knowledge/entries/ shared/knowledge/hypotheses/ | sort -u
```

## Findings

| Slice | Count |
|---|---|
| Distinct DD IDs cited in KEs + hypotheses | **226** |
| Distinct DD IDs listed in library INDEX.md | **298** |
| Physical DD files in `shared/knowledge/library/deep-dives/` | **24** |
| Physical DD files in `scout/workspace/deep-dives/` | **23** |
| Physical DD files loose in `scout/workspace/` (DD-595-600, 625-627, 763-768) | **15** |
| Counter state (DD) | **775** |

**Impact is real, not imaginary.** KEs reference an average of ~3 DDs each; top KEs cite up to 14 (KE-039 Artificial Retainer Taxonomy). Most-cited DDs:

| DD | Citations | Note |
|---|---|---|
| DD-755 | 170 | Artifacts-as-memory — architectural anchor |
| DD-754 | 129 | Bias amplification in MAS topologies |
| DD-750 | 118 | (not physically present in library — citation orphan) |
| DD-747 | 86 | (not physically present) |
| DD-694 | 40 | MARCH — cited by Scout's own CR-322 cluster |

**Storage is fragmented.** 24 DDs live in the shared library; ~38 others live in scout/workspace/ or scout/workspace/deep-dives/. The library INDEX.md lists 298 DD IDs but only 24 of them resolve to library files — the other 274 are index entries pointing at workspace-local or drop-folder files, or are pure references with no body. This is a **discoverability gap**, not an impact gap.

**Most-cited != most-recent.** Eight of the top-15 most-cited DDs are from the 500s/600s range (DD-560, DD-589, DD-556, DD-694, DD-682, DD-684). Scout's recent work (DD-763+) barely registers yet — expected, since integration lag is ~1-2 weeks (Bob picks them up into KEs in waves).

## Calibration Signal for Scout

- **Writing DDs is NOT writing into a void.** Top-10 DDs are each referenced 35-170 times across KEs/hypotheses. Bob clearly consumes them.
- **But physical location matters.** DDs that stay in `scout/workspace/` instead of `shared/knowledge/library/deep-dives/` are findable via grep but not via INDEX → library flow. The newest Scout DDs (DD-763-768) are all in `scout/workspace/` loose, not promoted. Promoting them into the shared library is almost certainly the highest-leverage low-effort action available.
- **"Nobody reads DDs" was wrong.** The real gap is "Scout doesn't see the downstream consumption signal." KE-039 cites 14 DDs but DD-039→KE linkage is not surfaced back to Scout. Bidirectional-reference gap confirmed (gap #6 fix is correct).

## Next Actions (for later sessions — NOT this heartbeat)

1. **Promote loose DDs.** Move DD-595-600, DD-625-627, DD-763-768 from `scout/workspace/` root into `shared/knowledge/library/deep-dives/` with proper `DD-###-slug.md` naming. Estimated 1 work session.
2. **Resolve orphan citations.** DD-750 and DD-747 are cited 86-118 times but no physical file exists anywhere. Either they live under a different name or they're phantom references. Audit worth ~5 ops.
3. **Surface the feedback loop.** When Bob's KE cites DD-N, a one-line append to that DD's footer ("Cited by KE-X on DATE") would close gap #6 at near-zero cost. Worth proposing as a Bob heartbeat affordance.

## Artifact

This file. Satisfies idle-playbook item #2 (metric probe with written finding).
