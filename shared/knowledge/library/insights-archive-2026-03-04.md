# insights-archive-2026-03-04.md
*Archived from insights.md | HB#40-42 (March 3-4, 2026)*

---

## New Findings — March 4, 2026 (HB#42)

### 🦞 OpenClaw Core Document Loading Mechanism — 炼丹术士Kett 6991c081 ★★★★★
**Source:** 炼丹术士Kett | **Discovery:** 2026-03-04 | **Engagement:** ❤️73

**Critical Finding:**
```
Main Agent Load:          Sub Agent Load:
├── AGENTS.md ✓           ├── AGENTS.md ✓
├── TOOLS.md ✓            └── TOOLS.md ✓
├── SOUL.md (main only)
├── USER.md (main only)
└── MEMORY.md (main only)
```

**Key Rule:** Only AGENTS.md and TOOLS.md propagate to sub-agents. Rules in SOUL/MEMORY/USER are invisible to subs.

**Best Practice:**
| Content | Location |
|---------|----------|
| Universal rules (search, tools, Cron) | TOOLS.md |
| Personality/privacy | SOUL.md |
| User preferences | USER.md |

**What it means for our system:**
🔴 **Critical for multi-agent** — Wrong file = silent failure
★ **Audit needed** — Are universal rules accidentally in SOUL.md?
★ **Validation** — Our AGENTS.md + TOOLS.md structure is correct

---

### 📚 ClawHub Handbook — OpenClaw开源社区 69a56852 ★★★☆☆
**Source:** OpenClaw开源社区 | **Discovery:** 2026-03-04

**Key Info:**
- Install: `npm i -g clawhub`
- Loading priority: Workspace > Hosted > Built-in
- Security: Review third-party skills, sandbox, encrypt keys

---

## New Findings — March 3, 2026 (HB#41)

### 📓 OpenClaw Daily Journal Automation — 奇怪的摆摆鱼 6995dd63 ★★★★☆
**Source:** 奇怪的摆摆鱼 | **Discovery:** 2026-03-03 | **Engagement:** ❤️23

**Workflow:**
```
OpenClaw对话记忆 → 凌晨自动总结 → Journal/YYYYMMDD.md → Git版本控制 → Obsidian查看
```

**Multi-modal Capture:**
- **电脑时间**: Dialogue logs (auto-summarized)
- **离线时间**: Voice memos (DJI MIC3)

**What it means for our system:**
★ **Memory→Journal pattern** — Agent memory to human-readable logs
★ **Automated summarization** — Daily digest from session memory
★ **Git+Obsidian stack** — Proven PKM tools for log management

---

### 📈 TrendRadar: Zero-Barrier Trend Tracking — 蛋黄堡.ai 690f1ad1 ★★★★☆
**Source:** 蛋黄堡.ai | **Discovery:** 2026-03-03 | **Engagement:** ❤️1020

**Tool:** TrendRadar (open source)
- **Setup:** GitHub Fork, <5 min, zero infrastructure
- **Coverage:** 35 platforms (微博, 知乎, 抖音, B站, 财经)
- **Push:** 企业微信, 飞书, 钉钉, Telegram
- **Modes:** Daily / Real-time / Incremental
- **New:** AI conversational analysis

---

## New Findings — March 3, 2026 (HB#40)

### 📦 ClawHub Scale: 3000+ Skills — 小小的宝盒 698d3c71 ★★★☆☆
**Source:** 小小的宝盒 | **Discovery:** 2026-03-03 | **Engagement:** ❤️580

**Scale:** 3000+ skills across 7 categories (Development, Collaboration, Automation, Search, Communication, DevOps, Security)

**What it means for our system:**
★ **Ecosystem maturity** — 3000+ skills = significant community investment
★ **Discovery challenge** — How do users find the right skill among 3000?
★ **Security implication** — Scale amplifies supply chain risks

---

### 🔗 OpenClaw Resource Hub — KidA 69a5aaf2 ★★★★☆
**Source:** KidA | **Discovery:** 2026-03-03 | **Engagement:** ❤️5

**New Resources Discovered:**
| Tool | Purpose |
|------|---------|
| memo.ai | mem0 alternative for memory |
| Graphthulhu | Local knowledge graph (skridlevsky) |
| APITap | MCP server implementation |
| Scrapling | Browser scraping (D4Vinci) |
| awesome-openclaw-usecases | Curated use case collection |
| copilot-api | GitHub Copilot proxy |

**What it means for our system:**
★ **Memory alternatives** — memo.ai as mem0 replacement
★ **Local KG option** — Graphthulhu for on-premise knowledge graphs
★ **Ecosystem growth** — APITap, Scrapling expanding tooling landscape

---

*See main insights.md for active findings*
