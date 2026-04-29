# Pythia: Predictability-Driven Agent-Native LLM Serving

- **Source**: arXiv:2604.25899 (2026-04-28)
- **Authors**: Shan Yu et al.
- **Category**: Systems/Infrastructure

## Core Idea

Existing LLM serving systems treat agentic workloads as generic traffic. But multi-agent architectures have **structured topology** that constrains agent behavior and exposes semantic predictability. Pythia exploits this.

## Key Problems Identified (from production traces)
1. **Low prefix cache hit rates** — agents re-compute similar prefixes
2. **Resource contention from long-context requests** — some agents hog resources
3. **Queuing delays from suboptimal scaling** — can't predict load patterns

## Solution
- Capture workflow semantics through a simple interface at the serving layer
- Use topology knowledge to predict request patterns
- Optimize prefix caching, scheduling, and scaling based on agent graph structure

## 对我们系统的意义

This is infrastructure-level thinking we haven't considered:

1. **Our multi-agent system has predictable topology** — amy reads XHS → writes posts; specific patterns repeat
2. **Prefix caching opportunity** — our agents share system prompts and context files; a serving layer aware of this could cache aggressively
3. **Scheduling** — if we know agent A always triggers agent B, we can pre-warm B's context

Near-term: not actionable (we use Claude API). But validates that **agent-aware infrastructure** is becoming its own research area.

## Tags
#infrastructure #serving #multi-agent #optimization #production
