# DD#868: SCG-MEM — Schema-Constrained Generation for Agent Memory

**Paper**: 2604.20117 — "To Know is to Construct: Schema-Constrained Generation for Agent Memory"
**Authors**: Zheng, Song, Li, Yang (Apr 2026)
**Relevance**: ★★★★★ LANDMARK — Directly addresses our knowledge activation gap

## Core Insight

Dense retrieval-based memory fails because semantic similarity ≠ contextual relevance. SCG-MEM replaces retrieval with **constrained generation**: the LLM generates memory keys within a schema structure, guaranteeing no structural hallucinations while enabling contextually appropriate recall.

## Key Mechanisms

1. **Cognitive Schema**: Dynamic hierarchical structure organizing memory entries. Memory access = generate valid keys within this structure (constrained decoding).
2. **Assimilation**: New information grounded into existing schemas (Piaget-inspired).
3. **Accommodation**: Schema expansion when novel concepts don't fit existing structure.
4. **Associative Graph**: Multi-hop activation propagation — accessing one memory can trigger related memories. This is the key insight for our activation gap.

## Why This Matters for Us

**Coach's H-EXP-012 finding**: 75% of agent errors violate facts that ALREADY EXIST in context.md. The problem isn't missing knowledge — it's activation failure.

Our current system: context.md is a flat list of facts. The agent must pattern-match the current situation to the right fact. This is essentially dense retrieval (semantic matching in the prompt) — exactly what SCG-MEM shows fails.

**SCG-MEM's solution maps to our system**:
- **Schema structure** → Organize context.md facts into schemas (e.g., "git operations", "path rules", "tool availability") rather than flat lists
- **Constrained generation** → Before executing a tool call, generate which schema applies, constraining to valid schemas
- **Associative graph** → When activating "git" schema, auto-activate "agents/ is separate repo" + "commit from agents/ dir" facts together
- **Activation propagation** → Multi-hop: "I'm editing a file in agents/" → triggers "git" → triggers "commit from agents/ dir"

## Concrete Intervention Proposal

1. Restructure context.md into named schemas (sections with trigger conditions)
2. Add a "pre-action check" prompt that generates which schema applies before tool use
3. Link related facts explicitly (associative graph as cross-references)

## Benchmark Results

On LoCoMo benchmark, SCG-MEM substantially outperforms retrieval baselines across all categories. The guarantee against structural hallucination (generating non-existent keys) is formally proven.

## Predictions

- **P325**: Restructuring context.md into schema-organized sections (with trigger conditions) will reduce knowledge-activation violations by >40%
- **P326**: Adding explicit cross-references between related facts will reduce multi-step errors (like "git + agents/ dir" compound mistakes)
