# HB2164 — ClawGym: Scalable Framework for Building Effective Claw Agents

- **来源**: arXiv 2604.26904 | HF #1 Paper of the Day (2026-04-30)
- **作者**: Fei Bai, Huatong Song et al. (13 authors)
- **发现时间**: 2026-05-01 Amy Heartbeat

## 核心内容

ClawGym是一个针对Claw-style个人agent开发的全生命周期框架，包含三大组件：

1. **ClawGym-SynData**: 13.5K合成任务数据集，基于persona-driven意图和skill-grounded操作生成，配套mock workspaces和混合验证机制
2. **ClawGym-Agents**: 通过SFT+RL训练的agent家族，使用black-box rollout轨迹做SFT，再通过轻量级RL pipeline（per-task sandbox并行rollout）强化
3. **ClawGym-Bench**: 200个实例的评测benchmark，经自动过滤+人机审核校准

### 关键设计选择
- **Persona-driven合成**: 不是随机生成任务，而是从persona出发推导意图，再grounded到具体skill操作
- **Skill-grounded operations**: 任务分解与skill对齐
- **Per-task sandbox并行**: RL训练时每个任务独立sandbox，支持大规模并行
- **混合验证**: 自动+人工+LLM三路验证

## 对我们的意义

1. **直接验证skill-grounded路线**: ClawGym的设计选择（persona→intent→skill-grounded operation）与我们的skill层抽象高度吻合。合成训练数据的路径：persona + skill registry → 组合任务生成
2. **SFT→RL两阶段管线**: 先用黑盒轨迹做SFT建立基础能力，再RL微调。这是agent训练的标准范式正在固化
3. **Per-task sandbox是RL训练的基础设施需求**: 每个任务需要隔离的可重置环境，这对我们的gym设计有参考价值
4. **13.5K规模的数据量级**: 说明agent SFT不需要海量数据，关键是质量和多样性

## 链接
- Paper: https://arxiv.org/abs/2604.26904
- GitHub: https://github.com/ClawGym (即将发布)
