# DD-702: DOVA — Deliberation-First Multi-Agent Orchestration

**Rating**: ★★★★½
**Paper**: "DOVA: Deliberation-First Multi-Agent Orchestration for Autonomous Research Automation" (Shen, Shen — March 2026)
**arXiv**: 2603.13327
**Relevance**: Verification budget allocation, adversarial verification protocols, and adaptive computation depth

---

## Core Innovation

A multi-agent platform with three interlocking innovations:
1. **Deliberation-first orchestration** — explicit meta-reasoning *before* any tool invocation
2. **Hybrid collaborative reasoning** — composable 3-phase pipeline (ensemble → blackboard → iterative refinement)
3. **Adaptive multi-tiered thinking** — 6-level token-budget allocation reducing cost 40-60% on simple tasks

## Architecture

```
Query → Interface Layer (REST/CLI/UI/MCP)
         │
         ▼
   Deliberation Layer (meta-reasoning)
   ├── User model + entity-aware context
   ├── Mandatory trigger detection
   └── Decision: RESPOND_DIRECTLY vs USE_TOOLS
         │
         ▼
   Agent Pool (5 specialized agents)
   ├── ResearchAgent (multi-source search)
   ├── ProfilingAgent (user model management)
   ├── ValidationAgent (code analysis + sandbox)
   ├── SynthesisAgent (narrative + attribution)
   └── DebateAgent (adversarial Bull-vs-Bear)
         │
         ▼
   Collaborative Reasoning Pipeline
   Phase 1: Ensemble (parallel, diversity)
   Phase 2: Blackboard (shared workspace, voting)
   Phase 3: Iterative Refinement (multi-round critique)
```

## Key Mechanisms

### 1. Deliberation-First Orchestration (Algorithm 2)
The orchestrator does NOT reflexively call tools. Instead:
- Formats user expertise profile
- Extracts entity-aware context from conversation
- Retrieves recent turns (k=6)
- Discovers available tools
- **LLM deliberates**: Is external information necessary?
- Mandatory triggers override: temporal keywords ("latest", year ≥2025), specificity markers

**Cost impact**: Tool-call volume reduced by fraction f_d (queries answerable from context alone). Savings = f_d × avg_tool_cost.

### 2. Hybrid Collaborative Reasoning (Algorithm 3)

**Phase 1 — Ensemble**: Multiple agents solve independently in parallel.
- Agreement score: A(c₁,...,cₙ) = max(0, 1 - Var(c₁,...,cₙ))
- High variance → low agreement → triggers deeper verification

**Phase 2 — Blackboard**: Shared workspace with weighted contributions.
- Post weight: w(p) = c_base(p) · (1 + ā(p))/2
- ā(p) = mean peer agreement votes ∈ [-1, 1]
- Dissenting views from Phase 1 posted as evidence

**Phase 3 — Iterative Refinement**: Top synthesis refined through multi-round critique.
- Combined confidence: c* = ½(c̄_ens + c_iter)
- Default 2 rounds (marginal information gain diminishes beyond 2)

### 3. Adaptive Multi-Tiered Thinking (Algorithm 4)

| Level | Budget | Typical Tasks |
|-------|--------|---------------|
| Off | 0 | Embeddings |
| Minimal | 1,024 | Classification |
| Low | 4,096 | Summarization |
| Medium | 16,384 | Code generation |
| High | 32,768 | Reasoning, research |
| XHigh | 65,536 | Complex analysis |

Budget function: B(t,h,q) = Bud[clamp(β(t) + α(h) + γ(q), 0, 5)]
- β: task type → base level
- α: complexity hint → adjustment {-1, 0, +1, +2}
- γ: query length → adjustment {-1, 0, +1}

**2-4× scaling** between adjacent levels. Simple tasks get 1K tokens; complex analysis gets 64K.

### 4. Multi-Round Adversarial Debate (Algorithm 6)
Bull-vs-Bear pattern for evaluative queries:
- **Sequential turn-taking** is critical: round r Bull conditions on all prior Bear arguments
- Creates implicit convergence: arguments surviving multiple rounds carry higher epistemic weight
- Default R=2 rounds (cost-effective sweet spot)
- Synthesis output: balanced summary + surviving strengths + validated concerns + confidence

### 5. Multi-Component Confidence Scoring
C(r,p) = Σ(wₖ · fₖ(r,p)) / Σwₖ with four components:
- f_len: Response length adequacy
- f_ref: Refusal pattern detection (penalizes hedging)
- f_fmt: Format compliance
- f_rel: Keyword overlap relevance
- Threshold: C ≥ 0.6 acceptable; C < 0.7 triggers iterative refinement

### 6. Diversity-Aware Memory Retrieval
MMR reranking over 3-tier memory:
- Short-term (TTL = 86,400s)
- Long-term (persistent)
- Procedural (reusable skills)
- MMR(dᵢ) = λ·sim(dᵢ,q) - (1-λ)·max_S sim(dᵢ,dⱼ), λ=0.5

## Ablation Results

| Configuration | Confidence | Coverage | Token Eff. | Latency |
|--------------|-----------|----------|------------|---------|
| **DOVA-Full** | **0.82** | **0.90** | **0.71** | **12.4s** |
| −Collaboration | 0.68 | 0.65 | 0.74 | 6.1s |
| −Thinking (fixed Med) | ~similar conf | ~similar cov | lower eff | higher lat |
| Single-LLM baseline | lower | lower | higher | lower |

Key finding: Collaboration provides **+0.14 confidence and +0.25 coverage** at cost of +6.3s latency and −0.03 token efficiency. The confidence/coverage gains are substantial.

## Critical Analysis

### Strengths
- **Deliberation prevents waste**: Not every query needs tools. The meta-reasoning step is a genuine innovation over reflexive ReAct.
- **Composable collaboration**: Three patterns (ensemble → blackboard → refinement) compose into a pipeline, rather than being mutually exclusive.
- **Budget allocation is principled**: 6 levels with clear task-type mapping. The clamp function prevents runaway costs.
- **Adversarial debate is formalized**: Bull-vs-Bear with sequential turn-taking creates genuine convergence dynamics.

### Limitations
- **Confidence scoring is shallow**: The 4-component scoring (length, refusal, format, relevance) misses semantic accuracy entirely. No factual verification.
- **Agreement ≠ correctness**: Ensemble agreement score A = 1 - Var(confidences) measures consensus, not truth. Multiple agents can confidently agree on wrong answers.
- **Ablation is architectural, not empirical**: "Expected relative performance based on architectural analysis" — needs real benchmark validation.
- **2-round debate limit**: Paper claims marginal gains diminish, but provides no empirical evidence for this specific claim.

## Implications for Our Architecture

### 1. Verification Budget Allocation
DOVA's 6-tier thinking budget maps directly to our verification depth allocation problem. Simple claims → minimal verification; complex/controversial claims → deep adversarial analysis. The budget function B(t,h,q) is immediately applicable.

### 2. Deliberation Before Verification
Don't verify everything. The deliberation-first pattern applies to verification: assess whether verification is warranted before spending compute on it. This connects to DD-689 (Sherlock selective verification).

### 3. Ensemble → Blackboard → Refinement for Verification
Phase 1 (ensemble) = multiple verification methods independently.
Phase 2 (blackboard) = aggregate evidence with weighted voting.
Phase 3 (refinement) = iterative critique of synthesis.
This is a verification orchestration protocol.

### 4. Adversarial Debate for Claim Assessment
The Bull-vs-Bear pattern with sequential conditioning and structured synthesis output is directly applicable to claim verification — one agent argues FOR a claim's validity, one argues AGAINST, with synthesis extracting surviving evidence.

## Cross-References
- **DD-701** (Semantic Router DSL): Complementary — DSL handles cross-layer policy compilation; DOVA handles orchestration-level verification
- **DD-689** (Sherlock): Selective verification → DOVA's deliberation-first extends this with budget allocation
- **DD-698** (AEGIS): Forensic dialectics → DOVA's Bull-vs-Bear debate formalizes this pattern
- **KE-104**: Verification architecture — DOVA provides the budget allocation layer
- **DD-690** (CoCo): Continuous oversight → DOVA's ensemble agreement monitoring is similar

---
*Scout DD-702 | 2026-04-09 | Verification Orchestration Research Sprint*
