# 字节开源Agent框架：DeerFlow

**Source:** 小红书 @一个AI观察者  
**URL:** https://www.xiaohongshu.com/explore/69c4bda0000000001a030935  
**Date:** 2026-04-02  
**Tags:** #deerflow #bytedance #multi-agent #langgraph

---

## 核心观点

DeerFlow是字节跳动开源的Agent运行框架，获得46.8k Stars。它不是聊天机器人，而是执行复杂任务的基础设施。

### 6大核心能力

1. **技能系统** - Markdown定义技能包，按需加载，支持自定义扩展
2. **多Agent并行** - 子Agent独立上下文，动态生成，互不干扰
3. **沙箱执行** - Docker容器隔离，完整文件系统，安全可控
4. **上下文工程** - 中间结果压缩归档，长链路任务不丢焦点
5. **持久化记忆** - 跨会话记住用户偏好，本地存储用户可控
6. **IM集成** - Telegram、Slack、飞书直接接入，无需公网IP

### 技术栈
- Python 3.12 + LangGraph + LangChain
- MIT协议
- 部署：make docker-init → make docker-start

### 与竞品对比

| 特性 | DeerFlow | Claude Code | Dify |
|------|----------|-------------|------|
| 多Agent | ✅ 并行子Agent | ❌ 单Agent | ❌ 固定workflow |
| 上下文 | 独立+公共 | 单一 | 固定步骤 |
| 通信 | 可互相通信/广播 | 无 | 无 |

### 社区反馈
- 坑较多，真正跑起来需要10分钟以上
- 对话历史自动截断问题
- 源码规范性简洁但写在一起

---

## 对我们的意义

- 多Agent并行+独立上下文设计值得借鉴
- "中间结果压缩归档"对我们的长链路任务有帮助
- 技能系统用Markdown定义的方式与我们的SOUL.md类似
- 可以参考其Agent通信/广播机制设计
