# SkillRL: Recursive Skill-Augmented RL (2026-03-16)
**Source**: arXiv:2602.08234 (Aiming Lab/NVIDIA/UMD)
**Code**: github.com/aiming-lab/SkillRL (418⭐)
**TL;DR**: 🔥🔥🔥🔥🔥 **里程碑级** — 递归技能增强强化学习；10-20× Token压缩；经验蒸馏+技能库协同进化

## Core Innovation

SkillRL bridges the gap between raw experience and policy improvement through **automatic skill discovery and recursive evolution**.

### Three-Stage Pipeline

```
Raw Trajectories → Skill Distillation → Hierarchical SkillBank → Recursive RL Evolution
```

| Stage | Mechanism | Output |
|-------|-----------|--------|
| **Experience Distillation** | Teacher model processes success/failure trajectories differentially | Structured skills + Failure lessons |
| **SkillBank Construction** | Hierarchical: General + Task-specific skills | Queryable skill library |
| **Recursive Evolution** | RL training with validation-failure-driven skill updates | Co-evolving policy + skills |

### Key Technical Details

**1. Differential Trajectory Processing**
- **Success trajectories**: Extract strategic patterns, critical decision points, generalizable reasoning
- **Failure trajectories**: Synthesize concise failure lessons (point of failure, flawed reasoning, counterfactual, prevention principles)

**2. Hierarchical SkillBank Structure**
- **General Skills (𝒮g)**: Universal strategic principles (exploration, state management, goal-tracking)
- **Task-Specific Skills (𝒮k)**: Domain-specific heuristics per task category
- **Skill Format**: `{name, principle, when_to_apply}` — enables efficient retrieval

**3. Recursive Skill Evolution**
```
For each validation epoch:
  if Acc(Category) < threshold:
    Collect failed trajectories (diversity-aware sampling)
    Analyze failures → Generate new skills or refine existing
    Update SkillBank
```

**4. Cold-Start SFT**
- Problem: Base model doesn't know how to use skills
- Solution: Teacher generates skill-augmented reasoning traces → SFT on demonstrations
- Result: Model learns to "retrieve, interpret, and apply skills"

### Experimental Results

| Benchmark | SkillRL | Improvement |
|-----------|---------|-------------|
| ALFWorld | SOTA | Faster convergence, higher asymptotic |
| WebShop | SOTA | +15.3% vs baselines |
| Search tasks (7) | SOTA | Robustness as complexity increases |

**Efficiency Gains**:
- Token compression: **10-20×** vs raw trajectories
- Convergence speed: **33% faster** than vanilla GRPO

## OpenClaw Mapping

| SkillRL | OpenClaw Equivalent | Validation/Tension |
|---------|---------------------|-------------------|
| Experience distillation (success) | AGENTS.md accumulation | ✅ Aligned |
| Failure lesson extraction | **Error Log design** | ✅ **Direct validation** |
| Hierarchical SkillBank | L1 Skills / L2 Error Log / L3 AGENTS.md | ✅ Isomorphic |
| Cold-start SFT | AGENTS.md static injection | ✅ Same philosophy |
| **Recursive skill evolution** | **L3 controlled evolution** | ⚠️ **Key difference** |
| Teacher model distillation | L3 human audit (read_by) | ⚠️ Automation vs Human |

### Critical Distinction: Evolution Mechanism

| Dimension | SkillRL | OpenClaw |
|-----------|---------|----------|
| Evolution trigger | Validation failure (automated) | Human judgment (L3 read_by) |
| Skill generation | Teacher model synthesis | Human + L3 Agent collaboration |
| Update frequency | Every validation epoch | On-demand / periodic |
| Safety constraint | Implicit (similarity threshold) | Explicit (read_by audit) |

### Key Insight

> SkillRL validates **failure-driven skill evolution** is effective, but uses automated teacher model for synthesis. OpenClaw's L3 human audit adds necessary safety layer — "what skills to add" is a design decision, not just a pattern extraction problem.

This aligns with HB#1665 (Reasoning Judges can be deceived): automated skill generation without human oversight risks compounding errors.

## Paper Metadata
- **arXiv**: 2602.08234 [cs.LG]
- **Authors**: Peng Xia et al. (Aiming Lab, NVIDIA, UMD, UCSC)
- **Venue**: Preprint (Feb 2026)
- **Related**: HB#1664 (DeReason), HB#1665 (LLM-as-Judge deception), HB#1663 (MR-Search)

**Relevant to**: 
- scout (Skill evolution mechanisms, RL training)
- bob (Skill hierarchy design, automation vs human oversight)
- tech-lead (SkillBank implementation patterns)

---
*Archived: 2026-03-16 | HB#1668*
