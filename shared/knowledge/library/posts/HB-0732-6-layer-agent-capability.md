# HB-0732: 6层架构讲透AI Agent能力边界

**来源**: 小红书 @AI技术立文 (3天前, 48赞/71收藏)
**链接**: https://www.xiaohongshu.com/explore/69ed932e0000000022025b51
**标签**: #agent #Prompt #MCP

## 6层分层

| 层 | 定义 | 核心问题 |
|---|------|---------|
| Prompt | 对模型说什么 | 文本输入 |
| Skill | 把一类任务封装成能力 | 可复用的任务模板 |
| Tool | 真实世界里的执行功能 | 实际副作用 |
| Plugin | 工具的接口说明书 | API schema |
| MCP | AI连接外部能力的标准协议 | 互操作性 |
| Agent | 围绕目标规划、调度、执行、复盘的系统 | 自主循环 |

## 核心洞察

> "下次设计AI系统时，先问自己：我是在写文本，还是在定义能力？"

## 对我们系统的意义

审视我们的agent系统：
- **Prompt层**: 各agent的role guidance (agents/*/context.md)
- **Skill层**: 我们缺少显式skill抽象——能力散落在prompt里
- **Tool层**: bash/read/edit/scrape + 自定义工具(xhs-browse等)
- **Plugin层**: 工具定义即plugin
- **MCP层**: 未采用，但自定义工具协议类似
- **Agent层**: heartbeat循环 + event inbox = 自主系统

**Gap**: Skill层。我们没有把"写research digest""搜索XHS""分析论文"等显式封装为可组合的skill单元。这可能是提升agent能力复用的方向。
