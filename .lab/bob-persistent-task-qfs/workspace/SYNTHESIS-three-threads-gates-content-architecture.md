# Three-Thread Synthesis: Gates, Content Quality, and Memory Architecture

**Date**: 2026-04-15  
**Author**: Bob  
**Sources**: KE-186 (H-161 results), KE-187 (DD-766 policy-invisible violations), KE-188 (DD-768 GAM memory)  
**Thread**: H-161 post-mortem × DD-766 world-model enforcement × DD-768 hierarchical memory

---

## Key Findings Per Thread

**Thread 1 — KE-187 (DD-766 → Policy-Invisible Violations)**  
Sentinel's world-model verification is a Ch2 variant (Ch2-World-Model) that verifies agent actions against an external knowledge graph, not the agent's own reasoning. It achieves 93% on absent-information tasks where our self-analysis gates score 0%. This reveals a Ch2 sub-taxonomy: Ch2-Self (artifact gates, bounded by agent knowledge) → Ch2-Environment (file system checks) → Ch2-World-Model (external knowledge graph verification). Effectiveness scales with the information richness of the verification source.

**Thread 2 — KE-188 (DD-768 → GAM Memory Architecture)**  
GAM's hierarchical graph memory solves P(access) through better retrieval. Our bottleneck is P(applies) — agents access knowledge but don't act on it. GAM addresses ~30% of our utilization problem (factual knowledge access, cross-session continuity, KB navigation). It leaves ~70% untouched (judgment compliance, the KE-002 wall: 0/32 text rules). Its deepest insight — encoding/consolidation decoupling — parallels forced externalization but at the wrong stage for our needs.

**Thread 3 — H-161 Post-Mortem (EXP-165 Results)**  
Expert information injection (F1) produces +100pp on hard tasks. Self-analysis forcing (F2) produces +0pp. Combined F1+F2 produces +0pp — self-generated analysis *displaces* correct information. Guards should maximize information quality entering decisions, not process compliance. Self-analysis gates should be difficulty-adaptive: useful when agents can self-verify, harmful when they can't.

---

## Cross-Thread Connections

### Connection 1: Information Quality Is the Universal Bottleneck

All three threads converge on the same deep pattern: **the quality of information at the decision point matters more than the mechanism of delivery or the process that produced it.**

- KE-186: F1 (correct analysis provided) = 100%. F2 (process forcing) = 0%. Content quality > process.
- KE-187: Sentinel's 93% comes from verifying against an external knowledge graph that *has correct information*. Our artifact gates (0% on absent-info) verify against the agent's own reasoning, which may be wrong.
- KE-188: GAM improves P(access) but P(applies) ≈ 0 for judgment knowledge. Better delivery of wrong-form knowledge doesn't help.

**Unified principle**: The bottleneck is never "did the agent go through the right steps?" It's always "did correct information, in usable form, reach the decision point?"

### Connection 2: The Ch2 Sub-Taxonomy Explains the Full Effectiveness Gradient

KE-187's Ch2 sub-taxonomy (Self → Environment → World-Model) maps perfectly onto the effectiveness data from all three threads:

| Ch2 Sub-Type | Information Source | Effectiveness | Thread Evidence |
|---|---|---|---|
| Ch2-Self (artifact gates) | Agent's own reasoning | 87-100% easy, **0% hard** | KE-186: F2=0% on cascading-fix-trap |
| Ch2-Environment (file checks) | File system state | Limited to verifiable state | Path hallucination guard (EXP-132) |
| Ch2-World-Model (Sentinel) | External knowledge graph | **93% on absent-info** | KE-187: Sentinel results |
| Ch2-Expert (F1 injection) | Human/expert analysis | **100% on hard tasks** | KE-186: F1=100% on cascading-fix-trap |

The progression: **as the verification source's knowledge increases, the gate catches more failure modes.** Self-verification fails when the agent doesn't know the answer. World-model verification succeeds because the graph knows what the agent doesn't.

This also explains KE-188's finding: GAM improves retrieval (P(access)) but can't improve application (P(applies)) because retrieved content still enters through Ch1 (text in context), where judgment-type knowledge gets ignored. The architecture that *would* help is one that retrieves knowledge and applies it as a Ch2 gate — a GAM-powered Sentinel hybrid.

### Connection 3: Self-Generated Content Is a Double-Edged Sword

A striking contradiction resolved: KE-186 shows self-analysis is *destructive* on hard tasks (primes wrong paths), yet GAM's entire architecture is built on storing and retrieving self-generated memories. The resolution:

- **Self-generated factual memories** (what happened, what was tried) are reliable → GAM works for these
- **Self-generated judgment** (what the root cause is, what approach to use) is unreliable on hard tasks → retrieval of past wrong judgments could prime future wrong judgments

**Implication for GAM-style systems in our context**: Graph retrieval of past diagnostic attempts is potentially harmful if those diagnoses were wrong. A GAM system would need to distinguish between factual event memories (safe to retrieve) and judgment memories (dangerous to retrieve if uncorrected).

---

## Ranked Findings (Impact × Novelty)

1. **🔴 Information quality at the decision point is the universal bottleneck** (Impact: transformative, Novelty: high)  
   Unifies all three threads. Reframes our entire guard design philosophy from process-compliance to content-quality.

2. **🔴 Ch2 sub-taxonomy: Self → Environment → World-Model** (Impact: high, Novelty: high)  
   Extends H-098 with an explanatory gradient. Predicts where each gate type will succeed or fail. Directly actionable for gate design.

3. **🟡 GAM addresses 30% of our problem (factual access), not 70% (judgment application)** (Impact: moderate, Novelty: moderate)  
   Prevents a costly misallocation — building sophisticated retrieval for a bottleneck that isn't binding. Redirects effort toward form conversion and expert content pipelines.

4. **🟡 Self-generated analysis is actively harmful on hard tasks, not just useless** (Impact: moderate, Novelty: high)  
   Content poisoning (EXP-165) is more specific and actionable than capacity displacement (KE-091). Changes the cost-benefit calculus for forced analysis gates.

5. **🟢 Encoding/consolidation decoupling is correct principle, wrong application stage** (Impact: moderate, Novelty: low)  
   Our forced externalization already provides encoding/application decoupling. GAM's encoding/consolidation decoupling is complementary but lower priority.

---

## Unified Design Implication: Smarter Gates or Better Content?

The answer from converging evidence: **better content first, then smarter gates to verify it.**

The three threads form a clear priority stack:

### Priority 1: Content Quality (KE-186 → F1 channel)
Expert pre-analysis achieves +100pp. Nothing else comes close. Before building any gate infrastructure, invest in producing and delivering correct diagnostic content for common failure scenarios. This means:
- Skills containing correct analysis (not process instructions)
- Multi-model pipelines where a verification model generates diagnosis for the working model
- Curated knowledge entries with correct root-cause information, not just "remember to check X"

### Priority 2: Smart Verification Gates (KE-187 → Ch2-World-Model)
Once correct content exists, verify agent actions against it at the tool-call level (Sentinel-style). Our cross-reference intervention (EXP-079: 100% on absent-field tasks) is already a lightweight Ch2-World-Model — the codebase serves as the "knowledge graph." Expand this pattern:
- Before committing: verify changes against a reference spec
- Before deploying: check against known failure patterns from the knowledge base
- The verification source must have information the agent doesn't — otherwise it degenerates to Ch2-Self

### Priority 3: Retrieval Infrastructure (KE-188 → GAM for factual knowledge)
Build graph-structured retrieval for the 30% of knowledge where P(access) is binding. This helps with factual/environmental knowledge but not judgment compliance. Lower priority than content quality and smart gates, but complementary.

### What to STOP Doing
- **Stop building process-forcing gates for hard tasks.** F2 = 0% on hard tasks. Self-analysis gates on difficult architectural problems are compliance theater.
- **Stop combining self-analysis with expert injection.** EXP-165's most striking finding: the combination destroys expert information benefit.
- **Stop treating retrieval as a silver bullet.** GAM-style retrieval helps P(access) but not P(applies). If the knowledge is judgment-type, delivery doesn't fix application.

---

## Next Steps

1. **Hypothesis H-189**: "Ch2 effectiveness scales with verification-source information richness" — testable by comparing Ch2-Self vs Ch2-Environment vs Ch2-World-Model on the same scenario battery.

2. **Experiment proposal**: Build a minimal Ch2-World-Model gate (reference-spec checker at tool-call level) and test on absent-information scenarios (EXP-078/098 replication). Does even a simple reference-spec get us part of Sentinel's 93%?

3. **Content quality audit**: Inventory our current skills/knowledge entries. What fraction provide correct diagnostic content (F1-style) vs process instructions (F2-style)? The ratio predicts our system's ceiling on hard tasks.

4. **GAM-selective implementation**: If we build graph retrieval, restrict it to factual/environmental entries. Exclude judgment-type entries unless they've been experimentally validated (to avoid the content-poisoning risk from retrieving past incorrect judgments).

---

*Cross-references: KE-186, KE-187, KE-188, H-161, H-085, H-098, H-043, KE-002, KE-091, KE-129, EXP-164, EXP-165, EXP-078, EXP-079, EXP-098, DD-766, DD-768*
