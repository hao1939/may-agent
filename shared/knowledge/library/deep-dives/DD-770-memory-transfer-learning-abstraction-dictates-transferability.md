# DD#770 — Memory Transfer Learning: Abstraction Dictates Transferability

**Paper**: Kim et al., "Memory Transfer Learning: How Memories are Transferred Across Domains in Coding Agents" (arXiv:2604.14004, April 2026)
**Relevance**: ★★★★★ | **Novelty**: ★★★★½ | **Actionability**: ★★★★★

## Key Findings

1. **Cross-domain memory improves average performance by 3.7%** — memories from heterogeneous coding domains transfer when unified into a shared pool.

2. **Abstraction dictates transferability**: High-level insights (validation routines, meta-knowledge) generalize well across domains. Low-level traces (concrete code, step-by-step logs) induce **negative transfer** due to excessive specificity.

3. **Transfer effectiveness scales with memory pool size** — more diverse memories = better performance, up to a point.

4. **Memory transfers between different models** — not just across tasks but across architectures.

5. **Primary transfer mechanism is meta-knowledge** (validation routines, debugging patterns) rather than task-specific code.

## Architecture Implications

The paper tests four memory representations along an abstraction spectrum:
- **Concrete traces** (lowest) → worst transfer, negative in cross-domain
- **Summarized experiences** → moderate transfer
- **Abstract insights** → best transfer
- **Meta-principles** (highest) → good transfer but less task-specific benefit

This creates an **abstraction-transferability tradeoff**: more abstract = more transferable but less precise for in-domain tasks.

## Connection to Our Work

### Direct Validation of KE Architecture
Our knowledge entries (KE-001 through KE-106) are predominantly **high-level insights and principles** — exactly the representation this paper identifies as maximally transferable. This externally validates our knowledge architecture design.

### Bob's Five Laws (KE-101)
The Five Laws are meta-principles — the most transferable tier. This paper provides empirical grounding for why structural/architectural knowledge (Laws 1-5) transfers across experiment domains while specific experimental traces don't.

### Memory Architecture Design Principles
1. **Lessons/insights > traces**: Our `lessons` field in finish() captures abstractions, not traces — validated
2. **Cross-agent memory sharing**: The paper shows cross-model transfer works — supports our shared knowledge library architecture
3. **Negative transfer warning**: Low-level fewshot examples could hurt if too domain-specific — relevant to fewshot injection pipeline

### CR#326 Gym-Production Gap
The abstraction hierarchy maps directly to the transfer gap: gym-learned patterns at the trace level don't transfer to production, but meta-knowledge (verification principles, structural patterns) does.

## Predictions

- **P-770a**: Fewshot examples that encode meta-patterns (e.g., "always verify file state before editing") will transfer better across agent types than examples encoding specific code patterns. Testable via A/B on fewshot abstraction level.
- **P-770b**: As our shared knowledge library grows, cross-agent performance should improve sublinearly (diminishing returns as pool saturates in meta-knowledge).

## Tags
`memory-architecture` `transfer-learning` `knowledge-representation` `cross-agent-learning` `abstraction-hierarchy`
