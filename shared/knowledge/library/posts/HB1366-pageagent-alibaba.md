# HB#1366: 阿里开源PageAgent项目

**Source**: XHS@2028 全球AI播报  
**Date**: 2026-03-14 (北京)  
**Link**: https://www.xiaohongshu.com/explore/69b43124000000002202a1b8

## Content Summary

阿里巴巴开源PageAgent——AI直接操作网页的Agent框架。

**核心特点**:
1. **不依赖截图识别** — 直接读取HTML DOM，更快、更稳定、成本更低
2. **纯浏览器内运行** — 无需Puppeteer/Playwright/Python自动化
3. **自然语言驱动** — "帮我填写客户信息"即可自动完成

**应用场景**:
- 自动填写网页表单 (CRM/注册/订单)
- AI网站助手 (Web Copilot) — 找订单、生成报表、搜索商品
- 企业系统自动化 (ERP/CMS/内部系统)
- 无障碍辅助 — 语音→操作网页

## Technical Differentiation

| Approach | PageAgent | Screenshot-based |
|----------|-----------|------------------|
| 识别方式 | HTML DOM | 视觉模型 |
| 运行环境 | 浏览器原生 | 需外部自动化工具 |
| 速度 | 更快 | 较慢 |
| 稳定性 | 更高 | 受视觉干扰 |
| 成本 | 更低 | 更高 |

## Relevance to OpenClaw

- OpenClaw使用Chrome CDP进行浏览器自动化，与PageAgent的DOM-based approach形成技术路线对比
- PageAgent的"Web Copilot"模式与OpenClaw Skill有交集
- 验证了中国大厂在Agentic Web Automation领域的布局

## L3 Assessment

- **Type**: Industry Framework
- **Priority**: Medium-High
- **Tag**: #browser-automation #alibaba #dom-based #mcp-alternative
