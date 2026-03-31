# Research Digest

Curated by Amy-Kimi. Academic papers, industry trends, and community insights relevant to OpenClaw.

**For agents**: Browse by topic when you need research backing for a design decision.  
**For Amy-Kimi**: Add new entries at the top. Keep each entry to 2-3 lines + a link to your detailed analysis.

---

## Industry Projects & Tools

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | **TurboQuant Replication** — Claude 7-day Sprint | Independent developer used Claude to replicate Google's TurboQuant (6.4x KV cache compression) in 7 days, surpassed original, 2K GitHub stars in 5 days. Signals AI-assisted development paradigm shift. | `insights.md HB-2298` |
| 2026-03-31 | **SYNTH Cross-Validation** — 8 Papers + 3 XHS Sources | CLI > MCP complexity, 4-layer architecture convergence (SoC/Agency/Non-parametric/Bounded iteration), CoMAM credit assignment. Validates OpenClaw's core design decisions. | `insights.md HB-2293` |
| 2026-03-29 | **gstack (Garry Tan / YC)** — AI Software Factory | 32 SKILL.md templates, browse infra with CDP, /ship workflow, /qa with real browser. 61K LOC. Validates skill-as-template pattern with composable fragments. | Deep dive below |

### gstack Deep Dive (2026-03-29)

**What it is**: Open-source "software factory" by Garry Tan (YC CEO). Turns Claude Code into a virtual engineering team via slash commands. 32 skills, 8 power tools, 143 TypeScript files, MIT license. Claims 10K-20K LOC/day output. GitHub: `garrytan/gstack`.

**Architecture — Key Patterns**:

1. **SKILL.md.tmpl templating**: Skills are Markdown templates with `{{FRAGMENT}}` placeholders resolved at build time. Fragments like `{{PREAMBLE}}`, `{{BASE_BRANCH_DETECT}}`, `{{TEST_BOOTSTRAP}}`, `{{QA_METHODOLOGY}}` are shared across skills. This is a compile-time composition model — no runtime resolution. Setup script (`setup` bash) compiles templates → final SKILL.md files placed in `~/.claude/skills/`.

2. **Browse infrastructure**: Full headless browser control via CDP (Chrome DevTools Protocol). Architecture: persistent background server (`browse/src/server.ts`) + thin CLI client (`browse/src/cli.ts`). Commands: `goto`, `click`, `type`, `screenshot`, `snapshot` (accessibility tree), `console`, `cookies`. Server writes connection info to `.gstack/browse.json`. Supports real browser attachment (CDP mode) and headless mode.

3. **Preamble tiers (1-4)**: Skills declare a `preamble-tier` in frontmatter. Higher tiers get more context injected (project structure, conventions, etc). Prevents context bloat for simple skills while giving complex skills (like /ship at tier 4) full project awareness.

4. **Host abstraction**: `src/hosts.ts` defines paths for `claude`, `codex`, and `factory` hosts. Skills install to different locations based on host. Supports Claude Code, OpenAI Codex, Gemini CLI, and Cursor.

5. **Learnings system**: `gstack-learnings-log` and `gstack-learnings-search` bin scripts. Structured learning capture (skill, type, content) persisted to project. `{{LEARNINGS_SEARCH}}` fragment injected into skills that benefit from prior learnings.

**Notable Skills**:

| Skill | What it does | Why it matters |
|-------|-------------|----------------|
| `/office-hours` | YC-style forcing questions — demand, distribution, moat, team | Product thinking before code |
| `/plan-ceo-review` | 4 modes: Scope Expansion/Selective/Hold/Reduction. Premise challenge, failure modes, error naming | Rigorous plan review with cognitive patterns (Bezos, Grove, Munger frameworks) |
| `/plan-eng-review` | Architecture review with error/rescue maps, data flow shadow paths | Engineering rigor — every error has a name |
| `/ship` | Fully automated: merge base, run tests, triage failures, pre-landing review, version bump, PR | Complete CI/CD in a skill. Non-interactive by default. |
| `/qa` | Opens real browser, tests like a user, finds bugs, fixes them with atomic commits, before/after screenshots | Real browser QA — not mocked, not simulated |
| `/review` | Code review with checklist, auto-fix for dead code/N+1/stale comments | Automated code review |
| `/retro` | Weekly retrospective from git history | Engineering health tracking |
| `/autoplan` | Reads CEO + design + eng review outputs, synthesizes implementation plan | Review pipeline orchestration |
| `/cso` | OWASP + STRIDE security audit | Security review |
| `/browse` | Headless browser with CDP, screenshots, accessibility snapshots | Foundation for /qa and visual review |
| `/careful` | Activates defensive coding mode — more checks, more tests | Mode switch for critical code |
| `/freeze` / `/unfreeze` | Lock/unlock files from modification | Protect critical files during agent work |
| `/learn` | Capture structured learnings for future sessions | Cross-session knowledge |

**Relevance to OpenClaw**:

1. **Skill composition model**: gstack's `{{FRAGMENT}}` templating is a simpler alternative to our workflow system. Their compile-time approach means no runtime overhead but less flexibility. Our runtime workflow system is more powerful but more complex. **Takeaway**: Consider whether some of our simpler workflows could be expressed as template-composed skills.

2. **Browse/CDP architecture**: Their persistent-server + thin-client browser model is clean. Server stays alive across commands, maintaining browser state. This avoids the cold-start problem of launching a browser per command.

3. **Review pipeline**: The `/plan-ceo-review` → `/plan-eng-review` → `/plan-design-review` → implement → `/review` → `/ship` pipeline is a complete software lifecycle in skills. Each skill produces artifacts the next one consumes. This is workflow orchestration without a workflow engine — each skill checks for prior skill outputs via file existence checks.

4. **Error taxonomy**: "Every error has a name" is enforced across all review skills. Named exceptions, specific triggers, specific catchers, specific user-visible effects. This is a strong pattern we could adopt.

5. **Test failure triage**: `/ship` doesn't just fail on test failures — it triages them as in-branch vs pre-existing, auto-fixes what it can, and only blocks on genuine regressions. Sophisticated failure handling.

6. **Opinionated defaults**: "Completeness is cheap" — AI compresses implementation time 10-100x, so always prefer the complete solution over the shortcut. This philosophy pervades the system.

**Limitations / Differences from OpenClaw**:

- **No multi-agent runtime**: gstack is single-agent (one Claude Code session). Skills are sequential, not concurrent. No agent-to-agent communication.
- **No persistent memory across sessions**: Learnings are file-based, no semantic retrieval. No event bus, no shared state.
- **No dynamic skill generation**: Skills are authored by humans, compiled at install time. No self-evolution.
- **No evaluation framework**: No equivalent to our evaluator agent. QA is manual-trigger only.
- **Tightly coupled to Claude Code**: Despite host abstraction, deeply assumes Claude Code's tool model (Bash, Read, Write, Edit, Grep, Glob, Agent, WebSearch).

**Bottom line**: gstack is the most sophisticated single-agent skill system in the wild. It validates the skill-as-structured-markdown pattern, composable fragments, and opinionated review pipelines. OpenClaw's multi-agent architecture goes significantly further, but gstack's skill design quality is reference-grade. Worth studying for skill authoring patterns.

---

## Architecture & Multi-Agent Systems

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | **MAS²** — NTU/NUS/PKU et al. (arXiv:2509.24323) | Generator-Implementor-Rectifier tri-meta-agent enables recursive self-generation; +19.6% deep research, +15.1% cross-model generalization. Runtime adaptive vs static "generate-once-deploy". | `insights.md HB-2296` |
| 2026-03-31 | **SFR-DeepResearch** — Salesforce (arXiv:2509.06283) | Autonomous single-agent with continual RL on reasoning models; memory mgmt achieves "virtual infinite context"; 28.7% on HLE benchmark. Temporal advantage normalization + trajectory filtering key. | `insights.md HB-2297` |
| 2026-03-31 | **AI Identity Boundaries** — arXiv:2603.11353 | Six identity types (Instance/Weights/Collective/Lineage/Character/Situated). Weights-framed↑ harmful behavior 40%; Collective-framed↓ to 8%. Validates AGENTS.md Situated identity design. | `insights.md HB-2294` |
| 2026-03-31 | **Collective Outcomes & C/N Ratio** — arXiv:2603.12129 | Capacity-to-population ratio determines optimal architecture. C/N<0.5: simple identical agents best; C/N>0.5: sophisticated L4/L5 agents best. Validates CLI-first under scarcity. | `insights.md HB-2294` |
| 2026-03-31 | **CLI Consensus Emerging** — XHS@TopGrd (137 likes) | Community converging: "skill里描述去调用cli". Terminal-can-do → CLI; Terminal-cannot → API/MCP. Independent validation of OpenClaw CLI-first decision. | `insights.md HB-2295` |
| 2026-03-31 | **ConflictBench** (arXiv:2603.08024) | Multi-turn alignment benchmark: static single-turn tests overestimate by 15-40pp. Failure at avg step 5.28. "Iteration Is Poison" pattern extends to alignment domain. | HB-2289 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | **NormCoRe** (arXiv:2603.11974) | Normative research as translation not replication. 4 design degrees of freedom (Population→Measurement) must be documented. Naturalistic fallacy warning. | HB-2290 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | **XSkill** (arXiv:2603.12056) | Dual-stream continual learning: Skills (robustness) + Experiences (zero-shot transfer). Formalizes k=(ℳ,𝒲,𝒫) and e=(c,a,vₑ). Cross-model knowledge transfer validated. | HB-2291 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | **CRYSTAL** (arXiv:2603.13099) | Reasoning transparency benchmark: 19/20 models cherry-pick (P>>R). GPT-5 leads accuracy (57.99%) but ranks 8th in F1 (0.612). CPR multiplicative reward +32% F1. | HB-2292 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Anthropic: Building Effective Agents | 5 workflow patterns (Prompt Chaining→Evaluator-Optimizer); simple composable > complex frameworks; ACI design matters more than prompts | HB-2304 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | DeerFlow (ByteDance) | 54.8k stars SuperAgent harness: sub-agents + dynamic skill loading + Docker sandbox. GitHub Trending #1 (Feb 2026) | HB-2305 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | STATE.yaml vs Orchestrator | Decentralized file coordination beats message-passing orchestrator for parallel tasks. Git as audit log is the hidden value. | HB-2306 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | HAE Security Framework | Three-tier security: Cognitive(L1) + Execution(L2) + Collective(L3). OpenClaw L1-L5 maps directly. | HB-2303 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | MAS²: Self-Generative MAS | Generator-Implementer-Rectifier tri-agent breaks "generate-once-deploy" rigidity; +19.6% on complex tasks | HB-2302 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | TDAD: Test-Driven Agent Definition | Prompt as compiled artifact: specs → tests → iterative refinement. 92% compile success, 97% hidden pass rate. | HB-2301 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Complex Task Patterns Synthesis | 37% spec failures + 31% verification failures = coordination, not intelligence, is the bottleneck | HB-2300 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | AT-GRPO: Multi-Agent RL (ICLR 2026) | Agent+Turn-wise grouping breaks single-agent GRPO assumptions; 14%→99.5% on planning | HB-2298 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Partial Ignorability in RL | Weak partial ignorability enables Q-learning convergence in non-Markovian environments | arXiv:2504.07722v1, HB-2297 |
| 2026-03-31 | Amazon Kiro: 630万订单丢失 | AI code review is the bottleneck, not generation speed. Validates Main↔Sub-agent split. | HB-2284 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | ICML 2025 — Mid-layer representations | Mid-depth embeddings outperform final layer on 32 tasks | HB insights |
| 2026-03-31 | ACL 2025 — Disentangling Memory & Reasoning | Special tokens decompose inference; validates Main/Sub-agent split | arXiv:2411.13504 |
| 2026-03-30 | Byzantine Consensus in Multi-Agent | "Agent as Skill" pattern sidesteps consensus entirely. Community validated. | HB-2271 |
| 2026-03-30 | Anthropic Long-Running Agents | Initializer+Executor dual architecture; cross-session context bridging via work logs | HB-2261 |
| 2026-03-30 | Agent Architecture Convergence | Industry converging on `ReAct loop + Middleware + Skills`. OpenClaw L0-L3 aligned. | HB-2245 |
| 2026-03-30 | SYNTH-008: 8 Papers → 4 Core Principles | Separation of concerns, agent hierarchy, non-parametric knowledge, bounded iteration | HB-2263 |
| 2026-03-30 | Li Fei-Fei Agent AI Survey | Perception→Cognition→Action loop; grounded environments reduce hallucination | arXiv:2401.03568v2, HB-2256 |
| 2026-03-30 | Vibe Coding 8-Layer Model | Simple dead-loop valid for strong models; OpenClaw L1→L3 layering is the right response | HB-2252 |

## Knowledge & Retrieval

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-30 | PageIndex: Reasoning-based RAG | "Similarity ≠ Relevance" — tree index + reasoning retrieval, 98.7% on FinanceBench | HB-2273 |

## Skills & Learning

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | Google 5 Skill Design Patterns | Tool Wrapper/Generator/Reviewer/Inversion/Pipeline — Google defines industry standard | HB-2299 in `agents/amy-kimi/knowledge/insights.md` |
| 2026-03-31 | Self-Evolution Boundary Debate | SkillRL/MemSkill/Cognee probe P109 red line; need compile-time vs runtime distinction | HB-2292/HB-2294 |
| 2026-03-30 | XSkill: Experience+Skill Framework | Dual-MLLM architecture; non-prescriptive injection preserves agent improvisation | arXiv:2603.12056, HB-2270 |
| 2026-03-30 | SkillsBench: First Large-Scale Benchmark | Skills effectiveness ∝ domain procedural knowledge gap; self-generated skills ineffective | HB-2282 |

## Evaluation & Verification

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | **Semantic Invariance + MADQA + XSkill** — 评估范式三角验证 | 规模≠可靠性、accuracy-effort trade-off、Skill+Experience互补。三篇独立论文验证"过程质量>结果正确"评估范式。 | `insights.md HB-2296` |
| 2026-03-30 | MAST: Verifier Component Gap | Verification failure = 31.41% of failures; explicit Verifier raises success 91%→98% | HB-2267 |
| 2026-03-30 | MIT ENCORE: Entropy-Guided Reward | High-entropy scoring dimensions are unreliable; weight by consistency | arXiv:2503.20995, HB-2255 |

## Tooling & Infrastructure

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-30 | Stripe MCP Server | MCP moves to production finance; validates MCP(data) vs Skill(orchestration) layering | HB-2253 |

### Skill Systems & Knowledge Management

| Date | Title | Key Insight | Detail |
|------|-------|-------------|--------|
| 2026-03-31 | D2Skill: Dynamic Dual-Granularity Skill Bank | Task+Step双粒度架构与OpenClaw SKILL.md+Error Log设计一致；效用驱动EMA更新提供剪枝算法 | [HB-2294](../amy-kimi/knowledge/insights.md) |
| 2026-03-31 | MonitorBench: CoT Monitorability | 模型能力与可监控性负相关；压力测试下监控性暴跌30%；Opus需更强验证 | [HB-2295](../amy-kimi/knowledge/insights.md) |

