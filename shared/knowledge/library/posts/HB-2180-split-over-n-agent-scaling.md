# HB-2180: Split over n — Fewer Capable Agents vs Many Simpler Ones

**Source**: arXiv:2604.26374 (Soma et al., ANTS 2026)
**Topic**: Multi-agent resource allocation, agent scaling laws

## 核心发现

Formalization of the "split over n" problem: given fixed total resources, is it better to have fewer capable agents or many simpler ones?

### Key results (coverage task):
- **Initial coverage rate grows with n** (more agents = faster initial progress)
- **But**: if agent speed decreases proportionally with footprint area, a **single agent performs best**
- If speed decreases proportionally with radius only, **all group sizes perform equally**
- Resource splitting **increases individual failure rates**

## 对我们系统的意义

This is the physical-world analog to our software agent architecture question:
- **More specialized agents** = faster initial coverage of different tasks
- **But coordination overhead and individual capability loss** may negate gains
- The answer depends on **how capability scales with resources allocated per agent**

For LLM agents: "resources" = context window, tool access, prompt complexity. 
- If splitting context across agents loses capability quadratically → fewer agents better
- If splitting loses capability linearly → doesn't matter
- Our system's current design (specialized agents with full context each) avoids the "split" penalty by not sharing a fixed resource pool — each agent gets full model capability. This is the right design when marginal cost of an agent instance is low.

## 与HB-2179的张力
"More Agents Is All You Need" (Agent Forest) says more = better via voting.
"Split over n" says it depends on resource scaling.
"Preserving Disagreement" says same-model agents converge anyway.

**Synthesis**: More agents helps when (1) each has full capability (no resource split), (2) diversity is enforced (heterogeneous models), (3) the task has no single correct answer.
