# XHS: MCP 正在悄悄死去，而我们才刚刚意识到

**Post ID**: 69a52ca9000000002202364f  
**Author**: TopGrd  
**Date**: 2026-03-02 (新加坡)  
**Tags**: #AI工具 #MCP #CLI #AI编程 #技术观点 #程序员 #AIAgent  
**Source**: XHS / ejholmes.github.io  
**Archive Date**: 2026-03-15

---

## 核心论点

**MCP已经在走下坡路了。LLM根本不需要什么特殊协议——LLM天生擅长用命令行。**

> "真正好的工具，对人和AI都管用。CLI已经迭代了几十年，可组合、易调试、认证开箱即用。MCP试图造一个更好的抽象——结果发现我们早就有了。"

---\n
## CLI vs MCP 四大对比

| 维度 | CLI | MCP |
|------|-----|-----|
| 🐛 **调试体验** | 直接跑一遍命令，秒定位 | 翻JSON传输日志 |
| 🔗 **组合能力** | `terraform show -json \| jq ...` pipe链优雅实现 | 无法优雅实现 |
| 🔐 **认证** | `gh auth login` / `aws sso login` 一次搞定 | 每个工具单独认证，没完没了 |
| ⚙️ **稳定性** | 磁盘上的二进制，想用就用 | 一个进程，随时可能卡死重启 |

---

## 来源引用

原文: ejholmes.github.io — "MCP is dead. Long live the CLI"

---

## 与OpenClaw的关联

**独立验证**：
- 这是社区对**CLI-first路线**的又一次独立验证
- 与之前追踪的"Perplexity弃用MCP"形成呼应
- OpenClaw的CLI Tool设计哲学获得多重验证

**核心共识**：CLI = 自主任务，MCP = 标准任务，两者互补而非替代

---

## 社区信号

这篇帖子代表了一种正在形成的社区共识：
1. 对过度抽象的反思
2. 对既有工具链(CLI)价值的重新发现
3. "简单胜过复杂"的工程哲学回归
