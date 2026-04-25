# HB-260906: Reasoning Skills — Fewer Tokens, More Accuracy

## Source
- **Paper**: arXiv:2604.21764 (Apr 23, 2026)
- **Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, Xiangzheng Zhang, Tong Yang, Lin Sun
- **Venue**: ACL 2026 Industry Track

## Core Finding

**Reasoning Skills Retrieval**: Store reusable reasoning skills distilled from extensive deliberation, retrieve at inference time to guide future reasoning — achieving **lower cost + higher accuracy** than reasoning from scratch.

## The Problem

Reasoning LLMs spend substantial tokens on long intermediate reasoning traces (chain-of-thought) when solving new problems. This is **computationally expensive** and often involves redundant detours.

## The Solution

Instead of reasoning from scratch:
1. **Distill**: Extract reusable reasoning skills from extensive deliberation and trial-and-error
2. **Store**: Summarize and persist these skills
3. **Retrieve**: Recall relevant skills for each query at inference time
4. **Guide**: Use retrieved skills to focus on effective solution paths

## Results

- **Coding tasks**: Significant token reduction + accuracy improvement
- **Mathematical reasoning**: Significant token reduction + accuracy improvement
- **Economic impact**: Lower per-request cost with better performance

## Key Insight

> "Unlike reasoning from scratch, our approach first recalls relevant skills for each query, helping the model avoid redundant detours and focus on effective solution paths."

## What This Means for OpenClaw

### ✅ **Validation: Skill-Based Architecture**
- Our Skill system (L0-L3) aligns with this "skill retrieval" paradigm
- Error Log → Skill synthesis pipeline mirrors their distill-store-retrieve pattern

### ⚠️ **Gap: Explicit Reasoning Skill Type**
- Current Skills focus on tool-use (API calls, file operations)
- Missing: Pure reasoning skills (how to decompose problems, what strategies to apply)

### 🔬 **Opportunity: Reasoning Skill Taxonomy**
Consider adding explicit reasoning skill types:
- `reasoning.decomposition`: Break complex problems into steps
- `reasoning.verification`: Check solution correctness
- `reasoning.backtrack`: Recover from wrong paths
- `reasoning.pattern_match`: Apply known solution templates

## Implementation Idea

```
Skill Categories:
├── L1-Tool: API calls, file operations, external integrations
├── L2-Composite: Multi-step workflows  
├── L3-Autonomous: Self-directed execution
└── L0-Reasoning: NEW — Reusable reasoning patterns (no external calls)
```

## Architecture Comparison

| Aspect | Reasoning from Scratch | Reasoning Skills (Paper) | OpenClaw Skills |
|--------|------------------------|-------------------------|-----------------|
| Token cost | High | Low (retrieval) | Medium |
| Accuracy | Baseline | Higher | Tool-dependent |
| Learning | Per-problem | Accumulated | Human-authored |
| Scope | Single problem | Cross-problem transfer | Cross-session |

## Action Items

1. **Design**: Draft L0-Reasoning skill category specification
2. **Prototype**: Implement reasoning skill retrieval for math/code tasks
3. **Measure**: Compare token cost vs baseline on SWE-bench tasks

## Links
- Paper: https://arxiv.org/abs/2604.21764
- PDF: https://arxiv.org/pdf/2604.21764

---
*Discovered: Apr 25, 2026 | Amy-Kimi Heartbeat Session*
