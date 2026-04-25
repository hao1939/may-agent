# VAKRA: IBM企业级Agent评估基准 — 组合推理的试金石

**来源**: Hugging Face Blog / IBM Research (Apr 15, 2026)
**链接**: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis
**评分**: ★★★★★

## 核心定位

VAKRA是**面向企业级环境的工具落地、可执行基准**，测量**组合推理**而非孤立技能：

- **8,000+ APIs** 跨越 **62领域**
- 真实数据库支撑的可执行环境
- 3-7步推理链，结合结构化API交互与非结构化检索
- 自然语言工具使用约束

> **关键发现**: **Models perform poorly on VAKRA** — 当前Agent在企业级复杂工作流上仍有巨大提升空间

## 四大能力维度

### C1: API Chaining (BI APIs)
- **2,077实例**，54领域
- 1-12次工具调用链
- 使用SLOT-BIRD和SEL-BIRD工具集合

**特殊设计 — get_data工具**:
```json
{
  "name": "get_data",
  "arguments": {"tool_universe_id": "..."},
  "label": "retrieved_data_1"
}
```
- 初始化数据源
- 返回轻量预览（避免MCP大数据传输）
- 服务端存储完整数据集
- 配置MCP服务器暴露相关工具集

### C2: Tool Selection (Dashboard APIs)
- **1,597实例**，17领域  
- 每域**平均116工具**（最多328个）
- 使用扩展REST-BIRD集合

**OpenAI API限制**: 工具列表最多128个 → 需要shortlisting机制

### C3: Multi-Hop Reasoning
- **869实例**，38领域
- 需要**1-5个逻辑跳跃**
- 多跳问题需要提取并组合多个证据

### C4: Multi-Source + Policy (最复杂)
- **644实例**，41领域
- **多源**: API + RAG文档检索混合
- **多轮**: 对话历史，当前turn回答
- **策略约束**: 纯文本工具使用策略

策略示例：
> "If a user's query pertains to Technology & Software... make sure you try answering them by only using document retrievers. Do not use other types of tools."

## 评估框架

### 瀑布式评估流程
1. **策略遵守检查** (C4 only): 程序化验证
2. **工具序列比较**: 执行预测工具调用，对比工具响应集合
3. **最终响应评估**: LLM-based judge验证(i)基于工具输出 (ii)与ground truth事实一致

### 错误阶段隔离
顺序分类至最早失败阶段：
1. 正确工具选择？
2. 所需参数完整无幻觉？
3. 参数值正确？
4. 最终响应准确且基于工具输出？

## 失败模式分析

### 主要失败类型
1. **工具选择错误**: 在大量工具中选错
2. **多跳推理断裂**: 逻辑链条中断
3. **策略违反**: 未遵守工具使用约束
4. **上下文丢失**: 长链条中丢失关键信息
5. **数据源污染**: 错误关联信息源

## 对 OpenClaw 的意义

### ✅ 直接应用
- **Gym场景设计**: 4层能力框架可直接映射到评估场景
- **get_data轻量预览**: 解决MCP大数据传输问题，值得借鉴
- **瀑布式评估**: Error Log评估可采用类似多阶段验证

### ⚠️ 能力缺口
- **大规模工具集动态筛选**: 验证Tool Attention的ISO score必要性
- **显式API+RAG混合查询**: 当前缺乏此能力
- **策略约束执行**: 需要hard constraint层

## 关键洞察

| 洞察 | 含义 |
|------|------|
| 组合推理 > 孤立技能 | 企业级Agent需要端到端工作流能力 |
| 工具选择 at scale 是瓶颈 | 平均116工具/域，最多328个 |
| 策略约束需要显式执行 | 软prompt不够，需要机制保证 |
| 多源混合是标配 | API + RAG + 多轮对话 |

## 资源链接

- 数据集: ibm-research/VAKRA
- Leaderboard: ibm-research-vakra.hf.space
- GitHub: github.com/IBM/vakra
