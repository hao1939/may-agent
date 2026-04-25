# H-195: Adaptive Compression Selection Improves Knowledge Utilization

**Created**: 2026-04-24 by Bob
**Status**: proposed
**Confidence**: P(H) = 0.62
**Source**: DD#880 (Experience Compression Spectrum, 2604.15877)
**Connects**: H-077 (schema context), H-043 (knowledge utilization bottleneck), H-078 (meta-learning), KE-123 (don't stack interventions)

---

## Claim

Knowledge retrieval accuracy and agent task success improve when the system adaptively selects the appropriate compression level (episodic → procedural → declarative) based on task novelty and complexity, rather than serving all knowledge at a fixed declarative level.

## Mechanism

DD#880 identifies a "missing diagonal" — all existing systems operate at a fixed compression level. Our system stores most knowledge as declarative rules (context.md, KEs) at ~1,000× compression. But novel/complex tasks may need lower compression (procedural skills at 50-500×, or episodic examples at 5-20×) to provide enough context for correct application.

The causal story: declarative rules (e.g., "don't use npx") are efficient for familiar situations but fail for novel compositions where the agent needs to understand *why* (procedural) or *when it happened before* (episodic). Our H-043 "known but violated" gap (75% of violations involve facts already in context) may partly be a compression mismatch — the knowledge is there but at the wrong level of detail for the task.

## Evidence

### Supporting
- DD#880: Survey of 22 systems shows transferability increases but specificity decreases with compression — rules transfer well but lose task-relevant detail
- H-043 / H-EXP-012: 75% known-but-violated rate suggests declarative rules alone don't activate properly
- EXP-195: Direct hints (low-compression, episodic-like) achieved 40% on cascading-fix-trap-v2 where declarative skills achieved 0% — lower compression = higher activation for novel tasks
- KE-123: Stacking multiple declarative interventions degrades performance — suggests agents have a compression-level capacity limit
- DD#882 (GAAMA): Concrete implementation of multi-level compression (episode→fact→reflection) with graph-based retrieval achieves 78.9% vs 75.0% RAG baseline on LoCoMo-10. Shows maintaining all compression levels simultaneously + associative retrieval outperforms single-level approaches.

### Against / missing
- EXP-210: Schema-organized context (a compression-level optimization) showed no significant difference — ceiling effect may mask the phenomenon
- The known-but-violated gap could be purely attention/position-based, not compression-related
- No direct A/B comparing compression levels for the same knowledge yet

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Novel task + episodic example | ≥20pp improvement over declarative rule alone |
| Familiar task + declarative rule | No difference vs episodic (ceiling) |
| Novel task + procedural skill | 10-15pp improvement over declarative, less than episodic |
| Adaptive selection (match level to novelty) | ≥15pp improvement on mixed task portfolio |

## Test Plan

- **Design**: 3-arm experiment on a task with known declarative-rule failure
  - Arm A: declarative rule only (current system)
  - Arm B: procedural skill (step-by-step how-to)
  - Arm C: episodic example (annotated session trace showing the pitfall)
- **Scenario**: A gym scenario where agents violate a known rule (e.g., compound-edit-verification or a C1.1-violating task)
- **N**: 10 per arm × 1 scenario = 30 runs (~$3)
- **Decision rule**: confirmed if Arm C > Arm A by ≥15pp AND Arm B intermediate; falsified if no significant ordering

## Implications if true

- Build adaptive compression router: task classifier → compression level → knowledge retrieval
- Convert high-violation KEs into multi-level entries (rule + procedure + example)
- DD#880's "missing diagonal" becomes our next major infrastructure investment
- Changes how we write skills: include episodic examples, not just declarative procedures

## Links

- Parent / related: H-077, H-043, H-078, DD#880
- Tracked in: agents/bob/workspace/todo.md
