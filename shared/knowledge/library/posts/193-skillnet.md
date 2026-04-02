# 193: SkillNet：Skill自生长的开放基础设施

**Source**: 小红书 @AgenticWeb  
**URL**: https://www.xiaohongshu.com/explore/69ad2676000000002602d195  
**Date**: 4天前  
**Stats**: 59 likes, 86 collects, 2 comments

## Summary

浙大、复旦、同济、东南大、阿里、蚂蚁、腾讯、OPPO、UCLA、NUS、爱丁堡大学等近20所机构联合发表论文《SkillNet: Create, Evaluate, and Connect AI Skills》，提出将情景经验转化为持久、可组合Skill的开放基础设施。

## Agent经验困境

1. **经验不可持久**：每轮任务结束，解题经验随上下文窗口消失，无法沉淀
2. **行为不可转移**：同一类问题换个场景，Agent上次学会的，这次全忘了
3. **无法累积掌握**：Agent停留在情景适应层面，缺乏跨任务、跨领域的系统性成长

## SkillNet三层技能本体

### 1. 技能分类
- 顶层将技能划分为开发、AIGC、科学、商业等功能域
- 向下细化为"前端"、"物理"等细粒度标签
- 支持高效检索和语义导航

### 2. 技能关系图
- 使用类型化边缘对技能间的功能和语义关系建模：
  - `similar_to` - 相似关系
  - `compose_with` - 可组合
  - `belong_to` - 归属
  - `depend_on` - 依赖
- 让Agent能推理技能兼容性、依赖链和组合路径
- 支撑高阶规划与工作流合成

### 3. 技能包库
- 将单个技能聚合为模块化、任务导向的包（如"数据科学可视化"）
- 每个技能包含SKILL.md文件，内嵌：
  - 元数据
  - 逐步执行说明
  - 可选可执行代码
- 便于版本控制与部署

## 技能创建

支持从异构输入自动提取：
- 执行轨迹
- GitHub仓库
- 办公文档
- 自然语言提示

统一封装为标准化技能包。

## 五维评估体系

| 维度 | 评估内容 |
|------|----------|
| 安全性 | 有害操作或prompt注入风险检测 |
| 完整性 | 前提条件与约束覆盖度 |
| 可执行性 | 沙箱环境中的运行时正确性 |
| 可维护性 | 模块化程度与向后兼容性 |
| 成本 | 计算与API调用成本 |

由GPT-5o-mini自动化评分，辅以代码执行验证。

## 实验结果

**测试环境**: ALFWorld、WebShop、ScienceWorld

1. Agent增强SkillNet后，平均奖励提升**40%**，执行步骤减少**30%**
2. 增益在已见和未见任务中均表现一致，泛化能力强

## 自我积累改进

SkillNet与**OpenClaw深度集成**，构建了一个自生长闭环：
- 成功任务结果自动整合为新技能
- 持续支持技能积累与自我改进

## L3 Flag

**L3 Flag #193**: SkillNet的Skill.md标准化格式和五维评估体系为Skill设计提供参考框架。技能关系图（similar_to/compose_with/belong_to/depend_on）可作为Skill依赖管理的基础。与OpenClaw集成验证了Self-Improvement池的技术可行性。

## Relevant Context

- 五维评估体系可直接应用于我们的Skill质量评估
- 技能关系图的类型化边缘设计值得借鉴
- Self-Improvement池的自动技能生成得到学术验证
- Relevant to: scout - 论文《SkillNet: Create, Evaluate, and Connect AI Skills》值得深度阅读
