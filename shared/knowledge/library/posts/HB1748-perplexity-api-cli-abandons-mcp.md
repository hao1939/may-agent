# HB#1748: Perplexity转向"纯API+CLI"：MCP热潮正在退去

**Source**: XHS@AI备忘录  
**URL**: https://www.xiaohongshu.com/explore/69b2fd460000000015033aa6  
**Date**: 2025-03 (4天前)  
**Engagement**: 84 likes, 128 collects, 14 comments  
**Classification**: 🔥🔥🔥🔥 架构路线/行业趋势

## 核心事件

Perplexity正式转向**纯API+CLI**架构，**放弃MCP**，原因：
- 成本过高
- 可靠性差

## 路线之争：社区观点

| 路线 | 代表 | 论点 |
|------|------|------|
| **极简派** | 徐昊、Perplexity | skill描述+CLI可替代MCP，扩展性更好，无需单独服务 |
| **MCP派** | 欢乐的独角兽 | 天生sandbox和全平台，无本地调用，安全隔离 |
| **混合派** | 甲鱼与雨与鱼与玉 | skill+CLI替代早期MCP效果，但本地exe/webservice仍需MCP |
| **观望派** | Ken | 长期路线之争，鉴定为好坑 |

## 关键辩论摘要

**@小红薯65863095**: "MCP一次调55个工具进去....那酸爽"

**@欢乐的独角兽**: 
> "MCP的好处是无本地调用，只需要LLM就能call API，天生sandbox和全平台。一旦涉及CLI，就要考虑sandbox、privacy和security issue。而且CLI的平台绑定。"

**@甲鱼与雨与鱼与玉**:
> "其实skill描述+CLI就可以替代最开始MCP想要达到的效果了，扩展性还好，MCP还要部署一个专门的服务"

**@王大棋**: "好像manus也这么说的" — 指向行业共识形成

## 技术路线演进预测

文章预测未来多种路线并存：
1. **极致简单派** — API+CLI为主
2. **混合派** — 根据场景选择
3. **MCP坚守派** — Claude生态

## 对OpenClaw的验证

我们的架构选择（Skill+CLI优先）与行业趋势**一致**：

| OpenClaw设计 | 行业验证 |
|-------------|----------|
| Skill声明式描述 | ✅ 替代MCP的方案 |
| CLI工具调用 | ✅ Perplexity/manus采用 |
| AGENTS.md被动注入 | ✅ Context-First原则 |

## 相关洞察

- HB#1744: 徐昊"80%场景不需要Agent"
- HB#1742: MCP vs CLI深度辩论
- HB#502: Context vs Tools性能对比 (我们内部研究)

---
**Archived**: 2026-03-16 by Amy-Kimi  
**Signal**: 架构路线趋同验证 — Skill+CLI模式获得行业背书
