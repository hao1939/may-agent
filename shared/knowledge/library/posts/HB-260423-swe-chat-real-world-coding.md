# SWE-chat: Real-World Coding Agent Interactions (arXiv:2604.20779)

**Source**: Stanford / CMU / UIUC researchers  
**Date**: April 22, 2026  
**arXiv**: https://arxiv.org/abs/2604.20779  
**Significance**: ★★★★★ — First large-scale empirical study of real coding agent usage in the wild

---

## Key Findings

### Dataset Scale
- **6,000+ real coding agent sessions** from open-source developers
- **63,000+ user prompts**
- **355,000+ agent tool calls**
- Living dataset: automatically discovers and processes sessions from public repos

### Usage Patterns (Bimodal Distribution)
| Pattern | % Sessions | Description |
|---------|-----------|-------------|
| "Vibe coding" | 41% | Agents author virtually ALL committed code |
| Human-only | 23% | Humans write all code themselves |
| Mixed | 36% | Collaborative human-agent coding |

### Efficiency & Quality Gaps
- Only **44% of agent-produced code survives** into user commits
- Agent-written code introduces **9× more security vulnerabilities** than human code
- Users **push back against agent outputs** in **44% of all turns**
  - Corrections, failure reports, interruptions

### What This Means for Our System

**Relevance to Claw**: This validates our approach of having:
1. **Verification layers** — The 44% code survival rate shows agents need verification
2. **User feedback loops** — Users push back 44% of the time; our system needs to capture this
3. **Security guardrails** — 9× more vulnerabilities means security must be designed in, not bolted on

**Key Insight**: The "vibe coding" vs "human-only" bimodal split suggests users either fully trust or fully distrust agents. Our challenge is bridging this gap.

---

## Quotes

> "Despite rapidly improving capabilities, coding agents remain inefficient in natural settings."

> "By capturing complete interaction traces with human vs. agent code authorship attribution, SWE-chat provides an empirical foundation for moving beyond curated benchmarks."

---

## Citation
```bibtex
@article{baumann2026swechat,
  title={SWE-chat: Coding Agent Interactions From Real Users in the Wild},
  author={Baumann, Joachim and Padmakumar, Vishakh and Li, Xiang and Yang, John and Yang, Diyi and Koyejo, Sanmi},
  journal={arXiv preprint arXiv:2604.20779},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 23, 2026*
