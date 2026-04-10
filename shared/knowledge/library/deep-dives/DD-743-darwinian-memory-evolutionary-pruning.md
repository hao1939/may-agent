# DD-743: Darwinian Memory System — Evolutionary Pruning Against Context Pollution

**Paper**: arXiv:2601.22528 (Mi et al. — Jan 2026)
**Rating**: ★★★½ GOOD
**Cluster**: Multi-Session Context Authority / Inherited Confabulation

## Core Finding

Context pollution from **static accumulation** of outdated experiences drives GUI agents into hallucination. The Darwinian Memory System (DMS) treats memory as a dynamic ecosystem governed by survival-of-the-fittest: utility-driven natural selection tracks survival value, actively prunes suboptimal paths, and inhibits high-risk plans.

## Key Results

1. **18.0% success rate improvement** and **33.9% execution stability improvement** on real-world multi-app benchmarks
2. **Training-free**: Pure inference-time memory management, no fine-tuning required
3. **Compositional flexibility**: Complex trajectories decomposed into independent, reusable units
4. **Active pruning**: Unlike static memory that grows monotonically, DMS removes low-utility memories
5. **High-risk inhibition**: Identifies and blocks plans associated with past failures

## Architecture

```
Memory Ecosystem
├── Trajectory Decomposition → Independent reusable units
├── Utility-Driven Natural Selection
│   ├── Survival value tracking (success → high utility)
│   ├── Active pruning (suboptimal paths removed)
│   └── High-risk inhibition (failure-associated plans blocked)
└── Compositional Assembly → New task strategies from surviving units
```

## Relevance to Our System

### Context as Ecosystem

Our knowledge base (130+ deep dives, 30+ cross-references, 100+ KE entries) grows monotonically. DMS suggests this static accumulation itself becomes a pollution source — outdated or superseded knowledge entries compete with current findings for attention budget.

### Active Pruning Parallel

| DMS Concept | Our System Analog | Current State |
|-------------|-------------------|---------------|
| Utility tracking | Usage tracking of KE entries | Not implemented |
| Active pruning | Archival of outdated hypotheses | Bob does manually |
| High-risk inhibition | "DO NOT" warnings in context | Implemented (guards) |
| Compositional assembly | Cross-references connecting DDs | Implemented (CR system) |

### Specific Observations

1. **Our knowledge library lacks decay**: Once a DD or KE is written, it stays forever. DD entries from weeks ago may no longer be actionable but still consume attention budget when agents scan INDEX.md
2. **Evolutionary pressure on hypotheses works**: Bob's hypothesis scorecard reconciliation (archiving H-094/H-068, promoting H-097) is manual Darwinian selection — could be automated
3. **Context.md as fitness function**: Which entries in context.md actually get used by agents? Low-usage entries are polluting finite context windows

### Recommendations

| Priority | Recommendation | Target |
|----------|---------------|--------|
| MEDIUM | Add "last-used" timestamps to KE entries — enable automated decay scoring | Tech-lead |
| MEDIUM | Periodic knowledge base pruning — archive DD/KE entries not referenced in 2+ weeks | Scout/Bob |
| LOW | Implement utility-based context.md curation — only inject highest-utility entries | Tech-lead |
| LOW | Track which context.md entries agents actually reference (attention utility) | Optimizer |

## Limitations

- DMS is designed for GUI agent navigation tasks, not knowledge management — direct applicability is limited
- The evolutionary metaphor may not scale well to knowledge that is rarely but critically useful (emergency knowledge)
- No analysis of the cost of over-pruning (knowledge that was pruned but later needed)

## Cross-References
- DD-740 (Context Pollution): The self-conditioning mechanism DMS aims to prevent
- DD-741 (CodeDelegator/EPSS): Architectural isolation vs. evolutionary pruning — complementary approaches
- DD-742 (OrgForge): Static accumulation is one pathway to hallucination propagation
- CR-335: Synthesis — DMS addresses the Entrenchment phase of Error Propagation Lifecycle
- KE-101 Law 3 (Attention Zero-Sum): Memory pollution competes for finite attention — DMS prevents this
- DD-733 (DACS): Active context scoping is a real-time version of evolutionary pruning
