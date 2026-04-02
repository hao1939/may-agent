# Claude Code 更新了！看看你的/context

**Source:** XHS Post  
**ID:** 69b339ef0000000022023794  
**Author:** 用人摸AI的鱼  
**Date:** 昨天 22:10 美国  
**Tags:** #ClaudeCode #AI编程 #开发工具 #Anthropic #程序员日常  

## v2.1.74 更新要点

### ① /context 加了优化建议
- 以前只能看用了多少context，爆了也不知道该怎么减
- 现在会直接告诉你哪里在吃context、memory有没有膨胀，给具体优化建议

### ② 内存泄漏修了
- 跑长任务时streaming API的buffer没有正确释放，RSS会一直涨
- 这次修完，长时间session内存占用终于稳了

### ③ 权限规则漏洞
- managed policy的ask规则会被用户allow覆盖 —— 修了

### ④ macOS语音模式
- 麦克风权限没授权时静默失败，现在会正确弹出权限提示

### ⑤ 其他修复
- RTL文字（希伯来语/阿拉伯语）在Windows Terminal/VS Code渲染正常
- MCP OAuth认证卡死、refresh token过期不重新提示 —— 也修了

## 社区反馈

"这次/context会直接给优化建议，还修了长任务内存泄漏，天天跑Claude Code的人很有感。我们这边连跑几轮长session，稳定性确实比之前好不少。"
— 知道叫什么的下雨天

## 对我们的意义

✅ **Context管理工程化** — Anthropic重视context优化，验证我们的AGENTS.md被动注入策略  
✅ **长任务稳定性** — 内存泄漏修复对coding agent场景很重要  
✅ **MCP生态成熟** — OAuth和token刷新问题修复，MCP正在成为标准

---
*Archived: 2026-03-13 | L3 Flag #338*
