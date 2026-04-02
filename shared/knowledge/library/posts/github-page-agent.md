# Alibaba Page Agent 深度分析

**来源**: GitHub (alibaba/page-agent)  
**时间**: 2026-03-15  
**Stars**: 8.4k | **Forks**: 654

## 架构设计 (AGENTS.md)

### Monorepo结构
```
packages/
├── core/           # @page-agent/core ⭐ 核心Agent逻辑 (headless)
├── page-agent/     # page-agent npm入口 (UI + controller + demo)
├── llms/           # @page-agent/llms - reflection-before-action心智模型
├── page-controller/# @page-agent/page-controller - DOM操作
├── ui/             # @page-agent/ui - Panel和i18n
└── extension/      # 浏览器扩展 (WXT + React)
```

### 关键架构模式
1. **模块边界清晰**
   - Page Agent: 主入口，继承PageAgentCore，添加Panel
   - Core: 无UI的PageAgentCore
   - LLMs: MacroToolInput合约，无page-agent依赖
   - UI: 通过PanelAgentAdapter接口解耦
   - Page Controller: DOM操作 + 可选视觉反馈(SimulatorMask)

2. **异步隔离通信**
   ```ts
   // PageAgent委托DOM操作给PageController
   await this.pageController.updateTree()
   await this.pageController.clickElement(index)
   await this.pageController.inputText(index, text)
   ```

3. **Reflection-before-Action心智模型**
   - LLMs包采用"先反思再行动"模式

## 与OpenClaw对比

| 维度 | Page Agent | OpenClaw |
|------|-----------|----------|
| 嵌入方式 | JavaScript注入 | 本地CLI运行 |
| DOM处理 | 文本分析，无多模态 | 视具体Skill而定 |
| 架构 | Monorepo分层 | AGENTS/DOMAIN/SKILL三层 |
| AGENTS.md | 项目开发指南 | 系统架构文档 |
| UI | 内置Panel | 命令行界面 |

## 关键洞察

1. **AGENTS.md命名趋同** - 行业开始采用AGENTS.md作为Agent项目标准文档
2. **分层架构共识** - Core/Controller/UI分层与OpenClaw的SOUL/DOMAIN/SKILL异曲同工
3. **Reflection模式** - "reflection-before-action"与OpenClaw的/thinking命令类似

---
**标签**: #github #architecture #browser-agent #alibaba
