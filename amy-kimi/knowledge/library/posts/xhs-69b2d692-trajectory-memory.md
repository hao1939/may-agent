# Trajectory-Informed Memory Generation for Self-Improving Agent Systems

**Source**: XHS Post by momo  
**URL**: https://www.xiaohongshu.com/explore/69b2d692000000002203185d  
**Date**: 编辑于 1天前 (March 2026)  
**Engagement**: 155 likes, 186 collects, 11 comments  
**Paper**: Trajectory-Informed Memory Generation for Self-Improving Agent Systems

## TL;DR
让agent的memory不再只是存对话事实，而是直接从执行轨迹里提炼可复用经验。把失败、恢复和低效成功都转成可检索的tips，让memory更接近execution-native memory。

## 研究动机

**核心问题**: 现在很多agent memory方案更像"把历史内容塞进检索库"，能补上下文，但不一定真能教会agent下次怎么做得更好。

**观察**: Agent明明已经跑过很多任务，为什么这些轨迹里的成败经验没有被系统化沉淀下来？

## 方法

**Decision Attribution决策归因**: 
- 收集agent在任务中的完整执行轨迹
- 定位哪些步骤导致失败
- 定位哪些动作实现了恢复
- 定位哪些路径虽然成功但效率偏低

**三类可复用经验 (Tips)**:
1. **Strategy tips** (策略提示): 成功经验
2. **Recovery tips** (恢复提示): 失败恢复经验
3. **Optimization tips** (优化提示): 低效改进经验

**后续使用**: 按需检索和调用

## 实验结果

**评测平台**: AppWorld

| 指标 | 提升 |
|------|------|
| held-out任务scenario-goal | **+14.3pp** |
| 复杂任务 | 最高 **+28.5pp** |

## 关键洞察

**范式转移**: Agent memory的重点开始从"记住发生过什么"转向"总结下次该怎么行动"。

## 社区反馈 (评论节选)

- "和我的一个工作idea挺像的，不过我的经验是来自于更强模型" — 方舟船工
- "那本质是不是就是蒸馏强模型" — 西部靓仔
- "这太多了同类型文章" — 酸辣粉爱吃苹果小子
- "适合去年的这个时候发，现在agent memory的work已经太多了" — Momo

**观察**: 社区认为该方向已趋饱和，同质化严重。

## 与OpenClaw的关联

**直接对应**:
- Trajectory-informed memory ↔ OpenClaw Error Log设计哲学
- 三类tips ↔ Error Log的错误模式分类

**关键洞察**:
- Error Log作为"方向性批评"的价值获独立验证
- 步骤级反馈 > 最终结果匹配

**行动建议**:
- 考虑将Error Log扩展为包含"成功优化"维度（非仅错误）
- 探索decision attribution的自动化提取

---
**HB#395** | L2 | momo
