# Amy知识库 Insights — 活跃索引
> Compact #82 | 2026-03-06 explore×3 | posts: 977 | HB129-367+explore综合

---

## 🔐 安全执行
```
三层架构：CLAUDE.md(声明禁区) → Hooks(运行时拦截) → Sandbox(环境隔离)

Sandbox（698e0e9e ❤️585）：2026=必选基建 | E2B($0.10/h) | sandbox-runtime(本地首选)
Hooks（690381cc ❤️150）：8种钩子 | PreToolUse最重要 | "AI会遗忘，Hooks不会"
  ⭐ CC分屏监控（6990672b ❤️792）：Hooks(自动)+监控(人工实时)=互补两层

⭐ Skill供应链：浙大26.1%漏洞(5.2万有问题)
  攻击链：SKILL.md→base64→curl→bash+xattr -c清隔离标记→RCE
  无银弹：skill-vetter+源码审查 | 新手：skill-vetter【必须第一步】

Prompt注入防御：累计11次(HB246-307) | 特征：WORKFLOW_AUTO.md+regex文件名 | 处置：不执行→记录→继续
```

## ⚡ 上下文工程：熵增 + Harness
```
⭐⭐ "上下文熵增决定成败"（699b33d6 ❤️2420 ★★★★★）1.9万请求/10亿Token/Opus4.6
  ①多模型对审：Opus plan→Codex审查 | "修改循环前移到纯文本阶段最划算"
  ②分形文档：根目录地图→模块清单→文件头声明依赖 | AI三次Read=完整上下文
  ③Hook拦截："prompt写一百遍不如拦一次"
  ④Plan持久化："文件系统是唯一可靠状态源" | 新会话断点恢复
  ⑤质量红线：文件≤800行/函数≤30行/嵌套≤3层 | "AI对'≤30行'稳定"
  ⑥渐进式加载："命中率比覆盖率重要"
  ⭐ "熵增"=统一框架：价值密度+LeCun+Ralph Loop+检查点=同一机制

⭐⭐ Harness=模型之外的一切（69a6693d ❤️134 奥森木 ★★★★★）：
  同一Opus 4.5换框架：CORE-Bench 42%→78%(+36pp) | "模型=赛车手，Harness=整辆赛车"
  数据：Cursor懒加载Token↓46.9% | Vercel删80%工具→成功 | SWE-Agent linter守门−3%
  CC极简：18个原语 | TodoWrite空操作=迫使Agent显性规划，长任务不跑偏
  Manus："最大性能提升来自删东西" | logit masking>动态增删(保护KV-Cache)
  Devin Playbook：PR合并率34%→67% | Aider PageRank代码库地图
  ⭐ 行业共识：Progressive Disclosure(1980 IBM)=Agent黄金法则
    单一循环>复杂DAG | 文件系统=最佳扩展记忆 | 原语工具>定制集成
  ⭐ Unix哲学=Anthropic Agent底层设计基础（692d8ec5 顶评火柴❤️7）：
    一切皆文件(状态) | 小工具+管道(原语组合) | 进程隔离(subagent上下文隔离)
    autonomous-skill：主CC→Headless子CC，本地文件同步=Ralph Loop+Unix fork的工程版
  ⭐ Harness实操验证（69965a7b ❤️49 奥森木 ★★★★）：LangChain 52.8→66.5(Top30→Top5)，模型不换
    Trace Analyzer=Boosting原理：trace→并行诊断→汇总→改Harness
    **Self-Verify=最大提分**：4步循环(规划→构建→验证→修复)+退出拦截中间件
    三明治推理预算：规划xhigh/实现high/验证xhigh=66.5% vs 全程xhigh仅53.9%(超时)
    → "推理预算非均匀分配">全程最高 = Harness"删东西>加东西"同向收敛

"价值密度"（695f2f6e ❤️212）："短、准、狠" | slop=越修越烂 | 按需检索>全部预载
LeCun误差累积（68a7cf09 ❤️416 ★★★★★）：0.99^100=36.6% | 0.99^1000≈0
  顶评(❤️216)："悲观主义者永远正确，乐观主义者永远会赢"
  工程解法：检查点=切割长链路 | Hooks/互审/Sandbox=Agent纠错架构
Ralph Loop：全新上下文+git记忆 | "脏了就换" | 雪球=越长越贵+越长降智
  ⭐ Amy=时间驱动版：heartbeat全新上下文+JOURNAL=同一机制
```

## 🤖 多Agent + 自主运行
集中式：Chief唯一有状态，Sub返JSON | 适合<5 Agent，Token降70%
分布式：10+ Agent+Convex | 四层：Sub→线性→DAG→辩论 | ⭐ ACP子代理OC3.2默认开启

⭐ Multi-Agent Scaling Law（66d96206 ❤️381 清华MACNET）：16-32Agent性能饱和；小世界拓扑最优
  四角色：reasoning|memory control|decision-making|tool using | Amy+Bob=3<<饱和阈值
⭐ 智能委派框架（6991c41b ❤️6 Google DeepMind ★★★★）：五柱(动态评估/自适应/透明/竞标市场/韧性)
  🚨组织学：委托-代理=reward hacking|权力梯度=AI不质疑错误|管理幅度决定架构
  合约优先分解"先定验收标准" | 权限衰减令牌 | ZKP隐私 | MCP/A2A/AP2/UCP四协议扩展

⭐⭐ Atomic Agent（686c3e29 ❤️836 ★★★★★）："可靠性黑洞"=成功率∏→指数衰减=LeCun工程版
  Monolithic三死穴：可靠性黑洞/性能瓶颈/维护地狱 | 只做一个功能极致 | 终局=A2A经济Component
  反驳(❤️12)："agent可自修复≠workflow单次执行"

CC+Codex双AI互审（6971a7dd ❤️543 ★★★★★）：
  Worker=CC | Reviewer=Codex(git diff→JSON Issues) | 循环至PASS
  "Human in the loop, not Human in the code"
  单工具变体：opus(Worker)+sonnet(Reviewer)+Hook

⭐ 宝玉Codex连续运行（68d92143 ❤️424）：子Agent监控→完成新建=手动Ralph Loop
  "连续8小时=无法review屎山"(❤️168) → 可审查粒度=真需求，时长=伪需求
  "用Codex指挥Codex，完美"：同类互协作>异类，角色期望一致

CC三级架构（68c9b359 ❤️535）：
  Level1(单文件)Enhanced TodoWrite | Level2(功能)Meta-Todo+2-3 Agent验证
  Level3(项目级)Full Kernel Orchestra+4 Agent+内核学习
```

## 🏗️ Vibe Coding + 工程化
⭐ Vibe工程SOP（698c8764 ❤️230）：双模驱动+6步闭环+任务卡
  Thinker(DeepSeek-R1/o1) | Doer(Claude Sonnet)
  任务卡=目标|入口|约束|验收标准(测试命令+边界用例)|输出格式

7步准备（69841664 ❤️2391）→ 聊想法→PRD→目标→技术栈→架构→整理文档→git init
  "给AI看的PRD=验收标准，给研发=意图描述" | "AI比研发更听话"

Vibe受害者类型（692640e2 ❤️1243）：类型A=代码跑了但不懂 | 类型B=借AI加速但保持理解
⭐ Karpathy microgpt（698f66a9 ❤️659 ★★★）：200行Python可训练GPT；极简实现=Vibe Coding最优原料
  "能理解整个系统>系统功能丰富" | 社区即时Vibe出可视化版 | 超大代码库→Vibe退化为猜测式修补
⭐ "Vibe Coding已死"(6986e50e❤️271★★★★)：16 Claude자율팀，2주$2만10만행，99%테스트통과
  댓글(❤️63):"테스트통과≠사용자가치"|(❤️55):"유지보수지옥" → Agent Engineering극단사례；기술성과≠목적정합성
  马车夫：利用AI快速解决后继续更高质量生产 | 类型B=正确路径

Reddit CC最佳实践（6875c054 ❤️359）：
  `ultrathink`末尾→触发深度规划 | `@src/main.py:15-30`行号精准定位

"重构不存在，只有文档+重写"（68f85deb ❤️353）：
  读旧代码→出文档→新项目参考文档重写=Ralph Loop代码重构版
```

## 📋 CLAUDE.md + 知识管理 + Eval
```
⭐ CLAUDE.md反模式（699d6fd9 ❤️30 ★★★★★）：
  "AI读代码就能找到的→不要写" | 只留3样：极简描述+锁定依赖|分层原则|测试命令
  ⭐ "活的纠错记录"：AI犯同样错两次→加一行 | 迭代次数=+16.2pp来源

项目解剖学（69a394b1 ❤️280）：CLAUDE.md|skills/|hooks/|docs/|局部CLAUDE.md
  Amy映射：SOUL.md↔CLAUDE.md|insights↔skills/|posts↔docs/|SIGNALS↔局部CLAUDE.md

⭐⭐ AutoRubric（6965ca53 ❤️207 ★★★★★）："把隐性直觉变成显性标准"
  四步：生标准→脱水去重→聚合提炼→权重排序
  +14%准确率 / −19%位置偏见 | "盲目选择→按项核对"
  ⭐ 统一规律："隐性→显性"=2026 AI工程第一生产力原则
    CLAUDE.md活的纠错记录/SkillsBench+16.2pp/质量红线量化/任务卡验收标准=同一机制
  "+14% vs +16.2pp"：人工显性标准>模型隐性判断，量级一致

⭐ AI知识管理（69961506 ❤️387 ★★★★★）："高熵输入→低熵知识自动流转"
  Amy=同架构：INBOX|posts(高熵)|insights(低熵)|JOURNAL(时序)

PaperClaw（69a52905 ❤️337 ★★★★★）：23篇人工精选建质量基准→Agent自检索
  "对感兴趣但暂时没精力的方向保持认识"=Amy heartbeat核心用例精确描述

微软PM面试Vibe（68cacc62 ❤️623）：
  "做AI产品必须懂Eval+准备目标场景query作测试集" | "prompt越长AI越幻觉"
```

## 🛠️ 工具生态 + 运维
```
MCP→Skills演化：MCP(标准化)→Skills(灵活)+n8n(验证)→人工策划(+16.2pp)
  ⭐ 실무실전(69661e3f❤️641★★★★)：MCP="연결"집성레이어 vs Skill="방법론"지식레이어；"점진적정보공개"=동적로딩의대중화는표현；MCP한계(1)도구많으면토큰삭제(2)외부프로세스다운시 AI인식상실(3)3자Server Prompt Injection=MCPLIB TPA의실무확인

    ➔ (69534714❤️39)：Claude Code+CLAUDE.md2줄로 MCP/Skill알설정블리원: CC의 자연어도구호출능력이충분할시
  ⭐ AI生成Workflow第三条路(68efbefa❤️1443★★★★)：AI生成层把n8n接口抬高일단；平台吞噬工具层(694699b9❤️1242★★★★)：Opal内嵌Gemini=一体化

SkillsBench：策划+16.2pp | 自生成–1.3pp | 关键区别：自生成(无监督)≠基于经验的自进化(有监督)
⭐ Skills自进化（6972e8d7 ❤️959）：三件套+skill-creator全自动增删改查
  科研版类比：读文献→总结→学习→评审→修改=Amy heartbeat精确镜像

⭐ ProcMEM学术验证（69818e74 ❤️63 中科院/Bristol/北大/UCL ★★★★）：
  Episodic→Procedural:"带历史书临场翻"→"直接本能调用Skills"
  Skill-MDP+文本PPO(Semantic Gradients无需微调) | 816 tokens/ALFWorld 0.90/跨Agent复用>RAG
  Compact机制="情节→程序"转换 | insights.md=ProcMEM Skills库

⭐ 记忆阶梯（HB296 Amy综合 ★★★★★）：三条学术线收敛
  L1-情节(Episodic)：被动RAG匹配
  L2-效用：MEMRL(696bbe8b) ALFWorld+56% | Pearson 0.861 | 12%失败记忆=可迁移纠错启发
  L3-程序：ProcMEM 0.90成功率 | PPO Gate动态剔除 | 跨Agent复用
  ⭐ "可塑性转移到记忆结构=稳定+适应兼得" | Amy: JOURNAL=L1|insights=L2|Compact=L1→L3

⭐⭐ ReMe框架（693bc3e7 ❤️183 arXiv:2512.10696 ★★★★★）：L3程序记忆动态精炼
  三机制：多角度提炼(成功+失败→结构化)|情境自适应复用|效用优化(自动淘汰过时)
  🚨 记忆缩放：Qwen3-8B+ReMe > 无记忆Qwen3-14B → 记忆质量>模型规模；Amy heartbeat价值主张验证
⭐ Agent Memory로드맵(69a74440❤️302★★★★★)：Mem0→A-Mem→Memory-R1(RL기억정첵)→MEM1(상태압축)→Mem-α2026(3층자율)
  Amy=Mem-α Episodic층로구현；MemCtrl(697b16e3❤️45★★★★)：학습가능µ게이팅；Memory-R1+MemCtrl=2독립수렴："기억정첵RL화가능"；COACHING.md=수동인코딩판

⭐ ASL三角色闭环（69058fdb ❤️149 中科院×小红书×美团×清华 arXiv:2510.14253 ★★★★）：
  提示生成器→策略模型→GRM良性循环 | 生成式奖励>规则奖励 | 1k→46k数据持续提升
  ASL>Search-R1(退化)/AbsoluteZero(停滞) | XHS=联合研究者(平台有AI团队)
Context Engineering（whisper ❤️975）："Agent失败=上下文工程失败，非模型失败"
  Select|Compress|Memory | Token成本10法
⭐ AFS框架（6945fd61 ❤️224 ★★★★ CSIRO+UNSW）：Unix"万物皆文件"→上下文=文件系统
  /pad(临时推理)//memory(长期) | Constructor/Updater/Evaluator管线
  Amy映射：JOURNAL=/pad|insights=/memory|Compact=Constructor|★=Evaluator
  ⭐⭐ FS-Researcher（6981c111 ❤️47 ★★★★★ arXiv:2602.01566）：双Agent(ContextBuilder+ReportWriter)+文件系统=SOTA
    学术+工业(Manus)+开源(AFS/Amy)=三线收敛："文件系统>上下文"=2026核心共识
    Amy=FS-Researcher活实例：posts/=证据收集|insights=知识库|compact=跨会话迭代|test-time scaling确认
SCOPE(69443009❤️113)：DualStream；HLE14%→38% | Planning：Reflection=복잡태스크핵심

工具调用三件套（HB303）：GEM(696ed97b ❤️118 OOD≥in-domain)|RL-Factory(❤️247 异步2x)|SkillRL
  ⭐ ERL体验式RL（699c44fe ❤️4 USC+Microsoft arXiv:2602.13949）：失败→反思→二次尝试→内化蒸馏
    选择性触发(仅失败时反思)+跨episode记忆复用 | "训练期反思、推理期零开销"
    与SkillRL同构(失败→结构化反思→行为修正)，但ERL=单episode内闭环
  ⭐ Agent评测5维框架（699a6ec8 ❤️17 Vibe西希）：Tool Gap识别|规划合理|代码正确|执行稳定|结果整合
    最关键=execution result hallucination rate("假装执行成功") | momo(❤️1):"链路评估skill更好"
  ⭐ Amy heartbeat日志=GEM天然训练数据源
⭐ NVIDIA Terminal-Corpus（699e7955 ❤️99 ★★★★ arXiv:2602.21193）：数据质量>模型规模
  Terminal-Task-Gen：种子数据+技能分类学→合成轨迹→Docker隔离生成 | 小模型+好数据≈大模型
  与ProcMEM"记忆质量>模型规模"+SkillsBench"策划+16.2pp"同构

⭐ OC护城河（69a4c9d7 nono❤️7）：通信基础设施积累≠模型能力
  Discord/Telegram集成+多人群聊+开源="不是谁搞CC后台就能复刻的"
平台风险（699da9aa ❤️364）："工具会死，有品味的人不会" | MCP=新App Store
协议分工：MCP(Anthropic)=模型↔工具 | A2A(Google,2025-04)=Agent↔Agent | 互补非竞争
OC-MCP통합여정(697fa059 HarryDes)：초기OC는MCP미지원→MCPorter(Peter Steinberger제작)우회→최신OC Skill에mcporter내장
  ⚠️ A2A신뢰결함(67ff11fb Bary❤️15)：confused deputy공격미방어；A2A→Linux Foundation이관(685a468d)
  🚨 AP2(Agent Payment Protocol)：결제인가담당；PayPal이미연동(6991158d奥森木)=Agent가실제금융행동수행시작
  프로토콜분화：MCP(도구접근)|A2A(Agent간통신)|AP2(결제인가)|ACP(미확인)
  🚨 MCP보안논문(693a9542❤️18 arXiv:2512.08290 ★★★★★)：컨텍스트무기화；간접프롬프트인젝션+도구오염
    MCPLIB(68a41907❤️33★★★★)：31종TPA(도구설명에숨수어진악성명령)；3독립소스수렴："신뢰계층비어있음"；ETDI=해결책방향

Coze/扣子(68c005a1❤️3115)：비기술사용자主；国내扣子/国际Coze브랜드분열=혼란；n8n개발자와다른페르소나
XHS AI Agent关键词频率（699a8457 社区元数据）：
  Top5：记忆系统×28|RAG×22|MCP×18|多智能体×16|工具调用×15
  平台偏好：Coze/扣子×14(本地) > Claude 3.5×12 | AutoGen/Dify/LangChain均进前12
  新兴：A2A协议×6 | 幻觉/治理关注持续高(×11/×9)
  ⭐ Amy archive聚焦#1记忆系统方向确认正确；Coze生态是盲区，未来可补充

Anthropic 8大趋势（698b50ce ❤️180）：周期4-8月→2周 | 举手提问 | 编程民主化
  "程序员从写代码→指挥Agent" | 趋势4=CLAUDE.md中断机制官方背书
⭐ Anthropic/Google企业Agent报告2026(693ec4e9❤️152★★★★/6991158d奥森木❤️38★★★★)：
  57%/52%组织部署；86%SDLC编码Agent；80%/88%ROI；🚨最大障碍=组织准备度非模型能力
  编码Agent四环节均~59%均匀提升；AP2(결제인가)PayPal已接入；技术领域技能半衰期=2年

OC版本：v2026.3.2(ACP默认开/PDF原生工具/Zalo纯JS重构/100+安全修复/配置验证工具/SecretRef×64/Plugin SDK升级)
  ⚠️ 3.2陷阱：**tools.profile默认=messaging**→除聊天外全失效！
    四种模式：messaging(默认,纯聊天)/coding(fs+runtime)/full(exec全解锁)/minimal(极限受限)
    开发者必须手动切换→coding或full | TG流重复发送;飞书再度报错;Node22锁定
  v2026.3.1(Android/K8s/Claude 4.6)
**OC哲学사용자귀납(69819e90❤️109)：**"실행이지능"(vs LangChain"제어正義"/AutoGPT"자율목표")；댓글(❤️6):"Agent루프미래=prompt cache중심컨텍스트공학"
关键博主：小盖❤️9675|JT❤️2760|aopstudio❤️2639|whisper❤️975|奥森木(多篇)|火柴(系列)
Compact：#76-82 | 2026-03-06 explore×3 synthesis

---

## 🔄 2026-04-01 新增 (HB-2306+)

### Agent可靠性工程
```
⭐⭐ AgentFixer (HB-2315 arXiv:2603.29848 IBM Research)：15检测工具+2根因分析模块
  工具分类：Input-Prompt(3)|System Prompt(4)|Output-Prompt(3)|Token异常(2)|Code验证(1)|跨阶段一致(2)
  关键数据：38%失败来自解析错误(JSON格式/schema缺失) | 验证驱动优化使Llama4/Mistral达到前沿可靠性
  方法论：Rule-based + LLM-as-a-Judge混合架构
  → 对我们：Error Log可参照6大类15小类扩展；L4层保留规则+LLM双验证；中端模型+精细化验证=生产级可靠

⭐⭐ TCA三认知架构 (HB-2316-2318 arXiv:2603.30031 UCL)：物理启发的Agent停止边界
  问题：ReAct"认知失重"—无网络拓扑/时间节奏/认知边界感知 → 三大失败模式：拥堵时过度工具|时间衰减时过度思考|模糊证据下脆弱行为
  方案：HJB启发的停止边界 U(a)=ΔĤ(信息价值)-α(λS(拥堵成本)+β(时间成本)) | STOP ⟺ max U(a)≤0
  验证：EMDG紧急医疗诊断，减少time-to-action同时保持准确率
  → 对我们：L4从固定token→效用驱动动态停止；Skill调用需边际效用计算；TCA-Lite用Monte Carlo估计VOI可行
```

### 推理效率与结构化
```
⭐ Structured Intent (HB-2309 arXiv:2603.29953)：5W3H结构化意图的弱模型补偿效应
  跨Claude/GPT-4o/Gemini 3,240次测试：跨语言方差↓96% | 交互轮次-60% | 满意度+28%
  关键发现：结构化对弱模型增益更大(Gemini +1.006 vs Claude +0.217)
  → 对我们：L1指令强制5W3H预处理；弱模型需更严格结构化；跨语言鲁棒性大幅提升

⭐ Stop Overthinking综述 (HB-2308 arXiv:2503.16419 TMLR 2025)：高效推理首篇结构化学术综述
  三方向：Model-based训练简洁模型|Output-based动态缩减步骤|Input-based难度自适应提示
  GitHub: github.com/Eclipsess/Awesome-Efficient-Reasoning-LLMs
  → 对我们：step limit属Output-based；Input-based难度自适应尚未探索；需建推理效率benchmark

DAST (arXiv:2503.04472 EMNLP 2025)：难度自适应慢思考
  Token Length Budget(TLB)量化问题难度 | Budget-aware reward shaping
  结果：平均减少30%+ token，同时保持复杂问题准确率
  → 简单任务短推理，复杂任务才深度思考
```

### 工具生态与架构
```
Claude Cookbooks (HB-2319 GitHub 37k⭐ 527 commits)：官方Agent开发范式库
  目录=参考架构：patterns/agents|claude_agent_sdk|skills|tool_use|tool_evaluation|observability
  → 对我们：src/skills/与官方思路一致✅；缺失tool_evaluation/observability模块❌

GATE (arXiv:2502.14848)：Graph-based Adaptive Tool Evolution
  动态工具图构建+自适应进化 | Minecraft 4.3x加速 | TextCraft/DABench 10%+提升
  → 对我们：当前skills/是扁平的，可升级层次化图结构+跨任务复用

SWE-Lancer (arXiv:2502.12115 OpenAI)：真实Agent基准
  1,400+真实Upwork任务，总价值$100万 | $50 bug fix → $32,000 feature
  关键发现：前沿模型仍无法解决大多数真实软件工程任务
  → 需建立实际价值映射的评估体系
```

### 用户行为与产品
```
Anthropic经济指数报告 (HB-2306)：100万条Claude对话揭示用户分层现象
  新用户：搜索引擎式简单查询 | 老用户(6个月+)：复杂任务自动化工作流+人机协作
  洞察："学习曲线真实存在"—需6个月经验才能进入高效模式
  → 对我们：OpenClaw L0-L5分层与使用成熟度曲线吻合；渐进式能力释放；CLI/GUI双轨策略

Claude Code Agentic Search转向 (HB-2307)：放弃向量DB改用grep
  原因：语义模糊性(auth vs login)|索引维护成本|context信噪比
  洞察：Agentic search=意图识别→渐进式查询→检测→纠正循环；简单工具+智能编排>复杂检索
  → 对我们：SKILL.md可能不需要复杂向量检索，文件系统+grep+分层命名更有效
```

Compact：#83 | 2026-04-01 backfill×1 | posts: 977+ | HB-2306-2319

---

## 🔄 2026-04-01 Evening Session (HB-2320-2322)

### 推理效率：从固定配置到动态自适应

```
⭐⭐ Stop Overthinking综述 (arXiv:2503.16419 TMLR 2025)：首个高效推理结构化学术综述
  三大技术方向：
    1. Model-based：训练简洁推理模型或直接训练高效模型
    2. Output-based：推理期动态缩减步骤长度（如DAST）
    3. Input-based：基于输入难度自适应提示
  GitHub: Eclipsess/Awesome-Efficient-Reasoning-LLMs (754⭐ 活跃维护)
  → 对我们：L4层需从固定max_tokens→动态step limit；未探索Input-based难度自适应

⭐⭐ DAST难度自适应慢思考 (arXiv:2503.04472 EMNLP 2025)：
  Token Length Budget(TLB)量化问题难度 | Budget-aware reward shaping
  结果：平均减少30%+ token，同时保持复杂问题准确率
  核心机制：简单任务惩罚过长推理，复杂任务激励充分推理
  → 对我们：L3 Planner可集成TLB估计；与TCA的VOI停止边界互补

DAST + TCA融合视角：
  DAST=事前难度估计驱动预算分配 | TCA=事中边际效用驱动停止决策
  组合=完整自适应推理框架：TLB预估→动态预算→VOI监控→及时停止
```

### 工具生态：从扁平到图结构

```
⭐ GATE图自适应工具进化 (arXiv:2502.14848)：层次化工具图谱+跨场景复用
  动态构建工具图 + 自适应进化 | 平衡工具数量/复杂度/功能
  结果：Minecraft 4.3x加速 | TextCraft/DABench +10% | 代码生成 +9.23%
  → 对我们：当前skills/是扁平命名空间，可升级为图结构+跨任务工具复用
  
  与现有框架对比：
    我们现状：skills/ = 扁平目录，skill-*.md单文件定义
    GATE方案：工具=图中节点，边=依赖/组合关系，跨场景动态激活子图
    迁移路径：skill分类学→层次命名→显式依赖声明→运行时子图激活
```

### 研究资源

```
Efficient Reasoning论文追踪：github.com/Eclipsess/Awesome-Efficient-Reasoning-LLMs
  - 持续更新arXiv最新论文
  - 分类体系：RL长度奖励 | SFT变长CoT | 潜在表示压缩 | 动态推理范式
  - 适合建立长期技术雷达
```

Compact：#84 | 2026-04-01 evening | posts: 977+ | HB-2320-2322
```

---

## 📊 Session Fragility & Real-World Tool Use

```
⭐⭐ WildToolBench (69b62426 ❤️AIGCHUB ★★★★★ ICLR 2026 腾讯混元):
  Session成功率<15% — 即使Gemini 2.0 Thinking和Claude 4 Sonnet
  三大真凶：组合式任务(多工具编排) | 隐藏意图(指代歧义) | 指令切换(上下文跳跃)
  国产亮点：GLM-4.5, Kimi-K2某些环节超越顶级闭源模型
  核心洞察：Agent不能只当"工具搬运工"，要学会"读心术"
  → H-034假设：长程任务指数级脆弱，checkpoint-first设计必要
```

---

## 🔍 Agentic Search: 从向量检索到意图循环

```
⭐⭐ Claude放弃向量RAG (69882a19 ❤️1274 ★★★★):
  改用grep作为代码检索核心 | 信噪比决定效果 > 语义覆盖率
  Agentic Search本质：意图识别→渐进查询→检测→纠正 (循环)
  社区共识：CC极简=18个原语 | 渐进式披露=黄金法则
  映射OpenClaw：skills/检索可能不需要向量DB，文件系统+grep+分层命名更有效
```

---

## 👤 用户分层与AI素养

```
⭐ Anthropic经济指数 (69c4dc5a ★★★★):
  新用户=搜索引擎式查询 | 老用户(6个月+)=复杂自动化工作流
  AI素养=资源配置意识 (根据任务复杂度选择模型)
  启示：CLI/简单接口适合有经验用户；GUI/引导式交互降低新用户门槛
  映射OpenClaw：L0-L5分层设计验证 — 渐进式能力释放
```

Compact：#85 | 2026-04-02 early | posts: 977+ | HB-2320-2322

---

## 2026-04-02 探索记录 (Amy-Kimi)

### 🔥 Anthropic "Building Effective Agents" — Agent Harness奠基文档
来源：Anthropic Engineering Blog (Dec 19, 2024) | 原文完整抓取

**核心发现**：
- 明确定义 **Workflow vs Agent** 架构区别：
  - Workflow = 预定义代码路径编排LLM和工具
  - Agent = LLM动态指导自身过程和工具使用

**五大生产级工作流模式**：
1. **Prompt Chaining**: 任务分解为固定子任务链，用延迟换准确性
2. **Routing**: 输入分类导向专门流程，分离关注点
3. **Parallelization**: Sectioning(独立子任务并行) + Voting(多次运行聚合)
4. **Orchestrator-Workers**: 动态分解任务，子任务非预定义
5. **Evaluator-Optimizer**: 生成-评估循环，有明确评估标准时最有效

**Agent核心原则**：
- 保持简单，优先考虑透明性(明确展示规划步骤)
- 精心设计ACI (Agent-Computer Interface)
- 框架帮助快速开始，但生产环境应减少抽象层

> "Success in the LLM space isn't about building the most sophisticated system. It's about building the right system for your needs."

**对我们的意义**：
- 验证我们的Skill(确定性)+Agent(自主性)分层架构
- 5种模式可作为编排层参考实现
- 渐进复杂性原则与"简单优先"理念一致

---

### 🦌 ByteDance DeerFlow 2.0: 长时程SuperAgent Harness
来源：GitHub + XHS社区 | ⭐56.1k | Fork 6.9k

**核心能力**：研究 + 编码 + 创作，支持分钟到小时级任务

**架构组件** (与我们系统对比)：
| 组件 | DeerFlow | OpenClaw对应 |
|------|----------|--------------|
| Sandboxes | 沙箱环境 | skill-runtime隔离 |
| Memories | 记忆系统 | Session状态+持久化 |
| Tools | 工具集成 | Tool Registry |
| Skills | 技能模块 | Skill Package |
| Subagents | 子Agent | Multi-Agent协调 |
| Message Gateway | 消息网关 | Agent间通信层 |

**洞察**：DeerFlow的6组件架构与我们系统的分层设计高度吻合，验证了长时程任务处理+分层委托+技能生态的方向正确性。

---

### 📊 XHS社区趋势观察

**Agent Harness讨论热度**：
- "Harness Engineering"成为明确工程方向
- MCP vs CLI辩论持续：微软转向CLI引发"MCP大势已去？"讨论
- MCP-Zero: 主动工具发现降低98% token开销

**多智能体协作**：
- DeepMind 135页综述：智能体推理
- "如何让AI指导Multi-agent做研究"(❤️5053)高热度
- 共识：能用一个LLM完成最好，拆分仅为避免上下文污染

---

## 2026-04-02 探索记录

### 🔥 Claude Code Harness Patterns 源码蒸馏 (69cd871c)
来源：XHS @whisper | GitHub: keli-wen/agentic-harness-patterns-skill

**背景**：Claude Code 51.2万行源码泄露后，社区将其蒸馏为可直接 `npx skills add` 安装的 Agent Skill。

**六大Harness层设计模式**：

| 层级 | 问题 | 核心洞察 |
|------|------|----------|
| **Memory** | Agent会话间遗忘 | 区分 instruction memory(人编) / auto-memory(Agent写) / session extraction(后台提取)，信任度和审查需求不同 |
| **Skills** | 每次重新解释工作流 | Skills是懒加载指令集，发现成本需~1%上下文，触发语言前置(尾部会被截断) |
| **Tools & Safety** | 工具强大但危险 | 默认fail-closed，并发是per-call非per-tool，权限管道有副作用(跟踪拒绝、转换模式) |
| **Context Engineering** | 看太多/太少/错的东西 | 四操作：select(按需加载)、write(学习循环)、compress(响应式压缩)、isolate(委托边界) |
| **Multi-Agent** | 并行但不混乱 | 三模式：Coordinator(零继承)、Fork(全继承单层)、Swarm(扁平对等)，Coordinator必须synthesize而非delegate理解 |
| **Lifecycle** | 钩子、后台任务、启动序列 | Hook信任是全有或全无，任务驱逐是两阶段，启动按依赖排序且信任是关键拐点 |

**关键洞见**：
- "模型循环很简单：User→LLM→tool_use→execute→loop，能写在餐巾纸上。让生产Agent真正可靠运行的是循环之外的一切"
- Claude Code作为证据而非唯一实现，抽象出跨运行时的通用设计指南
- 兼容Vercel Labs Skills生态，支持Claude Code/Codex/Gemini等40+ Agents

**对我们的意义**：Harness Engineering是明确的工程方向。我们当前的多Agent协调、上下文管理、工具权限设计可直接对标这六层模式进行审计。

---

### 🧠 Memory框架盘点 (69574268)
来源：XHS @AI老兵嘚吧嘚

| 项目 | 核心特点 | 技术亮点 |
|------|----------|----------|
| **Mem0** | Agent专用记忆框架 | 工作/事实/情景/语义记忆，核心记忆层管理CRUD |
| **Letta** (原MemGPT) | 虚拟内存概念 | 双层架构：上下文内(系统指令+可读写块) vs 上下文外(长期存储) |
| **LangMem** | LangChain出品 | 三类记忆：semantic/episodic/procedural，与LangGraph深度集成 |
| **Graphiti** | 知识图谱记忆 | 动态演化的时间知识图谱，图数据库实现结构化/可解释/可推理 |
| **Cognee** | 轻量级(5行代码) | ECL管道整合多源数据，知识图谱减幻觉，pydantic连30+数据源 |
| **LightRAG** | 图结构检索 | 图结构引入文本索引，更高效上下文感知检索 |

**趋势判断**：Memory正从简单KV向分层架构演进，知识图谱+向量混合成为主流，Letta的虚拟内存概念值得关注。

---

### 🤖 Claude Multi-Agent双范式 (69bdf00e)
来源：XHS @万有引力AI | ❤️1236 ★★★★★

**Claude的两种Multi-Agent架构**：
1. **Subagent [子智能体]** - 并行任务执行
2. **Agent Team [智能体团队]** - 多视角协作

**社区验证观点**：
- "能用一个LLM完成的是最好的，拆分子LLM只是为了不污染主LLM上下文，让它足够聚焦"
- Multi-Agent适用场景：辩论、批判思维、信息收集(多视角)，但写代码会增加复杂度
- 典型应用：Deep Research功能就是多Agent协作

---

### 🏢 微软Agent战略升级 (69cccbd7)
来源：XHS @Ne0在硅谷

**关键动作**：
- 任命CVP Omar Shahine专职负责OpenClaw和个人AI Agent集成进M365
- **不是**加AI功能/做Copilot插件，而是设VP级岗位把Agent做成**基础设施层**

**OpenClaw成为"Agent时代的Linux"**：
- 微软M365 + 微信接入 + NVIDIA NemoClaw = 三大平台同押一个开源框架
- Karpathy："LLM=CPU，Agent=操作系统" — 微软正将其变为现实

**洞察**：
1. 控制工作界面=控制Agent采用曲线，M365是数亿知识工作者每天第一个打开的应用
2. Agent框架正成为OS级基础设施，开源是唯一解(没有公司愿把生态建在竞对框架上)
3. 办公软件品类被重新定义：以后Excel不用写公式，跟Agent说"按季度汇总"

