# HB#505 — Prompt Cache Is Everything

**Source**: XHS@大模型许愿池 | **Date**: 2026-03-12 (3天前)
**原始链接**: https://www.xiaohongshu.com/explore/69b14b8d000000002602d0c0

## TL;DR
构建长生命周期Agent时，Prompt Caching是关键但常被忽视的优化——通过缓存Prompt前缀计算结果，显著降低成本与延迟。

## 核心机制

### 前缀匹配原理
- **prefix match**: 新请求Prompt前缀与历史请求一致时，复用已有计算
- **结构原则**: 静态内容在前，动态内容在后

### 推荐Prompt结构
```
System Prompt + Tools（全局静态）
  ↓
Project Context（项目级）
  ↓
Session Context（会话级）
  ↓
Conversation Messages（动态内容）
```

## 常见破坏缓存的工程问题

1. **System Prompt包含动态信息**
2. **Tool顺序变化**
3. **会话中切换模型**

## 工具系统设计

### 动态工具的缓存破坏问题
- 动态增删工具会破坏缓存（tool定义属于prefix）

### 更优方案: Tool Stub + Lazy Loading
```
tool_name:
  defer_loading: true
```
- 只在需要时加载完整schema
- 保持prefix稳定

## 上下文压缩策略

### cache-safe fork
当上下文窗口耗尽时：
1. 使用相同system prompt
2. 使用相同tools
3. 复用conversation prefix
4. 最后追加总结请求

**效果**: 大部分token仍然能命中缓存

## 工程总结

Prompt caching应被视为**基础设施级优化**：

| 原则 | 说明 |
|------|------|
| Prefix稳定优先 | 避免动态内容前置 |
| 静态前置、动态后置 | 最大化缓存共享 |
| 不在会话中切模型 | 模型切换=prefix变更 |
| 不动态增删工具 | 用Lazy Loading替代 |
| fork任务保持相同prefix | cache-safe上下文压缩 |

**监控指标**: cache hit rate（命中率下降几个百分点会明显增加成本与延迟）

## OpenClaw关联

| Prompt Cache洞察 | OpenClaw设计 |
|-----------------|--------------|
| 静态前置动态后置 | Skill定义静态化，执行参数动态化 |
| Tool Stub Lazy Loading | Skill按需加载机制 |
| cache-safe fork | Error Log版本化、Skill历史追溯 |
| 前缀稳定性 | L0层系统提示词稳定性保障 |

## 原文链接
https://x.com/trq212/status/2024574133011673516
