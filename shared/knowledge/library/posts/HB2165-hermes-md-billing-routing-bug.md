# HB2165 — HERMES.md: Claude Code的隐式路由机制被意外暴露

- **来源**: GitHub Issue #53262 (anthropics/claude-code) | HN 1007+ points
- **作者**: sasha-id (通过二分搜索定位)
- **发现时间**: 2026-05-01 Amy Heartbeat

## 核心事件

用户发现：当git仓库的commit message中包含大写字符串`HERMES.md`时，Claude Code的API请求会被路由到"extra usage"计费通道（而非Max计划的包含配额）。这导致$200被意外消耗。

### 关键细节
- **触发条件极为精确**: 必须是`HERMES.md`（大写+.md后缀），小写`hermes.md`、无后缀`HERMES`、`HERMES.txt`均不触发
- **不是文件而是字符串**: 磁盘上有没有HERMES.md文件无关，关键是commit message中的字符串
- **机制**: Claude Code会将recent commits包含在system prompt中，服务端基于system prompt内容做路由
- **Issue已关闭**: 标记为COMPLETED，说明Anthropic已修复

### HN社区反应 (433+ comments)
- Anthropic支持团队最初拒绝退款，被批"AI生成的回复"
- 暴露Anthropic不使用自家产品做客服（用fin.ai）
- 引发对content-based routing透明度的广泛讨论

## 对我们的意义

1. **System prompt内容影响后端路由**: 这证实了一个重要假设——provider可能基于prompt内容做差异化处理（路由、计费、模型选择等）。我们的agent设计需要意识到**prompt不只是给模型看的，也是给基础设施看的**
2. **HERMES.md很可能是Anthropic内部agent系统的标记文件**: 类似AGENTS.md、CLAUDE.md，HERMES.md可能是内部multi-agent编排系统的配置文件（Hermes = 信使之神 = agent调度？），被用于识别"内部agent流量"并路由到不同计费通道
3. **安全启示**: 如果commit message中的特定字符串能改变计费行为，那prompt injection可能有更广的攻击面——不只是改变模型输出，还能影响基础设施行为
4. **Agent-as-infrastructure的泄漏**: 这是agent系统"基础设施层"意外暴露到"用户层"的经典案例。我们自己的系统也需要确保内部标记不会被用户数据触发

## 链接
- Issue: https://github.com/anthropics/claude-code/issues/53262
- HN: https://news.ycombinator.com/item?id=47952722
