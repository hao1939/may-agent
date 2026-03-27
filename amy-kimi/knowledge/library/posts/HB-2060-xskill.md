# HB#2060: XSkill多智能体持续进化协作方案

**来源**: 小红书 @知无牙  
**原文链接**: https://www.xiaohongshu.com/explore/69b97827000000001b000759  
**归档时间**: 2026-03-17  
**热度**: 12赞/8收藏  
**价值评级**: 🔥🔥🔥🔥🔥 范式级洞察

---

## 核心论文

**XSkill: Continual Learning from Experience and Skills in Multimodal Agents**  
arXiv:2603.12056 (2026-03-12)  
作者: Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. Fung  
机构: 香港科技大学、浙江大学、华中科技大学

---

## 核心概念

### 双路知识表示 (Dual-Stream Knowledge)

| 类型 | 层级 | 存储格式 | 作用 |
|------|------|----------|------|
| **Skills** | 任务级 | Markdown | 结构化工作流，提供可复用的工具模板 |
| **Experiences** | 动作级 | JSON | 战术性提示，捕获特定执行上下文和失败模式 |

### 持续学习循环

```
Phase I: Accumulation (积累)
  ├── Multi-path Rollouts (多路径执行)
  ├── Visually-Grounded Summarization (视觉感知总结)
  ├── Cross-Rollout Critique (跨轨迹对比批评)
  └── Hierarchical Consolidation (分层整合)
  
Phase II: Inference (推理)
  ├── Task Decomposition (任务分解)
  ├── Context-Aware Retrieval (上下文感知检索)
  ├── Visual Adaptation (视觉适配)
  └── Usage History Feedback (使用历史反馈)
```

---

## 技术架构

### 双 MLLM 分离设计
- **MLLM_kb**: 处理知识库操作（提取、整合、适配）
- **MLLM_exec**: 执行工具使用
- **优势**: 强模型做知识管理，执行模型可灵活替换；支持跨模型知识迁移

### 关键技术创新

1. **视觉感知知识提取**: 知识基于视觉观察，不只是文本轨迹
2. **跨轨迹对比批评**: 成功 vs 失败轨迹的因果分析
3. **分层整合机制**: 相似度合并 + 质量评估 + 冗余消除

---

## 实验结果

| 指标 | 结果 |
|------|------|
| 相对纯工具基线提升 | Average@4 提升 2.58~6.71 百分点 |
| TIR-Bench (Gemini-3-Flash) | 47.75% Average@4，超越 Agent-KB 11.13 百分点 |
| 跨模型知识迁移 | GPT-5-mini/o4-mini 使用 Gemini-3-Flash 知识库仍提升 2.58~4.16 百分点 |

---

## 对 OpenClaw 的启示

### 架构对齐
| XSkill | OpenClaw | 差距 |
|--------|----------|------|
| Skills (Markdown) | AGENTS.md / Skill | ✅ 已对齐 |
| Experiences (JSON) | 缺乏系统性经验存储 | ⚠️ 待补充 |
| MLLM_kb + MLLM_exec | Main Agent + Sub-agent | ✅ 已对齐 |
| 视觉感知知识 | 主要文本轨迹 | ⚠️ 可扩展 |

### 关键启示
1. **经验层缺失**: OpenClaw 有 Skills 但缺 Experiences（动作级战术知识）
2. **持续学习闭环**: 从执行反馈中提取知识并整合的机制值得借鉴
3. **跨模型蒸馏**: 强模型积累知识，弱模型使用知识——降本增效路径

---

## 相关链接
- 论文: https://arxiv.org/abs/2603.12056
- 代码: https://github.com/XSkill-Agent/XSkill
- 项目页: https://xskill-agent.github.io/xskill_page/
