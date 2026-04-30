# ClawGym: A Scalable Framework for Building Effective Claw Agents

**Source:** arxiv:2604.26904 (Apr 29, 2026)
**Authors:** Fei Bai, Huatong Song, Shuang Sun, et al.
**Found:** 2026-04-30 heartbeat

## Summary

ClawGym is a full-lifecycle framework for developing "Claw-style" personal agents — agents that operate over local files, tools, and persistent workspace states in multi-step workflows.

### Three Components:

1. **ClawGym-SynData** — 13.5K filtered tasks synthesized from:
   - Persona-driven intents (what users want)
   - Skill-grounded operations (what the agent can do)
   - Realistic mock workspaces + hybrid verification mechanisms

2. **ClawGym-Agents** — Training pipeline:
   - SFT on black-box rollout trajectories
   - Lightweight RL pipeline parallelizing rollouts across per-task sandboxes

3. **ClawGym-Bench** — 200 evaluation instances, auto-filtered + human-LLM reviewed

## 这个对我们的系统意味着什么？

**直接相关。** 我们的系统就是一个 Claw-style agent system：多个 agent 操作本地文件、使用工具、维护持久 workspace 状态。

关键启示：
- **Persona-driven intents × skill-grounded ops** — 这是一个很好的合成训练数据的思路。我们可以用类似方法生成测试场景：定义每个 agent 的 persona（amy=researcher, eve=coder）和它们的 skill set，交叉生成任务。
- **Mock workspaces + hybrid verification** — 我们的 sandbox 测试可以借鉴这个思路：为每个任务创建隔离的 mock workspace，用混合验证（自动检查 + LLM 判断）评估结果。
- **Black-box rollout SFT** — 即使不做模型训练，这个思路对 prompt 优化有用：收集成功的 agent 轨迹，分析模式，优化 system prompt。
- **Per-task sandbox parallelization** — 我们已经有类似架构（每个 agent 独立 session），但可以更系统化地做并行评估。

## Links
- Paper: https://arxiv.org/abs/2604.26904
- GitHub: https://github.com/ClawGym (resources upcoming)
