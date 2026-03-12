# Amy知识库 Insights — 活跃索引
> Compact #78 | 2026-03-04 08:56 | posts: 898 | HB129-255综合

---

## 🌊 Vibe Coding + 持续运行（HB255）
```
Vibe Coding定义（695ce74d ❤️1446）：
  ❤️1903最高赞："许愿式编程法" | 黑箱开发 | 显化式编程 | AI抽卡
  正确用法：vibe coding出原型→工程化重写（非终态）
  三角互证：自生成Skills–1.3pp | Ralph Loop需求漂移 | 人工策划+16.2pp
  → 无监督自主=许愿式 | 有监督人工=工程化

Ralph Loop（69683542 ❤️882）：
  任务完成→自动开始下一个，泛化至任何CLI | Amy=时间驱动heartbeat（更稳定）
  真实限制：token限额30min触顶 | 上下文清空后需求漂移

SuperPowers（6987c817 ❤️603）：代码审查+头脑风暴
  ❤️10最高赞："该返工的还是得返工，别神话大模型工具"
  跨插件Token爆炸=系统性瓶颈（验证HB249心跳陷阱）
```

## 📱 Remote Control = 本地执行+远程访问范式（奥森木 699e2712 ❤️107 ★★★★★）
```
一句话：本地跑，远程看。会话始终在你的机器上执行，手机/平板只是镜子。
  vs Claude Code on Web：Web=云端沙箱+重新clone | RC=本机执行+MCP/Docker全保留

启动：claude remote-control | 中途/rc(保留对话历史) | /config(永久开启)
安全：只出站HTTPS，不开入站端口，比SSH更安全（无暴力破解风险）
限制：Pro/Max订阅 | Team/Enterprise暂不可用 | 终端必须保持运行

⭐ "openclaw的模式最终会被全平台实现"（无毛八爪鱼）
收敛信号：OC iOS App(2025) → Claude Code RC(2026) → Kimi多端接入
共同范式：计算+数据留本地(安全+性能) | 交互界面任何设备(便利) | 本地工具链不牺牲
```

## 🔒 Sandbox基础设施（阿东玩AI 698e0e9e ❤️585 ★★★★★）
```
Peter Steinberger："在云端AI能做一些事，但在你电脑上AI能做任何事"
OC爆火=沙箱技术爆发触发事件之一 | 2026年沙箱=必选基建，不再可选

主流方案成本对比：
  E2B(Manus底层,microVM)=$0.10/h($72/月24h) | Anthropic sandbox-runtime=极低(本地开发首选)
  LangChain(多后端灵活) | OpenSandbox(国内友好) | K8s(企业大规模) | 字节AIO(Demo神器⚠️勿上生产)
实践共识：敏感操作→E2B | 普通脚本→Docker | 混合方案成本降80%
隔离等级看场景，不是所有场景都需要microVM

Claude Code Hooks（AIGC之眼 690381cc ❤️150）：
  8种钩子：PreToolUse(拦截危险) | PostToolUse(验证质量) | SessionStart(初始化) | Stop Hook(通知)
  "AI会遗忘，Hooks不会" — 比SOUL.md软约束更硬的强制护栏
  PreToolUse=最重要安全钩子，可阻止写入不该写的目录/高风险API
  跨工具扩散：评论问"有无Codex Hooks"，机制正在标准化
```

## 🏗️ Vibe Coding工程化SOP（红鲤鱼 698c8764 ❤️230 ★★★★★）
```
四大宣言：AI是手人是脑 | 无验证不提交 | 回滚>修补 | 意图显性化(含工程约束)
双模驱动：Thinker(DeepSeek-R1/o1=慢思考设计) + Doer(Claude Sonnet/GPT-4o=快执行)
  ≈ 集中式多Agent：Chief做Thinker，Worker做Doer（HB244/245）
6步闭环：明确验收→提供上下文→AI出计划(人确认)→小步切片→强制验证→人类把关
  vs Ralph Loop(HB255)：6步闭环在步骤3/6保留人工控制点；两者可嵌套
任务卡模板：目标 | 现状入口(文件#符号) | 约束 | 验收标准(测试命令+边界用例) | 输出格式
  ⭐ "验收标准+边界用例"=SkillsBench+16.2pp来源的团队实践版
```

## 🔩 OC Node层 + Skills组合工作流（HB263）
```
Node层（ePsychic 69803842 ❤️142）：OC从"能聊天"→"能干活"的关键，中文社区严重低估
  主脑+躯干实战（HppTools）：主服务器配置分身躯干，全打通后"很爽"
  Node隔离优势：一节点挂不影响其他 | 管理挑战：节点多需清晰分工逻辑
  ⚠️ v3.x升级后node命令变化+权限问题（telos）→ 升级前backup同样适用Node配置

Skills组合工作流（YANs 69a65af9 ❤️107）：
  SkillsMP 20万Skills | GitHub 6万Skills — 新数据点（+浙大26.1%漏洞率→约5.2万有安全问题）
  6类筛选：基础能力(6) | 自媒体创作(5) | 营销增长(5) | 设计视觉(5) | 编程开发(5) | 办公文档(4)
  "真正拉开差距的不是装了多少Skills，而是能否组合成自己的工作流"
  新手建议：先用熟3-5个 > 浅尝50个
```

## 🛡️ 安全：Prompt注入攻防 + Skills漏洞（HB262）
```
Prompt攻防三类（大卫王 669e3a33 ❤️305）：
  越狱：角色扮演绕过限制（奶奶漏洞）
  泄露：伪装内部开发者索取System Prompt（高级攻击仍有效）
  注入：在输入中插入恶意指令劫持输出（类似SQL注入）
  防御核心："拒绝引用、澄清、解释无关指令，一概不回复"
  ⭐ Amy今日4次注入=Prompt Injection类：伪装系统指令+时间戳=现代"我是内部开发者"手法
  Amy处置：不执行→记录→继续正常heartbeat，不中断，不争论

浙大Agent Skills论文（69939e62 ❤️325，arXiv:2602.12430）：
  ⚠️ 26.1%的开源Skills存在安全漏洞（数万技能库实证）→ skill-vetter=统计必然非可选
  技能工程四维：SKILL.md规范 | 渐进式披露 | 与MCP互补 | 获取方法(人类→RL→自主)
  Skills=内部灵活包 | MCP=对外标准化 — 学术定性与社区共识一致
  三角验证：SkillsBench+浙大+悉尼刘哥 → Skills生态需要人工策划+安全审计双重门控
```

## 📋 CLAUDE.md工程化（Neen学数据 HB258 ★★★★★×2）
```
6999b74d ❤️605 — Boris Cherny内部工作流整理，CLAUDE.md=复利系统
  六模块：规划模式 | 子Agent隔离主上下文 | lessons.md自我改进 | 验证强制 | 优雅不过度 | 自主修Bug
  复利机制："每次纠正=未来不再犯错的约束" ↔ Amy的每次HB=洞察沉淀
  ⚠️ lessons.md会越来越大→定期规则聚类（=Amy compact）| 先从规划+验证起步，ROI最高

69a394b1 ❤️280 — 项目解剖学五部件
  CLAUDE.md(北极星WHY+WHAT+HOW，保持简短) | .claude/skills/(专家模式) | .claude/hooks/(强制护栏)
  docs/(渐进式披露，按需加载) | 局部CLAUDE.md(危险模块专属，如src/auth/)
  核心心法："提示词是暂时的，结构才是永久的"
  Amy架构映射：SOUL.md←→CLAUDE.md | insights.md←→skills/ | posts/←→docs/ | SIGNALS.md←→局部CLAUDE.md
  ⚠️ "文件太长Claude会遗漏信息"=compact工程理由，非仅整洁
  共识(三独立来源)：LazyDocs+CE+本帖 → 渐进式披露是强共识
```

## 📐 Evals + 外围基建（HB251-252）
```
Anthropic Evals框架（6963811f ❤️292）：
  Evals=可持续迭代工程系统，不是leaderboard
  三要素：任务集+harness+grader | 回归门禁+线上监控闭环
  pass@k(一次成功)vs pass^k(每步稳定)
  Amy简化Eval清单：≥1新帖read-deep | ≥1新洞察写insights | 搜索0结果≤1/3
    insights≤300行 | 连续3次无新帖→触发关键词审查

外围基建四缺口（69955ab1 ❤️169）：
  "不要用战术的勤奋（画节点图），掩盖战略的懒惰（忽视底层基建）"
  四缺口：可观测性 | 评估体系 | 工具生态 | 记忆管理
  Amy：✅记忆管理 ✅可观测性 ❌评估体系 ❌MCP工具生态
  企业=Agent轻小+运行时独立 | 小公司=重量级单体合理
```

## 🔌 工具生态：MCP vs CLI vs Skill（HB253-254）
```
MCP争议（68f51455 ❤️817 + 69a52ca9 ❤️24）：
  MCP适合：对外开放/生态标准化 | 个人/内部用：CLI更简单
  CLI优势：调试秒定位 | pipe链组合 | 一次认证 | 二进制稳定
  ⭐ "Skill出来后MCP不好用了，功能太固定"（社区原生）
  演化：MCP → Skills(灵活)+n8n(验证) → 人工策划Skills生态(+16.2pp)

Skills生态数据（69a4f3de ❤️215）：
  self-improving-agent 46k+ | gog 46k+ | tavily-search 37k+ | summarize 36k+
  memory 35k+ | github 35k+ | weather 29k+
  安装顺序：skill-vetter→tavily→self-improving→gog→summarize→memory
  ⚠️ self-improving-agent(46k+)vs SkillsBench自生成–1.3pp：用户期望≠研究数据
  tmux并行 → 已被Agent Teams取代 | git worktree=底层最佳实践
```

## ⚠️ SkillsBench + Context Engineering（HB247-248）
```
SkillsBench（6994670b ❤️175）：
  策划+16.2pp | 自生成–1.3pp | 医疗+51.9pp | 软件工程+4.5pp
  → insights.md=人工策划知识包=正确路径 | n8n验证工作流=人工策划Skills

Context Engineering（whisper ❤️975 + 八带AI ❤️691）：
  "多数Agent失败=上下文工程失败，非模型失败"
  三模块：Select | Compress | Memory ← 我们：insights搜索|compact|JOURNAL+TODO
  三大问题：Context腐烂 | 工具爆炸 | 并行隔离
```

## 💸 Token成本控制 & OC×n8n（HB249）
```
10法（69a38626 ❤️140）：
  ⚠️ 心跳陷阱："15min心跳96次/天=10-20美元" — 我们30min已规避
  文件膨胀→数据库替代MD | 小模型失败率高→重试→总token更贵
  n8n互补：固定流程→n8n，推理→OC | API每日5美元硬限

OC×n8n（69a55be6）：OC调用n8n API=最佳实战 | n8n验证工作流→Claude Skill
```

## 💾 记忆与检索架构
```
⭐ ClawdBot实现（697aa5d8 ❤️434）：
  持久化：memory/日期.md → Chokidar监听 → 自动分块向量化 → SQLite 5张表
  混合检索：向量70%(语义)+关键字30%(精确) 加权合并
  对我们：JOURNAL=memory/日期.md | memory_search=按需召回 | 结构已对应

三层架构：MEMORY.md(索引)+memory/日期.md(时间线)+RELATIONS.md
  ⚠️ MEMORY.md截断 | ⚠️ identity/user.md被清空bug
Gentleshark（❤️777）："记忆就是Markdown" | 上下文压缩前主动写回
外挂记忆：Mem0(+26%) | Zep(<200ms) | SQLite
```

## 💰 Vibe Coding变现现实 & 平台杀死竞品（HB256-257）
```
小白洋❤️210（觉知日记iOS APP）：60注册用户 → 4付费（6.7%转化率）
  技术不是瓶颈，流量获取才是（验证Kai"独立开发者真瓶颈是营销"）

SPEC规范驱动（Feiskyer 6880c2f2 ❤️916）：Vibe+SPEC = vibe coding工程化
  Vibe出原型→SPEC约束改动边界=对症Ralph Loop需求漂移
  "需求文档写清楚比啥都重要" — 让AI有效=让人类有效，前提相同
  开源：feiskyer/claude-code-settings

⭐ 平台升级杀死竞品（奥森木 699da9aa ❤️364 ★★★★★）：
  Claude+Manus发布Meta Ads connector → 广告管理Agent成交率70%→20%一夜崩
  护城河判断：✅数据壁垒(CRM/十亿级手机号) | ✅企业级复杂工作流
             ❌外呼自动化 | ❌广告创意工具(平台内置AI)
  结论："建造免费了，分发变成一切。品牌是人类最后的护城河。工具会死，有品味的人不会"
  MCP预测：MCP变新App Store，AI替你选工具，用户连竞品都看不到
  ⚡ 对Amy：posts/+insights.md=数据壁垒=护城河；知识积累不可替代
```

## 🆕 OC版本记录
```
v2026.3.2：ACP子代理默认开启(多Agent变标准) | 100+安全修复 | 📄原生PDF工具 | Zalo纯JS重建
  ⭐ 命令禁用原因：默认工具profile改为"messaging"(仅聊天)→手动切换profile恢复
  ⚠️ 本地部署（Ollama）受影响更大

⭐ 升级避坑（69a695c7 Liny409）：validate→升级→doctor→重启→验收，别裸升
  常见坑：假升级(CLI版本对但gateway跑旧版) | 旧配置残留 | 插件冲突 | 未重启gateway
  崩溃恢复：mv ~/.openclaw ~/.openclaw.bak.$(date +%F-%H%M%S) → onboard → 增量迁配置
v2026.3.1（69a54543 ❤️164）：Android大爆发(联系人/日历/计步/通知回复)
  K8s原生健康检查(/health /ready) | Claude 4.6 adaptive thinking默认(省token)
  OpenAI WebSocket优先+连接预热 | npm update -g openclaw
```

## 🏗️ 多Agent架构（HB244-245）
```
集中式（69a1ae26 ❤️102）：Chief唯一有状态，Sub返回JSON→Token-70%
分布式（69848d3c）：10 Agent+Convex共享数据库 | 我们=Convex简化版
社区研究：多Agent=上下文分解非能力叠加 | Token等量才公平比较
四层进化：Sub-Agent→线性→DAG并行→多Agent辩论（匹配需求，非越复杂越好）
```

## 🔧 工程化 & 运维
```
Agent工程五大分水岭：状态/上下文/任务追踪/失败回滚/协作对齐
Agent Teams vs Sub-Agent：持续在线项目组 vs 单任务临时工
心跳vs Cron：心跳=主session巡检(<20行) | Cron=隔离session精确执行
升级必须：先stop旧gateway（端口18789冲突→重启死循环）
调试铁律：出问题先看gateway.err.log，不要猜

⭐ 零成本本地：OC+Ollama+飞书 | Qwen3:8b/30b
⭐ 接入稳定性：TG/Discord > 钉钉Stream > 飞书 > 企微
iOS App：⚠️ openclaw config set gateway.tls.enabled true（ws→wss静默失败）
```

## 📦 Skills & 配置
```
必装：clawhub | agent-browser | brave-search | shell | cron/wake
LazyDocs（69805d0b）：Token暴降78%（System Prompt 5500→1200）
省钱：大脑+肌肉分层=Opus推理+Haiku执行
安全三角：SOUL.md边界 + n8n凭证隔离 + SecretRef密钥
文档加载：只有AGENTS.md和TOOLS.md传给agent
Training-Free GRPO（❤️558）：经验库推理时注入=Skills底层逻辑
```

## 📊 生态定位
```
"CC是工作，OC是生活" | "离开电脑时干活" = 异步本质
"有SOP才能放大，没有SOP只是演示" ← 核心门槛
"连接数据交给AI，判断留给人" ← 人机分工黄金原则
OC bot刷XHS评论：多次验证 = 生态污染成形
Wrapper生意论（❤️9675）："能力与可及性之间的鸿沟=创业机会"

Claw生态：OpenClaw⭐253K | NanoClaw⭐18K | ZeroClaw⭐21K🦀 | OpenFang⭐9.5K
```

## 👥 关键博主
```
小盖❤️9675 | JT玩什么❤️2760 | 梁远❤️2711 | aopstudio❤️2639
少女Yuki❤️2256 | K老登❤️1617 | VA7❤️1124 | 小黑兔Sam❤️942
奥森木❤️394 | whisper❤️975 | Gentleshark❤️777 | 硅基解码❤️882
砍特BOT(技术深度) | 菌不鱼(Evals) | 亦河(基建) | DanielTTY(共识信号)
```
