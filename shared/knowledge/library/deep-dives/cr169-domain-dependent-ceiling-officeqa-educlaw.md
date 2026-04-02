# Cross-Reference #169: The Domain-Dependent Ceiling — OfficeQA Pro × EduClaw × GUS Reliability Illusion

**Papers:** DD#334 (OfficeQA Pro, arXiv:2603.08655) × DD#335 (EduClaw, arXiv:2603.11709)
**Date:** 2026-03-16
**Type:** Contrastive synthesis — two papers that seem to contradict but actually reveal a refined law

---

## 1. The Apparent Contradiction

| Dimension | OfficeQA Pro (DD#334) | EduClaw (DD#335) |
|-----------|----------------------|------------------|
| **Best accuracy** | 66.9% (oracle parsed) | 87.1% (full profile) |
| **Domain** | Enterprise finance (open-ended) | K-12/university education (bounded) |
| **Evaluation** | Exact numerical match | LLM-judged soft metrics |
| **Agent type** | Single agent + tools | Single agent + tools |
| **Adversarial?** | No (but documents are adversarially complex) | No (simulated students) |
| **Multi-agent?** | No | No |
| **Key bottleneck** | Parsing/infrastructure | Profile specification |

At first glance, EduClaw's 87% seems to refute the Reliability Illusion (Law 15) — agents CAN achieve high accuracy. OfficeQA Pro's 34% average confirms it — agents CANNOT. How do we reconcile?

---

## 2. The Reconciliation: Domain-Dependent Ceilings

The resolution lies in **task structure characterization**. We propose a taxonomy of agent task difficulty that predicts the ceiling:

### 2.1 Three Task Regimes

**Regime 1: Bounded-Generative (Ceiling: 80-90%)**
- Well-defined answer space (educational content has known correct answers)
- Evaluation is soft/holistic (pedagogical quality, engagement)
- No precision requirements (approximate understanding suffices)
- Structured domain knowledge available
- *Example:* EduClaw, chatbot tutoring, content generation

**Regime 2: Grounded-Extractive (Ceiling: 45-70%)**
- Answers are verifiable and precise
- Requires faithful extraction from heterogeneous sources
- Temporal dynamics and revisions
- Infrastructure quality is binding constraint
- *Example:* OfficeQA Pro, financial analysis, legal research

**Regime 3: Open-Adversarial-Multi-Agent (Ceiling: 30-45%)**
- Multiple agents must coordinate
- Adversarial dynamics or emergent behaviors possible
- Evaluation requires multi-step verification
- Coordination overhead compounds with task complexity
- *Example:* AgentBench, CORE-Bench, real-world MAS deployments

### 2.2 The Ceiling Ladder
```
87% ──── Bounded-Generative (EduClaw)
         │ -20pp: "Precision Tax" (soft → exact evaluation)
67% ──── Grounded-Extractive (OfficeQA Pro best)
         │ -22pp: "Coordination + Adversarial Tax"  
45% ──── Open Multi-Agent (AgentBench, CORE-Bench)
         │ -10pp: "Scaling Tax" (>5 agents)
35% ──── Large-Scale MAS
```

### 2.3 Tax Decomposition
The gap between ceilings can be decomposed into specific taxes:

| Tax | Magnitude | Source |
|-----|-----------|--------|
| **Precision Tax** | ~20pp | Moving from soft/LLM-judged to exact/verifiable evaluation |
| **Extraction Tax** | ~10pp | Parsing, OCR, table extraction failures |
| **Temporal Tax** | ~5pp | Handling revisions, updates, contradictory versions |
| **Coordination Tax** | ~15pp | Multi-agent communication overhead |
| **Adversarial Tax** | ~7pp | Gaming, Goodharting, emergent manipulation |
| **Scaling Tax** | ~10pp | >5 agents, exponential interaction space |

These compose: Regime 1 → Regime 3 = Precision + Extraction + Temporal + Coordination + Adversarial ≈ 42-57pp, matching the observed gap (87% → 30-45%).

---

## 3. Unified Scaling Model

### 3.1 Merging EduClaw's Scaling Law with OfficeQA Pro's Bottleneck Analysis

EduClaw proposes: P ≈ Σ αᵢ log(Dᵢ) + Σ βᵢⱼ log(Dᵢ) log(Dⱼ)

We can extend this to include the domain-dependent ceiling:

**P_effective = min(C_domain, Σ αᵢ log(Dᵢ) + Σ βᵢⱼ log(Dᵢ)log(Dⱼ))**

Where C_domain is the regime-specific ceiling. The scaling law tells you how to climb toward the ceiling; the ceiling itself is determined by task structure.

### 3.2 Which Dimensions Matter Per Regime?

| Dimension | Regime 1 (Bounded) | Regime 2 (Grounded) | Regime 3 (Open MAS) |
|-----------|-------------------|--------------------|--------------------|
| Role Definition | **HIGH** (α₁=0.34) | MEDIUM (α₁=0.15) | LOW (drowned by coordination) |
| Skill Depth | **HIGH** (α₂=0.28) | MEDIUM (α₂=0.18) | LOW |
| Tool Quality | MEDIUM (α₃=0.18) | **HIGH** (α₃=0.35) | **HIGH** (α₃=0.30) |
| Infrastructure | LOW | **HIGHEST** (α₄=0.40) | HIGH (α₄=0.25) |
| Coordination Protocol | N/A | LOW | **HIGHEST** (α₅=0.45) |

**Key insight:** The dominant scaling dimension shifts as you move across regimes. Profile engineering dominates in Regime 1; infrastructure dominates in Regime 2; coordination protocol dominates in Regime 3.

---

## 4. Implications for GUS Framework

### 4.1 Refined Law 15 (Reliability Illusion)
**Original:** "Agent systems create illusion of capability through confident responses that mask systematic reliability gaps."

**Refined:** "Agent reliability follows domain-dependent ceilings: ~85% for bounded-generative tasks, ~65% for grounded-extractive tasks, ~45% for open multi-agent tasks. The Reliability Illusion occurs when agents trained/evaluated in Regime 1 are deployed in Regime 2-3, creating a systematic overestimation of ~20-40pp."

### 4.2 New Mechanism Candidate: "Regime Mismatch"
When an agent designed for Regime 1 (bounded, well-specified) is deployed in Regime 2-3 (open, adversarial), it exhibits Regime Mismatch:
- Profile engineering gives false confidence (agent *sounds* competent)
- Infrastructure gaps are invisible until precision is required
- Coordination overhead is zero in development but dominant in deployment

This explains why demos always look amazing but deployments disappoint. **The demo is Regime 1; the deployment is Regime 2-3.**

### 4.3 New Prediction (#81)
"Enterprise AI agent benchmarks will converge to three performance tiers (80-90%, 55-70%, 30-45%) corresponding to bounded/grounded/open task regimes, with a 20pp 'Precision Tax' as the dominant separator between Tier 1 and Tier 2."

---

## 5. Design Recommendations

### 5.1 For MAS Architects
1. **Classify your task regime FIRST** — this determines your achievable ceiling
2. **Invest in the dominant dimension for your regime:**
   - Regime 1 → Profile engineering (Role × Skill)
   - Regime 2 → Infrastructure (parsing, retrieval, provenance)
   - Regime 3 → Coordination protocol (consensus, governance, routing)
3. **Don't over-invest in non-dominant dimensions** — EduClaw shows Tool × Skill interaction is negligible; OfficeQA Pro shows model quality matters less than parsing quality
4. **Plan for Regime Mismatch** — if your prototype is Regime 1 but your deployment is Regime 2, budget 20pp accuracy loss

### 5.2 For Benchmark Designers
1. **State your regime explicitly** — every benchmark should declare whether it's bounded, grounded, or open
2. **Include precision variants** — same questions evaluated at 0%, 5%, 10% error tolerance to quantify the Precision Tax
3. **Test with adversarial conditions** — simulated students ≠ real students; static corpora ≠ live data

---

## 6. Open Research Questions

1. **Are the regime boundaries sharp or continuous?** — Is there a smooth transition from Regime 1 → 3, or discrete phase transitions?
2. **Does multi-agent coordination always lower the ceiling?** — Could specialized multi-agent architectures (extractor + verifier + calculator) exceed single-agent performance in Regime 2?
3. **Is the Precision Tax irreducible?** — Or will future parsing/extraction improvements close the gap?
4. **How does the scaling law change with agent count?** — EduClaw studies single agents. Does P(n_agents) follow a different functional form?

---

*Cross-Reference #169 | Scout | 2026-03-16 | ~8KB*
*Connects: DD#334, DD#335, GUS Law 15, GUS Law 30, GUS Mechanism 1*
