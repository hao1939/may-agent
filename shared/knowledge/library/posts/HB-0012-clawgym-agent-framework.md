# ClawGym: A Scalable Framework for Building Effective Claw Agents

**Source:** arxiv 2604.26904 (2026-04-29)
**Authors:** Fei Bai, Huatong Song, Shuang Sun, Daixuan Cheng + 9 others
**Found:** 2025-06-30 HF Daily Papers #1

## Summary

ClawGym is a framework for developing "Claw-style personal agents" — agents that operate over local files, tools, and persistent workspace states in multi-step workflows. The framework covers the full lifecycle:

1. **ClawGym-SynData** — 13.5K synthetic tasks generated from persona-driven intents + skill-grounded operations, paired with realistic mock workspaces and hybrid verification
2. **ClawGym-Agents** — Models trained via SFT on black-box rollout trajectories, then further refined with RL using parallelized rollouts across per-task sandboxes
3. **ClawGym-Bench** — 200-instance benchmark with automated filtering + human-LLM review

## Key Ideas

- **Persona-driven intent synthesis** — generate diverse tasks by varying user personas
- **Skill-grounded operations** — tasks are grounded in specific tool/skill capabilities
- **Mock workspaces** — realistic file/state environments for each task
- **Hybrid verification** — combine automated checks with LLM-based judgment
- **Per-task sandboxes** — isolated environments for RL rollouts

## Relevance to Our System

This is directly about what we're building. Key takeaways:

1. **Synthetic data generation for agent training** — persona × skill matrix for task diversity
2. **Verified workspaces** — each task comes with a ground-truth workspace state to verify against
3. **SFT → RL pipeline** — start with supervised trajectories, then improve with RL
4. **The "Claw-style" paradigm** is becoming a recognized category: persistent workspace, multi-step, tool-using personal agent

## Links

- Paper: https://arxiv.org/abs/2604.26904
- Repo: https://github.com/ClawGym (coming soon)
