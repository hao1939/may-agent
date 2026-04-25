# Ecom-RLVE: Adaptive Verifiable Environments for E-Commerce Agents

**Source**: Hugging Face Blog (April 16, 2026) — Owlgebra AI / Hugging Face
**URL**: https://huggingface.co/blog/ecom-rlve
**Origin**: PyTorch OpenEnv Hackathon

## Core Finding

**Ecom-RLVE-GYM** extends RLVE (Reinforcement Learning with Verifiable Environments) from single-turn reasoning puzzles to **multi-turn, tool-augmented e-commerce conversations**. It provides 8 verifiable environments with algorithmic rewards — no LLM-as-judge required.

## The Problem: Fluency ≠ Task Completion

> "A customer who asks 'find me a USB-C charger under $25 that ships in two days' needs an agent that invokes the right catalog search, filters on three hard constraints, avoids hallucinating product IDs it never retrieved, and handles follow-ups when the top result goes out of stock."

Supervised fine-tuning teaches surface-level tool use but cannot scale to:
- Combinatorial constraint configurations
- Partial-information dialogues
- Multi-step transactional workflows

## Eight Verifiable Environments

| Environment | Agent Task | Verification |
|-------------|------------|--------------|
| **Product Discovery** | Find products satisfying all constraints | F1 over (product, variant, qty) tuples |
| **Substitution** | Find similar alternative when item out of stock | Compatibility + similarity matching |
| **Cart Building** | Add exact products, variants, quantities | Exact cart match |
| **Returns + Replacement** | Initiate return, suggest replacement | Order line identification accuracy |
| **Order Tracking** | Resolve which order, report status | Correct order + status retrieval |
| **Policy QA** | Answer deterministic policy questions | Exact policy match |
| **Bundle Planning** | Recommend complete shopping list within budget | Budget + completeness verification |
| **Multi-Intent Journey** | Chain 2-5 tasks in sequence | Sequential task completion |

## Three-Part Reward Signal

```
Total Reward = r_task + r_efficiency + r_hallucination
```

| Component | Description | Penalty/Reward |
|-----------|-------------|----------------|
| **Task reward** | Did agent complete the goal? | Binary or scaled by correctness |
| **Efficiency reward** | Completed without wasting turns? | Bonus for fewer agent-caused turns |
| **Hallucination penalty** | Only recommended retrieved products? | Penalty for inventing product IDs |

**Important**: User-caused turns (follow-ups, confirmations) don't count against efficiency.

## 12-Axis Difficulty Curriculum

A single difficulty number `d` (0-12) controls 12 independent aspects:

| Axis | Easy (d=0) | Medium (d=6) | Hard (d=12) |
|------|------------|--------------|-------------|
| Constraint count | 2 | 5 | 8 |
| Constraint omission rate | 5% | 70% | ~80% |
| Distractor fraction | 0% | 12% | 24% |
| Out-of-stock mid-conversation | 0% | 30% | 50% |
| Turn budget | Generous | Moderate | Tight |
| Input noise (typos, slang) | None | Moderate | High |
| Context switches | None | Occasional | Frequent |
| Retrieval depth | Shallow | Medium | Deep |
| Order history size | Small | Medium | Large |
| Policy complexity | Simple | Moderate | Complex |
| Tool budget | Unlimited | Limited | Strictly limited |
| Multi-intent chaining | 1 task | 2-3 tasks | 4-5 tasks |

## Adaptive Scheduling

Each environment tracks success rate independently and **only advances to harder problems once the agent passes reliably**. This keeps training at the capability frontier — avoiding "too easy to learn" and "too hard to progress".

## Deep Dive: Cart Building (E_CART)

### Five Required Skills

| Skill | Practice |
|-------|----------|
| Product Discovery | Search catalog with well-formed queries |
| Variant Selection | Identify correct color/size/connector |
| Cart Management | Add exact (product_id, variant_id, qty) |
| Clarification Dialogue | Ask focused follow-ups for ambiguity |
| Multi-Item Orders | Handle several products in one conversation |

### Six Available Tools

| Tool | Function |
|------|----------|
| `catalog_search` | Natural-language catalog query |
| `catalog_get_variants` | Return available variants |
| `cart_add` | Add product with variant and quantity |
| `cart_view` | Read current cart for verification |
| `user_get_visit_history` | Fetch recently viewed products |
| `ask_user` | Send clarification question |

### Variant Synthesis Strategy

Real catalogs have sparse variant data. Ecom-RLVE synthesizes variants at episode initialization:
- Category priority list picks natural attribute (electronics→connector_type; clothing→size)
- Generate 3 variants per target: 1 correct + 2 plausible distractors
- Verifier checks composite keys (product_id, variant_id)

### Difficulty Scaling Example (E_CART)

| Axis | d=0 | d=3 | d=6 | d=9 |
|------|-----|-----|-----|-----|
| Distinct items | 1 | 2 | 3 | 4 |
| Variant required | 21% | 66% | 93% | 99% |
| Multi-quantity | 0% | 30% | 50% | 50% |

## User Simulation

Uses **Qwen3.5 (9.7B)** to generate natural, varied user messages:
- Typo-filled requests
- Mid-conversation topic switches
- Strategic omission of constraints

**Key design**: Preferences match stated constraints — if user said "under $25", reward function actually cares about price.

## Early Training Results

**Config**:
- Base model: Qwen 3 8B
- Algorithm: DAPO (G=8 rollouts/prompt)
- LR: 1e-5
- Catalog: 2M products, FAISS index with Alibaba-NLP/gte-modernbert-base

**Finding**: Progressive growth in difficulty reached, confirming adaptive scheduling produces steady learning signal vs saturation/starvation patterns.

## Environment Scaling Hypothesis

```
C1 (Cart) ⊂ C2 (+Substitution) ⊂ C4 (+Product Discovery, Returns) ⊂ C8 (+Status, Policy, Bundle, Journey)
```

Hypothesis: C8 agents outperform single-environment specialists, even on specialist's own task (consistent with RLVE findings).

## Significance for OpenClaw

### ✅ Validated Directions
- **Verifiable rewards**: Algorithmic verification > LLM-as-judge for training
- **Multi-component rewards**: Task + efficiency + hallucination penalties
- **Adaptive difficulty**: Dynamic curriculum based on success rates
- **Variant handling**: Composite key verification (product + variant)

### ⚠️ Critical Gaps to Address
- **Skill verification**: How do we algorithmically verify Skill execution correctness?
- **Difficulty scaling**: Do OpenClaw Skills have graded difficulty levels?
- **Hallucination detection**: Can we verify agent only uses retrieved data?
- **Efficiency metrics**: Turn/token budget awareness in Skill execution

### 🔬 Research Opportunities
- Apply Ecom-RLVE's 12-axis difficulty model to OpenClaw's Gym scenarios
- Build verifiable reward functions for OpenClaw Skills
- Implement adaptive difficulty for Skill learning curriculum

## Related
- [HB-260426](HB-260426-agent-sandbox-infrastructure.md) — Sandbox infrastructure
- [HB-260426](HB-260426-skill-self-evolution-trend.md) — Skill self-evolution
- [HB-0013](HB-0013-skill-layering-atom-molecule-compound.md) — Skill layering
