# CR#292 — Non-Parametric Self-Evolution: The Memory-First Paradigm

**Cross-referencing:** DD#539 (MemCoder), DD#540 (Steve-Evolving), DD#528 (SEVerA), DD#532 (EvoSkills), DD#500 (ExpeL), DD#522 (LLM Wiki), CR#288 (Verified Self-Evolving Skill Architecture)
**Rating:** ★★★★★ — Two independent papers from different domains converge on identical paradigm

---

## The Convergence

Two papers from March 2026, from completely independent teams and domains, arrive at the same fundamental architecture for agent self-improvement:

| Dimension | MemCoder (DD#539) | Steve-Evolving (DD#540) |
|-----------|-------------------|------------------------|
| **Domain** | Software engineering (SWE-bench) | Embodied 3D worlds (Minecraft) |
| **Input signal** | Git commit history | Embodied interaction traces |
| **Structured representation** | Sextuple: (commit, changes, keywords, problem, root-cause, solution) | Experience tuple: (pre-state, action, diagnosis, post-state) |
| **Retrieval** | Dual-stage: FAISS ANN → cross-encoder reranker | Three-tier: summary → index → document |
| **Knowledge types** | Single track: solutions | Dual track: skills (positive) + guardrails (negative) |
| **Feedback loop** | Self-internalization (human-validated → memory) | Closed-loop control (diagnosis-triggered replanning) |
| **Evolution mechanism** | Memory growth (M_{N+1} = M_N ∪ {m_{N+1}}) | Accumulating skills + guardrails |
| **Parameter updates** | Zero | Zero |
| **Key result** | +9.4% absolute on SWE-bench Verified | Increasing success rates with experience accumulation |

## The Paradigm: Memory-First Self-Evolution

Both papers demonstrate that **agent capability evolution can be achieved entirely through memory management**, with zero parameter updates to the underlying LLM. This is the non-parametric self-evolution paradigm.

### Three Necessary Properties

1. **Structured representation** — Raw experience (git commits, interaction traces) must be transformed into structured, typed representations. MemCoder's sextuples and Steve-Evolving's diagnostic tuples both go far beyond naive "store the trajectory" approaches.

2. **Multi-stage retrieval** — Simple embedding similarity is insufficient. Both papers implement multi-stage retrieval: MemCoder uses ANN→reranker, Steve-Evolving uses summary→index→document hierarchy. The pattern: fast broad recall → precise semantic filtering.

3. **Closed feedback loop** — New validated experience must flow back into memory. MemCoder's self-internalization and Steve-Evolving's closed-loop control both close the evolutionary loop so the agent genuinely improves over time.

### What MemCoder Has That Steve-Evolving Doesn't

- **Human-in-the-loop validation** — MemCoder's self-internalization requires human confirmation before crystallizing solutions into memory. This prevents compounding errors.
- **Developer tacit knowledge** — Git history captures developer intent and reasoning, not just what happened.

### What Steve-Evolving Has That MemCoder Doesn't

- **Dual-track distillation** — Extracting BOTH positive skills AND negative guardrails. MemCoder only stores solutions (positive). Steve-Evolving's guardrail extraction from failures is the more complete approach.
- **Fine-grained diagnostic signals** — 13 check types, 11 failure causes, continuous indicators. MemCoder's diagnosis is less structured.
- **Three-tier memory hierarchy** — Explicit separation of summary (efficient), index (navigable), and document (complete) layers.

## Implications for Our System

### Immediate Actionable Items

1. **Adopt sextuple memory schema** for agent task completions: (raw_task, changes_made, keywords, problem_description, root_cause, solution_summary). This is the minimum viable structured memory.

2. **Add dual-track distillation** — When tasks succeed, extract reusable skills. When tasks fail, extract guardrails (what NOT to do). Currently we only learn from successes.

3. **Implement three-tier memory** — Our current flat memory structure should be reorganized into summary (for quick orientation), index (for retrieval), and document (for full context).

4. **Close the self-internalization loop** — Validated agent outputs should become new memory entries automatically, not require manual knowledge management.

5. **Measure the experience accumulation curve** — Plot agent success rate vs accumulated experience. If the curve is flat, you're doing RAG, not evolution. If it increases, you've achieved genuine self-improvement.

### The Unified Architecture

Combining the best of both papers:

```
Experience → Structured Tuples (sextuple schema)
    ↓
Three-Tier Memory (summary → index → document)
    ↓
Dual-Stage Retrieval (FAISS ANN → cross-encoder rerank)
    ↓
Dual-Track Distillation (skills + guardrails)
    ↓
Knowledge-Driven Planning (retrieved knowledge + guardrails in context)
    ↓
Diagnosis-Triggered Replanning (fine-grained execution monitoring)
    ↓
Self-Internalization (validated results → new memory entries)
    ↓
[Loop back to Experience]
```

### Connection to Verified Evolution (CR#288)

This memory-first paradigm is perfectly complementary to the verified self-evolution stack from CR#288 (SEVerA + EvoSkills + Lean-Agent):

- **CR#288** addresses: How do you evolve safely? (Formal output contracts + co-evolutionary verification)
- **CR#292** addresses: How do you evolve at all? (Structured memory + experience distillation + self-internalization)

Together: **Structure memory (CR#292) → Evolve skills within formal constraints (CR#288) → Verify outputs (DD#528) → Internalize validated results (DD#539)**

---

## Predictions

**P289:** By Q3 2026, "structured memory" approaches (typed schemas, not raw embeddings) will dominate the SWE-bench leaderboard. Unstructured RAG-only approaches will plateau.

**P290:** The dual-track distillation pattern (skills + guardrails) will become standard in agent frameworks by Q4 2026, replacing current success-only learning.

**P291:** Non-parametric self-evolution will prove sufficient for 80%+ of practical agent improvement use cases, with fine-tuning reserved for domain-specific foundation capabilities.

---

*Scout Session 271 — April 6, 2026*
