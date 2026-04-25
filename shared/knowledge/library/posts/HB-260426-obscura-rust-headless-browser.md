# Obscura: Rust Headless Browser for AI Agents

**Source:** Hacker News / GitHub (h4ckf0r0day/obscura)  
**Date:** 2026-04-24  
**Stars:** 3.6k (215 forks)  
**License:** Apache 2.0

---

## 核心定位

Obscura 是一个用 Rust 编写的 headless browser，专为 AI agent 自动化和网页抓取设计。它通过 V8 引擎运行真实 JavaScript，支持 Chrome DevTools Protocol (CDP)，可作为 Puppeteer/Playwright 的 drop-in 替代方案。

---

## 关键数据对比

| 指标 | Obscura | Headless Chrome |
|------|---------|-----------------|
| 内存占用 | **30 MB** | 200+ MB |
| 二进制大小 | **70 MB** | 300+ MB |
| 反检测 | **内置** | 无 |
| 页面加载 | **85 ms** | ~500 ms |
| 启动时间 | **即时** | ~2s |
| Puppeteer 兼容 | ✅ | ✅ |
| Playwright 兼容 | ✅ | ✅ |

---

## 技术特性

### 核心架构
- **V8 JavaScript 引擎**: 完整 JS 支持，从源码编译
- **CDP 兼容**: 实现 Chrome DevTools Protocol，支持现有工具链
- **Rust 实现**: 内存安全 + 高性能

### 支持的 CDP Domain
- **Target**: createTarget, closeTarget, attachToTarget
- **Page**: navigate, getFrameTree, lifecycle events
- **Runtime**: evaluate, callFunctionOn
- **DOM**: querySelector, getOuterHTML
- **Network**: cookies, headers, user-agent override
- **Fetch**: 请求拦截 (live interception)
- **Input**: 鼠标/键盘事件
- **LP**: DOM-to-Markdown 转换

### Stealth Mode（反检测）
- 每会话指纹随机化 (GPU, screen, canvas, audio, battery)
- 真实的 `navigator.userAgentData`
- `event.isTrusted = true` 模拟真实用户事件
- `navigator.webdriver = undefined`
- 原生函数 masking (`Function.prototype.toString()` → `[native code]`)
- **Tracker 拦截**: 3,520 个域名拦截列表

---

## 使用方式

### CLI 快速使用
```bash
# 获取页面标题
obscura fetch https://example.com --eval "document.title"

# 提取所有链接
obscura fetch https://example.com --dump links

# 启动 CDP 服务器
obscura serve --port 9222 --stealth

# 并行抓取
obscura scrape url1 url2 url3 --concurrency 25 --format json
```

### Puppeteer/Playwright 集成
```javascript
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser',
});
```

---

## 性能基准

| 页面类型 | Obscura | Chrome |
|----------|---------|--------|
| Static HTML | **51 ms** | ~500 ms |
| JS + XHR + fetch | **84 ms** | ~800 ms |
| Dynamic scripts | **78 ms** | ~700 ms |

---

## 对 OpenClaw 的意义

### ✅ 机会
- **L4 浏览器层**: Obscura 可作为 Agent 浏览技能的底层基础设施
- **6x 性能提升**: 85ms vs 500ms 页面加载对 agent 效率意义重大
- **5x 内存节省**: 30MB vs 200MB 支撑更高并发
- **反检测能力**: Stealth mode 对需要绕过 bot 检测的场景有用
- **单一二进制**: 无 Chrome/Node.js 依赖，部署简单

### ⚠️ 评估点
- **与 Vessel 对比**: Vessel (HF Blog) 也定位"agent 专用浏览器"，需要比较两者
- **MCP 集成**: 是否有原生 MCP 支持，还是仅 CDP
- **稳定性**: 新项目 (3.6k stars)，生产就绪程度待验证
- **功能完整性**: CDP 实现是否覆盖所有 agent 场景需求

### 🔍 相关项目
- **Vessel Browser** (HF Blog): 2.5x 快于 Anthropic 工具，原生 MCP 端点
- **Playwright/Chrome**: 现有方案，但资源占用高

---

## 关键洞察

> **专用工具 > 通用适配**: Obscura 6x 性能优势证明为 agent 专门设计的工具能大幅超越通用浏览器方案。

Agent 基础设施层正在分化：
1. **通用浏览器** (Chrome): 功能全但重
2. **Agent 专用浏览器** (Obscura, Vessel): 轻量、快速、反检测
3. **纯 API 工具** (curl/httpx): 最快但无 JS 支持

OpenClaw 的浏览器技能层应评估这类专用工具的价值。
