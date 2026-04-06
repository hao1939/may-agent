# External Validation: YC-Bench Confirms Three Core Findings

**Date**: 2026-04-06  
**Author**: Bob (Architect)  
**Sources**: HB-0140 (YC-Bench), H-080, KE-002, KE-007, KE-020, H-055, H-053, H-043, WKWA-004  

---

## The Convergence

YC-Bench (HB-0140) is a 1-year startup simulation testing 12 frontier models on long-horizon coherence. Its findings independently validate three of our most confident knowledge entries — from a completely different domain, with different models, at different scale.

This is the strongest external validation our knowledge base has ever received.

## Finding 1: Text Rules Don't Fix Judgment (KE-002 + H-055)

**Our claim** (KE-002, P(H)=verified): "Text rules don't fix judgment failures. 0/20 experiments."

**YC-Bench evidence**: Claude Sonnet 4.6 — "The Broken Genius"
- Writes perfect feasibility formula at Turn 7
- Ignores it at Turn 8
- Writes "one task at a time" rule
- Averages **7.23 concurrent tasks** (max 16!)
- Result: Bankrupt in 2/3 runs

**Why this matters**: Sonnet's behavior is an independent, large-scale demonstration of exactly what we found in 20+ experiments. The agent can articulate correct rules (cosmetic self-improvement, H-055), but **articulating ≠ following**. The fact that this appears in a completely different benchmark, with a different model, at a different task horizon, elevates KE-002 from "local finding" to "general principle of LLM agent architecture."

**Implication**: Any system that relies on agents writing rules for themselves to follow is building on sand. This isn't a Claude-specific issue — it's structural.

## Finding 2: Explicit Structure Beats Passive Context (KE-007 + KE-020)

**Our claim** (KE-007, verified): "Workflow enforcement is the only reliable behavioral intervention."  
**Our claim** (KE-020, verified): "Adoption hierarchy: Available (0%) < Instructed (4-10%) < Automatic (100%)."

**YC-Bench evidence**: Scratchpad usage as the key differentiator
| Model | Scratchpad Writes/100 Turns | Outcome |
|-------|----------------------------|---------|
| GPT-5.4 | 10.6 | Top 3 |
| Claude Opus 4.6 | 5.6 | Top 3 |
| Gemini 3.1 Pro | 0.0 | Bankrupt 2/3 |

**The pattern**: Models that **explicitly write to structured memory** succeed. Models that rely on passive context window accumulation fail. This maps directly to our adoption hierarchy:
- Scratchpad = Automatic (forced write/retrieve)
- Context window = Available (passive, often skipped)
- Opus's "inspect before accept" protocol = a self-imposed workflow (KE-007)

**Opus's winning strategy**: Rewrite scratchpad 34 times per run. Evolve through 4 strategic phases. Inspect every task before accepting (155 inspections/run). This is **workflow enforcement without a harness** — the model imposes structure on itself. But critically, only 3/12 models can do this. For the other 9, the structure must be imposed externally.

**Implication**: Our finding that explicit wiring beats availability (KE-020) applies not just to our multi-agent system but to any agent architecture. The 9 models that fail are the norm. The 3 that succeed are anomalies capable of self-imposed discipline.

## Finding 3: Memory Architecture Determines Long-Horizon Success (H-043 + WKWA-004)

**Our claim** (H-043, P(H)=0.62): "Knowledge utilization = P(exists) × P(access) × P(applies)."

**YC-Bench coherence pipeline**: perceive → record → retrieve → act

**Mapping to our framework**:
| YC-Bench Stage | Our Framework | Failure Example |
|----------------|---------------|-----------------|
| Perceive | P(exists) — knowledge must be generated | Gemini Flash: never reflects |
| Record | P(exists) × write discipline | All low-scratchpad models |
| Retrieve | P(access) — must be accessible when needed | Context truncation after 20 turns |
| Act | P(applies) — must change behavior | Sonnet: retrieves rules, ignores them |

YC-Bench's four failure modes map perfectly to breakdowns at different stages of H-043's utilization pipeline. Each failing model demonstrates what happens when one specific factor goes to zero:
- **Gemini Flash**: P(exists) ≈ 0 (no reflection, no recording)
- **Grok**: P(applies) ≈ 0 (reflects accurately, does nothing)
- **Sonnet**: P(applies) ≈ 0 (writes correct rules, ignores them — different mechanism than Grok)
- **Gemini Pro**: P(exists) = 0 (zero scratchpad writes)

**Implication**: H-043's multiplicative model is validated by an independent source. Any factor going to zero kills the entire pipeline, regardless of how strong the other factors are.

## Triage: H-080 and H-081 (Moratorium)

Both H-080 and H-081 were generated from this weekend's research. Under the active moratorium ("no new hypotheses until 5 more are resolved"), they need triage:

### H-080 (Explicit Memory > Passive Context)
**Verdict: MERGE → H-043 + WKWA-004**

H-080's core claim — "explicit memory write/retrieve outperforms passive context accumulation" — is already covered by:
- H-043 (knowledge utilization bottleneck, P(access) factor)
- KE-020 (adoption hierarchy: Available < Instructed < Automatic)
- WKWA-004 (memory control loop synthesis)

The YC-Bench evidence should be added to H-043 and WKWA-004 as external validation, not filed as a separate hypothesis. The "5-50x" claim is dramatic but tests a different system — what matters for us is whether our system exhibits the same pattern (it does, per KE-020).

### H-081 (Autoresearch Pipeline)
**Verdict: RECLASSIFY → design-proposals/**

H-081 isn't a hypothesis — it's a design proposal for autonomous optimization. Its core claim ("bug fixes > hyperparameter tuning") is interesting but not testable in our current system. Reclassify to `hypotheses/design-proposals/H-081-autoresearch-agent-optimization.md` as a future architecture idea.

**However**: Omni-SimpleMem's finding that bug fixes contribute +175% while hyperparameter tuning contributes less is worth noting as a research insight. It validates our approach of focusing on structural/workflow changes (KE-007) rather than incremental tuning.

## Meta-Observation

This is the third consecutive weekend where external research validates our internal findings:
1. **Week of Mar 24**: EvoSkills, SEVerA, Hermes all confirm "external mechanisms beat self-directed improvement" (H-055)
2. **Week of Apr 4**: CR-289 Agent OS stack confirms our 5-layer architecture intuition
3. **Apr 5-6**: YC-Bench confirms KE-002 (text rules fail), KE-007 (structure works), H-043 (multiplicative utilization)

**The pattern**: Our knowledge base is converging with the external research frontier. The claims we've verified through 30+ experiments are the same claims emerging independently from benchmarks, papers, and production systems. This increases confidence in our theoretical framework and suggests we're working on the right problems.

---

*Actionable next: Add YC-Bench citations to H-043, KE-020, and KE-002. Move H-080 evidence into H-043. Move H-081 to design-proposals/.*
