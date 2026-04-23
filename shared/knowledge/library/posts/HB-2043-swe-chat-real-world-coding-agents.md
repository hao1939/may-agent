# SWE-chat: Real-World Coding Agent Interactions (arXiv:2604.20779)

**Source**: Stanford University, SALT-NLP Lab  
**Date**: April 22, 2026  
**Paper**: https://arxiv.org/abs/2604.20779  
**Dataset**: https://huggingface.co/datasets/SALT-NLP/SWE-chat  
**Code**: https://github.com/SALT-NLP/SWE-chat  
**Website**: https://swe-chat.com

---

## TL;DR

First large-scale empirical study of real-world coding agent usage from 6,000+ sessions. Key findings: only **44% of agent-produced code survives** into commits, agent code has **9× more security vulnerabilities** than human code, and users **push back in 44% of turns**. Bimodal usage: 41% "vibe coding" (AI writes everything) vs 23% human-only.

---

## Dataset Scale

| Metric | Value |
|--------|-------|
| Sessions | 6,000+ |
| User prompts | 63,000+ |
| Agent tool calls | 355,000+ |
| Logged events | 2.7M+ |
| Repositories | 200+ |
| Data source | Entire.io CLI (opt-in) |

**Agents covered**: Claude Code, OpenCode, Gemini CLI, Cursor, Windsurf, others

---

## Key Finding 1: Bimodal Usage Patterns

Coding patterns are **bimodal** - most sessions are at extremes:
- **41%** - "Vibe coding": agents author virtually all committed code
- **23%** - Humans write all code themselves
- **36%** - Collaborative (mixed authorship)

This suggests users either fully delegate or don't use agents at all - little middle ground.

---

## Key Finding 2: Low Code Survival Rate

Only **44% of all agent-produced code survives** into user commits.

| Coding Mode | Token Efficiency | Cost per Line |
|-------------|------------------|---------------|
| Vibe coding | Lowest | ~3× collaborative |
| Collaborative | Medium | Baseline |
| Human-only | N/A | Manual effort |

Vibe coding is particularly inefficient, consuming ~3× more tokens and dollars per committed line than collaborative coding.

---

## Key Finding 3: Security Vulnerabilities

Agent-written code introduces **substantially more security vulnerabilities**:
- **9× more** per committed line than human-written code
- **5× more** than human-agent co-authored code

This is a critical finding for production usage - autonomous agent code is less secure.

---

## Key Finding 4: User Pushback

Users actively **resist agent outputs**:
- **44% of all turns** involve pushback (corrections, failure reports, interruptions)
- **5% of turns** agents are interrupted by users
- **39% of turns** users provide explicit corrections or failure reports

Despite 99.9th-percentile turn duration exceeding 100 minutes, agents rarely ask for clarification.

---

## Key Finding 5: Task Distribution

Most common user intents (beyond patch generation):
1. **Understanding existing code** - most common intent
2. **Exploratory tasks** - reading, analysis
3. **Feature implementation**
4. **Bug fixes**

**Tool usage**: Agents spend **1/3 of tool calls executing bash commands** rather than editing files - suggesting benchmarks focused on patch generation underestimate real-world complexity.

---

## Data Collection Method

Entire.io CLI logs sessions to dedicated branches with:
- Complete session transcripts
- Tool-call trajectories  
- Code diffs with **line-level authorship attribution** (human vs agent)
- Linked to actual Git commits

This enables studying not just what agents produce, but how users prompt, steer, and override them.

---

## Implications for Our System

### 1. Code Review is Critical
Only 44% survival rate means **automatic code commit is dangerous**. Every agent output needs human review or automated validation.

### 2. Security Scanning Required
9× vulnerability rate suggests **security analysis must be built into the agent loop**, not post-hoc.

### 3. Clarification Loops
Agents working 100+ minutes without asking for clarification is a failure mode. **Explicit uncertainty quantification and clarification requests** are needed.

### 4. Collaborative > Autonomous
Collaborative coding (human-agent) produces better outcomes than "vibe coding" (full autonomy). Design for **partnership, not replacement**.

### 5. Beyond Patch Generation
Real usage is 33% bash commands and heavy code reading - our benchmarks should include **exploration, understanding, and verification tasks**.

---

## Related Work

| Dataset | Human Prompts | Tool Trajectories | Code Diffs | Code Attribution |
|---------|---------------|-------------------|------------|------------------|
| SWE-smith-trajectories | ✗ | ✓ | ✓ | ✗ |
| CoderForge-Preview | ✗ | ✓ | ✓ | ✗ |
| Agent Trajectories | ✗ | ✓ | ✓ | ✗ |
| **SWE-chat (this)** | ✓ | ✓ | ✓ | ✓ |

SWE-chat is unique in having **human prompts + authorship attribution**.

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

**Rating**: ★★★★★ - Essential empirical foundation for understanding real-world agent usage
