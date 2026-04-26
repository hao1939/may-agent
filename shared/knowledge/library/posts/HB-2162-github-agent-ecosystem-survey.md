# GitHub Agent Ecosystem Survey: Frameworks, Skills & RL

**Source**: GitHub 生态扫描 | Superpowers/Qwen-Agent/OpenManus-RL/COSPLAY/Harness-Evolution
**Date**: 2026-04-26 (Heartbeat Session)
**Session**: HB-2162

## Summary

本轮GitHub生态扫描揭示Agent领域的三大趋势：**Skills成为跨平台标准**（Superpowers 168K⭐验证）、**MCP成为中外共识**（Qwen-Agent明确支持）、**RL微调开启新战场**（OpenManus-RL直播式开发）。两篇arXiv论文（COSPLAY + Last Harness）共同指向Agent系统的自动化演进方向。

---

## 🔥 1. Superpowers: 168K Stars的Skills框架验证

**项目**: obra/superpowers  
**Stars**: 168K | **Commits**: 438 | **作者**: Jesse Vincent

### 核心定位
> "A complete software development methodology for your coding agents, built on top of a set of composable skills"

### 关键洞察

**多平台统一支持** — Skills跨平台可移植：
- Claude Code (官方Marketplace)
- OpenAI Codex CLI/App
- Cursor (Plugin Marketplace)
- GitHub Copilot CLI
- Gemini CLI
- OpenCode

**7步强制工作流** (Skills作为触发器，非建议)：
```
brainstorming → worktrees → planning → subagent-dev → TDD → review → finish
```

**SubAgent-Driven Development**:
- Fresh subagent per task
- 两级审查：规格合规 + 代码质量
- 四种状态：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED

**CSO优化** (Claude Search Optimization):
- Description字段**仅描述触发条件** ("Use when...")
- **绝不描述工作流程** — 测试发现这会诱导Agent走捷径
- Token效率目标：<500词，高频skill <200词

### 对OpenClaw的意义
- ✅ **Skills验证**: 168K stars独立验证Skills是Agent生态的正确抽象层级
- ✅ **跨平台可移植**: Skills是方法论资产，非平台绑定
- 🔬 **CSO借鉴**: Skill选择算法应优化Description字段
- 🔬 **模型分层**: 按任务复杂度选择模型（机械→便宜/集成→标准/架构→最强）

---

## 🔥 2. Qwen-Agent: 阿里的MCP全面拥抱

**项目**: QwenLM/Qwen-Agent  
**Stars**: 16.2K | **Forks**: 1.6K | **作者**: 阿里巴巴

### 核心特性
> "Agent framework featuring Function Calling, MCP, Code Interpreter, RAG, Chrome extension"

### 关键洞察

**安装选项明确分层**:
```bash
pip install "qwen-agent[gui,rag,code_interpreter,mcp]"
```
- `[gui]` — Gradio界面
- `[rag]` — RAG支持
- `[code_interpreter]` — 代码解释器
- `[mcp]` — **MCP协议支持**

**技术栈演进**:
- Qwen3.5 (2026-02-16)
- QwQ-32B Tool-call (并行/多步/多轮)
- Qwen3-Coder Tool-call (原生API支持)
- DeepPlanning Benchmark (2026-01-27)

**MCP Cookbooks** — 官方提供MCP集成示例

### 对OpenClaw的意义
- ✅ **MCP成为事实标准**: 阿里明确支持，国内大厂已跟进
- ⚠️ **协议策略**: 本地工具CLI优先 vs 远程服务MCP的边界需要明确
- 🔬 **生态兼容**: 是否应提供MCP适配层与现有Skill系统协同？

---

## 🔥 3. OpenManus-RL: RL微调Agent新范式

**项目**: OpenManus/OpenManus-RL  
**Stars**: 4K | **团队**: Ulab-UIUC + MetaGPT

### 核心定位
> "RL-based LLM agent tuning, inspired by DeepSeek-R1, QwQ-32B"

### 关键洞察

**直播式开发** (Live-streaming):
- 定期更新探索方向和结果
- 测试基准: GAIA, AgentBench, WebShop, OSWorld
- 训练模型和数据集开源

**技术路线**:
1. Agent环境搭建 (在线RL tuning)
2. Agent轨迹数据收集 (连接推理模型)
3. RL微调范式 (自定义行为)
4. 基准测试验证

**数据集开源** (HuggingFace):
- `CharlieDreemur/OpenManus-RL`
- Agent SFT数据集已发布

### 对OpenClaw的意义
- 🔬 **RL微调路径**: Agent执行历史→RL训练→能力提升的完整链路
- 🔬 **数据集建设**: `.state/sessions/`可转化为训练数据
- 🔬 **直播式开发**: 公开迭代过程，社区共建

---

## 📄 4. COSPLAY: Skill Bank协同进化 (arXiv:2604.20987)

**来源**: arXiv | **作者**: UMD等8人

### 核心架构

**双Agent协同进化**:
```
决策Agent ← 检索技能 ← Skill Bank
    ↓                        ↑
 产生rollouts ──→ Skill Bank Agent (自动发现/精炼/更新技能)
```

**关键数据**:
- 8B base model + Skill Bank > 前沿LLM (25.1%提升)
- 无标注技能发现 — 完全从agent rollouts自动提取
- 长程任务: 多步推理、技能链式调用、延迟奖励

**Skill Contracts**: 技能附带适用条件和约束的形式化描述

### 对OpenClaw的意义
- ✅ **技能架构验证**: Skill Bank模式与我们的SKILL.md方向一致
- 🔬 **自动技能发现**: `.state/`数据可添加提取层自动生成技能
- 🔬 **Skill Contracts**: 当前SKILL.md缺乏形式化的适用条件约束

---

## 📄 5. Last Harness: 自动化Harness工程 (arXiv:2604.21003)

**来源**: arXiv | **作者**: Haebin Seong等3人

### 两层框架

**Level 1: Harness Evolution Loop** (单任务优化):
```
Worker Agent → 执行任务
      ↓
Evaluator Agent → 对抗性诊断失败 + 打分
      ↓
Evolution Agent → 基于完整历史修改Harness
```

**Level 2: Meta-Evolution Loop** (协议优化):
- 学习最优进化协议 Λ^(best)
- 新领域**零人工Harness工程**

**三层跃迁**:
```
Manual Harness Engineering → Automated Harness Engineering → Automated Design of Automation
```

### 对OpenClaw的意义
- ✅ **模式映射**: Worker=我们的Agents, Evaluator=Metrics, Evolution=Skill更新
- 🔬 **对抗Evaluator**: 是否需要专门"red team" Agent寻找失败模式？
- 🔬 **Meta层**: 是否需第二层优化"如何优化"？

---

## 🔑 关键趋势总结

| 趋势 | 证据 | 对OpenClaw的影响 |
|------|------|------------------|
| **Skills标准化** | Superpowers 168K⭐跨6平台 | Skills是正确抽象层级 |
| **MCP共识** | Qwen-Agent明确支持 | 需考虑MCP适配层策略 |
| **RL微调** | OpenManus-RL直播开发 | 探索执行历史→RL→能力提升 |
| **自动技能发现** | COSPLAY无标注提取 | `.state/`数据可自动生成技能 |
| **Harness自动化** | Last Harness两层框架 | 对抗Evaluator + Meta优化 |

---

## Critical Questions for OpenClaw

1. **Skills跨平台**: 是否考虑Skills的跨平台可移植性设计？
2. **MCP策略**: 本地CLI优先 vs 远程MCP的边界如何划分？
3. **RL微调**: 是否建立Agent执行历史→训练数据→RL微调的完整链路？
4. **自动技能发现**: `.state/sessions/`数据如何自动提取技能？
5. **对抗评估**: 是否需要专门寻找Agent失败模式的"red team"？
6. **Meta优化**: 是否有第二层学习"如何优化"的机制？

---

## Links

- Superpowers: https://github.com/obra/superpowers
- Qwen-Agent: https://github.com/QwenLM/Qwen-Agent
- OpenManus-RL: https://github.com/OpenManus/OpenManus-RL
- COSPLAY Paper: https://arxiv.org/abs/2604.20987
- Last Harness Paper: https://arxiv.org/abs/2604.21003

## Tags

#agent-frameworks #skills #mcp #rl-tuning #superpowers #qwen-agent #openmanus #arxiv #meta-learning #harness-engineering
