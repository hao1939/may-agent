# DD#646 — Memory Intelligence Agent (MIA): Bidirectional Memory Evolution

**Source**: arXiv 2604.04503 (April 6, 2026)
**Rating**: ★★★★
**Status**: Ready for Bob

## Why This Matters

MIA introduces **bidirectional parametric/non-parametric memory conversion** — the first architecture where an agent can convert retrieved non-parametric knowledge (RAG-style) into parametric updates (model fine-tuning) AND vice versa. This bridges the gap between "retrieval-augmented" and "learning" agents.

## Key Findings

### Architecture: Manager-Planner-Executor with Memory Evolution
- **Manager**: Task decomposition and resource allocation
- **Planner**: Strategy formulation with memory-informed planning
- **Executor**: Action execution with real-time memory queries
- **Memory Module**: Dual parametric/non-parametric stores with bidirectional conversion

### Bidirectional Memory Conversion
1. **Non-parametric → Parametric**: Frequently retrieved patterns get "compiled" into model weights via lightweight fine-tuning (LoRA-style)
   - Reduces retrieval latency for common knowledge
   - Similar to human procedural memory formation
2. **Parametric → Non-parametric**: When model confidence drops, uncertain knowledge gets externalized back to explicit retrieval stores
   - Prevents hallucination from degraded parametric memory
   - Acts as a "safety valve" for knowledge quality

### Test-Time Learning
- **Planner updates during inference**: Not just using frozen model — the Planner module receives gradient updates from task outcomes during execution
- Evaluated on **11 benchmarks** spanning QA, reasoning, and planning tasks

### Connection to Our Research

| MIA Component | Our Framework |
|---|---|
| Dual memory stores | CR#305 Memory Stack (parametric L3 + non-parametric L1-L2) |
| Non-parametric → Parametric | DD#570 SKILL0 skill internalization |
| Parametric → Non-parametric | DD#604 SuperLocalMemory externalization |
| Manager-Planner-Executor | Standard agent architecture (no novel governance) |
| Test-time learning | DD#605 Decoction experience → weight updates |

## Critical Analysis

**Strengths**:
- First clean bidirectional memory conversion architecture
- Test-time learning is genuinely novel for agent systems
- 11-benchmark evaluation is thorough
- The "safety valve" (parametric→non-parametric) is architecturally elegant

**Weaknesses**:
- Fine-tuning during inference is expensive — unclear scaling to real-time
- No multi-agent memory sharing
- Manager-Planner-Executor is well-trodden ground architecturally
- Missing: formal analysis of when conversion should trigger (threshold problem)

## New Concepts

**Bidirectional Memory Conversion (BMC)**: The ability to transform knowledge between parametric (in-weights) and non-parametric (in-retrieval-store) forms based on usage frequency and confidence. Analogous to the cognitive science distinction between declarative and procedural memory, but with explicit conversion mechanisms.

**Confidence-Gated Externalization**: When model confidence on a retrieved fact drops below threshold, that knowledge is externalized back to the non-parametric store. This prevents the "confident hallucination" failure mode where degraded parametric memory produces high-confidence wrong answers.

## Predictions
- **P436**: Bidirectional memory conversion will become standard in production agent architectures within 18 months (confidence: 50% — the engineering complexity is high)
- **P437**: The confidence-gated externalization pattern will be independently rediscovered by at least 2 other groups (confidence: 75%)

## References
- R120: Memory Intelligence Agent paper (2604.04503)

## Tags
`memory-architecture` `parametric-memory` `test-time-learning` `bidirectional-conversion` `agent-architecture`
