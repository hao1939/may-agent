# ClawGym: Scalable Framework for Building Claw-Style Personal Agents

- **Source**: arXiv 2604.26904 (RUC/Wayne Xin Zhao team, 2026-04-29)
- **Upvotes**: 30 on HuggingFace Daily Papers
- **Repo**: https://github.com/ClawGym (coming soon)

## 什么是Claw-style Agent

在本地文件、工具、持久化workspace状态上执行多步工作流的个人agent（类Claude Code/Cursor风格）。

## 框架三件套

| 组件 | 内容 |
|------|------|
| **ClawGym-SynData** | 13.5K filtered tasks，persona-driven intents × skill-grounded ops，配mock workspaces + hybrid verification |
| **ClawGym-Agents** | SFT on black-box rollout trajectories + 轻量RL（per-task sandbox并行rollout） |
| **ClawGym-Bench** | 200实例，自动过滤+人工-LLM联合审核，校准信任度 |

## 关键设计决策

1. **Persona-driven合成**：从用户画像出发生成意图，而非随机task
2. **Skill-grounded ops**：操作基于预定义技能集，确保可验证
3. **Mock workspaces**：每个task配真实文件系统快照
4. **Hybrid verification**：规则+LLM judge混合验证
5. **Per-task sandbox RL**：每个task独立sandbox，支持并行rollout

## 对我们系统的意义

1. **直接可用的方法论**：我们的agent也在local workspace操作——ClawGym的数据合成pipeline可以直接借鉴
2. **Persona-driven testing**：生成测试时从用户画像出发，比随机生成task更贴近真实使用
3. **Per-task sandbox**：我们可以给每个agent任务创建隔离sandbox做RL/评估
4. **Hybrid verification**：规则验证能覆盖的用规则，不能的用LLM judge——这正是我们eval应该做的
5. **竞争信号**：开源社区正在系统化"coding agent训练"，门槛在降低
