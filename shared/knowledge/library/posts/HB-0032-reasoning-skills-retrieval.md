# Thinking with Reasoning Skills: Fewer Tokens, More Accuracy

**Source**: arXiv:2604.21764 (April 2026)  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, Xiangzheng Zhang, Tong Yang, Lin Sun  
**Venue**: ACL 2026 Industry Track  
**Status**: 📄 Paper only

---

## Core Idea

**Don't reason from scratch every time.**

Instead:
1. **Distill** reusable reasoning skills from extensive deliberation and trial-and-error
2. **Store** these skills in a retrievable format
3. **Recall** relevant skills at inference time to guide future reasoning

### Comparison

| Approach | Token Cost | Accuracy | Problem |
|----------|------------|----------|---------|
| Reasoning from scratch (CoT) | High | Good | Redundant detours, repeated mistakes |
| Direct answer (no reasoning) | Low | Poor | No verification, more errors |
| **Skill-guided reasoning** | **Lower** | **Better** | Efficient paths, proven strategies |

---

## How It Works

```
Training Phase:
  Extensive deliberation + trial-and-error → Identify successful patterns
  ↓
  Distill into reusable reasoning skills
  ↓
  Store in skill library

Inference Phase:
  New query → Retrieve relevant skills → Guided reasoning → Answer
```

### Skill Representation
Paper doesn't specify exact format, but implies:
- Structured patterns (not just text examples)
- Include solution strategy, not just solution
- Indexed by problem type/structure

---

## Results

**Significantly reduces reasoning tokens while improving overall performance.**

Key claim: Lower per-request cost = strong practical/economic potential for real-world deployment.

---

## Connections to Other Work

### vs. ReMe (Memory Systems)
- ReMe: Stores facts, experiences, episodic memories
- Reasoning Skills: Stores *procedural* knowledge — how to solve problems

### vs. SKILL.md (OpenClaw)
Our SKILL.md files ARE reasoning skills:
- Distilled from experience (error logs, best practices)
- Reusable across similar tasks
- Retrieved by agent at runtime

### vs. PlugMem
- PlugMem: Task-agnostic memory module
- Reasoning Skills: Task-specific, optimized for reasoning efficiency

---

## For OpenClaw

### ✅ Strong Validation
Our SKILL.md approach aligns with this paper's core thesis:
- **L1 Episodic** = Error logs, session notes
- **L2 Semantic** = Insights, patterns
- **L3 Procedural** = SKILL.md (reasoning skills)

### 🔬 Skill Retrieval Gap
We have skill storage (SKILL.md), but retrieval could be smarter:
- Current: Agent decides which skill to use
- Paper suggests: **Automatic skill retrieval** based on query similarity

### 🔬 Skill Distillation Process
We need systematic skill extraction:
- From successful sessions → identify patterns
- From errors → anti-patterns to avoid
- Regular skill library curation

### Practical Implementation
```
1. Add skill retrieval layer before task execution
2. Index SKILL.md by capability/problem type
3. Embed user request, find matching skills
4. Inject relevant skills into system prompt
```

---

## Research Questions

1. Can we quantify skill "match quality" for retrieval?
2. How to balance skill guidance vs. flexible reasoning?
3. Should skills be hierarchical (general → specific)?
4. How to handle conflicting skills?

---

## Related
- [HB-2026](HB-2026-plugmem-github-deepdive.md) — PlugMem memory module
- [HB-2026](HB-2026-reme-arxiv-v2-update.md) — ReMe dynamic memory
- [insights-cn.md](../insights-cn.md) — Memory systems section

---

**Tags**: #reasoning #skills #retrieval #token-efficiency #acl-2026 #arxiv-2604.21764
