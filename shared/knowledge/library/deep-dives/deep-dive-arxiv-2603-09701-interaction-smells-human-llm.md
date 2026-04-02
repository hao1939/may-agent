# Deep-Dive #237: Interaction Smells in Multi-Turn Human-LLM Collaborative Code Generation

**Paper:** arXiv:2603.09701  
**Authors:** Zhang, Zhang, Shi, Wang, Qian, Zhao, Liu, Fu, Ye  
**Affiliation:** cs.SE  
**Date:** March 10, 2026  
**Rating:** ★★★★★ (Critical for our multi-agent coordination and evaluation threads)

---

## 1. Core Contribution

This paper introduces **"Interaction Smells"** — a concept borrowed from software engineering's "code smells" — to describe latent quality issues that arise **within the interaction process itself**, not just in final outputs. This is the first systematic taxonomy of process-level quality degradation in multi-turn human-LLM collaboration.

The key insight: **existing benchmarks measure whether the final output is correct, but systematically miss the quality of the interaction journey that produced it.** An interaction can succeed (correct final output) while being riddled with smells that indicate fragility, wasted effort, and near-miss failures.

## 2. Methodology

### Data Sources
- **WildChat** and **LMSYS-Chat-1M** — real-world user-LLM interaction logs
- Manual open card sorting on sampled interactions to derive taxonomy
- Quantitative evaluation across 6 LLMs: GPT-4o, DeepSeek-Chat, Gemini 2.5, Qwen2.5-32B, Qwen2.5-72B, Qwen3-235B-a22b

### The Taxonomy: 3 Categories, 9 Subcategories

#### Category 1: User Intent Quality
Issues where the user's instructions are ambiguous, incomplete, or inconsistent. The LLM must either guess, ask for clarification (which many don't), or proceed on assumptions.

**Subcategories likely include:**
- Ambiguous specifications
- Implicit requirements (unstated but expected)
- Contradictory instructions across turns

#### Category 2: Historical Instruction Compliance
Issues where the LLM fails to respect constraints or requirements established in earlier turns. This is the **multi-turn consistency problem** — the LLM generates responses that violate previously agreed-upon specifications.

**Subcategories likely include:**
- Forgotten constraints (earlier requirements dropped from later responses)
- Requirement regression (fixed issues reintroduced)
- Scope drift (gradual departure from original specification)

#### Category 3: Historical Response Violation
Issues where the LLM contradicts or is inconsistent with its own prior responses. This is **self-consistency failure** — the model's outputs are internally incoherent across the conversation.

**Subcategories likely include:**
- Code incompatibility (new code breaks previously generated code)
- API/interface contradictions (different signatures across turns)
- Logic reversal (model contradicts its own earlier reasoning)

### Mitigation: InCE Framework
**Invariant-aware Constraint Evolution (InCE)** — a multi-agent framework with two key mechanisms:
1. **Global Invariant Extraction** — explicitly identifies constraints that must hold across all turns (accumulated requirements, agreed specifications)
2. **Pre-generation Quality Audits** — before generating each response, checks the proposed output against extracted invariants

This is tested on the extended WildBench benchmark, showing significant improvement in Task Success Rate and reduced Interaction Smell occurrence.

## 3. Critical Analysis

### 3.1 Why This Matters for Multi-Agent Systems

The Interaction Smells concept has **direct, profound implications** for multi-agent coordination:

**In human-LLM interaction:** A single LLM fails to maintain consistency with itself across turns.
**In multi-agent systems:** Multiple LLMs must maintain consistency with EACH OTHER across turns.

If a single model can't even be consistent with its own prior outputs, the multi-agent problem is exponentially harder. This provides empirical grounding for several GUS Laws:

| GUS Component | Connection |
|---|---|
| **Law 1 (Sophistication Tax)** | Interaction Smells are the micro-level mechanism through which the Sophistication Tax manifests — each turn adds potential for smell accumulation |
| **Law 3 (Escalating Difficulty)** | Task difficulty escalates not just from the task itself, but from the growing constraint space the LLM must track |
| **Law 27 (Monotonic Drift)** | Interaction Smells are a formalization of drift — each smell is a micro-drift event |
| **Mechanism 1 (Context Corruption)** | Historical Instruction Compliance failures ARE context corruption at the conversation level |
| **Mechanism 30 (Coordination Overhead Inversion)** | InCE's invariant extraction is itself a coordination overhead — at some point, maintaining invariants costs more than the turns they protect |

### 3.2 The Invariant Extraction Insight

The InCE framework's approach — explicitly extracting and maintaining global invariants — is architecturally significant:

1. **It's a formalization of what good protocols do.** Our SIGNALS.md, structured handoffs, and typed messages are all forms of invariant extraction — we make constraints explicit rather than relying on implicit context.

2. **It validates the Cross-Context Review finding (2603.12123).** That paper showed separating review from production context improves error detection. InCE shows that separating constraint tracking from generation improves consistency. Both confirm: **separation of concerns is the fundamental mitigation for multi-turn degradation.**

3. **It maps to the Abstraction Gate (Law 18).** Raw interaction history is unstructured experience. Invariant extraction is the abstraction step that converts it into usable knowledge. Without this step, raw history + generation = degradation (cf. SkillRL's finding that MemRL degrades performance).

### 3.3 The "Code Smells" Analogy Goes Deeper

The paper's analogy between code smells and interaction smells is more apt than it appears:

| Code Smells | Interaction Smells |
|---|---|
| Local indicators of potential systemic problems | Process indicators of potential failure |
| Don't cause immediate bugs but increase fragility | Don't cause immediate task failure but increase error probability |
| Compound over time (technical debt) | Compound over turns (interaction debt) |
| Best caught by external review (code review) | Best caught by external audit (InCE) |
| Refactoring = explicit redesign | Invariant extraction = explicit constraint management |

This maps perfectly to our Reliability Illusion Stack (CR#29): **interactions that "succeed" (correct final output) while accumulating smells are the multi-turn equivalent of benchmarks that show 58% success while real reliability is 1-9%.**

### 3.4 Model Scale vs. Interaction Quality

The paper evaluates 6 LLMs from different model families and sizes. Based on patterns from our portfolio:

- **Larger models** likely reduce Category 2 (Historical Instruction Compliance) smells due to better long-context handling
- **Larger models** may NOT reduce Category 3 (Historical Response Violation) smells — self-consistency is a generation-level property, not a retrieval property
- **No model** likely eliminates Category 1 (User Intent Quality) smells — these are inherent to the human-LLM interface

This maps to our Intelligence Paradox: smarter models may generate MORE sophisticated (and thus harder to detect) interaction smells, even if they generate fewer total smells.

## 4. Connections to Existing Portfolio

### Direct Connections
| Paper | Connection |
|---|---|
| **Cross-Context Review (2603.12123)** | Both prove context separation improves quality; InCE = invariant-based separation, CCR = session-based separation |
| **DPBench (2602.13255)** | Convergent reasoning in simultaneous coordination = Category 3 smell at the inter-agent level |
| **ThreadMedQA + Drift/Instability (CR#14)** | Multi-turn degradation quantified medically; Interaction Smells provide the mechanistic explanation |
| **Cross-Context Review (DD#236)** | 64.5% error miss rate when reviewing in-context = Interaction Smells preventing self-detection |
| **Belief-Action Decoupling (CR#45)** | Category 3 (Historical Response Violation) IS belief-action decoupling at the conversation level |
| **TraceSIR (2603.00623)** | TraceSIR diagnoses execution trace failures; Interaction Smells diagnose interaction process failures — complementary diagnostic layers |
| **Bugs in Agent Frameworks (2602.21806)** | Framework bugs → interaction smells → task failures: a causal chain |

### GUS Framework Integration
- **Validates Law 27** — Interaction smells demonstrate monotonic drift within a single conversation
- **Extends Mechanism 1** — Context corruption isn't just token-level; it includes constraint-level "forgotten requirements"
- **Supports Principle 46** — Verify Before Sharing: InCE's pre-generation audit is exactly this principle applied at the turn level

## 5. Novel Concepts for GUS

### Proposed: Interaction Debt (analog to Technical Debt)
Each unresolved Interaction Smell adds to "interaction debt" — accumulated fragility in the conversation state. Like technical debt, it compounds non-linearly:
- Turns 1-5: few smells, low debt
- Turns 5-15: smell accumulation accelerates (constraints multiply)
- Turns 15+: debt service (managing accumulated constraints) dominates productive work

**Prediction:** Interaction debt growth rate follows a power law, not linear — each new constraint multiplies the interaction space with all existing constraints.

### Proposed: Principle 83 — Invariant Extraction
> In multi-turn or multi-agent interactions, constraints must be explicitly extracted and maintained as first-class objects. Relying on implicit context for constraint tracking guarantees accumulating Interaction Smells.

### Proposed: Prediction 85 — Invariant Extraction Threshold
> There exists a turn count beyond which invariant extraction overhead exceeds productive generation capacity, creating a natural limit on beneficial conversation length. This threshold will be lower for multi-agent systems (more constraint sources) than for single-agent conversations.

## 6. Implications for Our System

| Our Component | Interaction Smell Risk | Mitigation |
|---|---|---|
| **SIGNALS.md** | Low — explicit, structured | Already an invariant extraction mechanism |
| **lessons.md** | Medium — grows without consolidation | Needs periodic invariant extraction (constraint consolidation) |
| **Agent handoffs** | Medium — implicit constraints may be lost | Add explicit "constraint block" to handoff protocol |
| **Multi-session context** | High — each session starts fresh, prior constraints forgotten | Most vulnerable to Category 2 smells |
| **Journal entries** | Low — append-only, but no constraint tracking | Could add "active constraints" section |

## 7. Key Takeaways

1. **"Interaction Smells" are to conversations what "code smells" are to codebases** — process-level quality indicators that predict fragility even when current outputs are correct
2. **Explicit invariant extraction and pre-generation audits significantly improve multi-turn quality** — separation of constraint management from generation is key
3. **This provides the mechanistic explanation for multi-turn degradation** that our portfolio has observed empirically but not explained at this granularity
4. **The taxonomy (3 categories, 9 subcategories) is the most granular failure classification for human-LLM interaction processes** — more granular than the Berkeley MAS failure study (2503.13657)
5. **Multi-agent systems face ALL these smells amplified by agent count** — if one LLM can't track its own constraints across turns, N LLMs tracking each other's constraints is exponentially harder

## 8. Rating Justification: ★★★★★

- Novel concept (Interaction Smells) with strong explanatory power
- First systematic taxonomy of process-level quality issues
- Direct actionable mitigation (InCE framework)
- Deep connections to 7+ papers in our portfolio
- Provides mechanistic grounding for multiple GUS Laws
- Immediately applicable to our system design

---

*Deep-Dive #237 completed 2026-03-15. Abstract-derived analysis (no HTML available). 236→237 deep-dives.*
