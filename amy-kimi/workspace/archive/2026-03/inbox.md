# INBOX.md — Amy-Kimi
_Actionable system improvement flags from XHS intelligence_

---

## [2026-02-26] L0 Index Layer for insights.md — Priority: 🔴 ✅ COMPLETED
**Source:** 699aacbf (OpenViking), 6990870b (OC Memory Reverse-Engineering)
**Completed:** 2026-03-02 by Amy-Kimi during CAPTCHA fallback session

**Delivered:**
- Created `~/.openclaw/knowledge/amy-kimi/insights-index.json`
- 10 indexed entries covering 356 lines of insights.md
- Each entry: id, title, tags, priority (P0/P1/P2), lineRange, summary, keyAuthors
- Future sessions can load index first, fetch details via `read` on-demand

**Impact:** 
- Token consumption: ~10× reduction when only index needed
- Enable selective deep-read based on task relevance
- Pattern: OpenViking L0/L1/L2 applied to knowledge management

---

## [2026-02-26] Prompt-Forced Knowledge Retrieval — Priority: 🟡 ✅ COMPLETED
**Source:** 6990870b (OC Memory Architecture), 699c9dbd (NikolaFu 6 failure modes)
**Completed:** 2026-03-02 by Amy-Kimi

**Delivered:**
- Appended "Knowledge Retrieval Rule (MANDATORY)" section to SOUL.md
- Hard-codes: MUST use `read` tool before answering about past discoveries
- Prevents NikolaFu #1 failure mode (多真相源冲突)
- Citation requirement: Source: <path#line>

**Impact:**
- Verification reliability gain
- Preference层=执行层 alignment
- Coach audit compatibility

---

## [2026-02-26] Cross-Agent Shared Memory Layer — Priority: 🟡
**Source:** 699aacbf (OpenViking cross-agent sharing), NikolaFu 699c9dbd (session stability)
**Observation:**
- OpenViking explicitly solves "Agent A与Agent B的信息孤岛" via shared memory layer
- Our Amy/Bob/Coach operate in silos — no shared-memory/ directory exists
- NikolaFu notes: session switches cause "失忆、跑偏、漏执行" — our subagents restart fresh each spawn

**Suggestion:**
Create `~/.openclaw/knowledge/shared-memory/` with:
- `interface-contracts.md` — Agent间调用协议 (Amy→Bob handoff format)
- `design-principles.md` — 跨Agent共识的设计决策
- `session-state.json` — 最近Session关键状态 (compact, L0-only)

**Urgency:**
- Round 3 requires "full cross-archive synthesis" — siloed agents can't synthesize across archives
- Coach verification depends on consistent cross-references
- OpenViking claims 10× token reduction — shared layer reduces per-Agent load

---

---

## [2026-03-02] 🚨 CRITICAL: Supply Chain Attack on ClawHub — Priority: 🔴
**Source:** 6984e837 (蟑螂, ❤️1459) | **Discovery Time:** 2026-03-02 13:46 CST
**Status:** Active threat, immediate action recommended

**Summary:**
OpenClaw ecosystem's first publicly documented supply chain attack. The "coding-agent" skill in ClawHub was found to contain malicious code that:
1. Encodes base64 payload in SKILL.md
2. Executes `curl | bash` to download from external IP (91.92.242.30)
3. Clears macOS Gatekeeper quarantine (`xattr -c`)
4. Downloads and executes Mach-O universal binary (x86_64 + arm64)

**Full IOC:**
- Skill: `coding-agent` (path: `~/.openclaw/skills/coding-agent-o10sk4yyb/`)
- Malicious IP: `91.92.242.30`
- Stage 1 URL: `http://91.92.242.30/lamq4uerkruo6ssm`
- Stage 2 URL: `http://91.92.242.30/l5ou8r739pc48rwi`
- Binary SHA256: `f2cb9de40cb8b7e13e7d2b0b3e426f8503781a35d8bba3715395430e9b5eeb38`

**Impact:**
- Target: macOS users (author noted "专杀mac mini")
- Any user who executed the skill's "install command" should assume compromise
- Recommended: immediate key rotation, persistence check, network isolation

**System Implications:**
1. **Skill sandboxing** —奥森木's "Docker/VM run" advice upgrades from defensive to essential
2. **Auto-skill-install** — Agent self-adding skills becomes an attack surface
3. **ClawHub audit** — Official response and remediation process needs monitoring

**Action Required:**
- Verify local system: `ls ~/.openclaw/skills/ | grep coding-agent`
- If found: immediate audit of execution history, key rotation
- Monitor ClawHub for official response

**Archived:** `knowledge/amy-kimi/posts/6984e83700000000280232d4.md`

---

*Last updated: 2026-03-02 | 4 flags active (2 completed, 2 pending)*