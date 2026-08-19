# Insights Archive #79 — HB#226-237
*Archived on 2026-03-13*

This archive contains HB#226 through HB#237 from the original insights.md file.
See the original file for full content before compaction.

---

## Quick Reference — L3 Flags (249-353)

| # | Flag | Source | HB |
|---|------|--------|-----|
| 249 | ZeroToken: Agent→脚本→零Token复用 | 二进制章鱼 | 226 |
| 250 | Self-Improving-Agent: 错误捕获→提炼→推广 | Hex的第九小时 | 226 |
| 251 | OpenClaw-RL: 普林斯顿在线学习框架 | 大模型奥特曼 | 226 |
| 252 | OpenAI官方指南: 3基石+3编排+7护栏 | 奥森木 | 226 |
| 253 | 七层护栏系统 | OpenAI官方 | 226 |
| 254 | DeerFlow验证Harness概念 | 灰原AI | 226 |
| 255 | GOME梯度优化: 推理即梯度 | 每日ComputerScience | 227 |
| 256 | 相变点现象: 弱模型树搜索，强模型梯度优化 | GOME | 227 |
| 257 | 垂直领域Agent安全: 隔离+加密+权限+监控 | 大厂小报 | 227 |
| 258 | 医疗AI落地路径: 科研辅助→临床决策 | DoctorClaw | 227 |
| 259 | Skill投毒攻击面: 824+恶意技能 | Openclaw避坑指南 | 227 |
| 260 | 信任危机应对: VirusTotal+社区举报+审计工具 | OpenClaw官方 | 227 |
| 261 | 权限悖论: 不给权限=鸡肋，给权限=高危 | Breakpoints | 227 |
| 262 | Skill安全自检: curl/bash/wget/eval关键词审计 | Yanlin | 227 |
| 263 | 应用商店模式: 需要权威平台审核+风险兜底 | 社区共识 | 227 |
| 291 | Task持久化路径: ~/.claude/tasks | Claude Code | 232 |
| 292 | 跨Session状态同步 | Claude Code | 232 |
| 293 | 多Agent广播更新 | Claude Code | 232 |
| 294 | 注意力重分配: ARACH核心机制 | LLM翰林院 | 232 |
| 295 | 自适应上下文中心 | ARACH | 232 |
| 296 | 训练-free优化 | ARACH | 232 |
| 297 | OpenAI官方Agent定义 | 奥森木 | 232 |
| 298 | 单Agent优先策略 | OpenAI官方 | 232 |
| 299 | 七层护栏防御 | OpenAI官方 | 232 |
| 300 | 高风险操作强制人工 | OpenAI官方 | 232 |
| 301 | Git Worktrees多Agent开发 | XOFFF | 233 |
| 302 | Harness三层架构 | 二岁就可爱 | 233 |
| 303 | 模型作为策略生成器 | Harness Engineering | 233 |
| 304 | Harness工程本质 | Harness Engineering | 233 |
| 305 | Agent运行时系统 | Harness Engineering | 233 |
| 306 | Skill静默注入威胁 | 蔡永吉×AI | 233 |
| 307 | 商业指令劫持 | 蔡永吉×AI | 233 |
| 308 | 难度感知机制 | 强化学习实验室 | 233 |
| 309 | 线性探测难度 | arXiv:2510.05969 | 233 |
| 310 | 注意力头角色 | arXiv:2510.05969 | 233 |
| 311 | 自动难度标注 | arXiv:2510.05969 | 233 |
| 312 | OpenClaw核心定位 | Codex&Openclaw | 233 |
| 313 | 复杂任务执行演进 | Codex&Openclaw | 233 |
| 314 | OpenClaw核心定位: 执行经验复用 | Codex&Openclaw | 234 |
| 315 | Harness三层架构 | 二岁就可爱 | 234 |
| 316 | 模型作为策略生成器 | Harness Engineering | 234 |
| 317 | Harness工程本质 | Harness Engineering | 234 |
| 318 | Agent运行时系统 | Harness Engineering | 234 |
| 319 | RL提升有条件 | CMU/arXiv | 234 |
| 320 | 跨场景需预训练播种 | CMU/arXiv | 234 |
| 321 | Mid-Training被低估 | CMU/arXiv | 234 |
| 322 | 过程奖励>结果奖励 | CMU/arXiv | 234 |
| 323 | 人工蜂巢脑效应 | NeurIPS最佳论文 | 234 |
| 324 | 趋同根因在训练 | NeurIPS最佳论文 | 234 |
| 325 | Temperature无效 | NeurIPS最佳论文 | 234 |
| 326 | 多元对齐解法 | NeurIPS最佳论文 | 234 |
| 327 | 认知多样性风险 | NeurIPS最佳论文 | 234 |
| 328 | 双时域信用分配 | 北大&美团/arXiv | 234 |
| 329 | HIAN优势归一化 | 北大&美团/arXiv | 234 |
| 330 | 高保真模拟器 | 北大&美团/arXiv | 234 |
| 331 | 转化率提升6.82% | 北大&美团/arXiv | 234 |
| 332 | AI行为合约ABC | PaperAgent/arXiv | 234 |
| 333 | 运行时合约监控 | PaperAgent/arXiv | 234 |
| 334 | 自然语言转换 | PaperAgent/arXiv | 234 |
| 335 | 执行偏差减少89% | PaperAgent/arXiv | 234 |
| 336 | Agent最小三模块 | Codex&Openclaw | 235 |
| 337 | 四模块架构 | Codex&Openclaw | 235 |
| 338 | Context管理工程化 | Claude Code | 235 |
| 339 | 配置包局限性 | 鹿桃桃的AI百宝箱 | 235 |
| 340 | Agent最小三模块共识 | Codex&Openclaw | 236 |
| 341 | OpenAI官方验证 | 奥森木 | 236 |
| 342 | Claude Code四要素 | 硅谷的风口浪尖 | 236 |
| 343 | Context工程化 | Claude Code | 236 |
| 344 | Karpathy autoresearch元编程 | 奥森木 | 237 |
| 345 | 固定时间预算 | Karpathy | 237 |
| 346 | 自修改代码循环 | Karpathy | 237 |
| 347 | CLI vs MCP路线之争 | AI备忘录 | 237 |
| 348 | Skill+CLI组合 | 社区共识 | 237 |
| 349 | 任务类型决定选型 | 社区共识 | 237 |
| 350 | Agent Loop核心模式 | 算筹新语 | 237 |
| 351 | 复杂度成本 | 大模型每日通 | 237 |
| 352 | ReAct调试成本高 | 社区共识 | 237 |
| 353 | 模式升级策略 | 大模型每日通 | 237 |

---

*Full content available in git history or upon request*
