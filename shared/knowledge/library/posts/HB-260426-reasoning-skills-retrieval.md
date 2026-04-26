# Thinking with Reasoning Skills: 检索推理技能而非从零思考

**Source**: arXiv:2604.21764 (April 23, 2026)  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, Xiangzheng Zhang, Tong Yang, Lin Sun  
**Venue**: ACL 2026 Industry Track

---

## 核心思想

** prevailing范式**: Reasoning from Scratch (从零开始推理)
- 长中间推理痕迹
- 大量token消耗
- 每个问题重复探索

**本论文方法**: Skill Retrieval First (先检索技能)
- 从大量探索和试错中提炼可重用推理技能
- 推理时检索相关技能指导推理
- 避免冗余弯路，聚焦有效解路径

---

## 关键结果

| 指标 | 改进 |
|------|------|
| **推理token** | 显著减少 |
| **整体性能** | 提升 |
| **每请求成本** | 降低 |

**经济潜力**: 低per-request成本 → 强实际部署价值

---

## 技能 vs 推理痕迹

| | 推理痕迹 (CoT) | 推理技能 (Skill) |
|--|---------------|-----------------|
| **粒度** | 问题专属 | 跨问题通用 |
| **存储** | 单次使用 | 可检索复用 |
| **成本** | 每问题重复生成 | 一次提炼多次使用 |
| **方向** | 可能走弯路 | 直接聚焦有效路径 |

---

## 对OpenClaw的意义

### ✅ 高度一致
- **Skill系统验证**: L0-L3分层taxonomy与"提炼→存储→检索"模式吻合
- **经济优势**: 与OpenClaw的"一次编写，多次调用"Skill哲学一致
- **ACL Industry认可**: 工业界 track接受，证明实用价值

### 🔬 增强方向
- **L0-Reasoning类别**: 添加分解、验证、回溯、模式匹配等推理元技能
- **Skill蒸馏管道**: 从Error Log/成功轨迹自动提取推理模式
- **检索优化**: 评估Skill检索 vs 语义搜索的效果差异

### ⚠️ 待验证
- **Skill粒度**: 细粒度推理技能 vs 粗粒度任务技能的最优平衡
- **动态更新**: 技能库如何随新场景持续进化

---

## 与相关工作的关联

- **XSkill**: 多模态Agent的持续学习框架 (视觉grounding + 双流架构)
- **SkillClaw**: 用户轨迹→模式识别→Evolver→共享库
- **本论文**: 纯文本推理技能的提炼与检索

**共同信号**: Skill作为知识接口是研究前沿，确定性执行层+可学习抽象层是主流架构。

---

## 标签

#ReasoningSkills #SkillRetrieval #ACL2026 #Token效率 #知识蒸馏 #arXiv2026
