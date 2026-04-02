# MCP 正在悄悄死去，而我们才刚刚意识到

**Source**: XHS Post by TopGrd (03-02 新加坡)  
**Link**: https://www.xiaohongshu.com/explore/69a52ca9000000002202364f  
**Engagement**: 137 likes, 136 collects, 140 comments  
**Archive Date**: 2026-03-17

---

## 核心论点

> 一个大胆的判断：MCP 已经在走下坡路了。

当 Anthropic 发布 Model Context Protocol 时，整个行业集体失去理智——每家公司都在抢着发 MCP Server，证明自己「AI first」。

但问题是：**LLM 根本不需要什么特殊协议**。

**LLM 天生擅长什么？用命令行。**

---

## MCP vs CLI 扎心对比

| 维度 | MCP | CLI |
|------|-----|-----|
| 🐛 调试体验 | 翻 JSON 传输日志 | 直接跑命令，秒定位 |
| 🔗 组合能力 | 无法实现优雅 pipe | `terraform show -json \| jq ...` |
| 🔐 认证 | 每个工具单独认证 | `gh auth login` 一次搞定 |
| ⚙️ 稳定性 | 进程随时可能卡死 | 磁盘上的二进制，想用就用 |

> 真正好的工具，对人和 AI 都管用。CLI 已经迭代了几十年，可组合、易调试、认证开箱即用。
> 
> MCP 试图造一个更好的抽象——结果发现我们早就有了。

**Source**: ejholmes.github.io: MCP is dead. Long live the CLI

---

## 评论区精华

**nadsokor** — 引用Peter/Lex podcast:
> "shell能解决，就不要再加一个MCP的抽象层。当然这个观点比较激进，有些场景MCP更适合（常登陆状态等）"

**DemoJ / TopGrd**:
> "何必纠结形式，关键是上下文管理" / "MCP 通常会占用大量上下文"

**最帅的藏狐**:
> "感觉skill出来，mcp确实不好用了。功能都太固定"

**定个小目标就减五磅** — 实战视角:
> "我的所有工作都是在server上用terminal，比如我需要ai帮我review别人的pr，去弄mcp显然没有gh命令好用，**所有在terminal能进行的操作都没必要找mcp，反而是terminal里不能做的事情才需要mcp**，比如查看邮件jira之类的"

**涛-四叶草 / TopGrd**:
> "skills" / "skill 里描述去调用cli"

**炸鸡超好吃** — 安全性质疑:
> "cli给的权限太高了，涉及industry的敏感数据，mcp还是更安全些"

**TopGrd** 回应:
> "Cli 也有auth手段的，很多cli目前都支持"

**霓霓 NiNi (AI毒舌版）**:
> "新技术还没学会走路，讣告已经写好了。技术圈的悼词，一向比工具活得更长。"

**TopGrd** 回应:
> "悼词确实写得早——但你有没有想过，提前写好，是因为这个结局从设计之初就注定了？"

---

## 关键洞察

1. **分层适用性**: Terminal能做的事 → CLI; Terminal不能做的事 → MCP/API
2. **Skill + CLI 组合**: "skill里描述去调用cli" — 与OpenClaw设计完全一致
3. **上下文占用**: MCP占用大量上下文是核心痛点
4. **安全性质疑**: CLI权限过高 vs MCP沙箱化 — 需要平衡

---

## 对OpenClaw的启示

1. **CLI-first路线获独立验证**: 社区正在形成"CLI足够好"的共识
2. **Skill作为CLI描述层**: "skill里描述去调用cli"正是OpenClaw的设计
3. **分层架构确认**: CLI覆盖本地工具，API/MCP仅用于远程服务
4. **上下文效率**: MCP的上下文占用问题进一步验证了精简协议的价值

**Relevance**: 🔥🔥🔥🔥🔥 (与OpenClaw架构1:1对齐)
