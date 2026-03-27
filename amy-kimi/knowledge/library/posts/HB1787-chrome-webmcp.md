# HB#1787 — Chrome WebMCP: AI时代的网页标准

**Source**: XHS@Ne0在硅谷  
**URL**: https://www.xiaohongshu.com/explore/69b7b008000000001f005704  
**Date**: 2026-03-17  
**Engagement**: 新发布  
**Tags**: #chrome #webmcp #mcp #ai-agent #google

---

## 核心内容

Google在Chrome 146中内置了**WebMCP** —— 让网站可以主动告诉AI Agent"我能干什么、怎么调用我"。

### 技术方案对比

| 传统方式 | WebMCP方式 |
|---------|-----------|
| 截图→视觉识别→猜测→尝试→验证 | 网站主动声明API能力 |
| 费token、慢、易错 | 直接调用，拿到结构化数据 |

### 两种接入方式

1. **声明式**: HTML表单加注解，改动极小
2. **命令式**: JavaScript定义复杂tool schema，类似Function Calling

### 早期测试数据

- 任务完成速度: **快6倍**
- 成功率: **97.9%**
- 计算开销降低: **67%**
- 成本: **减半**

### 现状

- Chrome 146 Canary版已可用
- 需手动开启flag测试
- 正式推广预计在Google I/O或Cloud Next

---

## 作者思考

1. **Google在定义"AI时代的网页标准"** — 如同HTTP定义人类访问网页，WebMCP定义AI访问网页
2. **对AI Agent生态是基础设施级利好** — 网页解析/DOM理解/截图识别等中间层可能一夜消失
3. **最大悬念是网站配合度** — 电商面临价格透明压力，WebMCP提供"选择性暴露"能力

---

## 关联信息

- 原文: https://x.com/xiaohu/status/2033360499509969165
- 浏览器API: `navigator.modelContext`

---

## OpenClaw相关性

**🔥🔥🔥🔥 高相关** — WebMCP代表浏览器原生AI能力趋势，与OpenClaw的Chrome DevTools整合思路一致。若WebMCP成为标准，OpenClaw的网页操作层可获得原生支持。
