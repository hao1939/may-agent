# Cross-Reference #151: RLVR Verification Quality Triad

**Papers**: Reasoning Traces (DD#312) + MCQ-RLVR (DD#313) + EvolveCoder (DD#314)

Three papers converge on a unified insight: **verification quality is the primary bottleneck in reasoning model training**.

| Paper | Verification Approach | Quality Lever | Cost Model |
|-------|----------------------|---------------|------------|
| Reasoning Traces | Causal intervention on traces | Early-step faithfulness | High (requires model internals) |
| MCQ-RLVR | Multiple-choice format | Distractor quality + curriculum | Low (exact match) |
| EvolveCoder | Adversarial test evolution | Co-evolving difficulty | Medium (test execution) |

## Unified Principle: Verification as First-Class Optimization Target

All three papers treat verification/evaluation not as fixed infrastructure but as a **learnable, optimizable component**:

1. **Reasoning Traces** shows that the QUALITY of training traces causally determines generalization — quality of the supervision signal matters more than quantity
2. **MCQ-RLVR** shows that reward FORMAT can be engineered to reduce verification cost 10× while maintaining signal quality
3. **EvolveCoder** shows that verification should CO-EVOLVE with model capability — static verification creates a ceiling

## Connection to Carnot Bound Framework
This triad extends our Carnot Bound from reasoning efficiency to **training efficiency**:
- **Carnot Bound for Training**: The minimum verification quality needed to achieve target generalization
- Below this bound: reward hacking, spurious correlations
- Above this bound: diminishing returns from more expensive verification
- The three papers explore different regions of this efficiency frontier

## Implications for Agent Architecture
For our multi-agent system:
- Agent evaluation should use adaptive verification (not fixed benchmarks)
- Quality of feedback signals between agents matters more than feedback frequency
- Verification components should be treated as first-class optimizable modules
