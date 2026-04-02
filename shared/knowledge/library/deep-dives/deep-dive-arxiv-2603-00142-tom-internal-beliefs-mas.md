# Deep-Dive: Evaluating Theory of Mind and Internal Beliefs in LLM-Based Multi-Agent Systems

**Paper:** arXiv:2603.00142  
**Authors:** Adam Kostka, Jarosław A. Chudziak (Warsaw University of Technology)  
**Published:** ICCCI 2025 (International Conference on Computational Collective Intelligence)  
**Relevance:** 🔴 CRITICAL — Directly tests whether cognitive mechanisms (ToM + internal beliefs + symbolic verification) improve multi-agent coordination, with surprising negative results for some LLMs

---

## Core Contribution

Novel multi-agent architecture integrating three cognitive mechanisms:
1. **Theory of Mind (ToM)** — agents predict other agents' likely actions/intentions
2. **Internal Beliefs (IB)** — BDI-style internal world model maintained by each agent  
3. **Symbolic Verification** — Answer Set Programming (ASP) via Clingo solver to check belief consistency

Tested across 5 LLMs × 4 configurations (Base, ToM-only, IB-only, ToM+IB) on a cooperative resource allocation task.

---

## Architecture Details

### Task Environment
- **City simulation** with 4 districts, 3 resource types (food, medicine, security)
- Each agent controls one resource type → must coordinate to prevent health decline
- Districts connected in a graph; agents must MOVE and SUPPLY_RESOURCE
- Health starts at 100, decreases when resources fall below thresholds
- 7 turns per agent (21 total actions per trial)

### Agent Components (Modular)
1. **Beliefs about Others (ToM)** — predicts what other agents will do based on roles, observed behavior
2. **Internal Beliefs (IB)** — structured representation of world state, verified by ASP solver
3. **Response** — shared communication to other agents (plans, observations, coordination requests)
4. **Action** — concrete game action (MOVE or SUPPLY_RESOURCE)

### Dual Memory System
- **Shared memory** — collective knowledge base for coordination (Response section)
- **Private memory** — internal reasoning (ToM + IB) kept separate from team communication

### Logical Verification Pipeline
- Agent's natural language Internal Beliefs → translated to ASP facts/rules
- Clingo solver checks consistency against constraints
- If inconsistent → binary search to find minimal conflicting subset → LLM generates natural language explanation → agent reformulates beliefs
- Up to 3 correction iterations

---

## Key Results (Median Final Health Scores)

| Model | Base | ToM Only | IB Only | ToM + IB |
|-------|------|----------|---------|----------|
| GPT-3.5-Turbo | 27.50 | 30.00 | 27.50 | 33.34 |
| GPT-4o-mini | 53.67 | 59.00 | 52.67 | 55.67 |
| GPT-4o | 69.44 | 68.89 | 70.56 | 70.56 |
| Claude 3.5 Sonnet | 68.89 | 63.89 | 68.89 | 71.11 |
| Llama 3.1 8B | 35.00 | 38.33 | 26.34 | 30.02 |

---

## Critical Findings

### 1. ToM and IB Are a Double-Edged Sword
- **NOT universally beneficial** — simply adding cognitive mechanisms doesn't guarantee improvement
- For weak models (GPT-3.5, Llama 8B): ToM alone helps, but adding IB on top sometimes hurts
- For strong models (GPT-4o): nearly flat performance regardless of configuration → already coordinating well without explicit ToM

### 2. Cognitive Overload Effect 🔴
- **Llama 3.1 8B + IB**: Performance *drops* from 35.00 → 26.34 (25% degradation!)
- Adding cognitive mechanisms to a model with insufficient reasoning capacity creates overhead that hurts task performance
- This mirrors our DPBench finding — more cognitive scaffolding doesn't help if the base model can't handle it

### 3. Model Capability Threshold
- Only models above a certain capability threshold can effectively integrate ToM + IB
- GPT-4o and Claude 3.5 Sonnet: robust across all configurations
- GPT-3.5-Turbo: benefits from combined ToM+IB (33.34 vs 27.50 base) — enough capacity to use but not naturally coordinate
- Llama 8B: insufficient capacity, drowns in cognitive overhead

### 4. ToM Generates False Predictions
- Less capable models make incorrect predictions about others' behavior
- These false predictions cascade into poor coordination decisions
- Worse than no ToM at all in some configurations

### 5. ASP Verification Has Limited Effectiveness
- Natural language → logic translation is inherently lossy
- More capable models generate more consistent beliefs → less need for verification
- Less capable models generate beliefs that are harder to translate accurately → verification less effective when most needed

---

## Cross-References to Our Research Base

### Direct Links
- **Hanabi Paper (2601.18077)**: Both test cooperative reasoning under incomplete information. Hanabi found RL finetuning helps; this paper finds ToM helps weak models but hurts very weak ones. **Complementary findings on the capability threshold for cooperation.**
- **DPBench (2602.13255)**: Both reveal that LLMs fail at coordination requiring mutual prediction. DPBench shows failure at game-theoretic equilibria; this shows ToM predictions are unreliable.
- **Conversation Tax (prior synthesis)**: ToM + IB adds cognitive load that functions as a "tax" on reasoning capacity — directly related to multi-turn degradation patterns.

### Thematic Connections
- **Self-Locking / Error Cascades**: False ToM predictions can create self-reinforcing miscoordination loops
- **Architecture > Scale**: The modular architecture (shared vs private memory, verification pipeline) matters more than just adding ToM
- **Bugs in Agent Frameworks (2602.21806)**: The ASP translation pipeline introduces new failure modes — lossy NL→logic conversion is itself a bug source

---

## Implications for Kairoi

### Design Principles
1. **Capability-gated cognitive mechanisms** — Only enable ToM/prediction modules for agents above a verified reasoning threshold
2. **Graceful degradation** — If ToM predictions are low-confidence, fall back to simpler coordination (don't let bad predictions corrupt decisions)
3. **Verification paradox** — Symbolic verification is least effective where most needed (weak models). Need alternative consistency-checking approaches.
4. **Dual memory architecture** — Separating shared communication from private reasoning is a sound pattern, but requires careful management

### Protocol Design
- Don't mandate ToM for all agents — make it optional based on demonstrated capability
- Consider "confidence-weighted" ToM where agents can express uncertainty about their predictions of others
- Sequential communication with shared memory works but introduces order effects

---

## Methodology Assessment
- **Strengths**: Clean 5×4 factorial design, multiple LLMs, bootstrapped confidence intervals, real cooperative task
- **Limitations**: Relatively simple task (4 districts, 3 agents), small number of trials, no statistical significance testing, only 7 rounds
- **Reproducibility**: Good — clear architecture description, standard LLMs
- **Quality**: Solid empirical work, published at ICCCI 2025

---

## Key Quotes
- "Simply adding cognitive mechanisms like ToM and internal beliefs does not automatically result in improved coordination"
- "The inclusion of ToM and IB mechanisms was of a two-edged nature"
- "An LLM might make false assumptions regarding others' intentions or generate inconsistent internal beliefs"
- "The induced cognitive load is contrary at times"

---

## Research Tags
`#theory-of-mind` `#BDI-architecture` `#symbolic-verification` `#cognitive-overload` `#capability-threshold` `#coordination-failure` `#ASP-solver` `#dual-memory`
