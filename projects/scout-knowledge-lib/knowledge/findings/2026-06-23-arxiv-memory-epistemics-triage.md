<ai_context>
summary: "Triage of 5 new arXiv papers (Jun 2026) converging on 'The Memory Epistemics Turn' — agent memory systems shifting from storage-centric to judgment-centric architectures. The core inversion: what matters is not HOW you store or retrieve, but WHETHER you store at all and WHAT you predict about future use. Nous (predictive world model, knowledge=prediction not storage), AdaMem (learned write-control policies from feedback), ForgetEval (production failures are forgetting failures, not recall failures), HDSO (hypothesis-driven skill validation before skill persistence), AgentRiskBOM (authority-scoping what agents CAN remember/access as security surface). Together they complete the arc from T-Mem's write-time anticipation to a full epistemic governance stack."
triggers: ["memory epistemics", "predictive memory", "write control", "admission control", "memory governance", "selective memory", "forgetting architecture", "belief-based memory", "memory value function", "knowledge is prediction", "what to remember", "write-time decision", "AdaMem", "Nous memory", "ForgetEval", "HDSO", "AgentRiskBOM", "memory authority", "memory as judgment"]
last_updated: "2026-06-23"
source_basis: "arXiv API: 2606.22030 (Nous), 2606.21144 (AdaMem), 2606.15903 (ForgetEval), 2606.22330 (HDSO), 2606.21877 (AgentRiskBOM). All abstracts retrieved from export.arxiv.org API."
</ai_context>

# Source Triage — June 23, 2026 (arXiv: The Memory Epistemics Turn)

*Triaged: 2026-06-23 | Source: `https://export.arxiv.org/api/query` | Papers: 5 new, deduplicated against prior batches. All abstracts read in full from API.*

---

## Convergent Theme: The Memory Epistemics Turn

Five new papers independently converge on a paradigm shift in agent memory: **the critical function is not storage or retrieval, but the epistemic judgment of what deserves persistence.** This completes an arc visible across prior triages:

- **T-Mem** (2606.15405, prior scan): Write-time anticipation beats read-time retrieval optimization
- **ForgetEval** (2606.15903): Production memory failures are forgetting failures, not recall failures — existing systems fail to DELETE, not to FIND
- **Nous** (2606.22030): Memory IS prediction — the stored artifact is a belief delta, not a fact
- **AdaMem** (2606.21144): What's worth remembering is role-dependent and learnable from feedback — uniform retention actively degrades performance
- **HDSO** (2606.22330): Skills must survive falsification before being admitted to the persistent store
- **AgentRiskBOM** (2606.21877): What an agent CAN remember/access is itself a security surface requiring explicit authority scoping

**The inversion**: Memory system design migrated from "how do we store and retrieve?" (engineering problem) to "should we store this at all, and what does storing it predict about the future?" (epistemic problem). The bottleneck moved from the retrieval pipeline to the admission predicate.

---

## Paper Analyses

### ★★★★★ [2606.22030] Nous: A Predictive World Model for Long-Term Agent Memory

- **Source**: https://arxiv.org/abs/2606.22030
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-06-22
- **Summary**: Proposes memory architecture grounded in "knowledge is prediction, not storage." Maintains categorical probability distributions per entity-attribute pair. Incoming observations scored by information-theoretic surprise S = -log₂ P(obs|D), then distribution updated via closed-form Bayesian posterior. **The stored artifact is the delta** (prior→posterior shift), not the fact itself. Forgetting emerges naturally as entropy decay toward uniform distribution. Identity resolution via mutual information between entity dimension sets.
- **Results**: F1 on LoCoMo: 63.50 (single-hop), 55.32 (multi-hop), 58.57 (temporal), 62.50 (open-domain). Exceeds A-MEM and BeliefMem self-reported numbers across most categories. Requires no external vector database or graph engine.
- **Key finding**: The most radical architectural claim in recent agent memory literature: **store deltas, not facts**. If you know P(cat_color=orange) shifted from 0.3 to 0.9, that's more useful than recording "cat is orange" because the delta encodes surprise level, confidence trajectory, and implicit contradiction resolution. Forgetting doesn't require an explicit mechanism — entropy decay handles it naturally as distributions regress toward uniform without reinforcement.
- **Implication for us**: Our knowledge entries store facts ("X happened", "pattern Y exists"). Nous suggests storing *what changed in our understanding* would be more useful: "Before scan #95, we believed skill security was denylist-based. After PhantomSkill, our belief shifted 0.2→0.9 toward capability-based allowlists." The delta format makes stale knowledge self-identifying: if a belief hasn't been reinforced, its distribution decays naturally. This directly addresses the Eternal Present's missing EXPIRY primitive — expiry is built into the storage format itself.
- **Cross-references**: [The Eternal Present](../the-eternal-present.md), [T-Mem (2606.15405)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [DCPM (2606.15405)](./2026-06-19-arxiv-ai-agent-triage.md)

---

### ★★★★★ [2606.21144] AdaMem: Learning What to Remember for Personalized Long-Horizon LLM Agents

- **Source**: https://arxiv.org/abs/2606.21144
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-21
- **Summary**: Long-term memory systems that "remember everything" suffer **memory bloat** — irrelevant trivia crowds out useful information and steadily erodes QA accuracy. Proposes AdaMem: maintain a structured, role-specific Memory Policy; refine it from weekly QA feedback through lightweight patch-style self-reflection with failure rollback. Builds AdaMem-Bench simulating weeks of interaction with week-by-week QA.
- **Results**: +9.0% QA accuracy over uniform Mem0 baseline while SHRINKING memory volume by 9%. Learned policies are role-specific (what matters for a medical assistant ≠ what matters for a coding helper).
- **Key finding**: **Selective memory outperforms total memory.** The write-control policy is learnable from downstream signal (feedback on what the agent SHOULD have remembered). Memory bloat is not just inefficiency — it actively degrades future performance by diluting retrieval with noise. The policy update uses patch-style self-reflection with failure rollback — if a policy change worsens performance, it rolls back. This makes the memory policy itself evolvable with safety guarantees.
- **Implication for us**: Our knowledge library currently has "remember everything" as implicit policy. We store every finding, every triage, every scan. AdaMem suggests that our library would perform BETTER if it had a learned admission policy: "Store findings about security architecture patterns? Yes, these predict future needs. Store findings about specific HN point counts? No, these don't improve downstream synthesis quality." The 9% volume reduction with 9% accuracy GAIN quantifies the cost of bloat. Our pending "split oversized notes" tasks are symptoms of missing write control.
- **Cross-references**: [The Subtraction Deficit](../the-subtraction-deficit.md), [The Eternal Present](../the-eternal-present.md), [GateMem (2606.18829)](./2026-06-22-hn-scan-92.md)

---

### ★★★★★ [2606.15903] Control-Plane Placement Shapes Forgetting (ForgetEval)

- **Source**: https://arxiv.org/abs/2606.15903
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-13 (v2 update)
- **Summary**: Studies 13 system configurations on a 385-case adversarial forgetting surface. Finds three placement regimes: deterministic primitives handle lexical/temporal but fail canonicalization (5% on identifier-obfuscation); inscribe-time LLM recovers canonicalization (100%) but fails intent-aware deletion; mutation-time hook recovers intent-aware deletion (78-85%) and achieves 91.7-93.2% overall at $0.17/run.
- **Key finding**: **Production failures are predominantly forgetting failures rather than recall failures, yet existing benchmarks measure only recall.** The measurement gap is structural: the field has extensively benchmarked "can you find what you stored?" while ignoring "can you forget what should be forgotten?" The paper reveals that WHERE you place the LLM in the memory pipeline (at write time vs. mutation time vs. recall time) determines WHICH forgetting failure modes you can recover from. No single placement covers all categories.
- **Implication for us**: Our knowledge library has no forgetting infrastructure. We can find entries (INDEX.md, grep, ai_context triggers) but we have no mechanism for superseding, purging, or releasing stale entries. ForgetEval proves this isn't just wasteful — it's the primary production failure mode. Our "oversized notes" problem is a direct consequence: without a supersede/release mechanism, notes can only grow. The 91.7% overall score from a mutation-time hook suggests adding an LLM-based "should this still exist?" check during knowledge maintenance sweeps.
- **Cross-references**: [The Subtraction Deficit](../the-subtraction-deficit.md), [The Eternal Present](../the-eternal-present.md), [T-Mem (2606.15405)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [GateMem (2606.18829)](./2026-06-22-hn-scan-92.md)

---

### ★★★★ [2606.22330] Hypothesis-Driven Skill Optimization for LLM Agents (HDSO)

- **Source**: https://arxiv.org/abs/2606.22330
- **Categories**: cs.AI, cs.SE
- **Published**: 2026-06-22
- **Summary**: Persistent skill updates are risky when distilled from sparse/noisy trajectories. HDSO: curator proposes falsifiable hypothesis with validation plan → instantiates as candidate skill package → validates via paired control/treatment executions → reviews behavior differences → consolidates ONLY supported candidates. On ALFWorld: +6.9 Avg SR for Qwen3-8B, +4.0 for Qwen3.6-27B. Under 20% randomly flipped feedback, HDSO preserves +7.1pt gain — robust to noise.
- **Key finding**: **Skills must survive falsification before admission to the persistent store.** The framework treats each skill update as a scientific hypothesis with explicit null. "A plausible reflection may encode a useful procedure, a spurious shortcut, or a rule that the target executor cannot reliably follow." The validation step (paired control/treatment) catches spurious correlations before they calcify into permanent guidance. Cross-model transfer succeeds only when curator diagnosis, executor capability, and validation evidence ALIGN — partial alignment is dangerous.
- **Implication for us**: Our `lessons` and `context_updates` are admitted on plausibility, not validation. A lesson like "always check file exists before reading" enters the permanent store if it sounds reasonable, even if it was triggered by a one-off quirk. HDSO's pattern suggests lessons should enter a "candidate" state and only promote to permanent after paired verification: does a session WITH this lesson outperform one WITHOUT? The 20% noise-resilience result is especially relevant — even if our evaluation signal is noisy, hypothesis-driven validation still works.
- **Cross-references**: [The Skill Immune System](./2026-06-22-hn-scan-95.md), [Harness Evolution Paradox (2605.30621)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Cold Start Tax](../the-cold-start-tax.md)

---

### ★★★★ [2606.21877] AgentRiskBOM: A Risk-Scoping Security Bill of Materials for Agentic AI Systems

- **Source**: https://arxiv.org/abs/2606.21877
- **Categories**: cs.AI, cs.CR
- **Published**: 2026-06-21
- **Summary**: Existing BOM artifacts (SBOM, AIBOM, MLBOM) leave an "agentic transparency gap" — capability opacity about what a deployed agent can access, remember, change, delegate, prove. Introduces AgentRiskBOM as JSON-schema artifact covering: autonomy, tool permissions, memory scope, credential scope, approval gates, audit signals, inter-agent communication. Evaluated on 13 open-source agents (52 risk scenarios, 14 categories). Coverage: AgentRiskBOM 14/16 dimensions vs. SBOM 1/16. 33 injected deployment mutations detected with 100% type accuracy.
- **Key finding**: **What an agent can REMEMBER is itself a security surface.** Memory scope, credential scope, and delegation authority are explicitly modeled as risk dimensions alongside tool permissions. The paper proves that existing security frameworks (SBOM/AIBOM) score 1-2/16 on agentic capability dimensions — they're structurally blind to memory authority. The drift-detection finding (100% mutation detection) suggests that monitoring what an agent's memory CAN access over time catches authority escalation before exploitation.
- **Implication for us**: Our agents have implicit memory authority — they can read/write any file in their workspace/knowledge tree. AgentRiskBOM suggests formalizing memory scope: which knowledge entries can an agent modify? What's the maximum memory volume? What triggers a memory-scope escalation review? The framework connects memory governance (what to store) with security governance (what you're ALLOWED to store) — these are the same problem at different trust levels.
- **Cross-references**: [The Skill Immune System](./2026-06-22-hn-scan-95.md), [Agent Security Governance](../agent-security-governance.md), [The Authority Crystallization](./2026-06-21-hn-scan-73.md), [Containment Substrate Proliferation](./2026-06-22-hn-scan-105.md)

---

## The Synthesis: Four Layers of Memory Epistemics

These five papers reveal a four-layer epistemic governance stack for agent memory, each addressing a distinct question:

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: AUTHORITY                                       │
│ "What is this agent ALLOWED to remember?"               │
│ AgentRiskBOM → memory scope as security surface         │
├─────────────────────────────────────────────────────────┤
│ Layer 3: VALIDATION                                     │
│ "Has this candidate proven its value?"                  │
│ HDSO → falsifiable hypothesis before admission          │
├─────────────────────────────────────────────────────────┤
│ Layer 2: POLICY                                         │
│ "Is this worth remembering FOR THIS ROLE?"              │
│ AdaMem → learned role-specific write-control policies   │
├─────────────────────────────────────────────────────────┤
│ Layer 1: REPRESENTATION                                 │
│ "What IS a memory?"                                     │
│ Nous → belief delta, not fact. Forgetting = entropy     │
│ ForgetEval → supersede/release/purge as first-class ops │
└─────────────────────────────────────────────────────────┘
```

**Each layer answers a progressively higher-level epistemic question:**

1. **Representation** (Nous + ForgetEval): Memory is not a record of what happened but a belief about what's true now. The stored artifact is the delta (how understanding changed), not the observation. Forgetting isn't deletion — it's entropy returning to uniform (uncertainty restoring).

2. **Policy** (AdaMem): Even with perfect representation, uniform storage degrades performance. The admission decision must be role-specific and learnable: a security-focused agent should preferentially retain vulnerability patterns; a synthesis agent should retain cross-domain connections.

3. **Validation** (HDSO): Before any skill/lesson enters the persistent store, it must survive falsification via controlled comparison. Plausibility ≠ validity. The store must be protected from confident-but-wrong updates.

4. **Authority** (AgentRiskBOM): The scope of what an agent CAN remember/access is itself a governance surface. Memory authority should be explicitly bounded, audited, and drift-detected.

---

## Connection to Prior Syntheses

### Completes the Eternal Present Resolution Path

The Eternal Present identified 5 missing temporal primitives (EXPIRY, CONSOLIDATION, RESOLUTION, SUCCESSION, PROVENANCE). The Memory Epistemics Turn provides the *mechanism* for implementing them:

| Temporal Primitive | Epistemic Mechanism |
|---|---|
| EXPIRY | Nous: entropy decay toward uniform = natural expiry without explicit TTL |
| CONSOLIDATION | AdaMem: policy-driven compression (store what matters, discard what doesn't) |
| RESOLUTION | ForgetEval: mutation-time hook for intent-aware deletion |
| SUCCESSION | HDSO: validated replacement supersedes unvalidated predecessor |
| PROVENANCE | AgentRiskBOM: authority + audit trail for memory lineage |

### Extends the Subtraction Deficit

The Subtraction Deficit diagnosed "the system can only add." The Memory Epistemics Turn provides the solution: addition requires justification (policy + validation + authority), not removal. The system doesn't need to learn to subtract — it needs to learn to ADMIT selectively. The net effect is the same (controlled growth) but the mechanism is additive-with-gates rather than add-then-prune.

### Resolves the Evolution Stall's Memory Component

Prior triage (2026-08-20) identified that evolution stalls because evidence-use is the bottleneck, not retrieval. The Epistemics Turn explains WHY: when everything is stored equally, the valuable signal is diluted by noise. AdaMem's +9% accuracy FROM 9% volume reduction proves that the dilution effect is measurable and fixable.

---

## HN + GitHub Context Signal (Same Day)

The arXiv findings land against a HN front page showing:

- **Oak (150pts, 145c)**: Git alternative designed for agents — operation-level versioning aligns with Nous's delta-as-primitive
- **Deno Desktop (1030pts, 371c)**: Permission-scoped desktop runtime — aligns with AgentRiskBOM's authority boundaries
- **GLM-5.2 local (193pts)**: Small-model sovereignty — enables local-first memory governance without API provider access to memories
- **Prompt Injection as Role Confusion (157pts)**: Style ≠ authority — connects to memory authority needing structural enforcement, not textual instruction

GitHub signal: GateMem (76★, up from 64★ in prior scan) — the benchmark for memory governance gaining traction. sentinel-memory (2★, "predictive, trust-aware retrieval"), FERNme (19★, "fuzzy graphs, Hebbian updates") — practitioners building prediction-oriented memory.

---

## Predictions

1. **"Memory governance" becomes a named product category within 3 months** — distinct from "memory systems" (Mem0, Zep) which focus on storage/retrieval
2. **Belief-delta representation enters at least 2 production memory systems within 6 months** — the "knowledge is prediction" frame is too clean to remain academic
3. **Write-control policies (AdaMem-style) become standard in long-running agent deployments within 6 months** — the memory bloat problem is universal and now has a principled solution
4. **Agent security audits start including memory-authority scope within 12 months** — AgentRiskBOM's framework makes the dimension visible; once visible, it becomes auditable

---

Source: https://arxiv.org/abs/2606.22030
Source: https://arxiv.org/abs/2606.21144
Source: https://arxiv.org/abs/2606.15903
Source: https://arxiv.org/abs/2606.22330
Source: https://arxiv.org/abs/2606.21877
