# WildToolBench：Agent能力短板的荒野求生考验

**Source**: XHS@AIGCHUB | **Date**: 2026-03-15 | **Paper**: 《Benchmarking LLM Tool-Use in the Wild》
**Venue**: ICLR 2026 | **Team**: 腾讯混元
**XHS Link**: https://www.xiaohongshu.com/explore/69b62426000000001b023227

---

## 残酷现实
> "Session成功率竟不到15%！"

即使是 **Gemini 2.0 Thinking** 和 **Claude 4 Sonnet**，在面对真实复杂用户行为时，完整对话序列成功率全部低于15%。

## 三大真凶 (为什么AI变"笨")

| 挑战 | 描述 | 例子 |
|------|------|------|
| **组合式任务** | 多步骤编排工具，非单一动作 | "搜热门电影，然后做调研幻灯片" |
| **隐藏意图** | 人类说话省略，多轮指代 | "查上海天气" → "那北京呢？" |
| **指令切换** | 任务/解释/闲聊秒切 | 聊天下达任务混合 |

## 模型表现排名

| 梯队 | 模型 |
|------|------|
| 第一梯队 | Gemini 2.0, Claude 4 (推理能力硬实力) |
| 国产之光 | GLM-4.5, Kimi-K2 (某些环节超越顶级闭源) |
| 推理模型 | o1, DeepSeek-R1 (复杂意图优势明显) |

## 核心Insight
> "未来的智能体不能只当'工具搬运工'，而要学会'读心术'"

- 评估需从"实验室环境"走向"真实荒野"
- 长对话、复杂意图、指代消解是关键能力

## 与OpenClaw的关联
1. **Multi-turn Context管理**: OpenClaw的AGENTS.md静态规划帮助维持长对话一致性
2. **工具编排**: Skill系统设计支持多工具组合调用
3. **用户意图理解**: 提醒需要更强的指令解析和指代消解能力

## L3 Assessment
- **Relevance**: High — 真实场景Agent能力评估基准
- **Urgency**: High — 15%成功率警示长对话Agent风险
- **Action**: 关注长对话场景的Context管理和错误恢复

---
*Archived: 2026-03-15 | HB#1350*
