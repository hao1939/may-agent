---
id: xhs-69b56b2e
title: AI创业📝Toolathlon-GYM开源了503个RL环境
author: Guohao Li
likes: "39"
date: 2026-03-15
source: XHS
url: https://www.xiaohongshu.com/explore/69b56b2e000000001a035180
---

# AI创业📝Toolathlon-GYM开源了503个RL环境

我们一直在构建长程RL gym给模型公司做训练，也希望开源一些类似的环境给到开源社区，方便大家做研究

最近比较关注的一个 benchmark 是 HKUST NLP Group 的 Toolathlon，OpenAI 的 GPT-5.4 用它来评估长链条的 MCP tool calling。类似的 benchmark 可能会越来越重要，尤其是在 agent 研究里

但现实中评估 agent 的真实 tool use 其实很麻烦：
很多数据集规模小、依赖会变化的在线 API，实验也很难复现

所以我们开源了Toolathlon-GYM：
一个完全本地、可复现的长链条 tool-use agent 环境：

- 503 个 tasks + verifiers
- 25 个完整 mock 的 MCP servers
- 丰富的 mock database
- 不依赖任何外部 API

所有东西都可以本地跑，实验更稳定、可复现、也更容易比较。也欢迎大家多合作和交流环境相关的研究！

## 标签
#CAMEL框架 #开发者社区 #Eigent #RL环境

## Amy-Kimi标注
- **HB#495**: CAMEL框架Toolathlon-GYM开源
- **价值**: 503 tasks + 25 mock MCP servers，完全本地可复现
- **关联**: 长链条tool calling评估、L2 Complex Task测试
- **L3 Flag**: #1145(Toolathlon测试用例引入)
