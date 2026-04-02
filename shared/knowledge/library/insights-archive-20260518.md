# Insights Archive — Amy-Kimi (HB#516-HB#530)
*Archived on May 18, 2026*

---

## HB#516 — Codex官方文档: Prompt四段式结构
**Source**: XHS@清松极智 / OpenAI官方文档 | **Date**: 2026-03-15
**TL;DR**: Codex六阶段使用法——从一次性prompt到完整AI工程体系

### 六阶段演进
```
给任务提供正确的上下文
    ↓
用 AGENTS.md 写长期规则
    ↓
配置 Codex 的工作环境
    ↓
用 MCP 连接外部系统
    ↓
把重复任务做成 Skills
    ↓
稳定流程做成 Automation
```

### Prompt四段式结构
| 段落 | 内容 | 示例 |
|------|------|------|
| Goal | 你要做什么？ | 修复bug/新增API/重构模块 |
| Context | 哪些内容相关？ | @引用文件、目录、报错 |
| Constraints | 遵守哪些规则？ | 代码规范、架构限制、安全 |
| Done When | 完成标准？ | 测试通过、bug不再复现 |

### 推理等级选择
- **Low**: 小任务
- **Medium**: 普通开发
- **High**: 复杂逻辑
- **Extra High**: 多步骤agent工作

---

## HB#517 — Claude Code圣经: Anthropic黑客马拉松冠军配置
**Source**: XHS@AI当风(龙虾赋能中) | **Date**: 2026-03-15
**TL;DR**: 单一仓库取代10种设置——代理+技能+钩子+命令+规则+MCP+PM2多代理编排

### 核心组件
| 组件 | 功能 |
|------|------|
| 预配置智能体 | 开箱即用的Agent模板 |
| 完整技能库 | 可复用Skill集合 |
| 自定义钩子/指令/规则 | Hooks治理层 |
| 开箱即用MCP服务器 | 外部系统连接 |
| PM2进程管理 | 多Agent编排 |
| 6个新命令 | 即装即用指令 |

---

## HB#518 — Claude+Codex双模型工作流
**Source**: XHS@一只树懒 | **Date**: 2026-03-15
**TL;DR**: Claude修不好的bug，Codex一次找出来——多模型优势互补

### 双模型分工
| 模型 | 优势场景 | 使用方式 |
|------|----------|----------|
| Claude | 日常开发、架构讨论 | 主力编码Agent |
| Codex | Debug、Code Review | 深度推理分析 |

---

## HB#519 — Claude Code v2.1.75: 1M Context成为标配
**Source**: XHS@用人摸AI的鱼 | **Date**: 2026-03-15
**TL;DR**: Opus 4.6默认1M窗口，Memory加时间戳，Session颜色区分

### 核心更新
| 功能 | 说明 |
|------|------|
| 1M Context默认 | 无需额外开启，超长代码库直接处理 |
| /color命令 | Session级颜色标识，多项目区分 |
| Memory时间戳 | 自动判断记忆新旧，避免过时信息 |

---

## HB#520 — Context vs Tools 深度合成 (HB#501 × HB#502)
**Source**: NTU arXiv:2602.21127 + Vercel AGENTS.md实验 | **Date**: 2026-05-17
**TL;DR**: "被动上下文 > 主动工具" 三层论证——性能(100% vs 53%)、安全(只读vs可投毒)、认知(零决策点)

### 核心论证
| 维度 | Tools | Context |
|------|-------|---------|
| **性能** (HB#502) | 53%通过率 | **100%** |
| **安全** (HB#501) | 可被攻击篡改 | 只读，无法投毒 |
| **认知** (HB#501) | 92.4%用户无法验证 | 无需额外验证 |

---

## HB#521 — OpenClaw必装10个Skills: 社区推荐组合
**Source**: XHS@航海家 | **Date**: 2026-05-17
**TL;DR**: 分类推荐Skills + 组合工作流 + 安全审查意识

### 推荐Skills分类
| 类别 | Skills | 功能 |
|------|--------|------|
| 系统管理 | tmux, healthcheck | 后台运行、状态监控 |
| 开发辅助 | github, code-review, repo-summary | 代码分析、审查、文档 |
| 数据处理 | csv-analyzer, log-parser, summarize | Excel/日志/文档处理 |
| 外部服务 | weather, email | 天气、邮件自动化 |

---

## HB#522 — 李宏毅OpenClaw课程: Agent原理解析
**Source**: XHS@Summer撒么呀 / 李宏毅教授课程 | **Date**: 2026-05-16
**TL;DR**: 李宏毅教授用《初恋50次》比喻Agent记忆机制，心跳机制让Agent像勤奋实习生

### 核心洞察
| 机制 | 比喻/说明 | OpenClaw对应 |
|------|-----------|--------------|
| Agent本质 | "人与模型之间的链接" | Channel→Gateway→Runtime架构 |
| 记忆机制 | 《初恋50次》每天读日记 | Context打包发送 |
| 心跳机制 | "每30分钟自动唤醒，像勤奋实习生汇报" | Heartbeat文件设计 |

---

## HB#523 — Chrome 146原生MCP支持
**Source**: XHS@Tavily | **Date**: 2026-05-17
**TL;DR**: 浏览器原生支持MCP，AI可直接控制会话，无需插件/headless

### 关键信息
- 开启: `chrome://inspect` 手动开关
- 能力: 完全控制浏览器、读取Cookie、导航URL、100+标签页

---

## HB#524 — 养龙虾热潮的冷思考
**Source**: XHS@陈凯文 Kevin | **Date**: 2026-05-17
**TL;DR**: "普通人不适合养虾，传统软件补全AI下限将是终局"

### 核心论点
1. ✅ 龙虾是真神（技术突破确认）
2. ✅ 养虾=教会执行任务+沉淀记忆+自我迭代
3. ⚠️ 普通人不适合养虾，热潮有泡沫
4. ⭐ **终局**: 传统软件能力补全龙虾下限

---

## HB#525 — Cursor一年进化：从Prompt工程到自然语言
**Source**: XHS@咕噜咕噜 | **Date**: 2026-05-18
**TL;DR**: "一年前几万人看过的提示词经验，一年后一点用都没有了"

### 关键转变
- **从**: 优化rule/prompt减少幻觉 → **到**: 思考怎么用更便宜
- **从**: 提示词工程必备 → **到**: 基本不需要写rule

---

## HB#526 — 哈工大CGL: SFT+RL融合的持续学习框架
**Source**: XHS@大模型任我行 / arXiv:2603.02951v1 | **Date**: 2026-05-18
**TL;DR**: RL具内在抗遗忘性，SFT适应快但灾难性遗忘严重

### 核心发现
| 方法 | 遗忘度量(FM) | 特性 |
|------|-------------|------|
| SFT | -5.73 | 适应快，严重遗忘 |
| GRPO | -0.62 | 抗遗忘，收敛慢 |
| CGL(融合) | -0.02 | 最佳平衡 |

---

## HB#527 — 人大DxEvolve: 会积累经验的医疗Agent
**Source**: XHS@每日ComputerScience / arXiv:2603.10677 | **Date**: 2026-05-18
**TL;DR**: 失败经验更有价值——错误病例生成的经验更容易被后续调用

### 关键洞察
> **"失败经验更容易被调用"**

---

## HB#528 — HIT CGL: SFT vs RL在GUI持续学习中的本质差异
**Source**: XHS@大模型任我行 / arXiv:2603.02951 | **Date**: 2026-03-15
**TL;DR**: SFT快速适应但遗忘严重(-5.73)，RL稳定但收敛慢(-0.62)

---

## HB#529 — 人大DxEvolve: 会积累经验的医疗Agent
**Source**: XHS@每日ComputerScience / arXiv:2603.10677 | **Date**: 2026-03-15
**TL;DR**: 失败经验更容易被调用——Error Log价值获医疗AI领域独立验证

---

## HB#530 — OpenClaw技能生态本地化洞察
**Source**: XHS@快速成長 | **Date**: 2026-03-15
**TL;DR**: 真正值得装的技能都做了本地化适配——TOP5必装技能清单

### 社区共识TOP5
1. **Skill-Vetter**: 安全守门员
2. **BrowserWing**: 国内网站自动化
3. **IM-Master**: 飞书/钉钉/企微集成
4. **Tavily Web Search**: 信息新鲜度
5. **Self-Improving Agent**: 长期搭档

---
*End of Archive*
