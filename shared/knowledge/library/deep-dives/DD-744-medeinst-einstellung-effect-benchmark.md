# DD#744: MedEinst — Benchmarking the Einstellung Effect in Medical LLMs

**Source**: arXiv:2601.06636 (Chen et al., Jan 2026)
**Rating**: ★★★★★
**Relevance**: Directly grounds EXP-130 iatrogenic mechanism. First rigorous benchmark for exemplar-induced fixation in LLMs.

## Key Findings

### The Einstellung Effect in LLMs
The Einstellung effect — fixation on familiar solutions that blocks discovery of better alternatives — has been rigorously demonstrated in LLMs via counterfactual clinical diagnosis:

1. **Bias Trap Rate**: Despite high baseline accuracy, frontier LLMs exhibit severe bias trap rates when presented with "trap" cases — cases where discriminative evidence is altered to flip the correct diagnosis, but surface-level patterns still match the original.
2. **Statistical shortcuts over evidence**: LLMs rely on pattern-matching from training data rather than patient-specific evidence, causing systematic misdiagnosis in atypical cases.
3. **Counterfactual pair methodology**: 5,383 paired cases across 49 diseases. Each pair = control case (where patterns work) + trap case (where patterns mislead). Measures fixation as the gap between correct-on-control and wrong-on-trap.

### ECR-Agent: Mitigation Through Structured Reasoning
Their proposed mitigation has three critical components:
1. **Dynamic Causal Inference (DCI)**: Dual-pathway perception (what confirms vs. what discriminates), three-level causal reasoning (association → intervention → counterfactual), evidence audit.
2. **Critic-Driven Graph Evolution (CGME)**: Iterative refinement storing validated reasoning paths + evolving knowledge graphs.
3. **Key insight**: Architectural intervention (forcing causal reasoning structure) breaks fixation where prompting alone fails.

## Relevance to Our System

### Direct EXP-130 Grounding
EXP-130 showed few-shot examples cause -67pp iatrogenic degradation on discovery tasks. MedEinst explains WHY:
- Few-shot examples ARE bias traps — they establish "what correct looks like" as a surface pattern
- The agent fixates on matching the example template rather than reasoning from evidence
- This is exactly the "template-as-ceiling" mechanism: the example creates an Einstellung that blocks novel approaches

### Connection to H-099 (Discovery Boundary)
MedEinst's trap cases are analogous to discovery tasks — they require the agent to OVERRIDE pattern-matching with genuine reasoning. The finding that even frontier models have severe bias trap rates validates H-099's claim that creative inference is irreducible to scaffolding.

### Connection to KE-101 (Five Laws)
ECR-Agent's success via architectural intervention (not prompting) validates Law 2 (structural > content). Their DCI dual-pathway = our adversarial framing principle (look for what confirms AND what disconfirms).

## Actionable Lessons

1. **HIGH**: "Bias Trap Rate" metric should be adapted for our evaluator — measures fixation separately from competence.
2. **HIGH**: ECR-Agent's dual-pathway perception maps to adversarial verification (proven in EXP-103 for confabulation). Key: force the agent to reason about what DISCONFIRMS the obvious answer.
3. **MEDIUM**: Counterfactual pair methodology could be adapted for gym scenario design — test whether agents can handle cases where familiar patterns mislead.

## Cross-References
- **EXP-130**: Few-shot iatrogenic (-67pp). MedEinst explains template-as-ceiling mechanism.
- **H-099**: Discovery tasks resist all interventions. MedEinst's trap cases = tasks requiring pattern override.
- **KE-101 Law 2**: Structural > content. ECR-Agent validates architectural mitigation.
- **DD#739**: Instruction stacking degradation. Few-shot = additional "instruction" causing pairwise conflicts.
- **CR#333**: Intervention validity — adversarial framing works architecturally, not as prompt injection.

## Tags
Einstellung effect, fixation, few-shot iatrogenesis, counterfactual evaluation, discovery tasks, cognitive bias
