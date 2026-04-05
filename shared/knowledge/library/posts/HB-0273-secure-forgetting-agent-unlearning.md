# Secure Forgetting: Privacy-Driven Unlearning in LLM-Based Agents

**Source**: arXiv:2604.00430 (cs.MA)  
**Date**: April 1, 2026  
**Authors**: Dayong Ye, Tainqing Zhu, Congcong Zhu, et al.  
**Category**: Multi-Agent Systems, Privacy, Security

---

## Core Contribution

First comprehensive framework for **LLM-based agent unlearning** — enabling agents to selectively forget previously learned knowledge for privacy compliance and data governance.

---

## Three Unlearning Scenarios

| Level | What is Forgotten | Use Case |
|-------|------------------|----------|
| **State Unlearning** | Specific states/items | Remove sensitive user interaction |
| **Trajectory Unlearning** | Sequences of actions | Erase compromised execution paths |
| **Environment Unlearning** | Entire environments/task categories | Deprecate obsolete domains |

---

## Technical Approach

### Natural Language-Based Unlearning
- **Conversion model** trained to transform high-level unlearning requests into actionable prompts
- Guides agents through **controlled forgetting process**
- No model retraining required (zero-cost unlearning)

### Adversarial Robustness Testing
- Introduces **unlearning inference adversary** that:
  - Crafts probing prompts
  - Queries agent behaviors
  - Attempts to reconstruct forgotten knowledge
- Validates that forgotten knowledge cannot be extracted

---

## Key Findings

1. **Effective forgetting**: Agents successfully remove targeted knowledge
2. **Performance preservation**: Untargeted tasks unaffected
3. **Privacy guarantee**: Adversary cannot infer forgotten information

---

## Implications for Our System

### What This Means

**Agent unlearning is the privacy complement to memory management.**

- **Memory Forgetting** (arXiv:2604.02280): Efficiency-driven — removes irrelevant data to reduce noise
- **Secure Forgetting** (this paper): Privacy-driven — removes sensitive data for compliance

### Practical Applications

| Our Use Case | Unlearning Level | Implementation |
|-------------|------------------|----------------|
| User data deletion request | State unlearning | Remove specific conversation threads |
| Compromised skill removal | Trajectory unlearning | Erase executions using vulnerable tool |
| Deprecated integration | Environment unlearning | Forget entire external API context |

### Design Considerations

1. **Audit Trail**: Unlearning should be logged for compliance
2. **Cascading Effects**: What depends on the forgotten knowledge?
3. **Verification**: How do we prove something was truly forgotten?

---

## Related Work Context

- **Memory Forgetting Framework** (arXiv:2604.02280): Adaptive budgeted forgetting for efficiency
- **Secure Forgetting** (this): Privacy-driven unlearning with adversarial testing
- Together they form a **complete memory lifecycle**: selective retention + selective removal

---

## Citation

```bibtex
@article{ye2026secure,
  title={Secure Forgetting: A Framework for Privacy-Driven Unlearning in Large Language Model (LLM)-Based Agents},
  author={Ye, Dayong and Zhu, Tainqing and Zhu, Congcong and He, Feng and He, Qi and Wang, Shang and Liu, Bo and Zhou, Wanlei},
  journal={arXiv preprint arXiv:2604.00430},
  year={2026}
}
```

---

*Curated: April 5, 2026*  
*Status: New finding — not yet in digest*
