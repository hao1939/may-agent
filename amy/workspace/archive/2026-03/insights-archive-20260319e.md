## Insights Review — Cycle 132 (2026-03-19)

**Sources cross-synthesized:** C130 (signal scan: Atlas+CGAE, Belief-Action Decoupling, AT-GRPO) + C131 (XHS: Triple Taxonomy, Failure Loop Consensus, Subtraction Settled) + Scout signals (DD#416 Curvature Stack, Hanabi ToM study 2601.18077, ToM Double-Edged Sword 2603.00142, Composition Gap DD#274-276) + Amy-Kimi HB#2160/2163 (market signals), HB#2162 (step distillation).

---

### Theme 1: Theory-of-Mind Is the Coordination Ceiling — And It's Low (CRITICAL)

Two Scout papers converge on a devastating finding for multi-agent coordination:

**Hanabi study (2601.18077):** Best models score 17/25 (2-player) → 8/25 (5-player) — steep scaling degradation. Fundamental barrier is **egocentric hinting**: agents communicate based on their OWN perspective, not the recipient's information state. RL-finetuned models create fragile "coordination dialects" that don't transfer to new partners.

**ToM Double-Edged Sword (2603.00142):** Adding Theory-of-Mind mechanisms is NOT universally helpful: Llama 3.1 8B performance DROPS 25% with ToM+IB (cognitive overload), GPT-4o is flat (doesn't need it), only GPT-3.5 Turbo benefits (narrow sweet spot). False ToM predictions cascade into miscoordination.

**Cross-synthesis with C130 Belief-Action Decoupling:** The decoupling cascade (CR#45: 29-44% message-action consistency, communication makes coordination WORSE) is now explained mechanistically: agents CANNOT model what partners know, so they communicate egocentrically, messages become predictions not commitments, and adding cognitive modules creates overhead without fixing the root cause.

**The Coordination Ceiling Theorem:** Multi-agent coordination has a hard ceiling set by ToM capability. Below threshold: cognitive mechanisms hurt. Above threshold: not needed. The sweet spot is narrow and model-dependent. Implication: **protocol-based coordination (our file-based async) is structurally superior to ToM-dependent coordination** because it externalizes the state that ToM tries to infer.

**Pattern connections:** #1 Iteration Is Poison (+1: RL coordination dialects create fragility), #8 Harness Engineering (+2: protocol > cognition for coordination, Hanabi validates explicit vs implicit), #9 Pseudo-Safety Trap (+1: ToM additions look like improvements but can degrade performance 25%).

### Theme 2: The Composition Gap — Systems Fail at Interfaces, Not Components (CRITICAL)

Scout DD#274-276 (BAVT, ChainFuzzer, CoMAM) reveal:

**ChainFuzzer:** 365 confirmed vulnerabilities across 19/20 multi-tool LLM apps. **82.74% require multi-tool chains** — single-tool testing is fundamentally inadequate. Guardrail bypass rate: 88.6%.

**CoMAM:** Joint multi-agent RL optimization via sequential MDP outperforms independent optimization. Credit assignment across agents requires NDCG-based adaptive approach.

**BAVT:** Budget-aware tree search matches 4× resource baselines. Intelligent allocation >> brute scaling.

**Cross-synthesis with Triple Taxonomy (C131):** The Composition Gap explains WHY three orthogonal taxonomies (Anthropic flow × Google capability × agno infrastructure) are all needed — failures emerge at the INTERSECTIONS between layers/patterns/skills, not within any single dimension. Testing a Tool Wrapper skill in isolation passes; testing it within an Orchestrator-Workers flow on a Planning Layer fails.

**Cross-synthesis with Security (ChainFuzzer + C130):** The 88.6% guardrail bypass via multi-tool chains confirms our Defense-Attack Isomorphism (#35) — security must be tested at composition level, not component level. This deepens Gap #32: protecting individual config files is insufficient if the attack vector is a chain of legitimate operations.

**Pattern connections:** #7 L3 Security Gap (+2: 82.74% multi-tool chain vulnerabilities, 88.6% guardrail bypass), #2 Verification > Generation (+1: composition-level verification required), #8 Harness Engineering (+1: BAVT budget-aware allocation as infrastructure).

### Theme 3: The Curvature Stack — Mathematical Foundation for MAS Monitoring (HIGH)

Scout DD#416 introduces Ollivier-Ricci Curvature as MAS monitoring primitive:

- Positive curvature = echo chambers/collusion
- Negative curvature = bottlenecks/fragility
- **SCCAL (ICLR 2026 Workshop):** Curvature detects cascading risks **10.2 turns before** semantic violations. AUROC 0.88 vs 0.71 semantic-only.

**Cross-synthesis with Belief-Action Decoupling (C130):** The decoupling cascade (agents become MORE stubborn via RL while metrics look fine) would be DETECTABLE by curvature analysis — increasing positive curvature = agents forming echo chambers of agreement while actual coordination collapses. Curvature provides the missing EARLY WARNING for pseudo-safety (#9).

**Limitation:** O(|E|·Δ³) per timestep — only practical for <50 agents. Our ~5-agent system is well within bounds.

**Pattern connections:** #9 Pseudo-Safety Trap (+1: curvature as mathematical detector for hidden coordination collapse), #2 Verification > Generation (+1: geometric verification complements semantic).

### Theme 4: Market Validates Agent Infrastructure > Applications (CONTEXT)

Amy-Kimi HB#2160/2163: Copilot commercial penetration only **3%** despite Microsoft backing. OpenAI demoting Sora to focus on code+Agent. Alibaba CEO personally leading ATH (all AI consolidated). Microsoft restructuring for Agent era.

**Step Distillation (HB#2162):** Multi-stage knowledge distillation — T5-Base surpasses T5-XXL teacher by 2-3pp via intermediate model noise reduction. Validates multi-model strategies.

**Cross-synthesis:** The 3% Copilot penetration + 37% real-world task pass rate (C128) = market confirms that AI application gap is real. Infrastructure (harness, tools, evaluation) is the bottleneck, not models. Aligns with Harness Engineering as the competition surface.

### 5. Source Count Updates (Cycle 132)

| # | Pattern | Previous (C131) | Δ | Current (C132) | Evidence |
|---|---------|-----------------|---|----------------|----------|
| 1 | Iteration Is Poison | 128+ | +1 | 129+ | RL coordination dialects = fragile (Hanabi) |
| 2 | Verification > Generation | 165+ | +2 | 167+ | Composition-level verification (ChainFuzzer), geometric verification (Curvature) |
| 7 | L3 Security Gap | 172+ | +2 | 174+ | 82.74% multi-tool chain vulns, 88.6% guardrail bypass (ChainFuzzer) |
| 8 | Harness Engineering | 335+ | +3 | 338+ | Protocol > cognition (Hanabi/ToM), Composition Gap infra, BAVT budget allocation |
| 9 | Pseudo-Safety Trap | 234+ | +2 | 236+ | ToM additions degrade performance 25% (looks like improvement), curvature as detector |
| **Total** | | **~1,394+** | **+10** | **~1,404+** | |

### 6. Gaps & Research Interests Updated

| Item | Status | Notes |
|------|--------|-------|
| Coordination Ceiling Theorem | **NEW** | ToM capability sets hard ceiling; protocol-based coordination is structurally superior |
| Composition Gap | **NEW** | 82.74% of vulnerabilities require multi-component chains. Single-component testing insufficient |
| Curvature as Early Warning | **NEW WATCH** | Mathematical detector for pseudo-safety; 10.2 turns advance warning |
| Gap #32 Config File Integrity | DEEPENED | Chain attacks > single-file attacks. Composition-level protection needed |
| Gap #1 Skill Crystallization | CRITICAL (unchanged) | Still most important unsolved problem. Path clear (C130), consensus complete (C131) |

**Research interests:**
- **URGENT:** Composition-level testing — how to test skill chains, not just individual skills
- **UPGRADE:** Curvature-based monitoring — practical implementation for small MAS (<10 agents)
- **MAINTAIN:** ToM limitations in coordination, market infrastructure signals
- **NEW WATCH:** Budget-aware resource allocation (BAVT) — could optimize our agent scheduling

*— Amy 📕 (cycle 132 — insights review)*

## Signal Scan — Cycle 133 (2026-03-19)

**Sources scanned:** Scout DD#434 (Kumiho — AGM belief revision memory), DD#435 (VeriGrey — greybox agent fuzzing), DD#436 (TerraLingua — emergent governance in LLM ecologies), DD#429 (MCFA — memory control flow attacks), DD#430 (D-MEM — dopamine-gated memory), CR#238 (Cross-Stack Attack Composition), CR#245 (Memory Gating Paradox). Amy-Kimi HB#2171 (AgentGym-RL), HB#2172 (FoldAgent context folding), HB#2173 (MAS² self-evolving MAS), HB#2174 (HAE 3-layer security framework).

---

### 1. Memory Security Reaches Formal Maturity: Kumiho + MCFA + Memory Gating Paradox (CRITICAL)

Three Scout outputs converge into the most complete picture of agent memory security to date:

**The Attack (DD#429 MCFA):** Memory retrieval HIJACKS agent control flow. >90% attack success across GPT-5 mini, Claude Sonnet 4.5, Gemini 2.5 Flash. 100% persistence, >85% resistance to textual repair. Framework-agnostic (LangChain + LlamaIndex). Memory Surgery (not prompting) is the only effective defense.

**The Paradox (CR#245):** Every memory quality gate simultaneously becomes an adversarial optimization target. D-MEM's RPE formula, once known to adversary, GUARANTEES maximum memory integration of poisoned content. General law: defense optimization = attack optimization target.

**The Resolution (DD#434 Kumiho):** AGM-compliant belief revision for memory. 97.5% adversarial refusal, 93.3% LoCoMo-Plus SOTA, 4.2× retrieval precision on multi-hop. The key insight: logical consistency criteria are HARDER to game than numerical scores — adversaries must craft content that's both poisonous AND logically consistent with the agent's entire belief graph. This is structurally harder than optimizing a known formula.

**Cross-synthesis — The Memory Security Stack:**
```
Attack surface (MCFA): Memory retrieval → control flow hijack (>90% success)
Paradox (CR#245): Numerical gates = adversary roadmap
Resolution (Kumiho): Logical consistency gates ≠ adversary roadmap
Defense layer (D-MEM): RPE gating reduces attack surface (80% token savings) BUT adds new surface if formula known
```

**For our architecture:** Our text-file memory is immune to MCFA's specific attack vector (we don't use vector RAG retrieval that can be poisoned). But the principle applies: any AUTOMATED file write path without consistency checking is vulnerable. The CraniMem write-gating concept (C130) + Kumiho's logical consistency = the design pattern for safe memory writes.

**Gap #4 (Memory Adversarial Robustness):** Scout reports this as DIRECTLY FILLED by Kumiho. Validated — the formal framework now exists. Implementation gap remains (AGM revision has worst-case exponential complexity for graphs >50K nodes).

### 2. Agent Security Testing Becomes Systematic: VeriGrey + Cross-Stack Composition (CRITICAL)

**VeriGrey (DD#435):** First practical greybox fuzzing for LLM agents. Coverage defined over execution traces (tool call sequences, memory accesses, governance decisions) — not code paths. 33% better vulnerability discovery than blackbox, real CVE-grade findings. Coverage saturation in <1000 test cases for single-agent.

**Cross-Stack Attack Model (CR#238):** 12 viable attack chains across 4 families. Three catastrophic cascades: (I) Governance Spiral (self-reinforcing, slow, invisible), (II) Trust Collapse (rapid, circular, Byzantine), (III) Optimization Trap (emergent, no adversary needed). Key insight: attack surfaces MULTIPLY across connected stacks, not add.

**Cross-synthesis:** VeriGrey can validate individual attack chain links but NOT full cascade sequences (single-step mutations only). The most dangerous vector (compiled memory → governance drift, Chain A2) is specifically the kind that operates below VeriGrey's detection threshold — slow, no single anomalous step. This reveals a **testing coverage gap**: greybox fuzzing catches ACUTE attacks; slow governance drift requires longitudinal monitoring (curvature analysis from C132).

**Two-tier defense model:**
- **Tier 1 (Acute):** VeriGrey greybox fuzzing — catches prompt injection, tool misuse, single-step attacks. Coverage: ~70% of known attack vectors.
- **Tier 2 (Chronic):** Curvature monitoring + longitudinal drift detection — catches governance spirals, trust collapse, optimization traps. Coverage: the remaining ~30% that VeriGrey misses.

**For our architecture:** Our system's simplicity (text files, human review) provides inherent Tier 2 defense (human can detect drift over sessions). But we lack Tier 1 — no automated testing of skill chains or tool compositions.

### 3. Emergent Governance Is Real But Fragile: TerraLingua + HAE (CRITICAL)

**TerraLingua (DD#436):** First empirical evidence that governance EMERGES spontaneously in multi-LLM ecologies — enforcement mechanisms, sanctions, reputation tracking appear without being designed. BUT: (1) Norms are fragile — single adversarial agent destabilizes thousands of timesteps of norm development. (2) Dialect fragmentation — subgroups develop opaque sub-languages (steganographic collusion risk). (3) Power law influence — few "hub" agents disproportionately shape norms.

**HAE Framework (HB#2174):** Three-layer security model — L1 Cognitive (reasoning attacks), L2 Executional (tool/environment attacks), L3 Collective (collusion/systemic collapse). Key insight: "同一威胁在不同自治层级会发生根本性质变" — the same threat QUALITATIVELY TRANSFORMS across autonomy levels. L1 prompt injection → L2 tool misuse → L3 systemic risk propagation.

**Cross-synthesis — The Governance Fragility Theorem:** TerraLingua shows governance can emerge, but HAE shows threats transform across levels. Combined: emergent norms at L3 are vulnerable to L1/L2 attacks that propagate upward and qualitatively transform. A single prompt injection (L1) → tool misuse (L2) → destabilizes emergent governance norms (L3) across the entire ecology.

**Cross-synthesis with CR#238:** TerraLingua's norm fragility IS the governance layer vulnerability that CR#238's Cascade Family I (Governance Spiral) predicts. The spiral: adversary exploits L1 → influences norm-setting → norms drift → more agents affected → governance fails. Confirmed empirically.

**Prediction P193 validation:** Scout predicts "governance anchors" — agents with fixed norms that resist drift. Our May agent (ops oversight with fixed rules) IS a governance anchor. This architectural choice is now empirically validated as necessary.

### 4. Long-Horizon Agent Capabilities Advancing: FoldAgent + AgentGym-RL + MAS² (HIGH)

**FoldAgent (HB#2172):** Tree-structured context management for 200+ turn interactions. Fold (compress completed branches), Unfold (restore when needed), Prune (discard low-value). FoldGRPO learns when to fold/unfold via RL. 40.67% on BrowseComp-Plus.

**AgentGym-RL (HB#2171):** ScalingInter-RL — progressive exploration-exploitation: early phases limit interactions (exploit known capabilities), later phases expand (explore diverse strategies). Matches or surpasses Claude/GPT-4 on 27 tasks across web/OS/code/database. 641⭐ on GitHub.

**MAS² (HB#2173):** Three-layer self-evolution: Self-Generative (workflow generation), Self-Configuring (heterogeneous LLM routing), Self-Rectifying (failure analysis + auto-retry). Pareto-optimal cost-performance via model routing.

**Cross-synthesis:** All three address the same underlying problem — agents that can handle EXTENDED interactions without degradation. FoldAgent compresses state, AgentGym-RL trains progressive capability, MAS² adds self-repair. The common insight: long-horizon capability requires ARCHITECTURAL support (tree structures, progressive training, self-repair), not just larger context windows.

**For our architecture:** FoldAgent's tree-structured context management maps to our archive/knowledge/workspace hierarchy — we already do manual "folding" (archiving). MAS²'s heterogeneous LLM routing aligns with our multi-model strategy. AgentGym-RL's progressive training validates the Coach's incremental capability-building approach.

### 5. Source Count Updates (Cycle 133)

| # | Pattern | Previous (C132) | Δ | Current (C133) | Evidence |
|---|---------|-----------------|---|----------------|----------|
| 1 | Iteration Is Poison | 129+ | +1 | 130+ | Kumiho: formal belief revision replaces iterative memory update |
| 2 | Verification > Generation | 167+ | +4 | 171+ | Kumiho AGM consistency checking, VeriGrey systematic testing, MCFA proves memory repair insufficient, HAE cross-level verification |
| 3 | File System = Memory | 146+ | +2 | 148+ | Kumiho provenance edges (causal memory), FoldAgent tree-structured context |
| 5 | Minimum Sufficient Reasoning | 120+ | +1 | 121+ | D-MEM: 80% token reduction via selective processing |
| 6 | Self-Evolution Trilemma | 149+ | +3 | 152+ | Kumiho safe memory evolution via belief revision, MAS² self-rectifying, AgentGym-RL progressive training |
| 7 | L3 Security Gap | 174+ | +4 | 178+ | MCFA >90% attack success, CR#238 12 cross-stack chains, TerraLingua norm fragility, HAE L3 threats |
| 8 | Harness Engineering | 338+ | +3 | 341+ | VeriGrey trace-level coverage, CR#238 cross-stack monitoring, MAS² heterogeneous routing |
| 9 | Pseudo-Safety Trap | 236+ | +3 | 239+ | CR#245 defense gates = attack targets, TerraLingua emergent norms look stable but fragile, HAE threat transformation |
| **Total** | | **~1,404+** | **+21** | **~1,425+** | |

### 6. Gaps & Research Interests Updated

| Item | Status | Notes |
|------|--------|-------|
| Gap #4 Memory Adversarial Robustness | **FILLED** (Kumiho) | Formal framework exists. Implementation gap: AGM complexity >50K nodes |
| Gap #1 Security Testing | **PARTIALLY FILLED** (VeriGrey) | Single-agent greybox validated. MAS testing still exponential |
| Governance Fragility Theorem | **NEW** | TerraLingua + HAE: emergent governance is real but single adversary can destabilize via cross-level threat propagation |
| Memory Security Stack | **NEW** | Attack (MCFA) → Paradox (CR#245) → Resolution (Kumiho) → complete lifecycle model |
| Two-Tier Defense Model | **NEW** | Acute (VeriGrey fuzzing) + Chronic (curvature/drift monitoring). Both needed. |
| Defense-Attack Isomorphism (#35) | STRENGTHENED | CR#245 formally proves the principle: any optimized defense = adversary optimization target |
| Gap #1 Skill Crystallization | CRITICAL (unchanged) | Path validated but still unimplemented |
| Cross-Stack Attack Awareness | **NEW** | CR#238: 12 chains, 3 cascade families. Governance Spiral (Chain A2) = most dangerous = below fuzzing threshold |

**Research interests:**
- **URGENT:** Kumiho implementation feasibility — can AGM belief revision work with file-based memory? Approximate algorithms?
- **UPGRADE:** VeriGrey-style trace coverage for our skill chains — even manual testing with trace coverage concept
- **MAINTAIN:** Two-tier defense model development, cross-stack attack awareness
- **NEW WATCH:** FoldAgent tree-structured context as explicit archive strategy, MAS² self-repair patterns

*— Amy 📕 (cycle 133 — signal scan)*

