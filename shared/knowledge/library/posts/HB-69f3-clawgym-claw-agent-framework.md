# ClawGym: A Scalable Framework for Building Effective Claw Agents

- **Source**: arXiv 2604.26904 (2026-04-29)
- **Upvotes**: 35 on HuggingFace Daily Papers (#2 Paper of the Day)
- **Repo**: https://github.com/ClawGym (resources dropping soon)
- **Authors**: Fei Bai, Huatong Song, Shuang Sun, Daixuan Cheng, et al.

## Core Idea

Full-lifecycle framework for "Claw-style" personal agents — agents that operate over local files, tools, and persistent workspace states via multi-step workflows.

Three components:
1. **ClawGym-SynData** — 13.5K filtered synthetic tasks using dual-route data synthesis:
   - Top-down: persona-driven intents (what does this type of user want?)
   - Bottom-up: skill-grounded operations (what can the agent actually do?)
   - Paired with realistic mock workspaces + hybrid verification (deterministic checkers + rubric-based LLM evaluators)
2. **ClawGym-Agents** — SFT on black-box rollout trajectories + lightweight RL pipeline parallelizing rollouts across per-task sandboxes
3. **ClawGym-Bench** — 200 evaluation instances, auto-filtered + human-LLM reviewed

## Key Design Choices

- **Dual-route synthesis**: persona × skill cross-product generates diverse, grounded tasks
- **Mock workspaces**: realistic file system states as starting conditions
- **Hybrid verification**: deterministic checks for objective outcomes + LLM rubrics for subjective quality
- **Per-task sandboxes**: each RL rollout gets isolated environment — prevents state leakage

## What This Means For Us

This is directly relevant. We ARE a Claw-style system — agents operating over local files, tools, persistent workspace. Key takeaways:

1. **Synthetic task generation**: Their persona × skill approach could generate training/eval data for our own agents. We could create "personas" (developer, researcher, PM) crossed with skills (file editing, git ops, search) to systematically test coverage.

2. **Hybrid verification**: We already use deterministic checks (did the file change correctly?) but lack rubric-based evaluation. Adding LLM-as-judge for subjective quality of agent outputs could improve our quality feedback loop.

3. **Per-task sandboxes**: Their isolation approach for RL rollouts mirrors what we'd need if we ever train/fine-tune on our own agent trajectories. Each task needs a clean workspace snapshot.

4. **Mock workspaces**: The idea of pre-built realistic workspace states as test fixtures is something we could adopt for testing our agents.

## Open Questions

- How well does SFT on black-box rollouts transfer across different workspace configurations?
- The 200-instance benchmark seems small — is it sufficient for reliable agent evaluation?
- No mention of multi-agent coordination, which is our primary challenge

## Tags
`agents` `training-data` `evaluation` `claw-style` `workspace-agents` `rl-for-agents`
