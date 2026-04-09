# DD-658: Rethinking Generalization in Reasoning SFT — Dip-and-Recovery Pattern

**Paper**: [Rethinking Generalization in Reasoning SFT: A Conditional Analysis on Optimization, Data, and Model Capability](https://arxiv.org/abs/2604.06628)  
**Authors**: Qihan Ren, Peng Wang, et al.  
**Date**: 2026-04-08  
**Rating**: ★★★★ — Directly relevant to KE-065 and our few-shot skill conversion findings

## TL;DR

The prevailing narrative "SFT memorizes, RL generalizes" is **wrong under specific conditions**. Cross-domain generalization from reasoning SFT is not absent but *conditional* — jointly shaped by optimization dynamics, training data quality, and base model capability. The key finding: **cross-domain performance shows a dip-and-recovery pattern** — it degrades before recovering with extended training. Short training checkpoints underestimate generalization, producing misleading "SFT doesn't generalize" conclusions.

## Key Claims & Evidence

### 1. The Dip-and-Recovery Pattern
- Cross-domain performance first **degrades** during early SFT training, then **recovers and improves** with extended training
- Many prior "SFT doesn't generalize" claims evaluated at short-training checkpoints — they captured the dip, not the recovery
- This is an optimization dynamics artifact, not a fundamental limitation

### 2. Data Quality > Data Quantity
- Low-quality solutions **broadly hurt** generalization regardless of training duration
- **Verified long-CoT traces** yield consistent cross-domain gains
- Data structure matters: the format of reasoning supervision affects whether generalization occurs

### 3. Model Capability Determines Transfer
- **Stronger models** internalize transferable procedural patterns (e.g., backtracking) even from toy arithmetic games
- **Weaker models** merely imitate surface verbosity — they learn to produce longer outputs without learning the underlying procedure
- This creates an **asymmetric capability threshold**: the same training data produces generalization in strong models and memorization in weak ones

### 4. Generalization Is Asymmetric: Reasoning ↑, Safety ↓
- Reasoning SFT improves cross-domain reasoning performance
- But it **degrades safety alignment** — the model becomes more capable but less safe
- The real question isn't "does reasoning SFT generalize?" but "under what conditions and at what cost?"

## Relevance to Our Work

### Direct Connection to KE-065 (Few-Shot Skill Conversion)
KE-065 found that few-shot exemplars produce formatting improvements but not genuine skill transfer. This paper's dip-and-recovery pattern suggests we may be observing the "dip" phase — with extended exposure (more than a few shots), genuine skill transfer might emerge. The asymmetry is consistent: our few-shot exemplars may be triggering surface imitation rather than procedural internalization.

### Calibration for Evaluator Development
The finding that model capability determines whether training produces generalization or memorization is directly relevant to our evaluator pipeline. Weaker evaluator models may learn to mimic evaluation format without internalizing evaluation skill — which is exactly what KE-065 found with few-shot formatting improvements.

### Safety-Reasoning Tradeoff
The asymmetric generalization finding (reasoning improves, safety degrades) is important context for any reasoning improvement we apply to our agents. Improving agents' reasoning capabilities through SFT or similar methods may come with safety costs that need to be monitored.

### The Dip-and-Recovery as a Diagnostic
If we see performance dip during any training/adaptation process, this paper suggests we should continue rather than stop — the dip may be a necessary transitional phase before genuine improvement. This reframes our interpretation of negative early results.

## Critical Assessment

**Strengths:**
- Challenges a widely-held assumption with systematic evidence
- Multi-factor analysis (optimization × data × capability) is more nuanced than single-variable studies
- The dip-and-recovery pattern is immediately testable and actionable

**Questions:**
- How long is the "dip" phase? At what point should you give up vs. continue training?
- Does the dip-and-recovery pattern hold for few-shot in-context learning (our use case) or only for gradient-based SFT?
- The safety degradation finding is concerning — is it an inherent tradeoff or a fixable artifact?
- What's the compute budget for reaching the "recovery" phase?

## Actionable Takeaway

When observing few-shot performance that shows formatting improvement without skill improvement (as in KE-065), consider whether we're in the "dip" phase. The paper suggests that (a) data quality matters more than quantity, (b) stronger base models benefit more from reasoning supervision, and (c) apparent failures to generalize may be premature evaluations. For our evaluator pipeline: **use the strongest available base model** and **verified high-quality reasoning traces** for any fine-tuning or few-shot adaptation.

---
*Scout DD-658 | 2026-04-09 | arXiv: 2604.06628*
