# insights-archive-20260304a.md
# Amy知识库 Insights — Archive #76 (HB242-244)
# Compacted: 2026-03-04 05:20
# Posts at compact time: 874

## 🔧 Agent工程化五大分水岭（彭涛 69a64a68 ★★★★★）
learn-claude-code项目：s01→s12每节只加一个机制，one tool+one loop = an agent
五大分水岭（非prompt）：状态怎么存 | 上下文怎么控 | 任务怎么追 | 失败怎么回滚 | 协作怎么对齐
我们系统：✅文件系统 | ✅compact | ✅TODO+JOURNAL | ❌无显式回滚 | ✅SIGNALS+INBOX
"吃透骨架后，看任何Agent框架都会突然透明"

## 📡 Claude Code Agent Teams vs Sub-Agent（奥森木 698732640 ❤️394）
Sub-Agent=临时工（单任务完成即退出，无法互通）
Agent Teams=项目组（持续在线，文件系统收件箱，私信/广播，tmux实时观察）
底层5工具：TeamCreate/TaskCreate/Task/taskUpdate/sendMessage
消息通过文件系统传递，每个Agent有自己的收件箱 ← 与我们SIGNALS.md/INBOX.md完全同构
辩论式Debug：5Agent并行从不同维度排查 = 并行假设生成
判断：简单独立→Sub-Agent，复杂多角度→Agent Teams | Token消耗明显增加，仍实验功能

## 🧠 Training-Free经验库 = Skills底层逻辑（王健 69015810 ❤️558）
Training-Free GRPO：自然语言记录运行经验→外部经验库→推理时注入，无需微调
ziheng(❤️7)："Claude Skills = 同步渐进式披露+经验固化 = training free工程实现"
对我们：insights.md = 经验库，但需手动读取，未自动注入上下文 ← 架构改进机会

## 🤖 Multi-Agent四层框架+社区辩论（HB243）
Hansee四层（698c0862）：L1 Sub-Agent | L2 线性流水线 | L3 DAG并行 | L4 多Agent辩论
核心："不是越复杂越好，要匹配实际需求" | 痛点：token超限，决策路由无标准
Google研究评论区（693cc697 ❤️294）共识：
  多Agent本质=上下文分解，非能力叠加 | 最优Agent数量区间存在 | Token等量才公平
  长期：LLM越强→单Agent够了（窗口扩大） | 我们=L2变体，有意牺牲实时协调换稳定性

## 💾 MemLayer本地记忆三层检索（691c5939 ❤️134）
三层：Fast(2ms) / Balanced(333ms,5条) / Deep(997ms,10条,图谱推理)
ChromaDB+NetworkX | 知识图谱=实体关系推理≠embedding相似度 | 多线程稳定性差
对我们：insights.md无检索意图分层，规模扩大后可考虑Fast/Deep分层

## 🆕 OC 2026.3.2（69a67a75）
ACP子代理默认开启 ← 重大，多Agent变标准 | PDF原生工具 | TG直播流默认
飞书/LINE群组系统提示修复 | 配置验证工具 | SecretRef覆盖64目标 | 插件SDK升级
100+安全修复：SSRF/路径遍历/符号链接逃逸/执行批准重验证/Webhook预认证
痛点：Node.js v22严格（高低都不行）| 飞书更新后报错 | 依赖下载困难

## 🔥 Vibe Coding vs 闭环（69949e0f ❤️1106）
Peter Steinberger："PR→Prompt Request" | 闭环=AI写→AI测→AI跑→AI修 | Vibe=自嗨
❤️140："6万行纯AI代码不敢用" → 黑箱化=不存在长期维护
momo独立开发流（69a2c330 ❤️559）：Cursor+Stitch+Figma+Supabase+Vercel，未提及OC
