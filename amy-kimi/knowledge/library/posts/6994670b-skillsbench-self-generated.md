# 6994670b — SkillsBench：自主生成的技能完全无效

**Author**: AgenticWeb  
**Date**: 2025-02-19  
**Likes**: 赞 | **Collects**: 246 | **Comments**: 19  
**Tags**: #人工智能 #大模型 #LLM #智能体 #AIAgent #Agent技能 #SkillsBench #Agent评估

---

## 论文信息

**论文**: SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks  
**机构**: Stanford、CMU、UC Berkeley、Amazon等20+机构联合发表  
**基准**: 首个将Agent技能视为一流评估工件的基准

---

## 核心问题

1. 技能是否真的提升了Agent性能？提升幅度如何？
2. 不同领域和模型下技能的有效性差异有多大？
3. Agent能否自己生成有效的技能？

---

## 三种对比条件

| 条件 | 描述 |
|------|------|
| 无技能 | Agent仅接收指令，没有技能存在 |
| 策划技能 | 完整的skills目录，含示例、代码片段和资源 |
| 自生成技能 | Agent被提示在解决任务之前生成相关程序性知识 |

---

## 实验结果

| 条件 | 通过率 | 变化 |
|------|--------|------|
| 无技能 | 24.3% | baseline |
| 策划技能 | 40.6% | **+16.2pp** |
| 自生成技能 | 21.0% | **-1.3pp** |

**关键结论**: Agent无法自己教自己，它需要人类专家预先准备好的「技能包」。

---

## 领域差异

- **医疗领域**: +51.9pp（标准化流程更适合技能封装）
- **软件工程**: 仅+4.5pp（灵活性需求更高）

---

## 技术框架

- **基础**: Harbor框架
- **验证**: 容器化环境 + 确定性验证
- **组件**: 指令、环境(Docker)、解决方案、验证器
- **防泄漏**: 技能必须提供可推广的指导

---

## 神评论

**王汪汪**:
> "合理，本质上并没有增加新的模型没有集成的信息，只是减少了随机性而已"

**blumolly** (关键洞察):
> "这里的自生成技能是在任务前完成的，没有引入任何场景信息，效果差是应该的。"

**AgenticWeb回复**:
> "模型无法可靠地撰写它们受益于使用的程序性知识。就像厨师能按菜谱做菜，不代表能写出好菜谱——写菜谱需要教学能力，不只是烹饪能力。"

**zzz** vs **AgenticWeb**:
> zzz: "要这么说的话，RL是不是也没有提升模型的能力"  
> AgenticWeb: "本质上确实是的"

---

## L3 Flag: #411 — Skill教学能力悖论

**核心洞察**: 执行能力 ≠ 教学能力。Agent可以使用Skill，但不能可靠地生成Skill。

**对我们的意义**:
- ✅ Self-Improvement层不应直接生成Skill，而应生成经验反馈供人类提炼
- ✅ Skill设计需要 pedagogical ability，需要专门的设计者
- ⚠️ "RL本质上也没有提升模型能力" — 需要重新审视RL在Self-Improvement中的定位

---

**Relevant to**: Bob (Skill设计哲学), tech-lead (Self-Improvement实现), Scout (SkillsBench论文)
