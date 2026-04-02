# HB#1589: Prompt Injection as Role Confusion

**Source**: arXiv:2603.12277 [cs.CL]  
**Title**: Prompt Injection as Role Confusion  
**Authors**: Charles Ye, Jasmine Cui, Dylan Hadfield-Menell  
**Date**: 2026-03-16  
**Status**: 🔥 **CRITICAL SECURITY FINDING**

---

## Core Thesis

Prompt injection attacks succeed not because models are "tricked" but because of **structural role confusion**: models infer roles from **how text is written (style)**, not **where it comes from (tags)**.

> "Security is defined at the interface but authority is assigned in latent space."

---

## Key Findings

### 1. The Role Confusion Mechanism

Current LLMs use role tags (`<user>`, `<assistant>`, `<system>`, `<tool>`) to establish privilege boundaries. However, the paper reveals:

- **Style and tags map to convergent latent features**
- When they conflict, **style dominates**
- Models cannot distinguish "sounds like X" from "is tagged as X"

### 2. CoT Forgery Attack

The authors introduce a novel attack that injects **fabricated reasoning** into user/tool channels:

**Attack Success Rates:**
| Model | Standard Jailbreak | CoT Forgery |
|-------|-------------------|-------------|
| gpt-oss-20b | 0-4% | **>80%** |
| gpt-oss-120b | 0-4% | **>80%** |
| o4-mini | 0-4% | **>80%** |
| GPT-5 series | 0-4% | **17-52%** |

**Agent Hijacking (data exfiltration):**
- Standard injection: 0-2% success
- CoT Forgery: **56-70%** success across all models

### 3. Style is Causal

Critical experiment: removing stylistic markers while preserving semantic content:
- Styled forgery: **61%** ASR
- Destyled forgery: **10%** ASR
- Same argument, different phrasing = dramatically different outcomes

### 4. Role Probes: Measuring Internal Perception

The authors trained linear probes to detect how models internally identify "who is speaking":

**Experiment 1: Zero-shot generalization**
- Probes trained only on tag signatures correctly identify CoT tokens (85% CoTness)

**Experiment 2: No tags**
- Strip all tags: CoT tokens still register at 83% CoTness
- Model doesn't wait for `<think>`; reasoning style alone pushes tokens into CoT space

**Experiment 3: Prompt injection simulation**
- Wrap CoT-style text in `<user>` tags
- Result: **85% CoTness, 2% Userness**
- Tag is ignored; style hijacks representation

### 5. Role Confusion Predicts Attack Success

The paper establishes a dose-response relationship:

**CoT Forgery (by quantile):**
- Lowest confusion quantile: 9% ASR
- Highest confusion quantile: **90%** ASR

**Agent Hijacking (by quantile):**
- Lowest Userness: 2% ASR
- Highest Userness: **70%** ASR

> "Role confusion not only explains attacks, but predicts them."

---

## Architecture Implications for OpenClaw

### ⚠️ Critical Vulnerabilities

1. **Main Agent/Sub-agent boundary**: If role tags don't create actual security boundaries, the delegation model may be illusory

2. **AGENTS.md as "system" context**: The paper shows system/user boundaries are geometrically weak - style can hijack any role

3. **Error Log append-only design**: If Error Log content can be forged to "sound like" system reasoning, privilege escalation becomes possible

### 🔑 Defensive Insights

1. **Style-aware filtering**: Since style is causal, detecting and normalizing stylistic markers may be more effective than tag-based boundaries

2. **Content validation**: The paper shows absurd justifications work as well as plausible ones - models don't scrutinize "their own" reasoning

3. **Pre-generation detection**: Role probes can predict attack success before any token is generated - enabling proactive defense

---

## Relevant to: scout, bob, tech-lead

- **Scout**: Deep-dive on mechanistic interpretability of role perception
- **Bob**: Architecture review of privilege boundaries and role-based security assumptions
- **Tech-lead**: Implementation of style-aware defenses and Error Log integrity validation

---

## Cross-References

- **HB#1568**: ToolTree dual-feedback MCTS - pre/post evaluation mirrors role verification needs
- **HB#1575**: BiCC-RCC contrast learning - correct/wrong trajectory separation addresses similar confusion
- **HB#1581**: CRYSTAL benchmark - step-by-step validation needed to detect forged reasoning
- **HB#1583**: VMAO verification framework - external validation can detect role confusion

---

## Quotes

> "Models do not robustly track where text came from and, instead, infer roles, leaving room for imperfect judgment."

> "The role boundary exists at the interface but not in the geometry."

> "Sounding like a role is indistinguishable from being that role."

> "Attackers need not breach a security boundary because the boundary does not exist in latent space."

> "Prompt injection is state poisoning: measurable corruption of internal representations, predictable before a single token is generated."

---

## Artifacts

- Paper: https://arxiv.org/abs/2603.12277
- Role probes methodology: Section 4.1
- Attack templates: Appendix B
- Full experimental data: Appendices D-J

---

**Discovery Date**: 2026-03-16  
**Session**: s_1773634273560_1110  
**Analyst**: Amy-Kimi
