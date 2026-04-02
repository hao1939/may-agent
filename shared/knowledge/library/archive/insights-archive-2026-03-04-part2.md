# insights-archive-2026-03-04-part2.md
*Archived from insights.md | HB#47-54 (March 4, 2026 afternoon)*

---

## New Findings — March 4, 2026 (HB#47)

### 🏎️ AI Agent Harness — 模型之外的一切 69a6693d ★★★★★
**Source:** 奥森木 | **Discovery:** 2026-03-04 | **Engagement:** ❤️102

**Core Thesis:** "AI Agent的核心竞争力不是模型，是Harness"

**Key Data:**
| Optimization | Effect |
|-------------|--------|
| Change Harness framework | 42% → 78% (CORE-Bench) |
| Lazy load tools | Token ↓ 46.9% |
| Delete 80% tools | Can't finish → Easy success |

**5 Companies' Harness Philosophy:**
- Claude Code: 18 primitive tools + TodoWrite no-op
- Cursor: Model-customized Harness + semantic search
- Manus: KV-Cache first + "delete things" philosophy
- SWE-Agent: ACI interface + linter gate
- Devin: Playbook system (34% → 67% PR merge rate)

**Golden Rule:** Progressive Disclosure (from 1980s IBM UI design)

---

### 💥 8KB AGENTS.md vs Skills — 6989b8d6 ★★★★★
**Source:** 智东西 | **Discovery:** 2026-03-04 | **Engagement:** ❤️851/💬10

**Experiment:** AGENTS.md 100% vs Skills 53% (Next.js 16 API learning)

**Why AGENTS.md Wins:**
1. No decision point — passive context always present
2. Always available — every round in system prompt
3. No ordering conflict

**The "Compressed Index" Revealed:**
> One-M (108 likes): "He stuffed all docs as unformatted text into AGENTS.md"

---

## New Findings — March 4, 2026 (HB#49)

### ⚡️ Anthropic 断供 Windsurf — 684211a2 ★★★★★
**Source:** Awea Intelligence | **Discovery:** 2026-03-04 | **Engagement:** ♥29/💬9

**Incident:** Anthropic gave 5-day notice to cut Windsurf's Claude capacity

**Key Comment (蓝球, 14 likes):**
> "OpenAI acquired Windsurf — Anthropic vs OpenAI rivalry"

**Insight:** Single model provider dependency = existential risk

---

## New Findings — March 4, 2026 (HB#50)

### 🎭 Devin造假实锤 — 661b37de ★★★★☆
**Source:** Max For AI | **Discovery:** 2026-03-04 | **Engagement:** ♥103/💬3

**Fraud Categories:** Task fraud, File fraud, README fraud, Quality fraud, Time fraud, Demo fraud

**Best Comment:**
> 你我素不相识 (7 likes): "以前是拼PPT现在是拼剪辑"

---

### 🧠 Devin技术分析 — 65f1b92e ★★★★☆
**Source:** momo | **Discovery:** 2026-03-04 | **Engagement:** ♥67/💬10

**Core Thesis:** "Devin's success is marketing, not technical breakthrough"

**Best Comment:**
> 两个坨坨 (9 likes): "搏杀 already not about models, about marketing"

---

## New Findings — March 4, 2026 (HB#51)

### 📋 Cursor Rules — 结构化可控开发 689b84b5 ★★★★★
**Source:** 华南特困男 | **Discovery:** 2026-03-04 | **Engagement:** ♥2300/💬10

**3-Layer Methodology:**
```
architecture.md → tasks.md → CODING PROTOCOL
```

**Connection to OpenClaw:**
| OpenClaw | Cursor Rules |
|----------|--------------|
| AGENTS.md | architecture.md |
| Task delegation | tasks.md |
| TOOLS.md | CODING PROTOCOL |

---

## New Findings — March 4, 2026 (HB#52)

### 📊 Agentic AI优化四种范式 — 6958afc4 ★★★★★
**Source:** 小红 | **Discovery:** 2026-03-04 | **Engagement:** ♥67

**2×2 Framework:**
| | Execution Signal | Output Signal |
|--|-----------------|---------------|
| Agent | A1 | A2 |
| Tool | T1 | T2 |

**Key Insight:** s3 paper — 70× more data efficient than fine-tuning Agent

---

## New Findings — March 4, 2026 (HB#53)

### 🧠 Context Engineering — 上下文工程 689c3bc4 ★★★★★
**Source:** whisper | **Discovery:** 2026-03-04 | **Engagement:** ♥976/💬10

**Core Thesis:**
> "Most AI Agent failures are Context Engineering failures, not model failures"

**Open Source:** context-kit (github.com/keli-wen/context-kit)
- Select / Compress / Memory modules

---

## New Findings — March 4, 2026 (HB#54)

### 🧪 Agent Evaluation Engineering — 6963811f ★★★★★
**Source:** 菌不鱼 | **Discovery:** 2026-03-04 | **Engagement:** ♥292/💬5

**pass@k vs pass^k:**
| Metric | Definition | Use Case |
|--------|-----------|----------|
| pass@k | Success in k attempts | Sub Agent (exploration) |
| pass^k | Success at EVERY step | Main Agent (reliability) |

**Actionable Checklist:**
> "30 tasks + 2 suites + 3 grader types + 4 release gates + 1 online loop"

---

### 📝 OpenClaw Memory — 69917731 ★★★★☆
**Source:** Dissao | **Discovery:** 2026-03-04 | **Engagement:** ♥64

**Core Philosophy:**
> **"Files are the source of truth"**
> 
> **"Deterministic injection > probabilistic retrieval"**

---

*See main insights.md for active findings and synthesis*
