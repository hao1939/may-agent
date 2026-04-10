# DD-742: OrgForge — Hallucination Propagation in Multi-Agent Chains

**Paper**: arXiv:2603.14997 (Flynt — Mar 2026, v2 Apr 2026)
**Rating**: ★★★★ EXCELLENT
**Cluster**: Multi-Session Context Authority / Inherited Confabulation

## Core Finding

**"Chaining propagates fabricated facts faithfully across documents without correcting them."**

OrgForge is a multi-agent simulation framework for generating synthetic corporate corpora, but its most important finding for our work is the empirical demonstration that when LLM agents are chained (output of Agent A feeds Agent B), **fabricated facts propagate without correction** — and each document in the chain looks locally plausible while systemic consistency fails silently.

## Key Results

1. **0.46 absolute improvement** in prose-to-ground-truth fidelity when using deterministic event bus vs. chained LLM generation
2. **Physics-cognition boundary**: Deterministic Python engine maintains ground truth (SimEvent bus) while LLMs generate only surface prose — the critical architectural insight
3. **15 interleaved artifact categories** traceable to shared immutable event log
4. **Consistent hallucination failure mode**: fabricated facts propagate faithfully across documents — the chain amplifies, never self-corrects

## Mechanism: Faithful Propagation of Fabrication

```
Agent A generates Document 1 → contains fabricated fact F
  ↓
Agent B reads Document 1 → treats F as ground truth  
  ↓
Agent B generates Document 2 → includes F, adds detail F'
  ↓
Agent C reads Documents 1+2 → F now appears in TWO sources  
  ↓
Agent C generates Document 3 → F is now "well-established"
```

The chain doesn't just propagate — it **legitimizes**. Each step adds local plausibility while systemic consistency degrades invisibly.

## Relevance to Our System

### Direct Parallel: Inherited Confabulation

Our system exhibits exactly this pattern:
1. **Coach confabulated** "coder is not a registered agent" (Session 597/EXP-118)
2. **Scout inherited** the claim → demoted research priorities, wrote CR#333 invalidation
3. **May independently verified** the claim was false → full cascade reversal

This is OrgForge's mechanism in our system: fabrication propagated faithfully, was treated as increasingly authoritative at each step, and was only caught by independent ground-truth verification (May checking the actual agent registry).

### The Physics-Cognition Boundary Principle

OrgForge's solution — a deterministic event bus as ground truth — maps to our system's need for:
- **Machine-verified evidence** (grep/wc output) vs. agent-generated claims
- **Structural verification** (file exists, test passes) vs. verbal assertions
- **Independent audit** (AEGIS pattern from DD#698) vs. chain-internal validation

### Specific Recommendations

| Priority | Recommendation | Target |
|----------|---------------|--------|
| HIGH | All cross-agent claims should be verified against ground truth, not inherited at face value | Tech-lead |
| HIGH | Compaction should flag claims as "verified" or "unverified" — don't let unverified claims look equivalent to verified ones | Tech-lead |
| MEDIUM | Implement "physics-cognition boundary" for our knowledge base — KE entries should link to machine-verified evidence, not just agent assertions | Bob |
| LOW | Track fabrication propagation metrics across agent handoffs | Bob |

## Limitations

- OrgForge is a document generation framework, not a software engineering agent system — the "chain" dynamics may differ
- The 0.46 improvement is measured against chained LLM baselines, which may not reflect our compaction architecture
- No analysis of mitigation beyond the deterministic event bus (what about partial verification?)

## Cross-References
- DD-740 (Context Pollution): Self-conditioning mechanism — fabrication enters context and gets amplified
- DD-741 (CodeDelegator/EPSS): Isolation prevents cross-contamination
- DD-743 (Darwinian Memory): Evolutionary pruning removes low-utility (potentially fabricated) memories
- CR-335: Synthesis — Error Propagation Lifecycle
- DD-698 (AEGIS): Independent audit agent with veto — addresses the verification gap OrgForge identifies
- KE-099/KE-100 (EXP-103): Machine-verified evidence as ground truth — our version of the physics-cognition boundary
- Session 599 meta-observation: Live instance of OrgForge's faithful propagation mechanism
