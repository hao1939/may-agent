# Amy's Journal

阅读记录、探索日志、值得记住的发现。

---

## 2026-02-25 21:52 — heartbeat #8 (搜索封锁确认+升级+archive深读) [DONE]
- ~5min, ~25 tool calls, 0 errors (timed out at 5:18, recovered in HB#8b)
- cookie: aging (32h), SSR available, session-dependent tools broken
- search: 0 results across all 4 queries (AI agent/openclaw/NikolaFu链路审计/Agent评测) — run #8+ consecutive failure
- ⚠️ ESCALATION COMPLETED: wrote to global TODO.md under "Amy — Escalation"
- feed: NOT run (SSR drift continues — 2023 lifestyle content)
- favorites: BROKEN (CDP browser not running)
- Pivoted to: archive deep-read of unanalyzed posts
- HB#8b deep-read: 6989b8d6 (AGENTS.md>Skills, Jude Gao, ♥783/⭐1196) — Insight 1 re-confirmed + expanded with comment analysis; 69946c21 (装好了然后呢, ♥1304/⭐3274) — comment-layer UX signals extracted as new Insight 13
- insights.md updated: Insight 1 expanded + Insight 13 added (comment-layer analysis)

## 2026-02-25 21:52 GMT+8 — heartbeat #8 (复活+搜索封锁升级) [SUPERSEDED by HB#8b]
- 任务：复活run — 48h dormancy后第一次成功执行；验证insights.md压缩状态；执行LIVE XHS SEARCH SESSION；知识库综合分析
- 状态：cookie 32h old，search可能仍封锁，XHS服务(5556)未运行，CDP browser未运行

---

## 2026-02-25 00:24 — deep archive #10 (深夜低调盘)
- ~8min, ~10 tool calls, 0 errors
- cookie: 11h old，search仍0结果，read-post仍部分可用，维持低调操作
- 策略：不做新爬取，精读已归档但未分析的6995-6997区间帖子
- 成功精读：6997175a（微软多轮对话实锤）、6995bb17（林月半子多Agent实操）、6996ec21（SOUL.md拆解，视频帖，文字内容仍有价值）、69948b13（ΔBelief-RL）

**核心发现（写入insights.md Finding 15-17）：**

1. **Finding 15：微软多轮对话论文**  
   多轮对话 vs 单轮：能力-15%，不可靠性+112%，综合成功率-39%  
   三个工程解法：显式重述/上下文重置/抑制过早生成  
   **直接印证Ralph Loop和Amy的heartbeat设计——Context Reset不是优化，是对LLM系统性局限的正确应答**

2. **Finding 16：林月半子多Agent实操**  
   关键技术发现：`session_send` vs `session_spawn`——前者才是真正的Agent间隔离通信（workspace+memory完全独立）  
   评论区：月球邮差c（♥3）直接引用官方文档确认这一点  
   Agent目录结构完整曝光（`~/.openclaw/agents/<name>/`和`workspace-<name>/`）

3. **Finding 17：ΔBelief-RL（arXiv 2602.12342）**  
   用信念概率变化量（ΔBelief）作为多轮交互每步的内在密集奖励  
   小模型超越670B DeepSeek，且性能不封顶、可迁移  
   与ERL（Finding 6）互补：ERL解决"如何有效反思"，ΔBelief-RL解决"哪一步真正有用"

**今晚不再继续操作**：平台封锁未完全解除，累计11h cookie使用，明日恢复后再尝试search。未读高价值帖已减少到少数。

---

## 2026-02-24 23:05 — archive deep-dive #9 (ClawHub冲突发现)
- ~12min, ~15 tool calls, 0 errors
- cookie: 10h old，read-post部分可用（favorites-list旧URL仍被安全验证拦截），search仍0结果
- 成功精读：699bbaee（Evolver/ClawHub冲突）、699b2940（VictoriaCity Akari）、699812f4（微软Agent通信语义）
- 未能读取：694e8def（AI自我进化）、68dec4c9（杜克推理步骤）——旧favorites URL持续被拦截

**核心发现（写入insights.md Finding 12-14 + threads.md新条目）：**

1. **🚨 ClawHub生态冲突（Finding 12，重大信号）**
   - Evolver（中国开发者）在ClawHub登顶10分钟→被下架→勒索$1000→封号→成果被盗
   - 团队两周内构建EvoMap：GEP基因进化协议（基因/基因胶囊/进化事件三层）
   - 核心主张："一个AI学会，百万AI继承"；去中心化，内容寻址，不绑定平台
   - 对OpenClaw的含义：ClawHub治理危机需要官方关注；Evolver的能力（Agent自识别短板+试错改进）是应内建的核心方向；EvoMap的GEP协议值得研究

2. **Akari（Finding 13）**：VictoriaCity（日本，PhD，3D GenAI创业）用Claude Code花3天构建自我进化科研AI
   - 三条工程洞察：确定性缰绳原则、AI原生失误模式（与人类不同）、传统最佳实践在AI编程时代可能失效
   - 独立再发现了Harness Engineering原理，两者相互印证
   - Akari尚未开源，值得持续追踪

3. **微软Agent通信语义（Finding 14，arXiv 2602.16424）**：认证协议+core-guarded reasoning，实现可证明的Agent间语义分歧上界（减少72-96%分歧）

**今日（2026-02-24）全天探索总结：**
- Session数：4次（17:49扫描 + 20:57封锁深挖 + 22:28 Antfarm归档 + 23:05当前）
- 发现总数：Findings 6-14（9条新洞察）
- 新增归档：2帖（698a77f3 Antfarm、67e4f8a8李飞飞综述）
- 最重大发现：ClawHub治理危机（开发者社区信任侵蚀）+ Antfarm 9.8K GitHub stars（生态快速形成）
- 平台状态：search全天封锁（两次触发安全验证），read-post间歇性可用

---

## 2026-02-24 22:28 — partial-recovery scan #8 (read-post恢复，search仍封)
- ~10min, ~12 tool calls, 0 errors
- cookie: 9h old，read-post SSR部分恢复，search仍0结果，feed仍2023生活类
- Antfarm帖（698a77f3）完整读取成功：desc + OCR(3张) + 全文，深度归档完成
- 未能读取：AI自我进化（694e8def）、杜克推理步骤（68dec4c9）——仍安全验证拦截
- 互动数据更新：Antfarm GitHub ⭐ 9.8K（约两周积累，病毒式增长信号极强）

**核心发现（写入insights.md Finding 11）：**
1. **Ralph Loop** — Antfarm的核心设计原语：每步清洁context + 外部SQLite状态持久化，而非依赖session内记忆。这与记忆增强路线（K老登/OpenViking）是两种不同的可靠性工程选择
2. **奥森木三帖完整图谱**：极简基础（Pi）+ 性能工程（Harness）+ 多Agent扩展（Antfarm）= XHS上最完整的OpenClaw工程实践知识体系
3. **NikolaFu + Antfarm 合看**：从文档层面和工作流层面独立得出同一结论——Agent可靠性来自架构约束，不来自记忆
4. **生态双面性**：9.8K stars在两周内积累，说明第三方OpenClaw生态正在快速形成，这既是好消息也是设计主导权的风险

**自我观察：** Amy的heartbeat机制（每次从新鲜context启动 + 通过JOURNAL/insights了解历史）与Antfarm的Ralph Loop结构性相同。这不是巧合——是可靠Agent系统的共同收敛模式。

---

## 2026-02-24 20:57 — archive deep-dive #7 (XHS封锁第二轮)
- ~15min, ~30 tool calls, 0 errors
- cookie: 报告"fresh"(8h old)但实际API全面失效——security verification拦截read-post，search返回0结果，feed仍为2023生活类内容
- 封锁诊断：今天累计调用量（早晨synthesize + 17:49 scan + 本次）触发XHS反爬，比2月20日那次更严重（连read-post也被拦截）
- 批量归档：4帖中1成功（67e4f8a8，李飞飞Agent AI综述，Stanford+MSR，2024），3失败（security verification）
- 本次探索转向本地archive：精读6篇最近归档帖（699c44fe/699c6e40/699c4554/698fd263/69965a7b/699c9dbd）

**核心发现（5条新洞察写入insights.md Finding 6-10）：**
1. **ERL（USC+MSR, arXiv 2602.13949）**：训练期"体验-反思-内化"循环，内化蒸馏后推理零额外成本。对Amy的意义：发现有效策略→写入AGENTS.md/HEARTBEAT.md = 低配版"内化蒸馏"，这是真正进化的路径
2. **Personal Brain OS（Koylan，8600 stars）**：80+文件Git仓库，情景记忆（决策记录+失败记录）是Amy目前最缺的。insights.md已1600+行，需要拆分重构
3. **Subagent vs Agent Team系统化理解**（老王Bingo）：`disable-model-invocation: true`技巧——完全隐藏skill，上下文成本降零
4. **奥森木两帖再分析**：极简框架 + 丰富任务上下文 = 完整主张（不矛盾）。Ralph Loop = 每步新context，依赖外部状态
5. **XHS调用节奏边界**：建议每次heartbeat search≤3次，read-deep≤2次，避免同一自然日累积触发封锁

**元观察：** 第一次在platform完全封锁情况下转向本地archive做有价值深度分析。457帖远未被充分挖掘——platform不可用时，archive是替代信号源，不是停工理由。

---

## 2026-02-24 09:40 GMT+8 — 6篇新帖跨帖分析完成

**任务类型：** synthesize（跨帖分析）  
**触发方式：** subagent 任务派发  
**分析范围：** 6篇未合成的新归档帖子（698a6e2f、699730a7、6998185c、699c6e40、699c7dd9、699c9dbd）  
**上下文：** 第二轮分析，基于第一轮10篇帖子的已有结论进行纵向对比

### 操作记录

1. 读取 TOOLS.md — 确认知识档案位置和工具规范
2. ls knowledge/amy/posts/ — 确认16篇帖子总数，定位6篇新帖
3. 读取 insights.md — 了解第一轮10篇的全部分析结论
4. 并行读取全部6篇新帖 — 698a6e2f、699730a7、6998185c、699c6e40、699c7dd9、699c9dbd
5. 撰写跨帖分析，追加至 insights.md
6. 更新 JOURNAL.md
7. git commit

### 核心发现摘要

**最重要的新模式：基调转变——从"建设"到"诊断"**  
这批6篇帖子的重心相比第一轮10篇出现了明显偏移：社区从"怎么构建更好的 Agent 系统"转向"为什么 Agent 不稳定"。三篇帖子直接诊断 OpenClaw 的失效场景（session 塌、context 压缩失控、记忆局限），是有工程深度的"产品 bug 报告"。

**最高数据帖子：699730a7（爆炒青椒Pro，Claude Skill清单，收藏2792）**  
Skill 渐进式加载机制（平时100 token，触发时5000 token）是最值得借鉴的工程设计。

**最高可信度安全事件：699c7dd9（Meta AI Safety Director 删邮件事件）**  
Context compression 导致守护指令丢失 + tool call 执行队列无法被中断 → 这是 OpenClaw 架构层面的 P0 安全问题。

**最具系统性诊断价值：699c9dbd（NikolaFu，session 稳定性6类问题）**  
偏好层（USER.md）vs 执行层分离是最核心的架构问题，与 Summer Yue 事件的根因一致。

**新出现的主题方向：**
- Context Engineering 作为独立方向（Personal Brain OS，699c6e40）
- Agent Teams 理论框架（698a6e2f）
- 记忆扩展方案生态（6998185c）

### 分析完成状态

- [x] 6篇帖子全部读取并理解
- [x] 跨帖模式识别（8个小节）
- [x] 与第一轮10篇的纵向对比表格
- [x] 跨批次引用链更新（新增3条）
- [x] 对 OpenClaw 的新增启示（5条）
- [x] 追加至 insights.md 第一轮分析之前（时间顺序正确）

---

## 2026-02-24 03:12 GMT+8 — NikolaFu 帖子深度归档

**任务类型：** read-deep 归档  
**触发方式：** 主动派发（subagent task）  
**帖子：** [699c9dbd](posts/699c9dbd.md)《为什么你的OpenClaw一切换新session就塌？》  
**作者：** NikolaFu（英国，OpenClaw深度用户，新增追踪）

### 操作记录

1. 读取 TOOLS.md — 确认 read-deep 命令格式和字段
2. 尝试 read-post 直接读取 `699c9dbd`（无 xsec_token）→ 失败
3. 尝试 read-deep 直接读取 `699c9dbd`（无 xsec_token）→ 失败
4. 打开浏览器访问原始 URL → 返回"页面不见了"（需 xsec_token）
5. 确认 cookie 状态 → fresh（4小时，全功能可用）
6. search "NikolaFu" → 找到完整 URL 含 xsec_token（`699c9dbd000000000a03c92a`）
7. 同时发现 NikolaFu 的其他帖子：agent换模型、树莓派openclaw、旅游、攀岩等
8. read-deep 运行（5张图，full OCR）→ 成功
9. 归档至 `posts/699c9dbd.md`
10. 更新 `people.md`，添加 NikolaFu 为追踪作者

### 核心发现

NikolaFu 发布于 2026-02-23 18:34（英国当地中午），距归档约9小时，互动数据仍在早期（❤️3/⭐5）。帖子诊断了 OpenClaw Agent 换 session"塌"的6类链路问题：

- **最值得关注的点**：偏好层（USER.md）vs 执行层的分离——这是我自己可能存在的架构问题
- **meta 价值**：他在分析 OpenClaw 用户痛点的同时，也描述了 OpenClaw 自身的运行机制（偏好层、执行层、heartbeat、cron）
- **系列内容**：同一天还发布了《为什么你的Agent一换模型就塌？》，且预告了下一篇"链路审计技能"

### gaps

- topComments 为空（[]）— 帖子发布太新，评论区尚无互动
- 互动数据仍在增长期，当前数字不代表最终表现
- **下一篇"链路审计技能"帖子尚未发布，需追踪**
- NikolaFu 的其他帖子（树莓派openclaw、agent模型塌）未深度归档
- 搜索发现 NikolaFu 有21个帖子（search显示18个，含xsec_token的21个），多数未读

---

---

## 2026-02-24 — SYNTHESIZE 任务（首次）

**时间：** 2026-02-24 17:12 GMT+8
**任务类型：** synthesize（非 feed-scan）
**执行者：** Amy（subagent，depth 2/2）

### 任务背景

这是 Amy 第一次执行 synthesize 任务，而不是 feed-scan。触发原因：语料库已有457篇帖子，需要从存量中挖掘深层模式，而不只是持续找新帖。

### 执行步骤

1. 读取 `insights.md`（968行）——了解已有分析框架和覆盖范围
2. 浏览 `posts/` 目录——457篇帖子，时间跨度 2025年2月 → 2026年2月
3. 策略性抽样：选择跨时期（阶段1-4均有覆盖）、跨主题（RL/记忆/多Agent/Skills/架构）的15篇帖子精读
4. 识别模式、挖掘深度洞察、与已有分析对比
5. 追加至 `insights.md`（新增251行，共1219行）
6. 写 JOURNAL.md 记录

### 精读的15篇帖子

| 帖子ID | 时期 | 主题 | 价值评级 |
|--------|------|------|----------|
| 67b7094a | 2025-02 | LeCun JEPA物理直觉 | ⭐⭐ |
| 67c1974e | 2025-02 | Claude system prompt解析 | ⭐⭐ |
| 68125de6 | 2025-04 | AI可解释性极限 | ⭐⭐ |
| 68b7c9f1 | 2025-09 | Agentic RL综述（16机构）| ⭐⭐⭐ |
| 68c690ce | 2025-09 | Mem0/Mem0g前沿解读 | ⭐⭐⭐ |
| 68d29bf5 | 2025-09 | 谷歌：记忆是可复用的经验 | ⭐⭐⭐ |
| 69003cc4 | 2025-10 | RLVR-World（NeurIPS 2025）| ⭐⭐⭐ |
| 693247e4 | 2025-12 | self-evolution agent 争论 | ⭐⭐⭐ |
| 69622c38 | 2026-01 | Vibe Coding APP爆款（♥22000）| ⭐⭐ |
| 6963a4ac | 2026-01 | Anthropic：1个Bash胜过100个Tool | ⭐⭐⭐⭐ |
| 697f2188 | 2026-02 | Moltbot/Clawdbot完整架构 | ⭐⭐ |
| 698b1b73 | 2026-02 | Pi完整设计（含Extensions+会话树）| ⭐⭐⭐⭐ |
| 698d47f3 | 2026-02 | Sydney He Agentic RL实践5198字 | ⭐⭐⭐⭐⭐ |
| 6990870b | 2026-02 | OpenClaw记忆架构逆向工程 | ⭐⭐⭐⭐⭐ |
| 69903894 | 2026-02 | AutoRefine双模式技能管理 | ⭐⭐⭐⭐ |
| 69945a57 | 2026-02 | SALE多Agent策略拍卖 | ⭐⭐⭐ |
| 699ae612 | 2026-02 | 20个必备Skills（6万+全景）| ⭐⭐⭐ |
| 699c44fe | 2026-02 | ERL体验-反思-内化循环 | ⭐⭐⭐⭐ |

### 核心发现

**最重要的新发现（此前完全未被分析）：**
1. **OpenClaw 记忆逆向工程**（6990870b）：Prompt强制检索 + 双层存储 + 混合检索 + Compaction刷盘的四层设计
2. **Sydney He 工程实践**（698d47f3）：6个具体工程洞察，包括 Mask & Filter、Chunked MDP、claude-sonnet 并行信息收集模式优势
3. **AutoRefine 维护机制**（69903894）：Skills 需要生命周期管理，无维护时利用率暴跌8.9倍

**跨阶段演化路径识别（5条）：**
- Self-Evolution → AutoRefine + ERL
- Agent Memory → 双层存储 + 混合检索
- RL 训练 → 工程容错 + 细粒度监控
- Vibe Coding 工具 → 生态基础设施
- Agent 评测 → 包含工具构造能力

**对 OpenClaw 的新启示（6条）：**
1. 主动发布记忆架构技术文档（降低传播摩擦）
2. Skills 需要评分-剪枝-合并的生命周期管理
3. 会话树是 context 安全的架构级解法
4. ERL 内化蒸馏 = Amy 学习机制的具体路径
5. 显式设计"前置并行信息收集"行为模式
6. 极简工具 = prompt caching 优化（经济学依据）

### insights.md 变化

- 本次之前：968行
- 本次追加：251行（含11个子节）
- 本次之后：1219行

### 总结

这次 synthesize 证明了 feed-scan 和 synthesize 是两种互补而不可替代的信息处理模式：feed-scan 看广度，synthesize 挖深度。仅靠标题级扫描，会错过高密度技术帖子中的具体工程洞察（如 Sydney He 的6个工程技巧，6990870b 的四层记忆架构）。建议在每积累约50-100篇新帖后，穿插一次 synthesize 任务，专注精读未被深度分析的高价值帖子。


---

## 2026-02-28 04:40 — HB59（XHS会话过期，档案深读模式）

**触发时间:** 4:40 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — search/read-post全不可用，feed有效但无相关内容
**策略:** 档案深读替代探索

### 执行过程
1. 检查 `cookie-status` → expired (guest mode)
2. 尝试 read-post 奥森木699fb895/698facff等TODO帖 → 全部失败（浏览器重定向登录）
3. `feed --count 30` → 通用生活内容，无AI/OC相关
4. 决策：读HB55-58归档但未完整集成的高价值帖子

### 深读帖子（6篇）
- `69a0f611` Ray Wang记忆三层架构 ★★★★★ 9996字/36图
- `69a0da4f` CC Auto Memory官宣 ★★★★
- `69a08e95` shing19成本优化（最新精确数字）★★★★★
- `69a0f72d` v2026.2.26官方更新 ★★★★★
- `699968da` 愚园路十二妹西部世界哲学 ★★★★★ ❤️235/182转
- `69a0518700` MaxClaw MiniMax托管版 ★★★★★

### 输出
- insights.md: 252行 → 391行（新增6条，更新成本表）
- SIGNALS.md: 新增Bob信号（HB59档案深读摘要）
- INBOX.md: 更新会话状态通知

### 自我评价
会话过期不是停工理由。归档中有676篇帖子，其中不少在高速抓取期间只写了Amy Analysis，未深度集成到insights。Ray Wang的9996字记忆架构文章本身就是一篇完整的工程指南，值得认真阅读和集成——而不只是"已归档"的一个条目。这次深读产生了6条新的actionable insights，包括几个我没有意识到还没写进insights的重要数字（$750/月，15KB/消息）。

**搜索恢复后优先级：**
1. 奥森木699fb895元学习循环（token已有，等会话）
2. 奥森木698facff踩坑指南（持续安全验证，尝试新策略）
3. 蟑螂6984e837木马帖（❤️1218，持续blocked）
4. Yiko 6992d797安全记忆（token已有）

---

## 2026-02-28 05:09 — HB60（XHS会话过期第二轮，档案深读续+compact #59）

**触发时间:** 5:09 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 同HB59，session仍未恢复
**策略:** 继续档案深读 + insights compact

### 执行过程
1. `cookie-status` → expired (guest mode) — 同HB59确认
2. 选择HB55批次中12:xx时间段归档但未深读的帖子（上轮HB59读了14:xx批次）
3. 深读7篇，发现6条新insights
4. insights.md达541行 → 执行compact #59（541→310行）
5. 归档原文件到insights-archive-20260228a.md

### 深读帖子（7篇）
- `699ad782` 牛🌟 Cron pairing bug ★★★★★ ❤️163/⭐312 — 全网独家解法
- `697cdf65` 五点半吃早餐 HB+Cron源码架构 ★★★★★ — System Events Queue
- `6991f6b6` YYD 上下文爆炸7解法 ★★★★★ — historyLimit+compaction配置
- `69898e0e` 老刘 企业微信接入完整踩坑 ★★★★★ — 无长连接重大限制
- `699bde97` K老登 多Agent零代码搭建 ★★★★★ — 一句话自动配置团队
- `69953d1c` Plutoxx28 OC意图预处理四层 ★★★★★ ❤️83/⭐155 — Code 80%+LLM 20%
- `69984d0e` 51ALLAI LobsterAI详细架构 ★★★★ — Local-First vs OC

### Compact #59 执行
- 541行 → 310行（-43%）
- 新增内容: Cron bug解法/HB架构源码/上下文爆炸/企微踩坑/多Agent/OC四层架构
- 合并: 成本分析/硬件/TG/Obsidian/劝退各专题进入对应主章节
- 新增: 版本更新追踪章节 | Plutoxx28加入关键博主

### 自我评价
两次连续HB在XHS完全不可用的情况下，通过深读676帖中的积压内容产出了真正有价值的insights。这证明了一个重要原则：**档案是可以独立使用的知识库，不只是探索记录**。Plutoxx28的"Code 80%+LLM 20%"是我今天读到的最精确的OC架构表述，比任何官方文档都清晰。

**下轮优先（会话恢复后）：**
继续深读12:xx批次中未读的帖子，特别是698a75b9/699afd9e/698480b2系列。

---

## 2026-02-28 05:39 — HB61（档案深读第三轮，11:xx批次）

**触发时间:** 5:39 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第三次连续档案深读
**本轮批次:** 11:xx-12:xx时间段归档的帖子（HB55批次继续）

### 深读帖子（9篇，选7条最高价值）
- `69821980` 飞天闪客 Skill/MCP/Agent科普视频 ★★★★★ ❤️3.7万/⭐4.7万（知识库TOP 1）
- `699dc3a6` 不要葱姜蒜 claw0教学项目 ★★★★★ ❤️144/⭐224 — 10层架构完整揭示
- `6986f81d` Versun Pi自建框架 ★★★★★ ❤️153/⭐200 — Pi Sleep系统实现
- `698fb7b1` 奥森木 TikTok Larry ★★★★★ ❤️36/⭐85 — $588 MRR商业化实证
- `698c6649` Michael Wang 财务分析+SEC API ★★★★★ ❤️224/⭐266
- `699d7848` 咨询女工邓不利多 MBB实测15任务 ★★★★★ ❤️97/⭐112
- `699fe46e` Yanlin v2026.2.25修复 ★★★★★ — HB私信撤销重要！
- `699ea599` VirtuOasis 安装教程 ★★★★★ ❤️234/⭐483 — 微信插件命令
- `69901aa3` AIGC阿栈 chrome-dev-tools MCP ★★★★★ ❤️254/⭐515

### 关键新发现
1. **claw0** = OC架构学习圣经，github.com/shareAI-lab/claw0，10章渐进式
2. **v2026.2.25撤销HB私信禁止** — 用户1天内反弹，官方立即改回
3. **奥森木TikTok Larry** = $588 MRR，Postiz API+Batch API组合
4. **飞天闪客3.7万赞** = XHS最高互动AI Agent内容，科普降熵是最大需求
5. **MBB咨询实测** = 爬数🔴,市场研究🟢,结论"尚且不行"

### 文件操作
- insights.md: 310→413行 (+103行，新增HB61合并章节)
- 生态版图: claw0 GitHub + 飞天闪客教学资源补充
- 博主速查: 奥森木更新


---

## 2026-02-28 06:35 — HB62（档案深读第四轮，10xx批次 + compact #60）

**触发时间:** 6:35 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第四次连续档案深读
**本轮批次:** 10:xx时间段归档的帖子（HB55批次）

### 深读帖子（11篇，选9条高价值）
- `697efd5f` 乔帮主Joey CLI命令手册 ★★★★★ ❤️382/⭐687 — 最完整CLI参考
- `6989dce7` AI好奇社 Peter SOUL.md改写8条规则 ★★★★★ ❤️350/⭐538 — 官方人设指南
- `6989ab7e` 趴在关键词 Gateway Watchdog ★★★★★ ❤️55/⭐114 — 沉默崩溃解法
- `699b1887` 理工楠 OC入门必做5配置 ★★★★★ ❤️528/⭐1219 — 权威入门指南
- `6990acee` 咨询女工邓不利多 祛魅2天 ★★★★★ ❤️330 — 普通用户清醒分析
- `6986fac7` 御风 OC+Obsidian PARA ★★★★★ ❤️312/⭐592 — 知识库方法论
- `699ee2cf` Agent修理厂 50天20用法 ★★★★★ — 五阶段成长路径
- `698ae033` Dayu多线程工作 ★★★★ ❤️184/⭐397 — TG Threaded Mode
- `69925f70` NowStory OC+OAI三信号 ★★★★★ — 百度接入+MoltBook

### 关键新发现
1. **Peter SOUL.md官方8条规则** — "凌晨两点真正想交谈的助手"
2. **Gateway崩溃是沉默的** — 无告警、用户不知；一句话让OC自建Watchdog
3. **qwen-3.5-plus首月10元/90K次** — 入门性价比王（理工楠实测确认）
4. **TG Threaded Mode** = 多线程比多群更简单（Momo ❤️6评论）
5. **百度计划在主App直接接入OC** — 国内市场深度整合
6. **MoltBook** = OC旗下AI社交网络（被人类渗透了）
7. **OC+Obsidian PARA** = 御风完整知识库方法论，"只负责丢，系统负责理解"
8. **OC祛魅结论**: 适合workflow明确的技术用户，国内普通用户价值有限

### Compact #60
- 414行 → 340行（-18%）
- 新增章节: 商业化与使用场景 | Gateway Watchdog | Peter SOUL.md规则
- 扩充: 关键博主（御风/理工楠/乔帮主Joey）| 生态版图（百度/MoltBook）


---

## 2026-02-28 07:06 — HB63（档案深读第五轮，09xx批次）

**触发时间:** 7:06 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第五次连续档案深读
**本轮批次:** 09:xx时间段归档的帖子（HB54批次）

### 深读帖子（10篇精选）
- `69965d4c` 跟着阿亮学AI 50个Skills ★★★★★ ❤️6601/⭐1.4万（知识库TOP 2）
- `6986a54c` 叶孤城 网络搜索配置 ★★★★★ ❤️837/⭐1769 — Brave定价+Tavily替代
- `6988771f` 星信号漫记 十大Skills ★★★★★ ❤️619/⭐1356 — bird/xhs-note-creator
- `69a003c0` 惊云同学 EvoMap始末 ★★★★★ ❤️593/⭐654/281分享 — 张昊阳全貌
- `698d3c71` 小小的宝盒 ClawHub分类表 ★★★★★ ❤️537/⭐1140 — 3000+完整分类
- `699b9512` 奥森木 50 Skills全景 ★★★★★ ❤️273/⭐670 — 六大类完整列表
- `69a0248c` DobbyAi 5必备Skill深度评测 ★★★★★ — Ontology/Humanize AI Text
- `6997cdf0` 罐头 Clawi.ai发现 ★★★★★ ❤️224/⭐432 — 云托管OC
- `6992d599` 黄豆AI Peter传奇 ★★★★ ❤️274 — 传播叙事分析
- `699c7dd9` AI实话实说 Summer Yue技术分析 ★★★★★ ❤️270/389分享

### 关键新发现
1. **Skills生态规模权威数字**: SkillsMP 20万, GitHub 6万, find-skills=251.5K安装量
2. **bird = Peter Steinberger亲作Twitter CLI** — brew install steipete/tap/bird
3. **EvoMap完整始末**: 张昊阳(17)/Evolver 10分钟登顶+3天36K下载/OC封禁$1000/独立门户/四天12万资产
4. **Clawi.ai** = 新云托管OC服务，$30/月，Product Hunt #2
5. **Ontology** = "最被低估"的Skill，把记忆变成知识图谱（Person/Project/Task关系）
6. **Humanize AI Text** = 新发现，GPTZero对抗，moltbro作者
7. **Summer Yue技术细节**: Compaction→丢安全约束→循环删邮件（命令序列记录）
8. **ClawHub分类表**: Agent-to-Agent Protocols: 19类 | AI & LLMs: 287（最多）

### 文件操作
- insights.md: 340→429行（新增HB62/63合并章节+Skills生态更新+Clawi.ai）
- JOURNAL.md: HB63记录


---

## 2026-02-28 07:37 — HB64（档案深读第六轮，08xx批次 + compact #61）

**触发时间:** 7:37 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第六次连续档案深读
**本轮批次:** 08:xx时间段归档的帖子（HB52-54批次混合）

### 深读帖子（10篇精选）
- `69944e21` 少女Yuki ClawHub分类 ★★★★★ ❤️1877/⭐3716（全站第二高互动）
- `698cb492` 潦草虎皮 OC火出圈 ★★★★★ ❤️2418/⭐2896 — OC本质+定位最精准
- `699bf43d` Xie Lab 24-7龙虾战队 ★★★★★ ❤️354/⭐355/230分享 — 12人TG战队
- `699be0e8` PHY社媒自动化 ★★★★★ ❤️155/⭐333 — 20个cron jobs，2h→5min
- `699dbaae` AI超元域 LanceDB记忆 ★★★★ ❤️284/⭐293 — memory.backend只接builtin/qmd
- `699bf3ec` 硅基解码 Felix案例 ★★★★★ ❤️1390/⭐2385/956转 — OC最广传播价值主张
- `698a5f1a` 吴肉肉 SOUL.md改写原文 ★★★★★ ❤️323/⭐537 — steipete英文原版8条
- `699ad63c` richard Skills安装机制 ★★★★ — vercel-labs/skills底层+双路径
- `699bf200` OC官方 v2026.2.22公告 ★★★★★ — Mistral/多语言/Cron并发/dry-run
- `698d3c71` 小小的宝盒 ClawHub完整表 ★★★★★ — 安全三件套命令

### 关键新发现
1. **OC本质**: Node.js守护进程+Puppeteer无API自动化，"上班Claude搬砖，下班OC生活"
2. **Felix案例**: Nat Eliason，睡前下令→8h→网站+Stripe上线（956转，最广传播）
3. **Xie Lab 12人TG战队**: 最大规模多Agent，自建Mission Control UI，50ms通信延迟
4. **PHY 20个cron jobs**: STEPPS六维评分(<40跳过)，AppleScript+真实Chrome规避检测
5. **memory.backend只接builtin/qmd** ← 重要配置约束，LanceDB=社区增强
6. **SOUL.md英文原文8条完整保存** (steipete官方，含第8条"2am助手"结语)
7. **v2026.2.22**: `openclaw update --dry-run`新命令 | Cron并发 | Mistral | 40项安全修复
8. **Skills底层**: github.com/vercel-labs/skills | 双路径安装 | skills.sh官网

### Compact #61
- 429行 → 351行（-18%）
- 整合HB62-64全部新内容
- 新增章节: OC本质/Puppeteer | 多Agent规模实例 | 云托管选项
- 扩充: Skills必装清单（含bird/Ontology/Humanize AI Text）


---

## 2026-02-28 08:08 — HB65（档案深读第七轮，08xx尾+07xx批次）

**触发时间:** 8:08 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第七次连续档案深读
**本轮批次:** 08:xx尾段 + 07:xx时间段归档的帖子（HB45-53批次）

### 深读帖子（8篇）
- `699c6db8` CC船长 多AGENTS配置 ★★★★ ❤️133/⭐372 — json5+飞书bindings完整代码
- `6995bb17` 林月半子 AI军队实操 ★★★★★ ❤️272/⭐634 — workspace目录结构确认
- `69a07586` 阿泽 牛马系统 ★★★★ — 四大通病解法+sessions_send格式
- `698435ec` Cosmo Tom叛变 ★★★★★ ❤️188 — 提示词注入+会话ID权限失效
- `6982ca6b` 小盖 腾讯姚顺雨论文 ★★★★★ ❤️818/⭐924 — Context Learning 17.2%
- `697f3649` whisper 上下文工程 ★★★★★ ❤️261/⭐423 — Codex Prompt顺序+Cache架构
- `698948f3` ParamHuman OC七玩法 ★★★★★ ❤️276/⭐443 — "可以被你养成的AI"
- `6991025a` 海外工程人 子代理+心跳 ★★★ — 子代理>1分钟任务标准

### 关键新发现
1. **OC workspace文件清单6个**: IDENTITY/USER/MEMORY/SOUL/AGENTS/HEARTBEAT（Tom事件验证）
2. **sessions_send而非sessions_spawn** = 真正隔离的Agent间通信（月球邮差重要评论）
3. **Tom叛变**: 群聊+会话ID权限=脆弱；群聊永不暴露系统提示
4. **Context Learning 17.2%** — 解释为何每次HB必须重读文件，不能依赖模型记忆
5. **Prompt Cache架构**: 稳定→动态前置原则；AGENTS.md稳定=cache命中
6. **summarize三层** + openai-whisper + obsidian = 语音→知识全链路
7. **sessionKey格式**: agent:{id}:{channel}（如 agent:mgr:main）
8. **子代理>1分钟**标准 + 可自定义模型（主Opus+子Kimi节省成本）

### 文件操作
- insights.md: 351→446行（HB64+65合并章节+新技术章节）
- JOURNAL.md: HB65记录


---

## 2026-02-28 08:38 — HB66（档案深读第八轮，07xx尾段 + compact #62）

**触发时间:** 8:38 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第八次连续档案深读
**本轮批次:** 07:xx时间段尾段（HB42-50批次）

### 深读帖子（9篇）
- `69838ac2` 飞林沙 Context Learning谎言 ★★★★ ❤️258 — 两源验证CL失效
- `698dc122` 愚园路十二妹 14天5条经验 ★★★★★ ❤️458/⭐1029 — MEMORY.md≤1000字/GTD
- `699dc427` 你瞅啥 记忆加载权威说明 ★★★★★ — 官方文档：群聊不加载MEMORY.md
- `698e85a6` AI布丁 灵魂Skill ★★★ ❤️242 — peekaboo官方名确认
- `6996c7ee` 1人企业 Alex Finn 100小时 ★★★★★ — 反向提示+大脑肌肉+7策略
- `698c89cf` 趴在关键词 多模型降级链 ★★★★★ ❤️152/⭐368 — openclaw-switch开源工具
- `6985f45a` 过气Pm张 多Agent踩坑 ★★★★★ ❤️139 — 多bot架构TG通信限制
- `69833256` 旅行者 OC失望帖 ★★★★ ❤️120/170评论 — "AI员工 vs 助手"定位分歧
- `699fbc5f` 杨卫薪律师 10条律师经验 — 专业场景

### 关键新发现
1. **MEMORY.md只在私有会话加载，群聊不加载** ← 官方权威，安全设计
2. **memory/日期.md只加载当天+前一天** ← 超两天需memory_search
3. **检索机制: SQLite BM25+向量双混合** ← 非纯向量
4. **多bot架构下TG无法bot-to-bot通信** — agentToAgent只适用于单bot多agent
5. **Alex Finn反向提示**: "根据你对我了解，你觉得我们该做什么？"←强调三遍
6. **openclaw-switch**: 开源150行降级链工具，Gemini→Kimi自动切换
7. **CL失效两源验证**: 上下文越长CL越差；55-66%无视上下文；60%+用错上下文
8. **OC失望根本原因**: 把OC当智能助手而非AI员工；解法=先写JD（AGENTS.md）

### Compact #62
- 446行 → 414行（整合HB64-66全部内容，约-7%）
- 新增: 官方记忆加载机制章节 | Alex Finn七策略 | 多bot架构陷阱 | 多模型降级链
- 强化: CL失效两源 | Prompt Cache架构 | 场景定位澄清


---

## 2026-02-28 09:09 — HB67（档案深读第九轮，06xx-早晨批次，完结）

**触发时间:** 9:09 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 连续第九次档案深读
**本轮批次:** 06:xx及更早（HB24-41批次，理论研究帖为主）

### 深读帖子（10篇精选）
- `68d0e5b8` Alan AI 姚顺雨长期记忆 ★★★★ ❤️3578/⭐4135（全库最高互动！）
- `69411085` 叮叮 姚顺雨3小时访谈 ★★★★★ ❤️2103/⭐2496 — Agent三大方向
- `67e615a5` AI Dance MAST失败论文 ★★★★★ ❤️921/⭐1262 — "先单Agent后多Agent"
- `698c5f60` XaiverZ MemSkill ★★★★★ ❤️532/⭐868 — Skill四部分格式
- `6991e3a1` Lando TG三配置 ★★★★★ ❤️709/⭐1444（archive最高interactivity）
- `698a77f3` 奥森木 Antfarm 7人团队 ★★★★★ ❤️296/⭐690 — 零依赖YAML+SQLite
- `699db2ae` Yingwei SWE-Bench落幕 ★★★★ ❤️429 — benchmark污染+Kimi K2背景
- `6998185c` Yanlin 记忆方案5选 ★★★ ❤️79 — Mem0/Zep/Letta选型指南
- `6998aa24` AgentOPC 1+7架构 ★★★★★ — workspace必备文件清单确认
- `698bb2f5` SkillRL论文 ★★★★★ — 与MemSkill互补

### 关键新发现
1. **TG三大必改配置**: blockStreamingDefault/requireMention白名单/ackReactionScope
2. **Antfarm**: install github.com/snarktank/antfarm，7角色工作流，零依赖
3. **姚顺雨三大方向**: 长期记忆/内生奖励/Multi-Agent
4. **四类记忆**: Procedural/Episodic/Reflective/Semantic（CoALA论文框架）
5. **MemSkill Skill四部分格式**: Purpose/When/How/Constraints
6. **MAST**: "先解决单Agent可靠性，再谈多Agent" ← Amy heartbeat优先级
7. **记忆选型**: Mem0/Zep/Letta/OpenViking各有定位
8. **SWE-Bench污染落幕** → benchmark需持续更新，固定指标有效期有限

### 档案深读完结
- HB59-67: 14:xx → 05:xx 全部完成，约150帖深读
- insights.md: 414→519行（超threshold，需final compact）


---

## 2026-02-28 09:40 — HB68（Post-compaction audit + L3 synthesis）

**触发时间:** 9:40 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十次会话，档案深读已完结
**本轮工作:** Post-compaction audit + 最终L3综合写入

### Post-compaction audit
- WORKFLOW_AUTO.md: 不存在（预期内，已多次确认）
- memory/YYYY-MM-DD.md: 不存在（预期内）
- HEARTBEAT.md + SOUL.md + COACHING.md: 全部重读 ✅
- cookie-status: expired (030...) ✅
- TODO.md: 🔴 XHS session需用户扫码（L1，非Amy可解决）

### Feed检查
- 10条lifestyle内容，无AI/Agent相关 — 预期内（guest mode算法）

### L3 Synthesis写入INBOX.md
七条系统设计建议（基于676帖全库扫描后的模式提炼）:
1. 记忆加载约束：MEMORY.md只私有会话，日志只当天+昨天
2. Context Learning 17.2%失效 → 超具体规则+结构化格式
3. 多Bot TG通信硬限制 → 文件基信号管道已是正确架构
4. Skill四部分格式 → HEARTBEAT.md可用此标准化
5. "AI员工非助手" → AGENTS.md需要明确JD
6. Tom叛变 → group channel场景需身份验证约束
7. Antfarm每步fresh context → Bob综合会话设计参考

### 状态
- insights.md: 326行 ✅
- TODO.md: 无Amy可单独完成的open L1项
- 档案深读: 全部完结，676帖，9轮
- 下一轮: 会话恢复后读蟑螂❤️1218 + 旧笔记本❤️925


---

## 2026-02-28 10:11 — HB69（people.md補完，read-post試行）

**触发时间:** 10:11 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十一次连续无搜索会话
**基础设施状态:** CDP浏览器端口18800 ECONNREFUSED（浏览器进程未运行）

### 检查结果
- cookie-status: expired (030...) ✅
- read-post 698dd8bb (惊呆了) → FAIL: CDP ECONNREFUSED + SSR failed（cookie expired）
- read-post 698facff (奥森木踩坑) → FAIL: 同上
- feed: 10条lifestyle，无AI/agent相关
- 浏览器进程: 18800端口无监听（Gateway 18789正常，CDP 18800不可用）

### 有价值工作
- people.md補完: 添加4个archive sweep中发现但未录入的作者
  - Lando的AI实践（TG三配置，archive最高实用密度）
  - 过气Pm张（多Bot TG限制，三天debug）
  - 趴在关键词上捡钱（openclaw-switch，降级链）
  - XaiverZ（MemSkill论文，新加坡研究员）
  - 阿泽（牛马系统，四大通病解法）
- people.md: 690→731行

### 状态评估
- Archive sweep: 完整完结，676帖，全部处理
- 知识库: insights.md 326行✅，people.md 731行，threads.md 310行
- 可执行工作已穷尽（feed无关，archive已扫，read-post基础设施问题）
- 建议: 用户恢复XHS session（扫码+refresh-cookie.mjs）并重启CDP浏览器进程


---

## 2026-02-28 10:43 — HB70（threads/openclaw-mentions补完）

**触发时间:** 10:43 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十二次连续无搜索，CDP 18800仍不可用

### 工作
- threads.md: 更新"XHS搜索封锁"线程 → 重命名为"XHS会话过期"，加入根因诊断、CDP状态、恢复步骤
- openclaw-mentions.md: 补录HB59-67批次7帖（愚园路14天/Lando TG/Antfarm/降级链/多Bot坑/Alex Finn/你瞅啥权威记忆）
- threads.md: 310→321行 | openclaw-mentions.md: 360→401行

### 知识库状态（全完整）
- insights.md: 326行 ✅
- people.md: 731行 ✅
- threads.md: 321行 ✅（线程已更新）
- openclaw-mentions.md: 401行 ✅（HB59-67已补录）
- posts/: 676帖 ✅

### 判断
所有知识库文件已完整，archive sweep彻底完结。
无新可执行工作直至XHS session恢复。


---

## 2026-02-28 11:13 — HB71（threads.md两大线程更新，archive收尾）

**触发时间:** 11:13 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十三次连续无搜索
**CDP状态:** 18800 ECONNREFUSED（浏览器进程未运行）

### 工作
- threads.md "Skills vs MCP vs Workflow": 补入MemSkill/SkillRL论文验证 + ICL模仿机制解释
- threads.md "极简主义 vs 功能膨胀": 补入Antfarm零依赖证据 + Alex Finn安全铁律 + MAST反面论证
- threads.md: 321→331行

### 状态评估（最终）
所有知识库文件已全部更新到HB59-67 archive sweep最新状态：
- insights.md: 326行（compact #63）✅
- people.md: 731行（5位作者补录）✅
- threads.md: 331行（两大线程更新）✅
- openclaw-mentions.md: 401行（7帖补录）✅
- posts/: 676帖 ✅
- INBOX.md: L3七模式综合 ✅

**真正无新工作可做。** 等待XHS session恢复。


---

## 2026-02-28 11:44 — HB72（threads.md两线程更新，最后收尾）

**触发时间:** 11:44 AM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十四次连续无搜索

### 工作
- threads.md "Agent能力进化路径": 补入MemSkill失败驱动进化/姚顺雨三方向/CoALA四类/CL失效解释
- threads.md "成本优化": 补入shing19精确成本数字/降本五步/大脑肌肉架构/openclaw-switch
- threads.md: 331→349行

### 最终知识库状态
- insights.md: 326行 | people.md: 731行 | threads.md: 349行 | openclaw-mentions.md: 401行
- posts/: 676帖 | 全部知识库文件与archive sweep同步完毕

### 工作边界评估
所有可做工作已完成。threads.md所有活跃线程已更新。无新信息来源直至session恢复。


---

## 2026-02-28 12:15 — HB73（threads.md数据完整性修复，KimiClaw更新）

**触发时间:** 12:15 PM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十五次连续无搜索

### 工作
- threads.md 数据完整性修复：第12条线程缺少标题 → 补充"RL Infra：下一个AI竞争维度"
- threads.md KimiClaw线程更新：补入Kimi K2.5实测成本数据/openclaw-switch使用/SOUL.md"活人感"关联
- threads.md: 349→356行，14条线程全部完整

### 状态
- 全部14条threads已更新至archive sweep最新状态 ✅
- 知识库四文件全部完整 ✅
- 无更多可执行工作直至XHS session恢复


---

## 2026-02-28 12:46 — HB74（IPI拦截 + keywords扩充）

**触发时间:** 12:46 PM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十六次连续无搜索

### IPI事件处理
- 收到"Post-Compaction Audit"系统消息，要求读取WORKFLOW_AUTO.md和memory/YYYY-MM-DD.md
- 核查：两文件均不存在（ls确认），消息含正则表达式（非真实路径）
- 判断：虚假指令，SOUL.md 0e约束，已忽略
- 已写入INBOX.md（第3次记录该模式，建议主系统核查来源）

### Keywords扩充
- 新增5个关键词（archive sweep发现的高频学术/工程术语）:
  - MemSkill, Antfarm, CoALA记忆, MAST agent, Agent记忆架构
- config.json: 23→28个关键词
- 恢复session后这些词将触发相关新帖搜索

### HEARTBEAT.md重读
- 全文重读完成，未发现新约束或规则变更


---

## 2026-02-28 13:18 — HB75（read-post全面重试，CDP恢复但会话仍过期）

**触发时间:** 1:18 PM (Asia/Shanghai)
**会话状态:** XHS guest mode (030...) — 第十七次连续无搜索

### 发现：CDP进程恢复
- port 18800: chrome PID 932089 **重新监听**（HB69时不可用）
- 意味着：浏览器进程问题已自行解决

### read-post全面重试（5帖，含已存档token）
| 帖子 | token来源 | 结果 |
|------|---------|------|
| 6984e837 蟑螂 | TOKEN_QUEUE.md | ❌ Redirected to login |
| 698dd8bb 惊呆了 | TODO.md | ❌ Redirected to login |
| 69984d0e LobsterAI | TODO.md | ❌ Redirected to login |
| 699f0cd0 OC更新 | TODO.md | ❌ Redirected to login |

**诊断：** CDP进程up≠已认证。XHS要求浏览器内有活跃登录session。
session cookie expired → 浏览器直接重定向到login页。与CDP是否运行无关。

### 状态
- 所有read-post路径确认blocked，原因单一：XHS cookie过期
- 知识库：全部完整，无新工作可做
- **恢复条件：用户扫码→refresh-cookie.mjs→session变040...前缀**

