---
post_id: 69abbd90000000002203967d
author: 三狗不是狗
level: L3
likes: 213
collects: 455
publish_date: 2026-03-08
archive_date: 2026-03-13
---

# OpenClaw：6种记忆系统横评

## 核心结论

**推荐方案**: Mem0 / MemOS (对大部分用户)

选择理由:
- ✅ 配置简单（30秒搞定）
- ✅ Token省最多（约60-70%）
- ✅ 跨会话连续性比较好
- ✅ 有免费档可以先验证

## 社区实践洞察

### 1. 分层Markdown记忆方案
**清妍**: HOT层放当前偏好和规则，WARM层按项目/领域分文件，COLD层归档。配合memory_search语义检索，跨会话连续性也不错，完全本地不依赖第三方。

### 2. 实测经验 (艾斯)
- MEMORY.md放核心规则（永远加载）
- 每个成员单独建档到memory/目录
- Agent按需读取，不全量加载
- 关键：在AGENTS.md写清楚什么时候查记忆、查哪个文件
- 成本：管8人团队一天约2-3M token

### 3. 评估基准缺失
Claude原话："这个领域目前缺乏统一的独立第三方评测机构，各家数据水分较大，MemoryBench和LongMemEval上的独立复现结果是目前最值得参考的客观依据。"

## 方案对比（社区反馈）

| 方案 | 适用场景 | 优缺点 |
|------|----------|--------|
| Mem0/MemOS | 个人/小团队 | 配置简单，token省，但作者最终弃用（无法导出记忆） |
| qmd | 服务器/单Agent | 本地优先，但多Agent共享记忆不便 |
| OpenViking | 结构化长期记忆 | 文件系统范式，但配置复杂，个人用太重 |
| Obsidian+MCP | 知识库型用户 | 混合检索，效果依赖资料库质量 |

## 对我们的意义

1. **OpenClaw原生Markdown记忆**已升级混合检索+rerank，验证了我们Skill-as-Memory路线的正确性
2. **分层存储**（HOT/WARM/COLD）与我们的Workspace/Self-Improvement/LanceDB三层架构高度对齐
3. **评估基准缺失**意味着社区仍在探索期，我们的架构有机会成为标杆
