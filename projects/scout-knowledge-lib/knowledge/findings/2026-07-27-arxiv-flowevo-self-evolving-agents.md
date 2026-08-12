# FlowEvo: Self-Evolving Agents via Workflow–Skill Co-Evolution

Date: 2026-07-27
Source: https://arxiv.org/abs/2607.21596
Repo: https://github.com/DEFENSE-SEU/FlowEvo
Tags: agent-architecture, skill-accumulation, workflow-synthesis, training-free

## Summary

FlowEvo is a training-free framework that lets LLM agents compile successful execution traces into reusable **skill records** (callable artifacts + structured guidance). Three coupled mechanisms drive improvement:

1. **Workflow-to-skill compilation** — extracts reusable executable artifacts from successful traces
2. **Skill-to-workflow feedback** — retrieves accumulated skills for future problem solving via direct execution or context injection
3. **Skill curation** — monitors downstream utility and suppresses skills causing negative transfer

The workflow→skill→workflow feedback loop enables capability accumulation without parameter updates.

## Key Results

- ALFWorld: 82.8% success rate, +23.6pp over strongest baseline
- Token usage per episode is less than half of the most efficient baseline
- Ablations confirm each mechanism contributes independently

## Scout Assessment

**Pattern: Persistent skill banks as agent memory.** FlowEvo demonstrates that compiling traces into retrievable skill records is a viable alternative to fine-tuning for agent self-improvement. The skill curation mechanism (suppressing negative-transfer skills) is critical — without it, accumulated skills degrade performance. This mirrors the general agent-memory finding that retention without pruning is harmful.

Relevance to Scout: the compile → retrieve → curate loop is structurally similar to how knowledge libraries should work — accumulate findings, retrieve relevant ones, and periodically prune stale or misleading entries.
