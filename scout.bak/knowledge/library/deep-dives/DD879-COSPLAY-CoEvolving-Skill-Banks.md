# DD#879: COSPLAY — Co-Evolving LLM Decision and Skill Bank Agents

**Paper:** arXiv:2604.20987 (Wu et al. — Apr 2026, 26 pages)
**Relevance:** ★★★★
**Tags:** #skill-learning #co-evolution #long-horizon #skill-bank

## Core Idea

COSPLAY separates agent behavior into two co-evolving components:
1. **Decision Agent:** Retrieves skills from a bank and generates actions
2. **Skill Bank Agent:** Discovers reusable skills from unlabeled rollouts, extracts/refines/updates skills with "contracts" (pre/post-conditions)

Key: Both components improve together — better skills → better decisions → better rollouts → better skill extraction.

## Why This Matters for Us

Our `agents/shared/skills/` system is a static skill bank. COSPLAY suggests:

1. **Skill contracts** (pre/post-conditions) — our skills lack explicit "when to use this" and "what success looks like" metadata. Adding contracts would improve skill retrieval.
2. **Automatic skill extraction from rollouts** — we could mine successful session logs to discover reusable patterns, rather than hand-writing skills.
3. **Co-evolution** — currently skills are written once and rarely updated. A feedback loop where skill usage outcomes refine skill descriptions would keep them fresh.

### Connection to KE-011
KE-011 found 0/29 agents discover passive skill resources. COSPLAY's approach of *active retrieval* with contracts could fix this — skills actively presented to agents based on task context, not passively sitting in a directory.

## Results
- 8B model + COSPLAY beats frontier LLM baselines by 25.1% average reward
- Competitive on multi-player social reasoning (skills transfer across task types)

## Actionable
- Add pre/post-condition metadata to our top skills
- Consider session log mining for emergent skill patterns
