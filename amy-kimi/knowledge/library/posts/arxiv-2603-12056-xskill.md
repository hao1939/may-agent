# XSkill: Continual Learning from Experience and Skills

**arXiv**: 2603.12056  
**Date**: March 12, 2026  
**Authors**: Guanyu Jiang, Zhaochen Su, Xiaoye Qu, Yi R. Fung  
**Source**: https://arxiv.org/abs/2603.12056  
**Code**: https://github.com/XSkill-Agent/XSkill  

---

## 核心贡献

**首个**统一视觉grounded任务级Skill和动作级Experience的双流持续学习框架。

---

## 关键定义

### Skill (任务级指导)
```
Skill k = (ℳ, 𝒲, 𝒫)
- ℳ: Metadata (name, description, version)
- 𝒲: Workflow sequence
- 𝒫: Reusable tool templates
- 存储: Markdown-based Skill Library 𝒦
```

### Experience (动作级指导)
```
Experience e = (c, a, 𝐯e)
- c: Triggering condition (触发条件)
- a: Recommended action (推荐动作)
- 𝐯e: Semantic embedding for retrieval
- 约束: |c| + |a| ≤ L_max^e words
- 存储: JSON-based Experience Bank ℰ
```

---

## 架构设计

### 双MLLM分离
| 组件 | 职责 | 优势 |
|------|------|------|
| MLLM_exec | 工具使用推理 | 保持执行模型灵活性 |
| MLLM_kb | 知识库操作(提取/整合/适配) | 可使用更强模型进行知识管理 |

**关键能力**: 跨模型知识转移 - 一个模型积累的知识可受益于另一个模型

### 两阶段流程
```
Phase I: Accumulation (训练时)
  ├─ Rollout Summary (多路径轨迹总结)
  ├─ Cross-Rollout Critique (对比分析提取因果因素)
  └─ Knowledge Consolidation (层次化整合)

Phase II: Inference (运行时)
  ├─ Task Decomposition Retrieval (任务分解检索)
  ├─ Context-Aware Visual Adaptation (视觉上下文适配)
  └─ Non-Prescriptive Injection (非指令式注入)

Feedback Loop: Usage history → Accumulation
```

---

## 关键机制

### 视觉Grounding
- 知识提取基于**视觉观察**而非仅文本轨迹
- MLLM_kb接收交错的图像观察+轨迹文本
- 记录: 采取了什么动作 + 什么视觉证据驱动了该决策

### Cross-Rollout Critique
- 对比成功与失败轨迹
- 识别结果背后的因果因素
- 输出结构化Experience更新操作: (add, e) 或 (modify, e_id, e')

### 层次化知识整合
**Experience整合**:
- 相似度检查: cos_sim > θ_sim 时合并
- 容量管理: 超过N_max^E时删除低质量条目

**Skill整合**:
- 片段集成到全局Skill文档
- 长度超过L_max^K时触发精炼
- 自评估: 泛化性、工作流正确性、简洁性

---

## 性能结果

| 指标 | 提升 |
|------|------|
| Average@4 | +2.58 to +6.71 points across 4 backbone models |
| vs strongest baseline | up to +11.13 points on challenging settings |

---

## 与OpenClaw的关联

### ✅ 高度一致
| XSkill | OpenClaw |
|--------|----------|
| Phase I (Accumulation) | Skill设计时定义/训练时进化 |
| Phase II (Inference) | 运行时执行 |
| **禁止运行时参数更新** | **禁止运行时自进化** |
| Markdown Skill Library | SKILL.md |
| JSON Experience Bank | Error Log |
| MLLM_kb (知识管理) | Scout (研究) |
| MLLM_exec (执行) | Amy/Amy-Kimi (执行) |

### 🔑 关键洞察
1. **Skill vs Experience分离** - 验证了我们区分结构化Skill和运行时Error Log的设计
2. **双MLLM架构** - 为Main/Sub-agent分工提供理论支撑
3. **视觉Grounding** - 未来多模态扩展的参考架构
4. **持续学习循环** - 使用历史反馈回积累的机制与我们的Self-Evolution愿景一致

### ⚠️ 术语注意
XSkill的"Experience" ≈ OpenClaw的"Error Log" (动作级战术知识)  
XSkill的"Skill" ≈ OpenClaw的"Skill" (任务级结构化知识)

---

## L3 Flags

- #XXX: Skill-Experience双元组形式化 - 已验证OpenClaw设计
- #XXX: 视觉Grounding知识提取 - 多模态扩展方向
- #XXX: Cross-Rollout Critique机制 - Error Log进化方法论

---

## 引用

```bibtex
@article{jiang2026xskill,
  title={XSkill: Continual Learning from Experience and Skills in Multimodal Agents},
  author={Jiang, Guanyu and Su, Zhaochen and Qu, Xiaoye and Fung, Yi R.},
  journal={arXiv preprint arXiv:2603.12056},
  year={2026}
}
```
