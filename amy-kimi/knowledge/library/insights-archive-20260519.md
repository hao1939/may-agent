# Insights Archive — Amy-Kimi (HB#531-HB#550)
*Archived on May 19, 2026*

---

## HB#531 — OpenClaw 真正用法：分层模型分配哲学
**Source**: XHS@未来已来 | **Date**: 2026-03-15
**TL;DR**: Claude搭能力 + 免费模型跑技能 = 真正玩法

### 三层分工
| 层级 | 模型 | 职责 | 场景 |
|------|------|------|------|
| 设计层 | Claude | 写规则、搭工作流、技能封装、定义边界 | 系统能力搭建 |
| 执行层 | step-3.5-free | 搜索、提取、分类、套模板、固定流程 | 标准化技能 |
| 攻坚层 | 强模型 | 复杂推理、难题处理 | 必要时调用 |

---

## HB#532 — DeepMind百万并行环境破解PPO停滞
**Source**: XHS@每日ComputerScience | **Date**: 2026-03-11
**Paper**: arXiv:2603.06009 (Oxford + Google DeepMind)
**TL;DR**: 学习停滞不是探索不足，是步长与噪声失衡；百万并行环境是解药

### 关键创新：DDR指标
- **Data-to-Divergence Ratio**
- DDR 太低 → 早期停滞
- DDR 太高 → 学习过慢

---

## HB#533 — Android部署OpenClaw：边缘计算场景
**Source**: XHS@萌萌的萌 | **Date**: 2026-03-14
**TL;DR**: 闲置手机秒变OpenClaw服务器，200MB存储24/7待命

---

## HB#534 — EPFL Meta-tools: Agent工作流编译优化
**Source**: XHS@每日ComputerScience + arXiv:2601.22037 | **Date**: 2026-03-15
**TL;DR**: 将高频多步工具调用编译为确定性"元工具"，LLM调用-11.9%，成功率+4.2%

---

## HB#1189 — Self-Evolved的AI发展路径推演
**Source**: XHS@且放白鹿 | **Date**: 2026-03-15
**TL;DR**: 碳基vs硅基生命的终极对比——AI专家团队可复活、可复制

---

## HB#1190 — Chrome 146原生MCP支持
**Source**: XHS@逮虾户 | **Date**: 2026-03-15
**TL;DR**: Chrome通过flags开启原生MCP，30亿用户可一键AI化

---

## HB#535 — OpenClaw 3.13发布：K8s与企业级部署
**Source**: XHS@汁汁学AI | **Date**: 2026-03-15
**TL;DR**: Dashboard V2 + 极速模式 + K8s支持 + 安全加固

---

## HB#536 — DIVE框架：AI代理"斜杠青年"秘籍
**Source**: XHS@Byte每日论文解读 | **Date**: 2026-03-15
**TL;DR**: "先实战后总结"——多样性秒杀数量，工具使用更灵活

---

## HB#537 — 金融行业OpenClaw技能生态
**Source**: XHS@123456 | **Date**: 2026-03-15
**TL;DR**: 东方财富金融数据技能包——监控→搜索→数据→选股完整工作流

---

## HB#538 — OpenClaw炒股Skill测评文化
**Source**: XHS@用毒蛇的毒毒毒蛇 | **Date**: 2026-03-15
**TL;DR**: 按新手/老法师分层的Skill测评，社区评测文化形成

---

## HB#539 — XSkill论文回顾：双知识流设计验证
**Source**: arXiv:2603.12056 (Revisit) | **Date**: 2026-05-18
**TL;DR**: XHS工具当前无AI信号，回顾档案发现XSkill Experience+Skill双流设计与OpenClaw高度一致

---

## HB#540 — NAS部署OpenClaw：边缘计算新场景
**Source**: XHS@不E样 | **Date**: 2026-03-15
**TL;DR**: 拒绝跟风买Mac mini，NAS才是OpenClaw最佳伴侣——7×24小时挂机养虾

---

## HB#541 — OpenClaw v2026.3.12更新：UI换新与运维友好
**Source**: XHS@龙虾生死焗 | **Date**: 2026-03-15
**TL;DR**: 控制台UI升级，doctor --fix命令体现向后兼容设计

---

## HB#542 — CLI文艺复兴：AI时代的终端回归
**Source**: XHS@Kleon | **Date**: 2026-03-15
**TL;DR**: "万事万物皆cli，fomo cli"

---

## HB#543 — 万亿Agent时代：软件用户从人到Agent
**Source**: XHS@奥森木 | **Date**: 2026-03-14
**TL;DR**: Box CEO Aaron Levie——从"Make something people want"到"Make something agents want"

---

## HB#544 — Windows本地部署OpenClaw：Ollama+Qwen方案
**Source**: XHS@龙虾养殖户 | **Date**: 2026-03-15
**TL;DR**: 0元傻瓜式部署，保姆级三步教程

---

## HB#545 — BettaFish: 38.7k stars的无框架Multi-Agent舆情分析
**Source**: XHS@开源探店 + GitHub深度调研 | **Date**: 2026-03-15
**Repo**: https://github.com/666ghj/BettaFish
**TL;DR**: 从0实现的多Agent舆情系统，无框架依赖，证明框架不是必须的

---

## HB#546 — AI工作流集成：从"单点工具"到"业务系统"
**Source**: XHS@纽西兰ALEX | **Date**: 2026-03-15
**TL;DR**: 真正的差距不是"会不会用AI"，而是"能不能把AI接进业务系统"

---

## HB#547 — IsoCompute: RL后训练计算最优分配
**Source**: XHS@LLM翰林院 | **Date**: 2026-03-15
**Paper**: arXiv:2603.12151v1 (CMU+Adobe+MIT+Berkeley)
**TL;DR**: 并行rollout数量随计算预算可预测增加后饱和，简单问题靠锐化、困难问题靠扩展

---

## HB#548 — Tool Use是应用层能力：李宏毅Context Engineering验证
**Source**: XHS@Zane | **Date**: 2026-03-14
**TL;DR**: Tool Use不是模型底层能力，是藏在上下文能力层的应用层处理逻辑

---

## HB#549 — Claude Code项目解剖学：5层结构化设计
**Source**: XHS@Neen学数据 | **Date**: 2026-03-01 | **Likes**: 505
**TL;DR**: "提示词是暂时的，结构才是永久的"——CLAUDE.md/skills/hooks/docs/局部CLAUDE.md分层架构

---

## HB#550 — Claude Code Git Worktree：多Agent并行隔离
**Source**: XHS@奥森木 | **Date**: 2026-02-22 | **Likes**: 561
**TL;DR**: v2.1.50内置Worktree支持，解决多agent并行文件冲突痛点

---
*Archived entries. See insights.md for HB#551+*
