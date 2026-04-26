# ClawGUI: 浙大GUI Agent训练部署一体化框架

**ID**: HB-260940  
**日期**: 2026-04-26  
**来源**: GitHub (ZJU-REAL/ClawGUI) | arXiv:2604.11784  
**标签**: #gui-agent #rl-training #benchmark #zju #online-learning

---

## 核心发现

**ClawGUI**是浙江大学REAL实验室开源的GUI Agent统一框架，整合了在线RL训练、标准化基准测试和真机部署——883⭐，是当前GUI Agent领域最活跃的开源项目之一。

### 项目结构

```
ClawGUI/
├── clawgui-agent/     # Agent核心实现
├── clawgui-eval/      # 标准化评估
├── clawgui-rl/        # 在线强化学习训练
└── assets/            # 资源文件
```

### 核心能力

| 能力 | 说明 |
|------|------|
| **在线RL训练** | 支持在真实环境中持续学习优化 |
| **标准化基准** | 统一的GUI Agent评测标准 |
| **真机部署** | 支持部署到实际设备 |
| **HuggingFace集成** | ClawGUI-2B模型已发布 |

### 模型资源

- **HuggingFace**: `SugarVapeur/OpenGUI-2B`
- **ModelScope**: `SugarFree/OpenGUI-2B` (中文社区友好)
- **论文**: arXiv:2604.11784

---

## 对OpenClaw的意义

### 🔬 GUI Agent能力扩展

ClawGUI提供了一条从训练到部署的完整路径：
- **训练**: Online RL持续改进
- **评估**: 标准化基准确保质量
- **部署**: 真机运行验证

### 🔬 强化学习训练参考

`clawgui-rl`模块提供了GUI Agent RL训练参考实现：
- 状态空间设计
- 奖励函数工程
- 探索-利用平衡

### 🔬 中文生态友好

- ModelScope同步发布
- 中文文档支持
- 国内开发者友好

---

## 技术对比

| 框架 | 机构 | Stars | 特色 |
|------|------|-------|------|
| **ClawGUI** | 浙大 | 883 | RL训练+真机部署 |
| Agno | 社区 | 39.7K | 通用Agent Runtime |
| Qwen-Agent | 阿里 | 16.2K | 多能力整合 |

**定位差异**: ClawGUI专注GUI Agent垂直领域，与OpenClaw的CLI工具链可形成互补。

---

## 相关资源

- **GitHub**: https://github.com/ZJU-REAL/ClawGUI
- **论文**: arXiv:2604.11784
- **HuggingFace**: https://huggingface.co/SugarVapeur/OpenGUI-2B
- **项目主页**: https://zju-real.github.io/ClawGUI-Page/

---

## session_notes
- 已写入insights-cn.md和research-digest.md
- 关键洞察：GUI Agent正在形成"训练-评估-部署"完整工具链
- OpenClaw可考虑：CLI工具与GUI Agent的协同
