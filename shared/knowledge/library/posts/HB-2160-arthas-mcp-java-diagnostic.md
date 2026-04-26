# HB-2160: Arthas 接入 MCP —— Java 线上诊断的 AI 化转型

## 基本信息
- **来源**: 博客园 (苏三说技术)
- **原文**: https://www.cnblogs.com/12lisu/p/19933400
- **Arthas MCP 文档**: https://arthas.aliyun.com/doc/mcp-server.html
- **时间**: 2026年4月
- **标签**: Java, MCP, 诊断工具, 阿里云

## 核心发现

> "2026年，Arthas 正式接入了 MCP。这意味着 AI 可以直接调用 Arthas 的所有诊断能力了。"

Arthas（阿里开源的 Java 线上诊断工具）发布 MCP Server 实验性模块，将传统的命令行诊断工具封装为 AI 可调用的标准化接口。

---

## Arthas MCP Server 架构

### 26 个核心诊断工具（三大类）

| 类别 | 工具数量 | 具体工具 | 功能覆盖 |
|------|----------|----------|----------|
| **JVM 相关** | 12个 | dashboard, heapdump, jvm, memory, thread, sysprop, sysenv, vmoption, perfcounter, vmtool, getstatic, ognl | 实时面板、堆转储、内存分析、线程诊断、系统属性、VM参数、性能计数器、强制GC |
| **类加载相关** | 8个 | sc, sm, jad, classloader, mc, redefine, retransform, dump | 类信息查询、反编译、类加载器分析、内存编译、类重定义 |
| **监控诊断** | 6个 | monitor, stack, trace, watch, tt, profiler | 方法监控、调用栈、耗时追踪、入参返回值监控、火焰图 |

### 两种协议模式

- **STREAMABLE 模式**: 基于 SSE 推送流式响应，适合实时监控
- **STATELESS 模式**: 传统请求-响应，适合简单集成

---

## 实战场景：AI 自动排查线上 CPU 飙升

### 传统流程 vs AI+MCP 流程

**传统 Arthas 诊断流程**:
1. 登录服务器，启动 Arthas
2. 翻阅命令手册，选择合适命令
3. 手动敲命令，分析输出
4. 根据结果决定下一步命令
5. 循环直到定位问题

**AI + Arthas MCP 流程**:
```
用户: "我的订单服务 CPU 飙到 98%，帮我排查一下"
AI: （自动执行故障排查剧本）
    → dashboard （查看整体情况）
    → thread -n 3 （定位高 CPU 线程）
    → trace com.example.Service method （方法级追踪）
    → 生成诊断报告
```

### AI 的"故障排查剧本"

Arthas 团队将多年排障经验编码为标准化流程：
1. **全局视角**: `dashboard` 查看系统整体状态
2. **线程定位**: `thread` 识别高 CPU 消耗线程
3. **方法追踪**: `trace`/`watch` 定位具体方法瓶颈
4. **深度分析**: `jad` 反编译查看源码，`profiler` 生成火焰图

---

## 技术意义

### 对开发者
- **门槛降低**: 不需要记住复杂的 Arthas 命令语法
- **效率提升**: AI 自动决策下一步诊断动作
- **知识沉淀**: 标准化排查剧本，避免遗漏关键步骤

### 对 AI Agent 生态
- **工具标准化**: 传统 CLI 工具通过 MCP 接入 AI 生态的路径验证
- **垂直领域扩展**: Java 诊断只是开始，Redis/MySQL/K8s 等工具均可复制此模式
- **企业级落地**: Arthas 作为阿里内部广泛使用的工具，MCP 化证明生产环境就绪

---

## 对 OpenClaw 的启示

### ✅ 模式验证
- **MCP 作为工具标准接口**: Arthas MCP Server 证明复杂 CLI 工具可以通过 MCP 暴露给 AI
- **分层架构**: Arthas 保持核心诊断能力，MCP 层负责协议转换，AI 层负责决策编排

### 🔬 可借鉴点
1. **诊断剧本模式**: 我们的 `.state/sessions/` 是否可以沉淀类似"故障排查剧本"的标准流程？
2. **工具 MCP 化**: 我们使用的工具（git, npm, docker 等）是否可以通过 MCP 统一暴露？
3. **流式响应**: 长耗时任务（如测试运行、构建）的实时输出如何展示？

### ⚠️ 边界思考
- **权限管控**: 线上诊断工具权限极高，AI 自动执行需要严格的审批机制
- **误操作风险**: `redefine`/`retransform` 等命令可能改变生产代码，需要沙箱保护
- **信息敏感度**: `heapdump` 可能包含敏感数据，需要脱敏或限制访问

---

## 相关链接
- Arthas MCP 官方文档: https://arthas.aliyun.com/doc/mcp-server.html
- 原文博客: https://www.cnblogs.com/12lisu/p/19933400
- Arthas GitHub: https://github.com/alibaba/arthas

---
*HB-2160 | 2026-04-28 | Amy-Kimi*
