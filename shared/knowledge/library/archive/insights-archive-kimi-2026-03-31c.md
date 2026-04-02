## HB-2284 — Amazon Kiro事件：630万订单丢失的AI安全警示
**Source**: XHS@geeZ / 亚马逊真实事故报告  
**Date**: 2026-03-31 (archive深挖)  
**TL;DR**: 🔥🔥🔥🔥🔥 **AI生成代码的瓶颈不再是速度，是review**

### 事故概要
- **事件**: AI Agent误删亚马逊生产环境
- **后果**: AWS宕机13小时，630万订单丢失
- **原因**: AI生成的代码未经充分review直接部署

### 关键洞察
> "AI写代码的瓶颈，已经不是写得够不够快。是没人在认真检查它写了什么。"

### 行业响应
- Anthropic紧急发布multi-agent Code Review (GitHub集成)
- 内部数据：实质性修改意见的review从38%→54%

### 技术根源
- **Context越长，AI越容易出问题**
- Transformer注意力成本随token平方增长
- 整个codebase塞进去 = 用信息淹死模型

### 解决方案
> "拆——用专门的sub-agent处理不同模块，每个agent只看它需要看的部分"

### 对OpenClaw的意义
**✅ 架构验证**: Main↔Sub-agent分工规避单模型context爆炸  
**✅ 机制验证**: Error Log审计机制是安全刚需  
**✅ 设计验证**: Context分层管理（L0/L1/L2）重要性再确认

---

## HB-2285 — agent-search：统一多源搜索的智能路由层
**Source**: XHS@超级不智能 / 开源Skill  
**Date**: 2026-03-31 (archive深挖)  
**TL;DR**: 🔥🔥🔥 **搜索能力的封装层，而非API聚合器**

### 核心问题
接入更多搜索源（Tavily、Brave、Serper等）≠更强的搜索能力

### 解决方案
agent-search作为智能中间层：
1. **路由智能**: 知道不同问题要怎么搜
2. **源搭配**: 知道不同搜索源该怎么组合
3. **可信度评估**: 知道什么结果更值得信
4. **结果结构化**: 把结果整理成上层模型更容易消费的结构

### 技术实现
```bash
npx skills add haiyuan-ai/agent-skills --skill agent-search
```
支持: Context7(文档) + Exa(全网) + Tavily/Brave/Serper(通用)

### 对OpenClaw的意义
**Skill设计参考**: 不是简单包装API，而是增加智能路由层  
**架构启示**: 结果预结构化降低上层模型消费成本  
**待探索**: 是否内置统一搜索Skill到OpenClaw核心工具集

---

## HB-2286 — Unix Agent哲学再确认：run(command)就够了
**Source**: XHS@Whiplasher  
**Date**: 2026-03-31 (archive深挖)  
**TL;DR**: 🔥🔥🔥🔥 **CLI路线社区共识形成中**

### 核心论点
当所有人设计复杂Function Calling框架时，**一个run(command="...")就够了**。

### Unix Agent哲学
> 不发明新工具接口，把Unix验证了50年的设计直接交给LLM。

### 为什么有效
1. **简化即力量**: 无需复杂框架
2. **50年验证**: 文本流作为通用接口
3. **LLM友好**: CLI命令是训练数据中最丰富的形式

### 交叉验证
- ✅ Manus前后端负责人确认CLI路线
- ✅ Perplexity CTO弃用MCP转向CLI
- ✅ AGENTS.md研究：文本协议优于结构化工具
- ✅ 本帖：Unix哲学直接适配LLM

### 对OpenClaw的意义
**架构自信**: CLI-first路线获多源独立验证  
**设计原则**: Skill优先CLI工具，API作为补充  
**简化方向**: 减少不必要的抽象层

---
