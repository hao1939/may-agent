# KE-069: SFT Dip-and-Recovery — Early Evaluations Systematically Underestimate Generalization

**Status**: Verified (external empirical)
**Source**: DD-658 (Rethinking Generalization in Reasoning SFT — multi-factor analysis)
**Confidence**: Moderate-High (systematic study, but applicability to in-context learning uncertain)
**Created**: 2026-04-09

## Core Finding

Cross-domain performance during reasoning SFT shows a **dip-and-recovery pattern**: performance first degrades before recovering and improving with extended training. Many prior "SFT doesn't generalize" claims captured the dip, not the recovery. The prevailing narrative "SFT memorizes, RL generalizes" is **wrong under specific conditions** — generalization is jointly shaped by optimization dynamics, data quality, and base model capability.

## Key Evidence

### 1. The Dip-and-Recovery Pattern
- Cross-domain performance **degrades** during early SFT
- Then **recovers and improves** with extended training
- Short-training checkpoints produce misleading "SFT doesn't generalize" conclusions
- This is an optimization dynamics artifact, not a fundamental limitation

### 2. Data Quality > Data Quantity
- Low-quality solutions broadly hurt generalization regardless of training duration
- **Verified long-CoT traces** yield consistent cross-domain gains
- Data format/structure affects whether generalization occurs

### 3. Capability-Dependent Transfer (Asymmetric Threshold)
- **Stronger models** internalize transferable procedural patterns (e.g., backtracking)
- **Weaker models** merely imitate surface verbosity — longer outputs without underlying procedure
- Same training data → generalization in strong models, memorization in weak ones

### 4. Asymmetric Generalization: Reasoning ↑, Safety ↓
- Reasoning SFT improves cross-domain reasoning performance
- But **degrades safety alignment** — more capable but less safe
- The real question: "under what conditions and at what cost?"

## Why It Matters

### For Our Few-Shot Research (KE-065, H-091)
- KE-065 found few-shot exemplars produce formatting improvements but not genuine skill transfer
- **Dip-and-recovery reframes this**: We may be observing the "dip" phase — with extended exposure, genuine transfer might emerge
- The asymmetry is consistent: our few-shot exemplars may trigger surface imitation rather than procedural internalization
- **Critical question**: Does dip-and-recovery apply to in-context learning (our case) or only gradient-based SFT?

### For Evaluator Development
- Weaker evaluator models may learn to **mimic evaluation format** without internalizing evaluation skill
- This is exactly what KE-065 found with few-shot formatting improvements
- **Use the strongest available base model** for evaluation tasks

### For Interpreting Negative Results
- When observing performance dip during any training/adaptation process, consider whether it's a **necessary transitional phase**
- Don't abandon interventions at the dip — the recovery may follow
- **Diagnostic**: If performance shows formatting improvement without skill improvement, may be at the dip

### Connection to Our Knowledge Base
- **KE-065 (Few-Shot Comprehensive Findings)**: Formatting improvements without skill transfer may be the "dip" pre-recovery
- **KE-060 (Intervention Taxonomy)**: Capability threshold for transfer maps to M1 effectiveness — stronger models benefit more from analysis activation
- **H-091 (Skill Delivery Methods)**: Reframes boundary conditions — some boundaries may be premature evaluations rather than hard limits

## Limitations

- Study covers **gradient-based SFT**, not in-context learning — transfer to our few-shot context is speculative
- No clear guidance on how long the "dip" phase lasts or when to give up
- Safety degradation concern for any reasoning improvement
- Compute budget for reaching recovery phase unclear

## Actionable Implications

1. **Reframe negative results**: Before concluding an intervention "doesn't work," check if we're evaluating at the dip
2. **Use strongest available models**: Capability threshold means weaker models memorize where stronger ones generalize
3. **Data quality over quantity**: For any training/fine-tuning, verified high-quality reasoning traces matter more than volume
4. **Monitor safety alongside capability**: Reasoning improvements may come with safety costs

---
*Bob synthesis from DD-658 | 2026-04-09*
