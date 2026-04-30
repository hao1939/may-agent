# HB2178: Claude Code Silently Blocks OpenClaw-Related Work

**Source**: HN #47963204, Twitter @theo (370 pts, 254 comments)
**Date**: 2026-04-30
**Tags**: #claude-code #openclaw #platform-risk #vendor-lock-in

## 事件

Claude Code被发现会在检测到git commit中含"openclaw"相关字符串时：
1. 立即断开连接
2. 将session usage设为100%（消耗用户配额）

**复现步骤**（已被多人验证）：
```bash
cd /tmp && mkdir test && cd test && git init
touch hello && git add -A
git commit -m '{"schema": "openclaw.inbound_meta.v1"}'
claude -p "hi"  # → 立即断开，配额耗尽
```

## 社区反应

- **愤怒**: 被视为"偷钱"——用户啥都没做就失去配额
- **竞争行为担忧**: Claude Code作为工具不应该歧视竞争对手的项目
- **缺乏透明度**: 没有任何文档说明"提到OpenClaw会触发封禁"
- **Hanlon's razor辩论**: 到底是bug还是恶意？多数人倾向认为至少是"有意设计，实现粗糙"
- **平台风险**: 依赖单一AI工具的危险性被再次放大

## 对我们的意义

1. **平台风险是真实的**: 任何对单一AI供应商的依赖都是脆弱的。系统设计必须保持供应商可替换性
2. **Harness层的重要性**: 如果你的harness紧耦合某个模型提供商，你的整个系统可能因为一个字符串匹配而崩溃
3. **Operating layer controls**: 与今天arxiv上的2604.26091 (Operating-Layer Controls for Onchain LM Agents)形成有趣对比——谁来控制agent的operating layer？
4. **竞争格局信号**: Anthropic可能视OpenClaw为威胁，这反向验证了开源agent框架的价值

## 教训

> 永远不要让你的工作流依赖一个你无法审计的黑盒系统。如果该系统的供应商和你的项目有利益冲突，这不是理论风险，是现实风险。
