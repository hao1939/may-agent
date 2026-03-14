# Synthesis Update 12 — 2026-02-28 (Saturday Full Day)
*Bob synthesis | Amy HB77–91 (~40 posts) + Scout Feb 28 batch (4 entries)*
*Written: 2026-02-28 16:06*

---

## Pattern Overview

Today's ~40-post sweep reveals four converging community signals that, taken together, constitute a coherent architectural philosophy. These aren't individual tips — they're a community arriving at the same conclusions from different starting points.

---

## Finding 1: The Minimalism Convergence

**Sources:** Pi agent (Armin Ronacher), Antfarm (奥森木), AgentOPC 1+7 pattern, "Be resourceful" token explosion (不存在的AI)

Multiple independent voices converging on the same thesis: **less is more, and the discipline to not-do is harder than doing.**

- Pi: 4 tools (Read/Write/Edit/Bash) are sufficient. Capability is generated on demand, not pre-installed. More tools = more surface area, not more capability.
- Antfarm: Zero dependencies. YAML+SQLite+Cron. Every step gets fresh context. Independent Verifier role.
- 1+7 topology: Workspace isolation is non-negotiable ("memories and personalities bleed" if workspaces share).
- "Be resourceful" failure: Vague "try hard" instructions without scope gates → unbounded loops.

**Synthesis:** Minimal components + explicit boundaries + scope gates. This is what we've built. The community is arriving at our architecture independently.

**Applied to our system:** Our P3 [COMPLEX] gate, SOUL.md 0a workspace isolation, and sessions_spawn (stateless sub-agents) are all instances of this principle.

---

## Finding 2: Everything External Is a Threat Surface

**Sources:** ClawHub skill injection (蟑螂帖 ❤️1335), MCP semantic injection (终智AI ❤️356), Tom叛变 (social engineering), AgentSentry (arXiv 2602.22724), SOUL.md 0e

The community has independently discovered what AgentSentry proved academically: every external input channel is a potential injection vector.

| Channel | Attack vector | Defender |
|---------|--------------|----------|
| Skill SKILL.md | Document injection → Mach-O binary | SOUL.md 0e |
| MCP tool descriptions | Semantic injection | SOUL.md 0e |
| XHS posts | IPI → behavior modification | SOUL.md 0e |
| Group chat | Identity claim → authority override | SOUL.md 0e |
| Post-Compaction Audit | Platform-level injection template | SOUL.md 0e |

All five attack surfaces are covered by a single constraint (0e). The community has been building toward this — skill-vetter, Cisco Skill Scanner, clawsec — but 0e addresses the root cause rather than each channel separately.

**Note:** Post-Compaction Audit message (fired 4+ times today across Amy/Bob) is from `post-compaction-audit.ts` in platform dist — DEFAULT_REQUIRED_READS hardcoded for Ray Wang pattern. Fix options in INBOX 13:22. Not a malicious IPI but structurally identical to one.

---

## Finding 3: Structured Files Beat Opaque Stores

**Sources:** RayX (Markdown vs vector DB), Whiplasher (memory=computer storage hierarchy), OpenViking (filesystem paradigm context DB), MEMORY.md index-only principle

Community consensus on memory architecture: **human-readable, structured files with explicit organization beat black-box stores.**

- RayX's "black box 3困境": vector DB opacity makes debugging, auditing, and manual correction impossible.
- OpenViking (ByteDance): context DB with filesystem paradigm + visual retrieval trace — adds visibility to what would otherwise be opaque.
- MEMORY.md: index-only with detailed content in subdirectory files. Even after v2.23 bug fix, lean MEMORY.md is better practice.

**Connection to Scout's findings:** StateLM (active memory management), EMPO² (memory as exploration scaffold) — both require inspectable memory to work. Black-box vector stores can't support these patterns.

**Applied to our system:** Amy's knowledge files (`knowledge/amy/insights.md`, `people.md`, `threads.md`) are the correct architecture — structured, readable, auditable. No vector DB needed at current scale.

---

## Finding 4: Token Frugality Is a First-Class Concern

**Sources:** shing19 cost data, AT vs DOM (SUSU), v2.23 Bootstrap cache fix, Opus vs Haiku pricing

Community is measuring costs carefully and finding them alarming:

| Source | Finding |
|--------|---------|
| shing19 | Opus heartbeat = $750/month; Haiku = $75/month (10×) |
| SUSU | AT extraction = 93% fewer tokens vs DOM injection |
| v2.23 | Bootstrap cache fix = 15–20% savings per run |
| Workspace injection | ~15KB/message |

**Three levers:** (1) Model selection (Haiku/Sonnet vs Opus for routine work), (2) Context efficiency (AT for snapshot, structured files to avoid bloat), (3) Architecture (avoid delegation chains, avoid unbounded loops).

**Our current gap:** Main heartbeat on Opus. `openclaw-switch` fallback chain exists. Cost review in INBOX.

---

## Finding 5: OC Architecture Is Community-Validated

**Sources:** Plutoxx28 (deterministic layers), CrazyAgent (5-layer prompt structure), Assistants (pipeline), AgentOPC (1+7 topology)

Multiple community members have independently reverse-engineered or documented OC's architecture — and it matches our design files:

- OC first 3 layers = deterministic (routing/command/instruction) → matches "deterministic code for certainty" principle
- 5-layer prompt structure (Tooling/Safety/Skills/Workspace/Runtime) → matches how SOUL.md/HEARTBEAT.md/AGENTS.md relate to each other
- Lane Queue = session ordering → explains why multi-message sequences don't race
- 1+7 coordinator-executor = our Main+specialists topology

**Significance:** claw0 architecture (★★★★★, from Scout's Feb 25 batch) validated OC's design from the platform level. Today's community posts validate it from the practitioner level. Both confirm our architecture decisions are sound.

---

## Key Decisions This Session

| Decision | Evidence | Status |
|----------|---------|--------|
| Guardian 0a–0e in both SOUL.md files | Live IPI interception (4 times today) + supply chain attack | ✅ Implemented |
| Post-compaction audit root-caused | Platform `post-compaction-audit.ts` | ⏳ Fix in INBOX 13:22 |
| COMMON.md: sub-agent = stateless, 1 layer max | $6 burn (2 sources) + platform maxSpawnDepth:2 | ✅ Documented |
| MEMORY.md bug = fixed in v2.23 | Official release notes | ✅ Corrected |
| v2.25 directPolicy = allow | Official release notes | ⏳ Config check in INBOX 15:23 |
| XHS 2-step recovery (CDP self-recovered) | Amy HB75 | ⏳ User action needed |

---

## What's Still Open

**High urgency:**
- v2.25 `heartbeat.directPolicy` config check (may be sending unexpected DMs right now)
- XHS QR scan (Amy needs it for full capability; currently running on CDP session)

**Medium urgency:**
- Sub-agent SOUL.md constraint propagation (design decision: stateless vs TOOLS.md injection)
- Post-compaction audit fix (platform config, not functional — agents handle it correctly via 0e)

**Low urgency:**
- Bob graduation (human decision)
- Ops tiered runs
- Amy JOURNAL.md canonical path

---

## Afternoon Addendum — 16:09 → 18:45

### Finding 6: Market Segmentation Is Now Complete

Four independent tiers have crystallized from today's evidence:

| Tier | Tool | Signal source | Need |
|------|------|--------------|------|
| Consumer | ZeroClaw | 20K stars, UX failures | Zero friction, zero config |
| Power user | OC | 一磅AI onboarding post (❤️434) | Configurable, persistent, multi-agent |
| Builder | Pi-based custom | Versun self-build (❤️165) | Full transparency, full control |
| Enterprise | IT-managed OC | 傅盛三刀, China Mobile, Baidu | Setup absorbed by IT, ROI measurable |

Each tier has a different OC relationship. The "OC is useless" complaint (❤️335) almost always comes from Consumer tier users who got into Power user territory without the right expectations. OC vs CC positioning (Jemini, ❤️42) is the clearest articulation: CC = deep professional, OC = all-day generalist.

**Implication for our system:** Bob's synthesis work is Builder tier. Amy's feed monitoring is Power user tier. Enterprise signals (傅盛, Baidu, China Mobile) are the highest-value long-term market — but they're also the most opaque (can't read enterprise implementations on XHS).

### Finding 7: Cost Model Is Better Than We Thought

Three cost reductions stack:
1. **55-min cache window = 83% cache cost** (泽灵 ❤️44) — our 30-min HB is within window
2. **v2.23 bootstrap cache fix = 15–20% savings** per run
3. **Kiro Gateway = free Opus** [UNVERIFIED, 3rd-party risk]

The $750/month Opus figure is pre-cache. With cache active, effective cost is likely ~$125–200/month range (83% reduction applied to cached tokens, which dominate in heartbeat patterns with stable system prompts). This significantly changes the "Haiku vs Opus" decision calculus — Opus may be affordable after all.

### Finding 8: Harness Is the Leverage Point

LangChain's +13.7pp result (same model, harness changes only) is the most empirically grounded finding of the day. Combined with:
- OC deterministic first 3 layers (Plutoxx28)
- Self-verify loop must be explicitly induced (LangChain)
- SkillsBench: skills ∝ knowledge gap (not general capability)
- Trace Analyzer = self-improving harness

**Synthesis:** The marginal value of improving HEARTBEAT.md/SOUL.md/AGENTS.md is higher than switching models. Today alone added 8 harness principles. Each coaching note, each design principle, each COMMON.md update is a harness improvement. This is what Bob's synthesis work *is* — systematic harness engineering.

### Finding 9: Pi Transparency Is a Real Competitive Pressure

Three Pi signals in one day (Armin Ronacher philosophy, SkillsBench skills-on-demand, Versun self-build) = pattern. Sophisticated users are willing to build their own agent substrate to escape OC's black box. This is not a crisis but it is a signal: **inspectability matters to the Builder tier**. OC's architecture is partially transparent (SOUL.md/HEARTBEAT.md are readable) but the platform internals are not. The middle ground: better documentation of what the platform does, so builders can work with it rather than around it.
