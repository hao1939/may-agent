# VAKRA: IBM 企业级 Agent 评估基准 — 组合推理的试金石

**来源**: Hugging Face Blog / IBM Research (Apr 15, 2026)  
**链接**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis

---

## 核心定位

VAKRA (Sanskrit for "curved" or "multi-directional") 是一个**可执行的企业级 Agent 评估基准**，专注于测量**组合推理**而非孤立技能：

- **8,000+ APIs** 跨越 **62 个领域**
- 真实数据库支持的本地托管 API
- 领域对齐的文档集合
- 需要 **3-7 步推理链** 的任务

**关键发现**: **Models perform poorly on VAKRA** — 当前 Agent 在企业级复杂工作流上仍有巨大提升空间。

---

## 四大能力维度

### C1: API Chaining (BI APIs)
- 2,077 测试实例，54 个领域
- 1-12 次工具调用链
- 数据源：SLOT-BIRD 和 SEL-BIRD 集合
- 示例：从足球数据库中筛选特定战术指标的球队

### C2: Tool Selection (Dashboard APIs)
- 1,597 实例，17 个领域
- 每个领域平均 **116 个工具**（最多 328 个）
- 需要正确的 API 短列表机制
- OpenAI API 限制：最多 128 个工具

### C3: Multi-Hop Reasoning
- 869 实例，38 个领域
- 需要 1-5 个逻辑跳跃
- 多段证据提取和组合

### C4: Multi-Source + Policy (最复杂)
- 644 实例，41 个领域
- **多源**: API + RAG (文档检索) 混合
- **多轮**: 对话历史上下文
- **策略约束**: 明文工具使用策略
  - 示例："关于代码库的问题，仅使用文档检索器，不使用其他工具"

---

## MCP 协议设计亮点

### get_data 工具模式
```json
{
  "handle": "retrieved_data_1",
  "num_records": 2,
  "key_details": [
    {"name": "team_name", "dtype": "str", "first_3_values": ["FC Barcelona", "Manchester City"]},
    {"name": "play_speed", "dtype": "int32", "first_3_values": [31, 40]}
  ]
}
```

**关键创新**:
- 返回轻量级数据预览（非完整数据）
- 服务器端存储完整数据集
- 避免 MCP 协议传输大数据的低效
- 根据 tool_universe_id 配置领域特定 API

---

## 评估框架

### 瀑布式评估管道
1. **策略遵循验证** (仅 C4): 程序化检查
2. **工具序列比较**: 执行预测工具调用，对比输出集合
3. **最终响应评估**: LLM-based judge 验证事实一致性

**评分公式**:
```
Leaderboard_Score = 1/4 * Σ(Capability_n)

C4 加权: (正确多源×2 + 正确单源) / (总多源×2 + 总单源)
```

---

## 失败模式分析

| 失败阶段 | 描述 | 占比 |
|---------|------|------|
| 工具选择错误 | 选择了错误的 API | 最高优先级 |
| 参数缺失/幻觉 | 参数遗漏或虚构 | 次优先级 |
| 参数值错误 | 参数值不正确 | 第三优先级 |
| 最终响应错误 | 答案不准确或与工具输出不一致 | 最后检查 |

**常见失败模式**:
- **上下文丢失**: 多轮对话中遗漏早期信息
- **数据源污染**: 在应使用 API 时错误使用 RAG，或反之
- **策略违反**: 未遵循工具使用约束
- **部分匹配**: 信息获取不完整

---

## 对 OpenClaw 的意义

### ✅ 可直接借鉴
1. **Gym 场景设计**: 4 层能力框架提供评估维度参考
2. **MCP 大数据传输**: get_data 轻量预览模式值得借鉴
3. **工具短列表机制**: 大规模工具集需要动态筛选

### ⚠️ 待补全能力
1. **显式 API+RAG 混合查询**: 当前缺乏同时调用 API 和检索文档的能力
2. **多轮对话上下文管理**: 需要更复杂的对话状态跟踪
3. **策略约束执行**: 缺乏基于规则的工具使用限制

### 📊 评估启示
- **执行轨迹比答案更重要**: VAKRA 验证完整工具调用序列，而非仅最终输出
- ** waterfall 评估**: 分阶段隔离失败点，避免重复计数
- **领域覆盖**: 62 个领域验证 Agent 泛化能力

---

## 资源链接

- **数据集**: ibm-research/VAKRA
- **Leaderboard**: https://ibm-research-vakra.hf.space/
- **GitHub**: https://github.com/IBM/vakra
- **官方发布**: https://www.ibm.com/new/announcements/introducing-vakra-benchmark

---

*标签: #enterprise-agent #benchmark #tool-use #multi-hop-reasoning #api-chaining #mcp*