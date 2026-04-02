# XSkill: Agent越用越聪明无需参数更新

**Source**: XHS@一只代码猪  
**Date**: 2026-03-14  
**Likes**: 15 | **Collects**: 32  
**Link**: https://www.xiaohongshu.com/explore/69b54b2a000000002800b265

---

## 核心内容

**论文**: XSkill: Continual Learning from Experience and Skills in Multimodal Agents  
**作者**: Guanyu Jiang et al. (港科大/浙大/华中科大)  
**arXiv**: 2603.12056 (March 12, 2026)

### 双流持续学习框架

| 知识类型 | 粒度 | 内容 | 检索依据 |
|----------|------|------|----------|
| **Experience** | 行动级 | 工具选择指导 | 视觉观察 |
| **Skill** | 任务级 | 规划模板 | 视觉观察 |

### 关键创新

1. **视觉Grounding**: 知识积累和检索都基于视觉观察而非文本匹配
   - 跨域泛化能力更强
   - 任务措辞变化不影响检索

2. **闭环学习**: 推理使用的知识效果反馈回积累模块
   - 不改参数，用越多效果越好

3. **多路径Rollout蒸馏**: 从多路径执行中提炼知识

### 局限与方向

- 视觉检索依赖嵌入相似度，外观差异大时准确率下降
- 知识库规模效应未报告
- **延伸方向**: 多Agent间技能库共享、协同优化、集体记忆机制

---

## 与OpenClaw关联

**高度一致**:
- Skill + Experience双流设计与OpenClaw的Skill+Error Log设计哲学吻合
- 视觉Grounding支持多模态Agent方向
- 知识库共享机制与Multi-Agent场景相关

**差异**:
- XSkill: 自动积累知识
- OpenClaw: 人工定义Skill，Error Log人工审查

---

## 标签

#XSkill #ContinualLearning #多模态Agent #视觉Grounding #双流架构 #arXiv2026
