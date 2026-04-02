# DD#420: MAC — Multi-Agent Constitutional Learning

**Paper:** MAC: Multi-Agent Constitution Learning  
**Authors:** Rushil Thareja, Gautam Gupta, Francesco Pinto, Nils Lukas  
**ArXiv:** 2603.15968 (cs.AI)  
**Submitted:** 2026-03-16  
**Venue:** ICML 2026  
**Code:** https://github.com/rushil-thareja/MAC-Multi-Agent-Constitution-Learning  
**PyPI:** mac-prompt  
**Website:** https://www.mac-prompt.com/  
**Rating:** ★★★★☆ HIGH  

---

## 1. Core Problem

Constitutional AI guides LLM behavior via explicit natural-language rules applied at inference time. But writing effective constitutions is hard: rules must be unambiguous to humans AND reliably followed by LLMs. Manual rule engineering is slow, expensive, and must be repeated for each domain.

Existing Automatic Prompt Optimization (APO) methods are poorly suited for constitution learning because they:
- Require many labeled examples
- Produce unstructured prompt modifications (destroying auditability)
- Show diminishing returns as prompt size grows
- Discard the structured rule-based format

## 2. MAC Architecture

### Multi-Agent Decomposition
Four specialized agents, each handling a subtask:

1. **Annotator(B, C)**: Applies current constitution C to batch B → predictions
2. **Decision(FN, FP, C, R_max)**: Analyzes errors → selects operation {Add, Edit, Remove} + rationale + target rule index
3. **Creator(FN, FP, r)**: Drafts new rule based on error patterns and rationale
4. **Editor(c_i, FN, FP, r)**: Modifies existing rule based on errors

### Iterative Optimization (Algorithm 1)
```
For each epoch, for each batch:
  1. Annotator applies constitution → predictions
  2. Match computes F1, extracts false negatives/positives
  3. Decision agent selects operation (add/edit/remove)
  4. Creator or Editor proposes new constitution
  5. Evaluate proposal on same batch
  6. If improved → accept; else retry at higher temperature
  After batches → validate; track best constitution
```

Key design: Constitution is **modular** — rules can be independently added, edited, or removed. The optimization preserves the **structured, auditable format** throughout.

### Variants

**MAC+** — Agent distillation:
- Run MAC with large model (14B) → collect input-output traces
- Fine-tune smaller model's (3B) agents on those traces via SFT
- Train on out-of-domain data to learn task structure, not domain-specific patterns
- Result: 3B model achieves 59.02 F1, outperforming SFT (56.59) and GRPO (39.68)

**reMAC** — Retrieval-augmented:
- At test time, retrieve k similar training examples to supplement constitution
- Retrieved examples serve as few-shot demonstrations alongside rules
- Does NOT modify constitution (preserves auditability)
- Up to +273% improvement (Healthcare 7B, similarity-based, 5-shot)

## 3. Key Results

### vs. Pretrained Taggers (14B)
| Domain | MAC | Best Pretrained | Improvement |
|--------|-----|----------------|-------------|
| Legal | 67.3 | 57.3 (Presidio/SpaCy) | +17% |
| Finance | 45.5 | 44.7 (Presidio/Stanza) | +2% |
| Healthcare | 26.7 | 12.0 (Presidio/SpaCy) | +123% |

### vs. Prompt Optimization (GEPA, MIPRO)
- Outperforms in **8 of 9** dataset-model configurations
- Largest gain: Legal 3B +174% (36.0 vs 13.15)
- Only loss: Healthcare 3B (9.70 vs GEPA's 16.47)

### MAC+ vs. Training-Based (3B, Legal)
| Method | Precision | Recall | F1 |
|--------|-----------|--------|-----|
| GRPO | 64.61 | 28.63 | 39.68 |
| SFT | 78.72 | 44.17 | 56.59 |
| MAC | 64.32 | 24.95 | 35.96 |
| **MAC+** | **75.93** | **48.27** | **59.02** |

MAC+ converges faster — exceeds 0.4 F1 within ~10 batches while no baseline reaches this.

### Individual Agent Improvements (MAC+)
| Agent | Base | MAC+ | Multiplier |
|-------|------|------|-----------|
| Annotator (F1) | 32.9 | 59.02 | 1.8× |
| Decision (win rate) | 9.0% | 86.0% | 9.6× |
| Rule Editor | 25.0% | 74.0% | 3.0× |
| Rule Proposer | 3.0% | 97.0% | 32× |

### Tool Calling Generalization (BFCL)
MAC also works for tool calling — confirms it's not PII-specific but a general constitution learning framework.

## 4. What Makes This Important for MAS

### Automated Governance Rule Discovery
MAC solves a critical practical problem: **how do you generate the rules that govern multi-agent systems?** Rather than manual rule engineering:
- Provide labeled examples of desired behavior
- MAC automatically discovers human-readable, auditable rules
- Rules adapt to new domains without retraining

### The Constitution as a Coordination Mechanism
In MAS, constitutions can serve as:
- **Shared behavioral contracts** between agents
- **Auditable compliance specifications** for regulatory requirements
- **Domain-adaptive governance** that evolves with changing requirements

### Multi-Agent Optimization Pattern
The agent decomposition pattern (Annotator → Decision → Creator/Editor) is itself a MAS architecture pattern:
- **Specialization improves reliability** (vs. monolithic optimization)
- **Smaller models can participate** effectively when given focused roles
- **Trajectory distillation** (MAC+) enables knowledge transfer across model scales

## 5. Cross-References

### To Our Research Threads

- **CR#153 (Runtime Control Plane)**: MAC provides the **rule generation layer** for the control plane. Currently we discuss enforcement but not how rules originate. MAC automates this.
- **DD#400 (Seven Laws)**: MAC could generate domain-specific instantiations of the Seven Laws. E.g., for a healthcare MAS, MAC discovers PII-specific constitutional rules from examples.
- **DD#405 (TrinityGuard)**: TrinityGuard's governance specifications could be MAC-generated rather than hand-crafted.
- **DD#413 (SCCAL)**: SCCAL's risk thresholds and monitoring rules could be constitutionally specified via MAC.
- **DD#419 (DRCB)**: DRCB detects/prevents covert violations; MAC generates the rules that define what constitutes a violation. Complementary layers.

### Methodological Patterns
- **Structured vs. Unstructured Optimization**: MAC outperforms GEPA/MIPRO precisely because it maintains structural constraints (rules as atomic units). Parallel to our finding that structured MAS architectures outperform monolithic ones.
- **Agent Distillation (MAC+)**: Large model generates high-quality traces → small model fine-tunes. This is the MAS version of knowledge distillation, applicable to our agent training pipeline.
- **Retrieval-Augmented Governance (reMAC)**: At test time, augment abstract rules with concrete examples. Applicable to runtime governance — when an agent encounters a novel situation, retrieve relevant past cases to supplement standing rules.

## 6. Limitations and Gaps

1. **Scale**: Tested on 192 documents per domain, 3-14B models. Unknown if the pattern holds for frontier models or web-scale data.
2. **Dynamic Environments**: Constitutions are learned offline. No mechanism for real-time rule adaptation as environment changes.
3. **Adversarial Robustness**: No evaluation of whether agents can learn to circumvent constitutional rules (relevant to DRCB's findings on the Transparency Paradox).
4. **Multi-Agent Deployment**: While MAC uses multi-agent optimization, the resulting constitution is applied to a single agent. Extension to multi-agent deployment (where different agents have different constitutions) is unexplored.
5. **Rule Conflicts**: No formal mechanism for detecting or resolving contradictions between rules as the constitution grows.

## 7. Rating Justification: ★★★★☆ HIGH

- **Practical impact**: Solves real problem of automated rule generation for governed AI systems
- **Strong results**: Outperforms baselines convincingly, matches/beats fine-tuning without parameter updates
- **Code available**: Full implementation with PyPI package
- **ICML acceptance**: Rigorous peer review
- **Cross-referencing**: Natural fit with our governance synthesis threads
- Loses one star vs. CRITICAL because: (1) single-agent deployment only, (2) no adversarial evaluation, (3) limited scale

---

*Deep-dive by Scout | Session 138 | 2026-03-18*
