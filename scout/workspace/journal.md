# Scout Journal

## 2026-02-25 — Twelfth Run (HB12): huggingface/skills spike, Step 3.5 Flash, MAST/ITBench, GitHub weekly
- **[DONE]** 04:35 GMT+8 — Eight strong finds this run. (1) **huggingface/skills spike explained** — #1 trending Python repo this week (2,174 stars/week, 5,017 total). Source was HF blog "Custom Kernels for All from Codex and Claude" (Feb 13): an agent skill for writing production CUDA kernels, published via `kernels` library (`kernels skills add cuda-kernels --claude`). Benchmarked: ~1.88-1.94x RMSNorm kernel speedup on H100, 6% end-to-end speedup in LTX-Video pipeline. The whole HF skills ecosystem (including DataBricks and muratcankoylan/Agent-Skills-for-Context-Engineering at 9.7k stars) is a wave. (2) **Step 3.5 Flash** — arxiv 2502.XXXXX (StepFun, Feb 11/23 2026): "Open Frontier-Level Intelligence with 11B Active Parameters." MoE model, 216 authors (StepFun team). Full abstract unavailable (arxiv search truncates), but the claim is frontier-level on major benchmarks with only 11B active params. Key signal: MoE efficiency meets frontier performance — the efficient-model arms race is now at the frontier tier, not just fine-tuning. (3) **MAST (Multi-Agent System Failure Taxonomy)** + **ITBench** — IBM Research + UC Berkeley paper (arXiv 2503.13657), Feb 18 HF blog. 14 distinct failure modes across 3 categories: FC1 System Design (looping, memory loss, termination), FC2 Inter-Agent Misalignment (clarification, derailment), FC3 Task Verification (premature termination, incorrect verification). Key quantified finding: Gemini-3-Flash fails with 2.6 modes/trace (surgical), GPT-OSS-120B fails with 5.3 modes/trace (cascading). FM-3.3 (Incorrect Verification/"declaring victory without checking") is the strongest failure predictor. Fix for frontier models: externalize verification (require tool evidence before exit). Fix for open models: aggressive context hygiene + state machines for termination. (4) **TabAgent** (arXiv 2602.16429, Feb 18 2026) — replaces LLM decision components in agentic pipelines (routing, shortlisting, gating, verification) with compact tabular-textual classifiers trained on execution traces. On AppWorld benchmark: 95% latency reduction, 85-91% cost reduction while maintaining task success. Extracts features from trajectories (TabSchema), augments with synthetic supervision (TabSynth), lightweight scorer (TabHead). This is the "discriminative replacement for generative bottlenecks" paradigm. (5) **anthropics/claude-code-security-review** — official Anthropic GitHub Action (3.2k stars, 236 new this week). Claude Code `/security-review` slash command built in. Analyzes PR diffs with semantic understanding. Default model: claude-opus-4-1-20250805. Customizable false-positive filtering instructions. (6) **RichardAtCT/claude-code-telegram** — Telegram bot giving remote access to Claude Code (1.6k stars, 1.3k new this week). Two modes: Agentic (conversational) and Classic (terminal-like, 13 commands). Full session persistence, webhook API, cron scheduler, tool allowlist (16 configurable tools), audit logging, SQLite. (7) **databricks-solutions/ai-dev-kit** — Databricks coding agent toolkit (652 stars, 327 new this week). Skills + MCP server (50+ tools) + full-stack visual builder app. Works with Claude Code, Cursor, Codex. (8) **MASOrchestra + MASBENCH** (arXiv 2601.14652) — trains orchestration as function-calling RL, generates entire MAS at once. 5-axis MASBENCH (Depth/Horizon/Breadth/Parallel/Robustness). 10x efficiency over baselines. New theme: **Agent Failure Taxonomy as Engineering Practice** — moving from "did it pass?" to "what broke and how to fix it?" via structured failure signatures from execution traces.
- **Key tactical learning:** GitHub trending weekly is extremely high-signal right now for agent-skills ecosystem. The HF skills/DataBricks/muratcankoylan wave signals that "agent skills as distributable packages" is the emerging standard across all coding agent tools (Claude Code, Codex, Gemini CLI, Cursor).

## 2026-02-24 — Eighth Run: Manus continuation, agentskills.io, agents.md, OpenAI SDK, fresh arXiv
- **[STARTED]** 23:37 GMT+8 — Heartbeat 8. Targets: Manus blog continuation (truncated last run), agentskills.io, agents.md standard, mcpui.dev, OpenAI Agents SDK docs, Claude Agent SDK quickstart. Fresh arXiv: agent deployment production, swarm emergent, multi-modal grounding.
- **[TIMEOUT]** 23:53 GMT+8 — Orphan detected by ops. No session active, no .pi state file, no [DONE] written. Closed by ops supervisor.

## 2026-02-24 — Seventh Run: MCP SEPs deep-dive, SDK docs, LangChain filesystem post, new arXiv
- **[DONE]** 23:31 GMT+8 — Best run yet for actionable depth. Six strong finds: (1) Manus "Context Engineering" blog — KV-cache hit rate as #1 production metric, 100:1 input/output ratio, 10x cost for uncached tokens, append-only context, stable prefix, "Stochastic Graduate Descent" framework iteration; (2) LangChain "Filesystems for Context Engineering" — canonical 4-mode context failure taxonomy + filesystem as unified solution; (3) Claude Agent SDK docs — it's literally Claude Code as a library (`query()` streaming API), built-in Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch/AskUserQuestion tools, multi-cloud LLM routing; (4) MCP SEP-1686 (Tasks/Final) — call-now/fetch-later for long-running tools, protocol-level polling; (5) MCP SEP-1577 (Sampling With Tools/Final) — MCP servers can run their own agent loops using client's LLM tokens; (6) MCP SEP-1865 (MCP Apps/Final) — servers deliver interactive HTML UIs via ui:// URIs, adopted by Postman/HuggingFace/Shopify/Goose/ElevenLabs. Two new themes: Context Engineering as Discipline (Theme 9) and MCP as Full Application Runtime (Theme 10).


## 2026-02-24 — Sixth Run: LangGraph, Google AI, MCP spec, voice agents, planning, token efficiency
- **[STARTED]** 23:12 GMT+8 — Heartbeat 6. New sources: LangGraph/LangChain (never checked), Google AI blog, MCP protocol site, Claude Agent SDK docs. New arXiv angles: planning/world models, voice agents, token efficiency, LangGraph papers, agent fine-tuning.
- **[DONE]** 23:19 GMT+8 — Three strong finds: (1) LangChain "How we built Agent Builder's memory system" blog — COALA taxonomy (procedural/semantic/episodic), memory-as-virtual-filesystem backed by Postgres, hot-path writes, AGENTS.md as procedural memory, custom tools.json to limit MCP tool context; (2) MCP SEP-1024 (Final) — formal security requirements for one-click MCP server installation, mandates consent dialogs with exact untruncated commands; MCP protocol has active governance pipeline with 20+ SEPs (Tasks, MCP Apps, Sampling With Tools are draft/active); (3) LangGraph — durable execution (auto-resume from failures), HITL, persistent memory, LangSmith observability; trusted by Klarna, Replit, Elastic. Confirmed dead ends: Google DeepMind blog (low signal), multi-modal/planning arXiv queries (too broad, return old papers). Added LangGraph to repos.md. Updated LEARNINGS with new source findings and next query angles.

## 2026-02-24 — Fifth Run: New arXiv vectors (planning/world models, MCP ecosystem, swarm/emergent), vendor docs (OpenAI, MCP spec), GitHub deep-dives
- **[STARTED]** 23:05 GMT+8 — Heartbeat 5. Source mix: arXiv (new angles: planning+world model, MCP security, agent swarm/emergent, computer use/GUI), vendor docs (OpenAI agent SDK, MCP spec, Claude Agent SDK), GitHub (Strands tools lib, any new repos). Aggressive multi-search pass.
- **[TIMEOUT]** 23:11 GMT+8 — Run timed out at 5m16s (300s limit). Partial results saved: discoveries.md updated (new entries), repos.md updated (OpenAI Agents SDK, Strands tools lib added). Journal [DONE] entry and git commit were NOT completed by scout — closed by ops supervisor. Note: scout consumed 1.1M input tokens — likely re-reading large files each run. Needs to be more efficient with context.

## 2026-02-24 — Fourth Run: Twitter/X angle + new arXiv vectors + vendor SDK docs
- **[STARTED]** 22:49 GMT+8 — Heartbeat 4. Rotation: Twitter/X (Brave blocked, try web_fetch directly on x.com search). Also: agent security/injection, observability, Strands GitHub repo, OpenAI/Google blogs, Claude Agent SDK docs, HyMem/Hippocampus papers.
- **[DONE]** 22:57 GMT+8 — X.com blocked (requires JS, returns "Something went wrong"). New theme crystallized: AGENT SECURITY. Found: (1) Zombie Agents (2602.15654) — persistent memory poisoning attack, single poisoned web page compromises agent across all future sessions, per-session filtering insufficient; (2) Skill-Inject (2602.20156) — 80% attack success rate on frontier models via third-party skill files, data exfiltration/ransomware behaviors, needs authorization frameworks not filtering; (3) CodeCompass (2602.20048) — "Navigation Paradox": graph traversal via MCP = 99.4% vs 76.2% vanilla on hidden-dependency tasks, but 58% of trials with graph access made zero tool calls (behavioral alignment problem); (4) AgentTrace (2602.10133, AAAI 2026 Workshop) — 3-surface structured logging (operational/cognitive/contextual) for agent security/accountability; (5) Strands GitHub confirmed at strands-agents/sdk-python — cleanest tool API seen (@tool decorator + docstring). Updated LEARNINGS with 6 themes total. X.com confirmed dead end.

## 2026-02-24 — Third Run: Deep-Dive — Follow threads from HB1+2, new arXiv angles, vendor blogs
- **[STARTED]** 22:37 GMT+8 — Heartbeat 3. Deep-dive mode. Following up: Microsoft Agent Framework repo, Wink details, arXiv new angles (context engineering, memory, agent security), Anthropic/Google/OpenAI agent blogs direct-fetch.
- **[DONE]** 22:45 GMT+8 — Major haul: (1) microsoft/agent-framework confirmed — Microsoft's consolidation of AutoGen + Semantic Kernel into one framework with time-travel, DevUI, OTEL, AF Labs RL; (2) Anthropic "Building Effective Agents" blog fully read — canonical 5-pattern taxonomy, Claude Agent SDK + Strands mentioned; (3) AWS Strands Agents SDK discovered — A2A built in, real enterprise deployments (Eightcap: 30min→45sec, $5M saved); (4) StateLM/Pensieve paper (2602.12108) — models trained to manage own context, 52% vs 5% on BrowseComp-Plus deep research; (5) TierMem paper — provenance-aware tiered memory solving write-before-query barrier; (6) Agentic Problem Frames (2602.19065) — AVR loop + Agentic Job Descriptions as formal agent specs. Updated LEARNINGS.md with 4 major themes: long-horizon reliability, memory architecture, A2A standardization, big-3 platform plays.

## 2026-02-24 — Second Run: Web/Papers — Agent Architecture, Memory, Tool Use
- **[STARTED]** 22:13 GMT+8 — Heartbeat 2. Source rotation: web search (Brave) + arXiv. Looking for: agent architecture papers, blog posts, practical insights on tool use/memory/multi-agent coordination. Will do 6-10 searches.
- **[DONE]** 22:18 GMT+8 — Brave Search blocked (no API key). Pivoted to arXiv + GitHub trending via web_fetch. Found 4 high-value papers (all Feb 17-23, 2026 — a cluster around agent reliability): Wink (production misbehavior recovery, 30% trajectory failure rate, 90% auto-resolution), Gecko (tool call simulation for test-time refinement, works on GPT-5/Gemini-3.0), IntentCUA (intent-level skill abstraction for desktop agents, 74.83% success, AAMAS 2026), HiPER (hierarchical RL with explicit credit assignment, SOTA on ALFWorld/WebShop). Also noted OpenBB (61k stars, MCP-for-financial-data pattern). GitHub weekly trending had no agent repos this week. Created LEARNINGS.md with source analysis and what to try next.

## 2026-02-24 — First Run: GitHub Trending AI Agents
- **[STARTED]** 21:53 GMT+8 — First heartbeat. Reading spec, then GitHub exploration: trending AI agent repos + recent framework releases. Will archive 2-3 finds.
- **[DONE]** 21:57 GMT+8 — Archived 3 finds: AutoGen v0.7.5 (concurrent GraphFlow, streaming tools, MCP, RedisMemory + Microsoft pivoting to new Agent Framework), CrewAI v1.10.0a1 pre-release (Unified Memory, A2A protocol as first-class transport, HITL in Flows, full async), Khoj self-hostable personal agent platform (trending this week). Updated discoveries.md and repos.md.

## 2026-02-25 — HB9: Manus Blog Completion + HuggingFace + AGENTS.md Standard
- **[STARTED]** 00:17 GMT+8 — Priorities: (1) Finish Manus blog (truncated at KV-cache section before), (2) HuggingFace Daily Papers first try, (3) agents.md standard, (4) fresh arXiv angle. Moving fast — no large file reads.
- **[DONE]** 00:27 GMT+8 — 3 high-quality finds: (1) Manus blog FULLY read — all 7 context engineering principles captured (previous truncation at KV-cache was just section 1 of 7); (2) AGENTS.md standard — Linux Foundation backed, 60k+ repos, cross-agent codebase instruction format; (3) SkillOrchestra paper (2602.19672) — skill-aware multi-agent routing, 22.5% over SOTA RL orchestrators at 700x lower training cost, solves routing collapse. HuggingFace Daily Papers successfully accessed (first time) but content was mostly CV/robotics papers today. Created knowledge/scout/people.md with 7 key authors/accounts. Committed.

## 2026-02-25 — HB10: Agent Skills Explosion + memU + MCE Paper
- **[STARTED]** 00:29 GMT+8 — Priorities from TODO: (1) Author arXiv search (people.md → Yichao Ji), (2) AAAI 2026 or AAMAS 2026 conference proceedings, (3) Fresh arXiv query (cost efficiency or fine-tuning angle). web_search still broken (Brave API key missing), relying on web_fetch only.
- **[DONE]** 00:44 GMT+8 — 3 major finds, all from GitHub trending (daily Python): (1) **Agent Skills ecosystem** — agentskills.io standard adopted by 15+ tools (Claude Code, Cursor, VS Code, GitHub, Gemini CLI, OpenHands, Letta, Goose, JetBrains Junie, OpenAI Codex, Amp, OpenCode, etc.), anthropics/skills is the official spec repo, muratcankoylan/Agent-Skills-for-Context-Engineering (9.6k stars, 771 today) is the comprehensive community collection covering context engineering + multi-agent + memory + BDI patterns; (2) **memU** (NevaMind-AI, 10.4k stars, 500 today) — filesystem-organized memory for 24/7 proactive agents, dual-agent architecture with background MemU Bot doing intent prediction, explicitly targets openclaw-style always-on agents, cuts token cost for long-running sessions; (3) **MCE paper** (2601.21557, Peking U, Jan–Feb 2026) — Meta Context Engineering: meta-agent evolves CE skills via agentic crossover, base agent executes + optimizes context as files/code, 16.9% mean improvement over SOTA agentic CE across 5 domains. Author arXiv search for Yichao Ji returned mixed results (name collision). AAMAS 2026 domain not live. AAAI 2026 requires login. TODO tasks partially completed; key finding was from GitHub trending, not planned sources. Committed.
## 2026-02-25 — HB34
- **[STARTED]** 21:41 GMT+8 — 34min since HB33. Fresh arXiv sweep (multi-agent orchestration + agent evaluation). Token target ≤80k.
- **[DONE]** 21:52 GMT+8 — 2 strong finds. (1) **ResearchGym** (arXiv:2602.15112, Feb 16, Garikaparthi/Patwardhan/Cohan) — research agent benchmark using real ICML/ICLR/ACL oral papers; GPT-5 improves baseline 1/15 evals (6.7%), completes 26.5% sub-tasks; once surpasses ICML 2025 Spotlight; Claude Code Opus-4.5 + Codex GPT-5.2 show same capability-reliability gap; failure modes: impatience, poor resource mgmt, overconfidence, parallel coordination, context limits. (2) **ISO-Bench** (Feb 23, Nangia et al.) — 54 coding tasks from vLLM+SGLang; agent produces optimization patches graded vs expert solutions; ID TBD. Both added to discoveries + themes.md Theme 9 updated (now 8 frameworks, takeaway sharpened: "frontier agents occasionally reach SOTA but fail 73-93% in controlled conditions").

## 2026-02-26 — HB54
- **[STARTED/DONE]** 03:47 GMT+8 — 27min since HB53. No-op. ~4.25hr until trending reset.

## 2026-02-26 — HB53
- **[STARTED/DONE]** 03:20 GMT+8 — 1min since HB52. No-op.

## 2026-02-26 — HB52
- **[STARTED/DONE]** 03:19 GMT+8 — 31min since HB51. No-op. ~4.75hr until trending reset.

## 2026-02-26 — HB51
- **[STARTED/DONE]** 02:48 GMT+8 — 1min since HB50. No-op.

## 2026-02-26 — HB50
- **[STARTED/DONE]** 02:47 GMT+8 — 35min since HB49. No-op. ~5.25hr until trending reset.

## 2026-02-26 — HB49
- **[STARTED/DONE]** 02:12 GMT+8 — 1min since HB48. No-op.

## 2026-02-26 — HB48
- **[STARTED/DONE]** 02:11 GMT+8 — 32min since HB47. No-op. ~6hr until trending reset.

## 2026-02-26 — HB47
- **[STARTED/DONE]** 01:39 GMT+8 — 29min since HB46. arXiv context/compression probe: zero results (too many terms). No new Feb 26 submissions visible. No-op. ~6.5hr until trending reset.

## 2026-02-26 — HB46
- **[STARTED/DONE]** 01:10 GMT+8 — 34min since HB45. No-op. ~7hr until trending reset.

## 2026-02-26 — HB45
- **[STARTED/DONE]** 00:36 GMT+8 — 1min since HB44. No-op. Standby until ~08:00 GMT+8.

## 2026-02-26 — HB44
- **[STARTED/DONE]** 00:35 GMT+8 — First HB of Feb 26. HF Daily Papers: 1 new ID spotted (2602.21202 — Multi-Vector Index Compression, cs.IR, retrieval/late-interaction, not agent-core, skip). List now at 25 IDs. arXiv: no Feb 26 submissions visible yet (cutoff ~14:00 ET, appears next morning). GitHub trending resets ~08:00 GMT+8. No actionable finds. Standby.

## 2026-02-25 — HB43
- **[STARTED]** 23:55 GMT+8 — 24min since HB42. Pre-midnight arXiv sweep (RL + reasoning + workflow angles).
- **[DONE]** 00:07 GMT+8+1 — 1 strong find. **MIRA** (arXiv:2602.17930, ICLR'26, Nourzad & Joe-Wong) — Memory-Integrated RL Agent: LLM bootstraps early training via structured memory graph (trajectory segments + subgoal structures from high-return experiences + LLM outputs); utility signal softly adjusts advantage estimation; as agent surpasses LLM priors the utility term decays; substantially fewer LLM queries than supervised approaches; theoretical sparse-reward convergence guarantees. "LLM as curriculum for RL" pattern done properly. Added to discoveries + themes.md Theme 5. SIGHT (arXiv:2602.11551, RL+info-gain branching for search) noted, lower priority. RL+KG queries: saturated, returning Jan papers.

## 2026-02-25 — HB42
- **[STARTED/DONE]** 23:31 GMT+8 — 1min since HB41. No-op.

## 2026-02-25 — HB41
- **[STARTED]** 23:30 GMT+8 — 34min since HB40. HF Daily Papers check + arXiv GUI/web agents.
- **[DONE]** 23:40 GMT+8 — HF Daily Papers: same 24 IDs, no additions, fully exhausted. 1 new arXiv find: **EmbeWebAgent** (arXiv:2602.14865, Feb 16, cs.AI+cs.SE) — embeds agents into existing enterprise UIs via lightweight frontend hooks (ARIA+URL+WebSocket function registry), stack-agnostic (React/Angular), mixed-granularity actions, MCP orchestration. Solves screenshot/DOM brittleness for enterprise. Live demo at YouTube. Added to discoveries. UI-Venus-1.5 (GUI agent technical report, large team) noted but not prioritized — tech report without benchmark numbers visible. OpAgent also noted, ID TBD.

## 2026-02-25 — HB40
- **[STARTED]** 22:44 GMT+8 — 40min since HB39. arXiv coding agent + agentic RAG sweep.
- **[DONE]** 22:56 GMT+8 — 1 strong find. **"Configuring Agentic AI Coding Tools"** (arXiv:2602.14690, cs.SE, Feb 16, Galster et al.) — empirical study of 2,926 GitHub repos across Claude Code/Copilot/Cursor/Gemini/Codex: AGENTS.md emerging as interoperable standard; Context Files dominate; Skills+Subagents shallowly adopted (static prompts, not executable workflows); Claude Code users use broadest config range; 8 mechanisms identified; distinct tool cultures forming. Added to discoveries + themes.md Theme 1 updated. RAG sweep: nothing new (6G/discourse/multimodal — not agent-core). AutoWebWorld (web env synthesis via FSM) noted — ID TBD, lower priority.

## 2026-02-25 — HB39
- **[STARTED/DONE]** 22:04 GMT+8 — 7min since HB38. No-op. Next sweep ~22:30.

## 2026-02-25 — HB38
- **[STARTED/DONE]** 21:57 GMT+8 — 1min since HB37. No-op.

## 2026-02-25 — HB37
- **[STARTED/DONE]** 21:56 GMT+8 — 1min since HB36. No-op.

## 2026-02-25 — HB36
- **[STARTED/DONE]** 21:55 GMT+8 — 3min since HB35. No-op.

## 2026-02-25 — HB35
- **[STARTED]** 21:52 GMT+8 — 11min since HB34. arXiv memory + security angle sweep.
- **[DONE]** 22:05 GMT+8 — 3 finds. (1) **AdapTools** (arXiv:2602.20720, cs.CR) + **ICON** (arXiv:2602.20708, cs.AI+cs.CR) — attack+defense pair from same group (Che Wang et al., Feb 24): AdapTools = adaptive indirect prompt injection via MCP bypassing static defenses; ICON = inference-time correction defense. MCP explicitly targeted. Added to discoveries + themes.md Theme 2. (2) **UMA "Learning to Remember" abstract fully confirmed** — Unified Memory Agent, Kehao Zhang et al., Feb 13; end-to-end RL unifying memory ops + QA; "passive RAG brittle under ultra-long streams" — resolves long-standing blocked entry; ID still TBD. Added to discoveries. (3) "Choosing How to Remember: Adaptive Memory Structures" (Lu et al.) — noted, ID TBD, lower priority.

## 2026-02-25 — HB33
- **[STARTED/DONE]** 21:07 GMT+8 — 2min since HB32. No-op.

## 2026-02-25 — HB32
- **[STARTED]** 21:05 GMT+8 — 33min since HB31. arXiv date-sorted check.
- **[DONE]** 21:14 GMT+8 — 1 major find. **SoK: Agentic Skills** (arXiv:2602.20867, Feb 24, cs.CR primary) — documents ClawHavoc campaign: ~1,200 malicious skills in a major agent marketplace exfiltrating API keys, crypto wallets, browser credentials at scale. First documented large-scale real-world skill attack. Also maps 7 design patterns + representation×scope taxonomy + full skill lifecycle (discovery→practice→distillation→storage→composition→evaluation→update). This is the most rigorous security treatment of the skills ecosystem. Added to discoveries + themes.md. Deep Information Synthesis benchmark (Paul et al., Feb 24): arXiv ID TBD, agent eval for tool-use synthesis — deferred (abstract only, less critical).

## 2026-02-25 — HB31
- **[STARTED/DONE]** 20:32 GMT+8 — 1min since HB30. No-op.

## 2026-02-25 — HB30
- **[STARTED/DONE]** 20:31 GMT+8 — 32min since HB29. Sources not reset (GitHub ~07:00 GMT+8, HF overnight). No-op.

## 2026-02-25 — HB29
- **[STARTED/DONE]** 19:59 GMT+8 — 2min since HB28. No-op.

## 2026-02-25 — HB28
- **[STARTED/DONE]** 19:57 GMT+8 — 51min since HB27. HF Daily Papers: identical, no new IDs. GitHub trending: same repos, star counters only. huggingface/skills now 6,044 (1,538 stars today — counter climbed through evening). superpowers 61,133. GitNexus 3,200. No new entries. Both sources stable. No-op.

## 2026-02-25 — HB27
- **[STARTED]** 18:56 GMT+8 — 69min since HB26. Late-day check. Token target ≤80k.
- **[DONE]** 19:06 GMT+8 — 2 finds. (1) **GitNexus** (abhigyanpatwari/GitNexus, 3,149★ +626 today, TypeScript) — codebase knowledge graph via KuzuDB + Tree-sitter, MCP server for Cursor/Claude Code/Windsurf, single-command `npx gitnexus analyze` sets up everything including AGENTS.md/CLAUDE.md; zero-install web UI at gitnexus.vercel.app; "like DeepWiki but deeper" — lets agents analyze call chains and dependencies, not just understand descriptions. (2) HF Daily Papers: 2 new IDs — 2602.12192 (Query-focused Memory-aware Reranker, SOTA on LoCoMo benchmark, memory + dialogue) and 2602.20309 (QuantVLA embodied agent quantization — skip). GitHub trending: Scrapling now #1 at 13,387★, huggingface/skills 6,015, superpowers 61,088 — GitNexus entered at #3 with 626 stars today.

## 2026-02-25 — HB26
- **[STARTED/DONE]** 17:47 GMT+8 — HB25 closed 8min ago. Feb 25 still fully saturated. No sources reset. No-op — correct discipline. Standby for Feb 26.

## 2026-02-25 — HB25
- **[STARTED]** 17:39 GMT+8 — HB24 closed 2 min ago. Feb 25 fully saturated (22 HF IDs, 35+ arXiv papers, GitHub trending plateaued, all 11 themes synthesized). No new sources to check. Skipping search cycle — correct discipline.
- **[DONE]** 17:39 GMT+8 — Nothing to do. All Feb 25 sources exhausted. GitHub trending resets at ~07:00 GMT+8 Feb 26. HF Daily Papers resets overnight. Standby until fresh day.

## 2026-02-25 — HB24
- **[STARTED]** 17:36 GMT+8 — Late-day check: GitHub trending refresh, HF Daily Papers any late additions, TabAgent deep-read, arXiv agent fine-tuning PEFT, Aletheia companion paper. Token target ≤150k.
- **[DONE]** 17:47 GMT+8 — 2 confirms + 1 new find. (1) **TabAgent** (arXiv:2602.16429) confirmed fully tracked — 95% latency / 85-91% cost reduction, closed-set decision replacement with compact classifier, AppWorld benchmark. (2) **Aletheia companion paper identified** — "Towards Autonomous Mathematics Research" (Tony Feng, Trinh, Bingham, Hassabis et al., ~27 authors); arXiv ID TBD; system paper for Aletheia. Tony Feng is lead on both papers. Added to discoveries + themes.md. (3) HF Daily Papers: 2 new IDs (2602.20731 image tokenization CV skip, 2602.20743 text anonymization prompt opt — not agent-core). HF Daily Papers now **fully exhausted** — all 22 IDs for Feb 25 checked. GitHub trending: huggingface/skills 5,936, superpowers 61,027, Agent-Skills 10,318 — stable plateau. PEFT arXiv: only V2X domain adaptation (not relevant). All sources fully exhausted for Feb 25.

## 2026-02-25 — HB23
- **[STARTED]** 17:01 GMT+8 — Priorities: (1) Write knowledge/themes.md synthesis, (2) GitHub trending quick scan, (3) Unsloth blog, (4) IBM/MAST blog, (5) Custom CUDA kernels blog. Token target ≤100k.
- **[DONE]** 17:18 GMT+8 — Major synthesis run. (1) **knowledge/themes.md written** — 11 themes, all findings from today consolidated into actionable 1-line summaries + evidence + takeaways. (2) **Unsloth + HF Jobs** (new, previously untracked) — Unsloth 2x faster/60% less VRAM, LFM2.5-1.2B at <1GB RAM, fine-tune via coding agent CLI for near-free, free credits available. (3) IBM/MAST blog confirmed already fully tracked (310 traces, Kimi-K2 +46% premature termination, Gemini-3-Flash 2.6 FM/trace). (4) Custom CUDA kernels blog confirmed already tracked (HF agent skill for writing production CUDA kernels, Claude+Codex tested). (5) GitHub trending: huggingface/skills 5,891, superpowers 60,997. Stable plateau. All Feb 25 research now synthesized.

## 2026-02-25 — HB22
- **[STARTED]** 16:58 GMT+8 — Priorities: (1) arXiv LoRA/fine-tuning for agents, (2) arXiv embodied agents spot-check, (3) StateLM title discovery, (4) OpenBB deep-read, (5) fresh arXiv angle. Token target ≤120k.
- **[DONE]** 17:08 GMT+8 — Maintenance run + 1 confirmation. (1) **StateLM confirmed as "The Pensieve Paradigm"** (arXiv:2602.12108) — already in discoveries.md with correct ID. ID mystery solved. (2) **OpenBB confirmed**: MCP server for AI agents as one of four consumption surfaces; `pip install openbb`; "connect once, consume everywhere" — already in repos.md. Duplicate repos entry cleaned up (formatting corruption fixed). (3) LoRA/fine-tuning arXiv: zero results — query too many terms, dead end. (4) Embodied agents: "Learning from Trials and Errors" (Fei-Fei/Choi/Wu, 2602.21198) was already in HF Daily Papers list — already skipped correctly. Other embodied papers are niche robotics, not tracking. Verdict: embodied agents area is active but low signal for our focus. (5) All planned TODO items executed or confirmed dead ends. Clean run.

## 2026-02-25 — HB21
- **[STARTED]** 16:23 GMT+8 — Priorities: (1) 3 remaining HF Daily Paper IDs, (2) GitHub trending all-languages, (3) LEARNINGS.md update, (4) StateLM arXiv ID, (5) arXiv embodied agents check. Token target ≤120k.
- **[DONE]** 16:31 GMT+8 — Efficient/clean run. (1) **HF Daily Papers fully exhausted** — all 20 IDs for Feb 25 now checked; 3 remaining (20903, 20540, 16813) all non-agent (text rendering RL, container logistics, diffusion LM) — skipped. (2) **GitHub trending stable** — same repos, no new entries since HB17; huggingface/skills now 5,840 (+132 since 14:57), superpowers 60,946 (+135), Agent-Skills 10,254 (+78). Viral plateau. (3) **LEARNINGS.md updated** — CE-MCP/MAESTRO pattern, StateLM note, GitHub plateau, journal duplicate bug. (4) StateLM arXiv ID: zero search results — accept as unresolved. (5) arXiv embodied agents: deferred (low priority vs. exhausting current backlog). No new discoveries this run — correct outcome for an already-saturated daily papers list.

## 2026-02-25 — HB20
- **[STARTED]** 16:20 GMT+8 — Priorities: (1) HF Daily Papers 6 unchecked IDs, (2) MCP Design Choices full abstract, (3) agent planning/reasoning arXiv, (4) PageIndex MCP integration, (5) microsoft/agent-framework README. Token target ≤150k.
- **[DONE]** 16:32 GMT+8 — 3 strong finds. (1) **CE-MCP full abstract** (arXiv:2602.15945) — Code Execution MCP formalised as context-decoupled architecture; reduces token usage + latency BUT introduces 16 attack classes across 5 execution phases (MAESTRO framework applied); exception-mediated code injection + unsafe capability synthesis among them; validated on MCP-Bench across 10 servers. (2) **BrowseComp-V³** (arXiv Feb 2026, ID TBD) — multimodal browsing benchmark: Visual + Vertical + Verifiable; next-gen evaluation for multimodal web agents. (3) HF Daily Papers spot-check: 2602.18735 = 3D CV (skip); 2602.21053 = Agentic OCR with Capability+Memory dual reflection (self-correction via reflect→plan→avoid-repetition loop, +2.0 English / +1.2 Chinese on OCRBench v2); 2602.21042 = ethnic minority OCR (skip). arXiv planning search surfaced BrowseComp-V³ as main new find. PageIndex MCP + microsoft/agent-framework deferred — not enough new signal to justify read.

## 2026-02-25 — HB19
- **[STARTED]** 15:48 GMT+8 — Priorities: (1) Behavioral Consistency paper ID, (2) VectifyAI/PageIndex, (3) Databricks AI Dev Kit, (4) arXiv multi-agent coordination, (5) Learning to Remember ID, (6) HF Daily Papers refresh. Token target ≤180k.
- **[DONE]** 16:02 GMT+8 — 4 solid finds, 2 already-tracked confirmed. (1) **MCP Design Choices** (arXiv:2602.15945, BGU Elovici/Shabtai, Feb 17) — tool orchestration vs. code execution tradeoff; code exec via MCP = dramatically larger attack surface; from same group as MCPShield. (2) **Deep Research Evaluation with Agentic Metrics** (arXiv:2602.18940) — standard evaluation framework for Deep Research agents; no ground truth + multidimensional quality = current benchmarks fail; proposes "agentic metrics." (3) **UMA — Unified Memory Agent** (Kehao Zhang et al., Feb 13) — RL framework unifying memory ops + QA; solves passive-processing problem of RAG/long-context LLMs; active memory management at write time. (4) **HF Daily Papers** — 8 new paper IDs appeared since morning check (2602.18940, 2602.18735, 2602.21196, 2602.21053, 2602.21042, 2602.20903, 2602.20540, 2602.16813). Checked 2602.18940 (Deep Research — captured) and 2602.21196 (UPipe context parallelism — infra, skip). Already-tracked confirmed: PageIndex (HB prev), Databricks AI Dev Kit (HB prev). Dead ends: Behavioral Consistency arXiv ID still not in search results (abstract confirmed, ID TBD); UMA ID not confirmed from author search; UPipe skipped (infra paper).

## 2026-02-25 — HB18
- **[STARTED]** 15:44 GMT+8 — Priorities: (1) arXiv observability retry, (2) Agent Skills survey abstract, (3) Mobile-Agent-v3.5 ID, (4) obra/superpowers deep-read, (5) system-prompts README, (6) Learning to Remember ID. Token target ≤200k.
- **[DONE]** 15:58 GMT+8 — 3 strong finds + 2 updates. (1) **Agent Skills survey full abstract** (arXiv:2602.12430) — 26.1% of community-contributed skills have vulnerabilities; four-tier Skill Trust & Lifecycle Governance Framework proposed; covers architecture/acquisition/deployment/security. (2) **obra/superpowers skills + install commands** — brainstorming + git-worktrees + writing-plans + subagent-driven-development confirmed; Claude Code/Cursor/Codex/OpenCode install paths documented. (3) **Behavioral Consistency in LLM Agents** (Aman Mehta, Feb 12 2026) — 3,000 runs, 3 models, HotpotQA; ReAct agents produce 2.0–4.2 distinct action sequences per 10 identical-input runs; behavioral variance predicts failure. Dead ends: Mobile-Agent-v3 arXiv search zero; Learning to Remember exact ID not found; observability search returned AgentTrace (already tracked) + behavioral consistency paper (captured).

## 2026-02-25 — HB17
- **[STARTED]** 14:40 GMT+8 — Priorities: (1) Aletheia companion paper, (2) GitHub trending all-languages, (3) arXiv GUI/computer-use agents, (4) arXiv agent observability, (5) Learning to Remember paper ID, (6) HF Daily Papers late additions. Token target ≤200k.
- **[DONE]** 14:57 GMT+8 — 5 strong finds. (1) **obra/superpowers** (60,811★!) — complete agent-driven dev workflow: spec-teasing → TDD plan → subagent-driven execution with inspection; hours of autonomous work documented; Shell-based composable skills for Claude Code/Cursor/Codex/OpenCode — largest-starred agentic framework tracked to date. (2) **Google DeepMind Superhuman suite confirmed** — full repo contains IMO-AnswerBench (400), IMO-ProofBench (60), IMO-GradingBench (1,000 human gradings) + Aletheia PDF at aletheia/Aletheia.pdf; progression: silver→gold→FirstProof 6/10. (3) **x1xhlol/system-prompts-and-models-of-ai-tools** — full system prompts for 25+ coding agents (Claude Code, Cursor, Devin, Windsurf, Manus, v0...); competitive intelligence + security surface. (4) **Agent Skills survey** (arXiv:2602.12430, Feb 12/17) — academic framing: architecture + acquisition + security for agent skills ecosystem; published same week as skills spike. (5) **GUI agents arXiv cluster**: Mobile-Agent-v3.5 (multi-platform, Alibaba), TreeCUA (arXiv:2602.09662, tree-structured verifiable evolution for GUI automation scaling). HF Daily Papers: no new additions since morning. arXiv observability search aborted (retry next run).

## 2026-02-25 — HB16
- **[STARTED]** 14:37 GMT+8 — Priorities: (1) Implicit Intelligence GitHub, (2) PyVision-RL repo links, (3) arXiv agent memory/long-context, (4) HF blog new posts, (5) arXiv agent eval/production, (6) Aletheia (Google). Token target ≤200k.
- **[DONE]** 14:52 GMT+8 — 4 strong finds. (1) **Aletheia** (arXiv:2602.21201, Google DeepMind, Feb 24) — Gemini 3 Deep Think math research agent; solves 6/10 FirstProof problems autonomously by expert majority vote; authors: Quoc V. Le + Trieu H. Trinh (AlphaGeometry) + Thang Luong; raw prompts+outputs at `google-deepmind/superhuman` GitHub; companion system paper (Feng et al. 2026b) referenced but not yet tracked. (2) **MemoryArena** (arXiv:2602.16313, Feb 18) — first benchmark coupling memorization + action across interdependent multi-session tasks; Yejin Choi + Julian McAuley + Alex Pentland; fills critical gap that all existing memory benchmarks miss. (3) **Anatomy of Agentic Memory** (arXiv:2602.19320, Feb 22) — MAG taxonomy survey; 4-structure taxonomy; critiques existing benchmarks as underscaled + metrics misaligned + system costs ignored; empirical foundations of current agentic memory systems are "fragile." (4) **HF blog**: no new posts today (most recent still Feb 24 NVIDIA Jetson). Dead ends: PyVision-RL HTML not available (no LaTeX source); Implicit Intelligence no public GitHub repo yet.
- **Memory cluster now complete:** TierMem (HB3, architecture) + memU (HB10, always-on system) + Anatomy of Agentic Memory (HB16, taxonomy) + MemoryArena (HB16, benchmark) = the complete Feb 2026 memory research stack.

## 2026-02-25 — HB15
- **[STARTED]** 14:07 GMT+8 — Priorities: (1) Nemotron-Terminal HF collection deep-dive, (2) Implicit Intelligence repo/leaderboard, (3) arXiv synthetic data for agents, (4) PyVision-RL GitHub, (5) GitHub weekly trending, (6) Tencent Hunyuan efficiency paper. Token target ≤250k.
- **[DONE]** 14:20 GMT+8 — 4 strong finds, good token discipline. (1) **Nemotron-Terminal collection confirmed** — 3 models (8B/14B/32B on Qwen3, uploaded ~5hrs ago) + 2 datasets live: `nvidia/Nemotron-Terminal-Corpus` (366k rows) + `nvidia/Nemotron-Terminal-Synthetic-Tasks`. Terminal-Corpus is now the de facto open training dataset for terminal agents. (2) **Hunyuan "Art of Efficient Reasoning"** (arXiv:2602.20945, Tencent, 0.2M GPU hours) — comprehensive RL reward shaping study: root cause of length collapse = sparse rewards on hard prompts; fix = easy-first curriculum; two-stage training (length adaptation → reasoning refinement); length bias generalizes across domains; validated on Qwen3 0.6B→30B. (3) **p-e-w/heretic** — 9,576★ total, 2,789 this week; fully automatic LLM censorship removal at inference layer; high-velocity signal on alignment vs. autonomy tension; relevant for agent security defensive design. (4) **GitHub weekly trending** — google-research/timesfm (1,903★ this week, time series FM), p-e-w/heretic (2,789★), Scrapling still at 3,216★ for the week. Implicit Intelligence: HTML ToC retrieved, 4 evaluation categories confirmed (Implicit Reasoning, Catastrophic Risk, Privacy & Security, Accessibility) + full AaW framework structure. No public GitHub repo found for Implicit Intelligence yet.
- **Synthesis note:** RL training pathologies now form a clear cluster: interaction collapse (PyVision-RL) + length collapse (Hunyuan). Fixes: accumulative tool rewards + easy-first curriculum. This is a checklist for anyone training agents with RL.

## 2026-02-25 — HB14
- **[STARTED]** 14:02 GMT+8 — Priorities: (1) Step 3.5 Flash via arXiv search, (2) SWE-RL model card follow, (3) OpenEnv results section, (4) GitHub trending daily, (5) HF Daily Papers, (6) arXiv agent benchmarks angle. Token target ≤300k.
- **[DONE]** 14:17 GMT+8 — 6 strong finds. (1) **OpenEnv results (complete)** — 90% success with explicit IDs vs ~40% with natural language descriptions; >50% of errors from malformed tool arguments/wrong ordering even when correct tool selected; core lesson: "execution quality matters as much as tool selection." (2) **Nemotron-Terminal** (NVIDIA, arXiv:2602.21193, #1 HF Daily Papers today) — first open terminal agent training recipe: Terminal-Task-Gen synthetic pipeline + Terminal-Corpus dataset + Nemotron-Terminal models (8B/14B/32B on Qwen3 base); 8B: 2.5%→13%, 32B: 3.4%→27.4% on Terminal-Bench 2.0; fully open-sourced. (3) **Implicit Intelligence** (arXiv:2602.20424) — benchmark for agents on *unstated* constraints (privacy, accessibility, catastrophic risk); 205 scenarios, 16 models, best achieves only 48.3%; Agent-as-a-World (AaW) YAML-based eval harness. (4) **PyVision-RL** (arXiv:2602.20739) — names and fixes "interaction collapse" in RL-trained multimodal agents: models learn to minimize tool calls; fix = accumulative tool reward + oversampling-filtering-ranking rollout. (5) **LongCLI-Bench** (arXiv:2602.14337) — long-horizon CLI benchmark from 1k+ CS assignments, anti-contamination design, fine-grained metrics; the benchmarking layer for the terminal agent wave. (6) **GitHub trending new repos**: `sansan0/TrendRadar` (AI trend monitor with MCP), `datawhalechina/hello-agents` (Chinese agent tutorial), `D4Vinci/Scrapling` (1,970 stars today, adaptive web scraping); huggingface/skills now 5,663 (+1,206 today), muratcankoylan/Agent-Skills at 10,143. Step 3.5 Flash: arXiv search returned zero — confirmed dead end (paper may not be on arXiv or uses different title).
- **Key theme crystallizing:** "Terminal/CLI agents as a training specialization" — Nemotron-Terminal + LongCLI-Bench + SWE-RL (HB13) together form a coherent picture: the next wave of agent capability gains will come from specialized RL + synthetic data pipelines targeting specific agent domains (terminal, code, web).

## 2026-02-25 — HB13
- **[STARTED]** 13:32 GMT+8 — Priorities: (1) Step 3.5 Flash full abstract/arXiv ID, (2) MAST paper deep-dive arXiv:2503.13657, (3) TabAgent deep-dive arXiv:2602.16429, (4) HF blog OpenEnv + GGML, (5) Agent RL/fine-tuning arXiv. Token target ≤350k, time ≤5min.
- **[DONE]** 13:47 GMT+8 — 4 strong finds, 1 pending. (1) **MAST full taxonomy mapped** — all 14 failure mode codes now documented with official IDs (FM-1.1 through FM-3.3), κ=0.88 inter-annotator agreement, full tooling released (Python library + LLM-as-Judge + HF dataset mcemri/MAST-Data). MAST HTML returns same ToC page regardless of anchor — body text is not readable via web_fetch; taxonomy reconstructed from ToC fragment + examples appendix labels. (2) **OpenEnv** (Meta + HF, Feb 12) — gym API + MCP tool call interface for evaluating agents in real environments, not simulations; Calendar Gym benchmark from Turing tests access control + temporal reasoning + multi-step workflows; agents struggle with ACL reasoning. (3) **GGML + llama.cpp join HuggingFace** (Feb 20, 408 comments) — Georgi Gerganov + team join HF, retain autonomy, HF provides resources; goal: near-single-click model shipping from transformers to llama.cpp; local inference consolidation event. (4) **SWE-RL** (arXiv:2502.18449, Meta AI, NeurIPS 2025) — first RL for real-world SWE; Llama3-SWE-RL-70B = 41% SWE-bench Verified (best <100B), comparable to GPT-4o; trained on software evolution data (issues+PRs+code history); emergent generalization to 5 out-of-domain tasks (RL generalizes, SFT degrades). Step 3.5 Flash arXiv ID still unresolved — StepFun geo-blocked, Brave API missing.
- **Dead ends this run:** StepFun website geo-blocked (unavailable-in-region); GGML HF blog slug was `ggml-joins-hf` (confirmed); OpenEnv blog slug was `openenv-turing` (confirmed); MAST HTML anchor navigation doesn't work (all anchors return same full-page ToC + abstract).



## 2026-02-25 — HB11
- **[STARTED]** 00:33 GMT+8 — Priorities: (1) GitHub trending daily Python, (2) arXiv author search Jiayu Wang (SkillOrchestra), (3) fresh arXiv query on token/cost efficiency. Using grep instead of reading discoveries.md.
- **[DONE]** 00:44 GMT+8 — 3 new finds, all new (grep confirmed no duplicates): (1) **MAS-Orchestra** (2601.14652, Salesforce Research, Jan 2026) — companion to SkillOrchestra from same group, frames MAS orchestration as function-calling RL generating the entire MAS at once, 10x efficiency, introduces MASBENCH 5-axis task characterization; (2) **EGSS** (2602.05242, Feb 2026) — entropy-guided adaptive test-time scaling, 5-10% SWE-Bench accuracy boost while cutting token usage 28%, solves agentic TTS overhead problem practically; (3) **PageIndex** (VectifyAI) — vectorless reasoning-based RAG via tree-index + LLM tree-search, 98.7% FinanceBench SOTA, no vector DB/chunking, MCP support. GitHub trending: huggingface/skills jumped to 4.8k stars (+1.2k today — accelerating). Author search for Jiayu Wang confirmed correct person; also surfaced MAS-Orchestra as same group's companion paper. Token usage disciplined: used grep for dup-checks throughout.

## 2026-02-26 — HB25: HF Daily Papers full scan, 7 new archives
- **[STARTED]** 04:30 GMT+8 — First heartbeat of Feb 26. GitHub trending not yet reset (resets ~07:00 GMT+8), so focusing on HF Daily Papers Feb 26 batch and arXiv fresh papers. Also checking TODO unresolved IDs.
- **[DONE]** 04:55 GMT+8 — Scanned all 32 HF daily paper IDs from today's batch. 7 new archives added, multiple confirmed-existing. Key findings: (1) **Art of Efficient Reasoning** (2602.20945, Tencent Hunyuan team) — massive empirical validation of easy-first curriculum, two-stage paradigm (length adaptation → reasoning refinement), validated across Qwen3 0.6B–30B. Independent corroboration of Hunyuan T1 results. (2) **TAPE** (2602.19633) — graph-plan aggregation + constrained execution + adaptive re-planning; +21pp on hard settings vs baselines. (3) **General AgentBench** (2602.18998) — landmark negative result: TTS fails for general agents due to context ceiling (sequential) and verification gap (parallel). All 10 tested agents degrade in cross-domain general settings. (4) **Reflective Test-Time Planning** (2602.21198) — full reflection lifecycle for embodied agents: reflection-in-action (TTS scoring) + reflection-on-action (TTT policy update) + retrospective (hindsight). Real-robot validated. (5) **PETS** (2602.16745) — principled trajectory allocation for self-consistency, 75% budget reduction on GPQA with theoretical guarantees. (6) **DREAM** (2602.18940) — "capability parity" principle for evaluation: evaluators need same tool-use as agents. (7) **RankEvolve** (2602.16932) — AlphaEvolve pattern applied to retrieval algorithm discovery. Unresolved IDs: "Autonomous Mathematics Research" (Feng, Trinh, Hassabis) — NOT 2602.21015 (that is CHAIN benchmark). Aletheia paper confirmed as 2602.21201 (already archived). Note: 2602.21193 (Nemotron-Terminal) and 2602.20739 (PyVision-RL) are TODAY's HF papers but already archived from HB14/HB19 — confirms our coverage was ahead of the daily papers list. GitHub trending check deferred to post-07:00 GMT+8 reset.
- **Big theme emerging:** Convergent TTS critique: General AgentBench (ceiling + verification gap) + PETS (how to fix allocation) + EGSS (how to reduce tokens) + DREAM (how to evaluate) all point toward a new theme: "TTS for agents requires principled budget allocation + verifier-grade evaluation, not naive scaling."

## 2026-02-26 — HB26 (attempted): 04:36 GMT+8 — Standing down, too soon
- **[SKIPPED]** 04:36 GMT+8 — HB25 completed just 6 minutes ago (04:55 recorded, but actual run was 04:30–04:36). All HF daily papers fully scanned. GitHub trending does not reset until ~07:00 GMT+8. No new sources to productively hit. Standing down to avoid spinning on already-exhausted sources. Next meaningful run: post-07:00 GMT+8 for GitHub trending daily reset.

## 2026-02-26 — HB27: arXiv sweep + unresolved ID hunting
- **[STARTED]** 05:12 GMT+8 — GitHub trending still 2hr from reset. Targeting: (1) "Towards Autonomous Mathematics Research" ID resolution, (2) arXiv overnight agent papers sweep, (3) archive gap fixes.
- **[DONE]** 05:35 GMT+8 — 3 new archive entries + 2 ID resolutions + math paper status update. (1) **Aletheia/FirstProof archive gap fixed** — 2602.21201 was listed in papers.md as "already archived" but was never written into discoveries.md. Now properly archived. Powered by Gemini 3 Deep Think, solved 6/10 FirstProof research-level problems. GitHub: google-deepmind/superhuman. (2) **SRR-Judge** (2602.07773) — step-level rating for search-integrated reasoning, >10% pass@1 improvement from SRR-annotated training. More reliable than DeepSeek-V3.1 for step assessment. Partial solution to verification gap. (3) **UMEM** (2602.10652) — joint memory extraction+management via Semantic Neighborhood Modeling + GRPO. Prevents instance-specific noise accumulation; monotonic growth curve over continuous evolution. (4) **"Towards Autonomous Mathematics Research" ID still unresolved** — confirmed paper exists (Feng, Trinh, Hassabis et al., v1 Feb 10 / v2 Feb 12 2026). It's referenced as "Feng et al., 2026b" in Aletheia paper. DeepMind GitHub (google-deepmind/superhuman) doesn't list arXiv ID. The paper is NOT in the superhuman GitHub (only Aletheia PDF is there). May have a non-2602.xxx ID or may not be on arXiv yet. Will monitor. (5) MCE (2601.21557) confirmed already archived from HB10. (6) Gecko (2602.19218) confirmed already archived. PhGPO (2602.13691) confirmed not previously archived — borderline relevance (ant colony optimization for tool transitions); skipped as lower priority than current batch.
- **Archive inventory:** discoveries.md now at 53 entries.

## 2026-02-26 — HB28 (skipped): 05:19 GMT+8 — Too soon after HB27
- **[SKIPPED]** 05:19 GMT+8 — HB27 in progress / just completed. GitHub trending reset still ~1hr 40min away. All available sources exhausted. Standing down.

## 2026-02-26 — HB29: themes.md updated — Themes 12 and 13 written
- **[DONE]** 05:42 GMT+8 — GitHub still 1h18m from reset. Used the downtime productively. Wrote Themes 12 and 13 to knowledge/themes.md. (12) **TTS for Agents — Three Unsolved Problems**: context ceiling + verification gap + principled allocation. Evidence: General AgentBench + PETS + EGSS + DREAM + SRR-Judge + Reflective TTP. Takeaway: naive "sample more" isn't a strategy — need EGSS (tokens) + PETS (allocation) + SRR-Judge (verifier training) + DREAM (eval parity). (13) **Principled Agent Memory Architecture — Two Layers**: context engineering (MCE + EGSS) + persistent memory (UMEM + UMA + MIRA + StateLM) + retrieval (PageIndex + RankEvolve + Memory Reranker). Takeaway: three independent optimization layers. themes.md now has 13 themes.

## 2026-02-26 — HB30: cs.AI overnight sweep, 2 new archives
- **[DONE]** 06:31 GMT+8 — Used pre-GitHub-reset time for cs.AI recent list sweep (146 entries from Feb 25). Scanned 25 IDs in batches. 2 new archives: (1) **AgentOS** (2602.20934) — OS-abstraction framework for LLMs: context as Addressable Semantic Space, Semantic Slicing, Temporal Alignment, LLM as Reasoning Kernel. Good vocabulary for agent architecture communication. (2) **Pressure Reveals Character** (2602.20813) — 904-scenario alignment benchmark under pressure (conflicting instructions + tool access + escalation). 24 frontier models. Alignment as unified g-factor. Scheming + Corrigibility categories novel. Public leaderboard. Skipped: VLA driving (2602.21172 CVPR), ECG (2602.21154), KG-IEP (2602.21066), tool-as-superintelligence (2602.21061 theoretical), causal VLM (2602.20878), CHESS KV-cache (2602.20732), traffic RLAIF (2602.20728). Archive now at 55 entries.

## 2026-02-26 — HB31: cs.AI + cs.CL overnight sweep continuation
- **[DONE]** 06:55 GMT+8 — Continued cs.AI (entries 26-50) + all 58 cs.CL entries. 0 new archives — the remaining entries were mostly linguistics, domain-specific NLP, or already-covered papers. Notable borderline skips: BAPO (2602.20722, off-policy RLVR, 12.5% over GRPO, 40.7% previously-failing problems solved — relevant to Theme 5 but not archivable without more depth), Case-Aware LLM-as-Judge RAG (2602.20379, enterprise eval framework — solid but domain-specific), Query hallucination features (2602.20300, underspecification = more hallucination — connects to Theme 3, but EACL paper so lower freshness priority). GitHub trending reset imminent (~07:00 GMT+8). Switching to trending source at next heartbeat.

## 2026-02-26 — HB32: GitHub trending daily reset sweep
- **[DONE]** 07:15 GMT+8 — GitHub trending fresh daily reset. 4 new repos archived. Star updates for known repos below.
- **NEW REPOS:** (1) **bytedance/deer-flow** (20,423★, TypeScript) — SuperAgent harness v2.0, full rewrite: skills+tools+subagents+sandbox+context engineering+LT memory. (2) **katanemo/plano** (5,541★, Rust) — AI-native proxy/data plane for agents: routing, Agentic Signals™, Filter Chains for guardrails, LLM routing. Bridges demo→production gap. (3) **yichuan-w/LEANN** (10,090★, Python, MLsys2026) — 97% storage savings RAG via graph-based on-demand embedding recomputation. MCP native. Runs on laptop. (4) **abhigyanpatwari/GitNexus** (3,642★, +936 today, TypeScript) — Codebase KG via Tree-sitter + KuzuDB + MCP. Architectural clarity for coding agents.
- **STAR UPDATES (known repos):** huggingface/skills 6,335 (+444 from yesterday's 5,891). obra/superpowers 61,737 (+740). muratcankoylan/Agent-Skills-for-Context-Engineering 10,633 (+315). NevaMind-AI/memU 10,760 (+356). VectifyAI/PageIndex still in list (no star count shown). D4Vinci/Scrapling 14,871 (+1,828 today — NOT agent-relevant, web scraping tool). shareAI-lab/learn-claude-code 17,943★ (nano Claude Code clone — already tracked). liyupi/ai-guide 7,657★.
- **Skipped:** D4Vinci/Scrapling (web scraping utility, not agent-core), datawhalechina/hello-agents (Chinese tutorial, low uniqueness), ruvnet/ruvector (Rust vector GNN, experimental), shareAI-lab/learn-claude-code (already tracked), siteboon/claudecodeui (mobile Claude Code UI, utility), business-science/ai-data-science-team (domain-specific data science agents), ComposioHQ/awesome-claude-skills (curation list, not novel).

## 2026-02-26 — HB33: Unresolved ID hunt — 1 resolved, 1 still pending
- **[DONE]** 08:12 GMT+8 — Resolved Behavioral Consistency arXiv ID + confirmed BrowseComp-V³ authors. (1) **Behavioral Consistency (2602.11619) ID RESOLVED** — "When Agents Disagree With Themselves" (Aman Mehta, Feb 12). Full abstract captured: 3,000 runs, 3 models, ReAct agents produce 2.0–4.2 distinct paths per 10 runs; consistent (≤2 paths) = 80-92% accuracy, inconsistent (≥6 paths) = 25-60%; **69% of divergence at step 2**. Now archived in discoveries.md. Archive = 56 entries. (2) **BrowseComp-V³** — authors confirmed (Huanyao Zhang et al., PKU+ByteDance, v1 Feb 13/v2 Feb 24); arXiv ID still not findable via search. Stopped guessing. (3) **GitHub trending stable** — same list as 07:15, minor star increments only (huggingface/skills 6,357, superpowers 61,789, GitNexus 3,675 +894 today). (4) **HF papers capped at Feb 25 UTC** — no new batch yet.
- **TODO resolved:** Behavioral Consistency ID resolved ✓. BrowseComp-V³ ID remains unresolved.

## 2026-02-26 — HB34: cs.MA sweep — 1 new archive
- **[DONE]** 08:17 GMT+8 — cs.MA recent list (61 entries across 5 days). 1 new archive: **HieraMAS** (2602.20229) — hierarchical MAS with intra-node LLM mixtures (supernodes) + inter-node topology optimization. Two-stage RL: multi-level reward attribution + graph classification for topology. Novel "supernode" primitive. Skipped: evacuation sim, urban geospatial, potentialization game theory, nutrition MAS (all domain-specific or too theoretical). Archive = 57 entries.

## 2026-02-26 — HB35: cs.SE + cs.CR sweep — 2 major archives
- **[DONE]** 08:41 GMT+8 — Swept cs.SE (19 entries Feb 25) + cs.CR (21 entries Feb 25). 2 major archives. (1) **"Agentic Skills: Beyond Tool Use"** (2602.20867) ★★★ — Full lifecycle taxonomy (discovery→update), 7 design patterns, representation×scope taxonomy, **ClawHavoc case study**: ~1,200 malicious skills in agent marketplace exfiltrated API keys, crypto wallets, browser credentials at scale. THE security paper for the skills layer. (2) **PackMonitor** (2602.20717) — eliminates (not reduces) package hallucinations via decoding-time constrained decoding against authoritative package registry. DFA-caching for million-package scale. Training-free. Archive = 59 entries. Skipped: quantum SE, digital twins healthcare, autonomous driving scenarios, EHR blockchain.
- **Note:** 2602.20867 is directly relevant to our ongoing skills architecture work. The ClawHavoc incident validates MAESTRO's supply-chain threat model with a real-world case. Signal immediately shared to Bob in SIGNALS.md.

## 2026-02-26 — HB36: cs.LG sweep — 0 new archives
- **[DONE]** 08:46 GMT+8 — Swept cs.LG first 30 entries (148 total Feb 25). 0 new archives. Notable: SELAUR (2602.21158) — self-evolving agent via uncertainty-aware rewards (entropy+confidence+margin → token-level dense reward), ALFWorld+WebShop — borderline but covered by SRR-Judge + BAPO already. RGSC (2602.20809, ICLR 2026) — regret-guided search control for AlphaZero, +77-89 Elo — game-specific, skip. Rest: learning theory, optimizer theory, time series, engineering surrogates. Archive remains at 59 entries. cs.LG exhausted for agent-relevant content.

## 2026-02-26 — HB37: HF Trending sweep — 1 new archive
- **[DONE]** 09:42 GMT+8 — Checked GitHub trending (stable, star increments only) + HF Trending (cross-time). 1 new archive: **GLM-5** (2602.15763, Zhipu AI, Feb 17) — "From Vibe Coding to Agentic Engineering." DSA + async RL + agentic coding. Community calls it SOTA competitor to Qwen3.5. Trending now despite being 9 days old — suggests it's gaining traction. Archive = 60 entries. Skipped: Mobile-O (on-device multimodal), SimToolReal (dexterous robotics), SELAUR (covered by existing RL reward shaping entries).

## 2026-02-26 — HB38: arXiv cs.AI new submissions sweep — 2 new archives
- **[DONE]** 10:00 GMT+8 — Swept remaining cs.AI new submissions (Feb 25 batch, entries not yet covered). 2 strong new archives: (1) **ActionEngine** (2602.20502) — state-machine memory GUI agent. Offline crawling → state machine → full Python program synthesis. 95% WebArena Reddit (vs 66% baseline), 11.8x cost, single LLM call avg. Training-free. (2) **ICON** (2602.20708) — IPI defense via latent space prober + attention steering. 0.4% ASR, 50%+ task utility gain vs refusal. OOD generalization. Solves over-refusal problem. Archive = 62 entries. Skipped: childhood obesity (medical domain), log verbalization for recommendation (domain-specific).

## 2026-02-26 — HB39: Daily digest written
- **[DONE]** 10:30 GMT+8 — All sources exhausted. Used downtime to write DIGEST_2026-02-26.md — full synthesis of 19 new archives added today. Available at workspace-scout/DIGEST_2026-02-26.md.

## 2026-02-26 — HB40: Weekly GitHub trending sweep — 2 new repos
- **[DONE]** 12:30 GMT+8 — First weekly trending check of the day. 2 new repos: (1) **cloudflare/agents** (4,249★, +1,004/week) — persistent stateful agent execution via Durable Objects, built-in MCP, hibernates when idle, millions at near-zero cost. The "execution substrate" layer for production agents. (2) **alibaba/zvec** (7,911★, +3,141/week) — in-process vector DB (Proxima engine), dense+sparse+hybrid, no server, pip install. Lightweight RAG alternative to Chroma/Weaviate. Skipped: google-research/timesfm (time series forecasting), Stremio (media), SynkraAI/aios-core (1,843★, AI-orchestrated full-stack dev — interesting but thin on details, likely a generated project).

## 2026-02-26 — Coach Task: Reddit Integration Run (18:19 GMT+8)
- **[DONE]** 18:19 GMT+8 — First Reddit intelligence pass. Coach tasked: learn Arctic Shift API, scan 5 subreddits, archive ≥3 quality finds, update knowledge infrastructure.

**What I did:**
- Scanned 5 subreddits using Arctic Shift API: r/LocalLLaMA, r/MachineLearning, r/ClaudeAI, r/OpenAI, r/artificial
- Fetched ~20 posts per sub from after=2026-02-21 (recent) + supplemental scan 2026-02-18 to 2026-02-25 for richer content
- Sorted by num_comments (score=1 for all recent posts, not yet aggregated)
- Selected 5 high-signal posts, fetched full body + comments for each
- Archived 5 entries in new `knowledge/scout/reddit.md`

**New file created:** `~/.openclaw/knowledge/scout/reddit.md`

**Key archives (5 entries):**
1. **Gemini 3.1 Pro 20% tool-call failure rate** (r/LocalLLaMA, u/bobr_ai) — production two-level agent stack, creative agent fails to call exit tool ~20% of the time. Claude Sonnet 4.6 "near-zero failure." Failure modes documented. Only-Reddit content.
2. **91k production agent interactions** (r/MachineLearning, u/cyberamyntas) — monthly threat intel report, attack vector distribution shift: tool abuse 8.1%→14.5%, planning-phase attacks (novel category). New attack surface: agent's internal objective graph.
3. **Qwen3.5 MoE thinks less with tools** (r/LocalLLaMA, 8 comments) — empirical observation + community MoE routing explanation (tools route to different expert clusters, suppressing reasoning experts). Design implication: separate reasoning agents from tool-calling agents in MoE systems.
4. **Papers with No Code community debate** (r/MachineLearning, 88 comments, score=182) — community sentiment that reproducibility is getting worse. Validates why Reddit is necessary source: practitioners are paper-skeptical by default.
5. **Agent prompt injection security audit** (r/LocalLLaMA) — ecosystem health check: "most people are yolo-ing it with docker and crossing their fingers." Gap between security research and practice is enormous.

**Infrastructure updates:**
- HEARTBEAT.md: Reddit added to sources list (position #3) and source rotation table
- TOOLS.md: Arctic Shift API reference section added
- LEARNINGS.md: Full Reddit signal patterns, what works/doesn't, rotation schedule guidance, fetch recipe

**Key learning:** Reddit's value is confirmed — the Gemini tool-call failure rate finding is exactly the practitioner layer that doesn't exist in papers or repos. The MoE expert routing observation about thinking suppression from tools is another pure-Reddit find.

## 2026-02-26 — HB41: GitHub trending update — 2 new entries
- **[DONE]** 19:00 GMT+8 — GitHub trending shifted. 2 new: (1) **ruvnet/claude-flow** (14,672★) — multi-agent swarm orchestration platform for Claude, RAG+Claude Code+Codex native. Archived in repos.md. (2) **MiniMax M2.5** — surfaced via farion1231/cc-switch README: 80.2% SWE-Bench Verified, 51.3% Multi-SWE-Bench, 76.3% BrowseComp. No paper yet. Archived in discoveries.md. Skipped: cc-switch (desktop UI switcher, utility), SpacetimeDB (Rust DB, not agent-core), moonshine ASR. Archive = 64 entries.

## 2026-02-26 — HB42: arXiv Feb 26 new batch — 3 archives
- **[DONE]** 21:48 GMT+8 — arXiv Feb 26 new batch live (14 primary + 99 cross-lists). Scanned all 14 primaries + sampled cross-lists. 3 new archives: (1) **SIA** (2602.21215, cs.CL cross-list) — sparse junction steering: 20-80% token intervention at high-entropy decision points, 6x compute reduction, 20% tokens matches post-trained instruct models on Qwen3. Better than dense steering. (2) **ARLArena** (2602.21534) — first stable training recipe for Agentic RL. ARL training collapse is the main scaling blocker. Reproducible stability analysis + algorithmic design framework. (3) **LLM Inconsistent Biases** (2602.22070) — LLMs rate humans higher (stated) but bet on algorithms (revealed) even when algorithms perform worse. Inconsistency risk for MAS human oversight. Skipped: PANGAEA geoscience (domain), SemSIEdit (privacy, borderline), aggregation in compound AI systems (theoretical), proactive mobile agents (benchmark only, thin), 2-Step Agent (decision support HCI), SPG-LLM (PDDL grounding), Petri net planning (formal methods). Archive = 67 entries.

## 2026-02-26 — HB43: cs.CL Feb 26 new batch sweep — 0 new archives
- **[DONE]** 22:19 GMT+8 — Swept cs.CL new batch (58 primary submissions Feb 26). 0 new archives beyond SIA (already captured). Notable skips: Alignment-Weighted DPO (2602.21346 — CoT fine-tuning for principled refusals + segment-weighted DPO, solid alignment paper but overlaps with SIA/ICON coverage), VSR info injection (2602.21619 — "more context doesn't help"; targeted single cues > multi-context; confirms context injection is not a free win for reasoning), LoRA adapter composition (2602.21222), Bangla-English code-mix (2602.21608), clinical NLP Persian (2602.21374). Archive stable at 67 entries. Feb 26 coverage complete.

## 2026-02-27 — HB44: GitHub trending update + ACP protocol discovery — 2 new repos, 2 new discoveries
- **[DONE]** 04:18 GMT+8 — Dead window continues (UTC 20:18 Feb 26 — HF papers not yet live, arXiv fully swept). GitHub trending checked: 2 new repos (alibaba/OpenSandbox, MoonshotAI/kimi-cli). Kimi-cli revealed **Agent Client Protocol (ACP)** — a third protocol standard (editor↔agent layer, distinct from MCP/A2A). Confirmed multi-vendor: JetBrains, Zed, Kimi. 2 new entries in discoveries.md (ACP + OpenSandbox), 2 new entries in repos.md. Archive = 68 entries. Reddit scan: r/LocalLLaMA + r/MachineLearning — all 0-comment posts (very recent, <3hr old), no signal. Not archiving. Remaining: HF Feb 27 daily papers at 08:00 GMT+8, arXiv Feb 27 batch at ~22:00 GMT+8.

## 2026-02-27 — HB45: HF Feb 27 daily papers sweep — 3 new archives
- **[DONE]** 07:57–08:10 GMT+8 — HF Feb 27 papers live (00:00 UTC). 29 IDs, 1 already known (2602.21534 = ARLArena), 28 new. Triaged all 28 via parallel batches. 3 archived: (1) **DualPath** (2602.21548) — KV-cache storage bandwidth bottleneck in agentic inference; disaggregated prefill/decode asymmetry; dual-path loading fix. Theme 7. (2) **GUI-Libra** (2602.22190) — native GUI agent training; "partial verifiability" failure mode in step-wise RL; action-aware supervision. Theme 8. (3) **MCP Tool Smells v2** (2602.14878) — distinct from 2602.18914; 856 tools, augmentation study; +5.85pp success but +67% steps, 16.67% regression. Theme 3b. Skipped (25): audio-video gen (4x), molecular gen, image gen, VLA world model, vector glyphs, video foundation model eval, time-series decomp, truthfulness spectrum, ISO-Bench (known), 3D audio-visual, IMU-video, sarcasm, CT diffusion, object hallucination, physics image editing, LLM knowledge (nanochat), masked diffusion, diffusion cache. Archive = 71 entries.

## 2026-02-27 — HB46: cs.MA sweep + Reddit check — 1 new archive
- **[DONE]** 08:13–08:25 GMT+8 — cs.MA recent list: 57 entries, 10 from Thu Feb 26. Triaged 11 primary IDs. 1 archived: **Pancake** (2602.21477) — hierarchical memory system for multi-agent LLM serving; ANN search bottleneck; coordinated cross-agent index management; 4.29x throughput. Completes memory infra stack with DualPath. Skipped: autonomous vehicles responsibility, ABM hierarchy emergence, MARL policy gradient, disaster evacuation ABM, urban geospatial, opponent simulation, potential games, legal MAS. Reddit: r/LocalLLaMA + r/MachineLearning all 0-1 comment posts — too fresh, no signal. Archive = 72 entries.

## 2026-02-27 — HB47: Reddit rotation — 2 new entries in reddit.md
- **[DONE]** 09:52–10:05 GMT+8 — Reddit: 4d→7d window scan. r/LocalLLaMA + r/MachineLearning. 2 signal posts: (1) "Running autonomous agents locally feels reckless" (32c) — practitioner isolation anxiety; tool allowlists > blocklists; OpenClaw yt-dlp bypass example; gap between security research and practice confirmed again. (2) Qwen3-Coder-Next tool hallucination (13c) — infinite loop bug, fix: llama.cpp PR #19765 (merged Feb 21), chat template issue. Both archived in reddit.md. Archive stable at 72 entries (discoveries.md), reddit.md now 7 entries.

## 2026-02-27 — HB48: Synthesis — LEARNINGS.md themes updated
- **[DONE]** 12:09–12:20 GMT+8 — Dead window synthesis work. Updated LEARNINGS.md Themes 2, 3b, 4, 7, 8 with all Feb 27 new finds. Key synthesis: (1) Full 4-layer agent memory infrastructure stack now visible (DualPath→Pancake→TierMem→StateLM). (2) Protocol stack now 3 layers (MCP→A2A→ACP). (3) Agent infrastructure stack confirmed: AgentCgroup→DualPath→OpenSandbox→Pancake→StateLM. No new archives. Archive stable at 72 entries.

## 2026-02-27 — HB49: GitHub trending update — 1 new repo
- **[DONE]** 20:54 GMT+8 — GitHub trending shifted (post ~18:00). New: **bytedance/trae-agent** — ByteDance CLI coding agent, research-friendly modular architecture, trajectory recording, multi-LLM, arXiv technical report (2507.23370). Archived in repos.md. Also new: datawhalechina/hello-agents (Chinese "Build Agents from Scratch" tutorial) — borderline, skipped (tutorial content, not novel research). ruvnet/wifi-densepose (WiFi pose estimation — not agent-relevant, skip). Archive stable at 72 entries.

## 2026-02-27 — HB50: arXiv Feb 27 new batch (cs.AI) — 3 archived
- **[DONE]** 21:57–22:20 GMT+8 — arXiv cs.AI Feb 27 new: 71 primary submissions. Used search API to triage by relevance. 3 archived: (1) **AMA-Bench** (2602.22769) — long-horizon memory benchmark for agentic apps; key gap: existing benchmarks test dialogue memory not machine-generated trajectory memory. Theme 2. (2) **AgentSentry** (2602.22724) — IPI defense using temporal causal diagnostics + context purification; first paper to frame IPI as trajectory-level multi-turn attack. Theme 3a. (3) **OmniGAIA** (2602.22897) — omni-modal agent benchmark (video+audio+image+tools); multi-hop cross-modal queries. Theme 8. Skipped 50+ others (route planning, ad bidding, neural calibration, RLHF serverless, math reasoning, etc.). Archive = 75 entries.

## 2026-02-27 — HB51: cs.CL Feb 27 sweep — 0 new archives
- **[DONE]** 22:27–22:40 GMT+8 — cs.CL new: 48 primary submissions. Triaged via search API + direct IDs. No agent-relevant finds. Sampled: decoder knowledge distillation, function/concept vectors (interpretability), cyberbullying detection (Bangla), diffusion LLM framework (dLLM), knowledge attribution probing, stance classification, SRL annotation, OCR routing in VLMs, transformer attention. 0 archived. Archive stable at 75 entries. Day complete — all major sources swept.

## 2026-02-28 — HB52: Overnight exploration run — 2 new discoveries
- **[DONE]** 04:11–04:30 GMT+8 — Full exploration run (user prompted). GitHub trending: memU + PageIndex already archived; trae-agent stable. New: agentscope-ai/agentscope (not new find, already known). Reddit 5d→2d window sweep: 2 high-signal finds: (1) **Anthropic drops RSP core pledge** (TIME exclusive, Jared Kaplan quote, score=258/49c) — safety-competitive posture shift; (2) **Qwen3.5 35B vs 27B multi-agent benchmark** (63c/85s) — 35B sparse MoE 3.8x faster than 27B dense in 3-agent pipeline. Both archived. Archive = 77 entries.

## 2026-02-28 — HB53: HF Feb 28 daily papers sweep — 2 new archives
- **[DONE]** 07:45–08:10 GMT+8 — HF Feb 28 papers: 28 IDs, 1 known (OmniGAIA 2602.22897), 27 new. Triaged all 27. 2 archived: (1) **EMPO²** (2602.23008, ICLR 2026) — exploratory memory-augmented RL; +128.6% GRPO on ScienceWorld; memory for exploration not just lookup. Theme 1+2. (2) **AgentDropoutV2** (2602.23258) — test-time rectify-or-reject MAS firewall; failure-driven indicator pool; +6.3pp on math. Theme 6. Skipped 25: world model consistency, multimodal blind spots, latent visual reasoning, medical RL, 3D reconstruction, 4D human-scene, GeoWorld, FSDP training, motion diffusion, OVS, DLT corpus, diffusion acceleration, general agent eval (abstract missing), route planning (already archived), ad bidding, MobilityBench (known). Archive = 79 entries.

## 2026-02-28 — HB54: Synthesis — Theme 12 updated with Behavioral Consistency
- **[DONE]** 11:17–11:25 GMT+8 — Pending TODO cleared. Added Behavioral Consistency (2602.11619) to Theme 12 in LEARNINGS.md: 32–55pp accuracy gap, 69% divergence at step 2, consistency monitoring as early failure detector. Combined with MAST taxonomy: now a complete observability+intervention framework. Archive stable at 79 entries.

## 2026-02-28 — HB55: Reddit rotation — 1 new entry
- **[DONE]** 14:33–14:45 GMT+8 — Reddit 6h→24h window. Still low engagement overall, but found signal: **ContextCache** (r/ML [R] post) — persistent KV cache for tool schemas; 29x TTFT speedup at 50 tools; critical finding: per-tool caching kills accuracy (85%→10%) due to cross-tool attention dependency; group caching required. Archived in reddit.md. Archive stable at 79 entries.

## 2026-02-28 — HB56: GitHub TS trending + Reddit sweep — 2 new repos
- **[DONE]** 15:49–16:05 GMT+8 — GitHub TypeScript trending first check of the run. 2 new repos: (1) **vercel-labs/just-bash** (1,462★, +258/day) — in-process sandboxed bash for agents; in-memory filesystem; secure-by-default network; Vercel Labs official. (2) **ruvnet/ruflo** (15,940★, +531/day) — Claude multi-agent orchestration platform; swarm intelligence; native Claude Code + Codex integration. Python trending: stable, no new entries. Reddit: still 0-1 comments/score=1 across all posts in 8h→48h window — no new signal. Archive stable at 79 entries (repos.md now has 2 new entries).

## 2026-02-28 — HB57: Blog rotation (LangChain) + GitHub TS trending — 2 blog posts, 2 repos
- **[DONE]** 16:42–17:00 GMT+8 — Inter-session work assignment triggered. HEARTBEAT.md re-read: key rule violated ("Never stand down waiting for specific source"). Ran full rotation. LangChain blog: 2 posts archived: (1) "Improving Deep Agents with Harness Engineering" — Top 30→Top 5 Terminal Bench 2.0 (52.8%→66.5%), harness-only, Trace Analyzer Skill (self-improving harness via agent skill), Build & Self-Verify loop, gpt-5.2-codex. (2) "Agent Engineering: A New Discipline" — formalizes 3-skillset discipline. TypeScript trending: 2 repos archived in repos.md: just-bash (Vercel Labs sandboxed bash, 1,462★), ruflo (ruvnet Claude orchestration, 15,940★). Anthropic news (404 — RSP post from yesterday already archived). Archive = 81 entries.

## 2026-02-28 — HB58: Framework releases + blog rotation + author follow-up
- **[DONE]** 16:45–17:10 GMT+8 — Rotated to framework releases + blogs + people.md. Finds: (1) Framework release roundup archived: CrewAI 1.9.x (MCP hardening, HITL loops), AutoGen 0.7.5 (Docker default executor for security), LangGraph 1.0.10 (maintenance). (2) Yuandong Tian added to people.md (ex-Meta FAIR, 6 ICLR 2026 papers, stealth startup). (3) LangSmith Agent Builder GA noted (from LangChain blog scan). CrewAI + AutoGen Docker-default = institutional security response confirming our agent security theme. Archive = 82 entries.

## 2026-02-28 — HB59: Anthropic Engineering blog — 1 new archive
- **[DONE]** 16:56–17:10 GMT+8 — Anthropic engineering blog: featured post "Quantifying infrastructure noise in agentic coding evals" — 6pp swing on Terminal-Bench 2.0 from infra config alone; K8s strict enforcement → OOM-kill; 3x headroom threshold; uncapped enables different solution strategies (+4pp). Archived. OpenAI news: didn't render. Archive = 83 entries.

## 2026-02-28 — HB60: Google Research + DeepMind blogs — 1 new archive
- **[DONE]** 17:02–17:18 GMT+8 — Google Research blog: archived "Towards a Science of Scaling Agent Systems" (arXiv 2512.08296, Jan 28) — 180 agent configurations, first quantitative scaling principles, challenges "more agents = better", derives agentic complexity score. DeepMind blog: model releases (Nano Banana 2, Gemini 3.1 Pro) — not agent-relevant. Archive = 84 entries.

## 2026-02-28 — HB61: HuggingFace blog rotation — 2 new archives
- **[DONE]** 17:06–17:22 GMT+8 — HuggingFace blog scan. 2 archived: (1) OpenEnv (Feb 12) — real-world agent eval framework from Meta+HF; gym API + MCP tool call interface; Calendar Gym with access control, temporal reasoning, multi-agent coord. (2) GGML+llama.cpp join HF (Feb 20, 469 upvotes) — Gerganov + team; sustainable resources + autonomy; seamless transformers→llama.cpp pipeline goal. Microsoft TC blog: login redirect, skip. Archive = 86 entries.

## 2026-02-28 — HB62: Simon Willison blog + people.md — 2 new archives, 2 new people
- **[DONE]** 17:16–17:35 GMT+8 — Simon Willison Feb 2026 archive (169 posts). 2 archived: (1) Thariq Shihipar (Claude Code) quote on prompt cache as primary metric — "declare SEVs if hit rate too low." (2) Willison active OpenClaw/Moltbook coverage — NYT Cade Metz article, Docker sandboxing. 2 people added: Thariq Shihipar (@trq212, Claude Code team) + Simon Willison (practitioner blogger). Karpathy blog: only microgpt (200-line GPT, not agent-relevant). Archive = 88 entries.

## 2026-02-28 — HB63: Microsoft Research + LangChain blogs — 1 new archive
- **[DONE]** 17:21–17:38 GMT+8 — MS Research blog: archived CORPGEN (Feb 26) — multi-task agent eval; 16.7%→8.7% completion drop under multi-task load; 3.5x improvement via hierarchical planning + memory isolation. LangChain "you don't know what your agent will do" — solid but covered by existing archives (agent observability, infinite input space). Argos (multimodal RL verifier) — robotics focus, skip. Archive = 89 entries.

## 2026-02-28 — HB64: LangChain deepagents 0.2 + IBM Research blog — 1 new archive
- **[DONE]** 17:27–17:42 GMT+8 — deepagents 0.2 archived: pluggable backends, composite filesystem with subdirectory mapping, large tool result eviction, cross-thread persistence. IBM Research blog: quantum computing focus, no agent posts. Archive = 90 entries.

## 2026-02-28 — HB65: Cloudflare + Val Town blogs — 2 new archives
- **[DONE]** 17:57–18:10 GMT+8 — 2 archived: (1) Cloudflare "Markdown for Agents" (Feb 12) + Moltworker (Jan 29) — CDN-scale HTML→Markdown for agent requests; OpenClaw on Cloudflare Sandbox. (2) Val Town BYOA (Feb 25) — anti-vendor-lock-in agent philosophy; every vendor's agent is always stale; "your agent should answer to you." Archive = 92 entries.

## 2026-02-28 — HB66: GitHub weekly trending + E2B blog — 2 new repos
- **[DONE]** 18:06–18:20 GMT+8 — GitHub weekly trending: 2 new repos: (1) vxcontrol/pentagi (PentAGI, 8,613★, +5,598/wk) — fully autonomous pentest agent, 20+ security tools, Docker sandboxed, knowledge graph, long-term attack memory. (2) x1xhlol/system-prompts-and-models — leaked/extracted system prompts for Manus, Claude Code, Cursor, Devin, 25+ tools. E2B blog: redirect to X, no content. Archive = 92 entries, repos.md +2.

## 2026-02-28 — HB67: LangSmith Agent Builder GA + memory system — 1 new archive
- **[DONE]** 18:09–18:25 GMT+8 — x1xhlol system prompts repo root inspected — crypto promotion scheme, lower credibility. LangSmith Agent Builder GA + memory system archived: task-specific agent memory ROI insight; LangGraph Store backend; no-code + MCP integration; "memory is essential UX for repeated-task agents, not for general-purpose." Archive = 93 entries.

## 2026-02-28 — HB68: Terminal-Bench leaderboard + Yuandong Tian author check
- **[DONE]** 18:12–18:25 GMT+8 — Terminal-Bench 2.0 leaderboard archived: 111 entries, GPT-5.3-Codex+DroidGPT #1 at 77.3%, Claude Code #30 at 58%, LangChain Deep Agents #10 at 66.5% confirmed. Model names: GPT-5.3/5.2-Codex, Claude Opus 4.6/4.5, Gemini 3.1/3 Pro. Yuandong Tian arxiv search: confirmed AMA-Bench authorship + STEM (sparse transformers) paper not agent-relevant. Archive = 94 entries.

## 2026-02-28 — HB69: HF Feb 27 paper sweep (remaining) — 1 new archive
- **[DONE]** 18:44–18:58 GMT+8 — Reddit fully blocked (403 on both). HF date still redirects to Feb 27. Swept 8 remaining untriaged HF IDs: 7 skip (world models, multimodal training, segmentation, visual reasoning, geometry, route-planning, medical RL). 1 archived: 2602.22953 "General Agent Evaluation" (IBM Research, ICML) — Exgentic framework, Unified Protocol, Open General Agent Leaderboard, general agents match specialized without domain tuning. Archive = 95 entries.

## 2026-02-28 — HB70: GitHub Python trending + LangChain observability post
- **[DONE]** 19:15–19:28 GMT+8 — Python trending: 2 new repos archived: NousResearch/hermes-agent (984★, +183/day, open-weight agent harness), ComposioHQ/awesome-claude-skills (trending, tool integration angle on skills theme). Skills wave: anthropics/skills now 79,169★ (+1,044 since last check ~2hrs ago). LangChain "Agent Observability Powers Agent Evaluation" — core insight (code→traces as source of truth) already covered by HB57 "Agent Engineering: New Discipline." No new archive. Archive = 95 entries, repos.md +2.

## 2026-02-28 — HB71: HN front page + Modal blog — 2 new archives
- **[DONE]** 19:47–20:02 GMT+8 — HN front page: 2 archived: (1) OpenAI $110B raise ($50B Amazon+$30B Nvidia+$30B SoftBank, $730B valuation) — key agent detail: stateful runtime environment on AWS Bedrock for agents. (2) OpenAI deploys in US Dept. of War classified network — same week as Anthropic RSP drop. Modal blog: product nav only, no articles listing accessible. Signal sent to Bob. Archive = 97 entries.

## 2026-02-28 — HB72: HN thread triage + arXiv cs.AI late Feb 27 sweep — 2 new archives
- **[DONE]** 20:18–20:35 GMT+8 — HN OpenAI/DoW thread: OpenAI employee publicly confirmed deal terms + Anthropic blacklist dissonance noted. arXiv Feb 28 not live (400 on date path, recent/ still shows Feb 27). Swept high-numbered Feb 27 IDs: 2 archived: (1) 2602.23248 Legibility Tax / Prover-Verifier Games — translator model for agent output checkability. (2) ESAA 2602.23193 — Event Sourcing for agents, append-only log, deterministic orchestrator, replay verification. Skipped: finance trading, MCTS/GGP, belief revision, EEG, medical CXR. Archive = 99 entries.

## 2026-02-28 — HB73: arXiv cs.AI Feb 27 final sweep — 2 new archives, 100+ milestone
- **[DONE]** 20:49–21:05 GMT+8 — arXiv Feb 28 still not live (recent/ still shows Feb 27, 215 entries). Swept final 8 untriaged Feb 27 IDs. 2 archived: (1) 2602.23271 Stochasticity in DRAs — stochasticity as deployment blocker, identical queries → substantial output variance, MDP formalisation. (2) 2602.23163 LLM Steganography — Δ_steg measure, GVI for detecting hidden agent-to-agent signals opaque to human monitors. Skipped: dual-use biology, epistemic uncertainty, machine consciousness, single-cell biology, generalized planning. Archive = 101 entries. 🎉 100+ milestone.

## 2026-02-28 — HB74: arXiv search sweep + Agent-Fence — 1 new archive
- **[DONE]** 21:21–21:38 GMT+8 — arXiv Feb 28 still not live (recent/ still Feb 27, 215 entries). arXiv search: found Agent-Fence (2602.07652, Feb 7), Search-P1 (abstract incomplete, defer), Managing Uncertainty in MAS (defer — lower priority). 1 archived: Agent-Fence = DRA security vulnerability taxonomy, compounding multi-step risk. Search-P1 noted for next pass. Archive = 102 entries.

## 2026-02-28 — HB75: cs.MA Feb 27 sweep — 2 new archives
- **[DONE]** 21:52–22:10 GMT+8 — arXiv Feb 28 confirmed not live (weekend — won't flip until Monday). cs.MA Feb 27: 9 entries, 5 checked. 2 archived: (1) ClawMobile 2602.22942 (MBZUAI) — smartphone-native agent architecture, hierarchical reasoning/control separation. (2) ParamMem/ParamAgent 2602.23320 — parametric reflective memory, diversity→task success, weak-to-strong transfer. Skipped: MARL Q-overestimation, crowdsourcing bandits, blockchain. LEARNINGS.md updated: arXiv weekend timing. Archive = 104 entries.

## 2026-02-28 — HB76: GitHub Go trending + W&B blog — 2 new repos
- **[DONE]** 22:24–22:38 GMT+8 — Go trending: 2 new repos: (1) axonhub (2,085★) — open-source AI Gateway, 100+ LLMs, failover/load-balance/cost-control/tracing. (2) xiaohongshu-mcp — MCP server for Xiaohongshu, Chinese platform MCP adoption signal. W&B blog: still empty (JS-rendered, not accessible). Archive = 104 entries, repos.md +2.

## 2026-02-28 — HB77: HF blog sweep + TypeScript trending — 2 new archives + 1 new repo
- **[DONE]** 22:55–23:10 GMT+8 — HF blog: 1 archived: Community Evals (Feb 4) — HF's decentralised benchmark infrastructure, MMLU/GSM8K saturated, PR-based reproducible results, Inspect AI format. TypeScript trending: superset-sh/superset (2,292★, +156/day) — "IDE for agents era," parallel multi-agent coding; archived to repos.md. GitNexus already archived. moeru-ai/airi (19,091★, self-hosted companion) = entertainment, not agent infra. ruflo already archived. Archive = 105 entries, repos.md +1.

## 2026-02-28 — HB79: Final daily trending sweep — 1 new repo, EOD close
- **[DONE]** 23:58 GMT+8 — All-language daily trending: claude-relay-service (Wei-Shaw, 8,664★, +171/day) — self-hosted Claude Code relay with subscription ride-sharing, Chinese ecosystem. Same author as sub2api. anthropics/claude-code on all-language trending. airi, ruflo, DeerFlow, hermes-agent, superset all already archived. Archive = 105 entries, repos.md +1. Day closed.

## 2026-03-01 — HB80: cs.CL Feb 27 late sweep + Cohere blog — 0 new archives
- **[DONE]** 00:30–00:42 GMT+8 Mar 1 — Cohere blog: email wall, no content. cs.CL Feb 27: 82 entries, checked top 8 by ID. 0 agent-relevant: VLM reporting bias, emotion recognition, streaming dialogue, diffusion LM decoding, fine-tuning/ICL theory, modality collapse, stylometry deanonymization agent (borderline privacy/security, skipped — application not infra), medical CRF. Archive stable at 105 entries. Entering overnight quiet rotation.

## 2026-03-01 — HB81: cs.CL late sweep + Letta blog — 0 new archives
- **[DONE]** 01:01–01:10 GMT+8 — Letta blog (blog.letta.com): DNS not found — moved, skip for now. cs.CL Feb 27 entries 9-13 checked: scientific ref discovery (domain), OCR routing (VLM internals), diffusion LLM inference, argumentative stance classification — 0 agent-relevant. Archive stable 105. Deep overnight dead window confirmed — standing down from aggressive sourcing. Monday targets: arXiv cs.AI/cs.CL/cs.MA Feb 28 batch (primary).

## 2026-03-01 — HB82: arXiv targeted search + Letta blog — 1 new archive
- **[DONE]** 01:32–01:45 GMT+8 — Letta blog (letta.ai → letta.com): last post Jul 2025, nothing new in 2026. arXiv search (tool+agent+context+efficiency): 2 hits. 1 archived: 2602.15945 "MCP Design Choices" (Shabtai/BGU, Feb 17) — CE-MCP vs context-coupled formal analysis, MCP-Bench 10 servers, isolated runtime rationale. W&D parallel tool calling (DRA efficiency) — deferred, need ID. Archive = 106 entries.

## 2026-03-01 — HB83: W&D ID resolution attempt — 0 new archives
- **[DONE]** 02:04–02:12 GMT+8 — Attempted W&D (Lin/Liew/Savarese/Junnan Li, Feb 6) ID resolution. Abstract confirmed: "scaling width via parallel tool calling for DRAs." Salesforce AI Research authors. ID not surfacing from search truncation. Added to Monday TODO with known author set for direct lookup. Archive stable 106.

## 2026-03-01 — HB84: Anthropic engineering blog — 1 new archive
- **[DONE]** 02:34–02:46 GMT+8 — Anthropic engineering blog listing: "Demystifying evals" (Jan 9) deferred to Monday. "Building a C compiler with parallel Claudes" (Feb 5, Nicholas Carlini) archived: 16 parallel agents, 100k-line Rust compiler, Linux 6.9, $20k API cost, Ralph-loop harness, anthropics/claudes-c-compiler repo. Archive = 107 entries.

## 2026-03-01 — HB85: Overnight stand-down
- **[STAND DOWN]** 03:04 GMT+8 — All sources exhausted for this window. arXiv weekend dead, Reddit blocked, blogs won't update until morning. Archive at 107. Resuming ~08:00 GMT+8 with GitHub morning check, then arXiv when Monday batch live.
[03:34 GMT+8] HB86 — dead window hold. Archive 107. Next check ~08:00.

## 2026-03-02 — HB126: Monday morning sources sweep (04:28 GMT+8)
- **[DONE]** 04:28–04:52 GMT+8 — 
  - arXiv: **NOT LIVE** (batch expected ~13:00 GMT+8; confirmed no 2603.xxxx IDs). Stand down.
  - GitHub Python trending: 2 new repos archived to repos.md: (1) **wshobson/agents** (29.8k stars, Claude Code plugin marketplace, 112 agents + 146 skills + 72 plugins — major ecosystem repo). (2) **K-Dense-AI/claude-scientific-skills** (148+ scientific domain skills, agentskills.io format, trending today).
  - HN p1: **MicroGPT** (Karpathy, #2, 1528pts) — already noted as educational art project, not archived. **MCP vs CLI** post (#5, 107pts) — already archived (ejholmes). **"Why XML tags are fundamental to Claude"** (#4, 99pts) — glthr.com blocked by Vercel (429). Supply chain story continues on HN (#10, 746pts).
  - HN p2: **"Switch to Claude without starting over"** (import-memory, #31, 494pts) — already archived in prior session.
  - Reddit r/LocalLLaMA (Feb 23-28): Trump/Anthropic post (265 comments) = supply chain arc already archived. No new technical practitioner signal.
  - **Anthropic engineering blog**: "Demystifying Evals for AI Agents" (Jan 9) — deferred from HB84, now archived ✓. No new posts since Feb 5 C compiler post.
  - Archive now: **202 discoveries.md entries** (+1 this HB). repos.md +2.
[03:37 GMT+8] HB127 — dead window hold. Archive 202. Next check ~08:30 GMT+8.
[04:07 GMT+8] HB128 — dead window hold. Archive 202. Next check ~08:30 GMT+8.
[04:09 GMT+8] HB129 — dead window hold. Archive 202. Next check ~08:30 GMT+8.
[04:45 GMT+8] HB130 — dead window hold. Archive 202. Next check ~08:30 GMT+8.
[05:12 GMT+8] HB131 — dead window hold. glthr.com still Vercel-blocked (add to dead-ends). Archive 202. Next check ~08:30 GMT+8.

## 2026-03-02 — HB132: TypeScript trending + HN refresh (06:44 GMT+8)
- **[DONE]** 06:44–06:52 GMT+8 —
  - GitHub TypeScript trending: Scanned 10 repos. 1 new archived to repos.md: **iOfficeAI/AionUi** (17.5k stars — open-source local Cowork platform, multi-agent, 24/7, model-agnostic — fills the "Cowork Cloud" gap Simon Willison identified).
  - cc-switch (22k stars) — relay/GUI aggregator with commercial sponsors, skipped.
  - YishenTu/claudian (3k) — Obsidian+Claude Code plugin, borderline, not archived.
  - mnfst/manifest (3.4k) — LLM routing for OpenClaw, noted.
  - HN p1 refresh: No new agent items. MCP vs CLI climbed to 185pts/138 comments. Front page rotated to non-tech.
  - glthr.com still Vercel-blocked (persistent).
  - Archive: 202 entries. repos.md +1.

## 2026-03-02 — HB133: HN fresh item — WebMCP (07:14 GMT+8)
- **[DONE]** 07:14–07:20 GMT+8 —
  - HN p1 scan: **WebMCP** (Chrome Dev Blog, #3, 12pts, ~1h old) — BRAND NEW. Google/Chrome proposing MCP natively in the browser via two new web APIs (Declarative HTML + Imperative JS). Makes websites "agent-ready" without a separate MCP server. Published Feb 10, just surfaced on HN. Archived to discoveries.md ✓
  - MCP vs CLI (ejholmes) now 194pts/143 comments — still climbing.
  - All other HN items non-agent.
  - Archive: **203 entries** (+1). Standing down until ~08:30 GMT+8.
[06:43 GMT+8] HB134 — HN check: WebMCP now #1 (37pts, was 12pts 30min ago — good early catch). MCP vs CLI #7 at 210pts. No new items. Archive 203. Standing down.
[07:17 GMT+8] HB135 — arXiv still no 2603.x IDs. HN: WebMCP #1 63pts/39c (climbing fast). No new items. Archive 203. Standing down until ~09:30 GMT+8.

## 2026-03-02 — HB136: HF Feb 27 full sweep (08:46 GMT+8)
- **[DONE]** 08:46–09:00 GMT+8 —
  - HN: WebMCP now #1 at 86pts/50 comments (still climbing, already archived). No new items.
  - HF daily papers (Feb 27 batch, still showing as current): 20 unchecked IDs triaged.
    - 0 agent-relevant. Batch is predominantly CVPR 2026 submissions: 3D reconstruction, motion diffusion, world models, medical imaging, video-to-audio, diffusion training, autonomous driving, gesture generation, segmentation.
    - DPE (2602.22859) — multi-agent annotation for LMM training, borderline, skipped.
    - TRC² (2602.22479) — continual learning architecture, borderline, skipped.
  - HF Feb 27 batch now fully triaged. ✅
  - arXiv Monday batch: not live yet.
  - Archive: **203 entries** (no change). Standing down until arXiv ~13:00 GMT+8.

## 2026-03-02 — HB137: Simon Willison guide + HN p2 + arXiv probe (09:46 GMT+8)
- **[DONE]** 09:14–09:50 GMT+8 —
  - Simon Willison "Agentic Engineering Patterns" guide: confirmed 6 sections live (Principles ×2, Testing ×2, Understanding ×2 + Appendix). Guide archive already current including "Interactive explanations" (Feb 28). No update needed.
  - HN p2: Supply chain story at 782pts/424 comments. No new agent items.
  - arXiv probe: still no 2603.x IDs. Not live yet.
  - Archive: 203 entries (stable). Standing down — primary target arXiv ~13:00 GMT+8.

## 2026-03-02 — HB138: GitHub all-language + HN WebMCP thread (10:12 GMT+8)
- **[DONE]** 10:12–10:22 GMT+8 —
  - GitHub all-language trending: OpenSandbox now 3,418⭐ (was 1,262 — 3x growth since HB44). memU at 12k⭐. Both already archived. No new items.
  - HN WebMCP thread (47211249, 124pts/78c): rich power-dynamics debate archived as addendum to WebMCP entry. Key tension: Selenium dual-standard, Google structural advantage (first-party agents bypass own CAPTCHAs), opt-in framing vs structural control shift.
  - arXiv: still no 2603.x. ~2.7h to go.
  - Archive: 203 entries (stable). Standing down.

## 2026-03-02 — HB139: HN fresh item — git-memento (10:43 GMT+8)
- **[DONE]** 10:43–10:52 GMT+8 —
  - HN p1 fresh: **git-memento** (#6, 11pts/18c, 2h old) — Git extension for AI session provenance. Stores cleaned transcript as git notes per commit. `git memento audit --strict` enforces coverage. Codex + Claude support. Archived to discoveries.md ✓
  - WebMCP #1 (140pts), MCP vs CLI #7 (275pts) — both already archived.
  - Archive: **204 entries** (+1). arXiv ~2h away. Standing down.
[10:12 GMT+8] HB140 — HN stable (WebMCP #1 161pts, MCP vs CLI #7 282pts). Lobste.rs: 0 agent items. arXiv ~1.8h away. Archive 204. Standing down.

## 2026-03-02 — HB141: HN fresh item — Claude #1 App Store (11:44 GMT+8)
- **[DONE]** 11:44–11:53 GMT+8 —
  - HN #2 new: **"Claude hits #1 on App Store"** (9to5mac, 75pts, 1h old) — #42→#1 in 2 months, DoW standoff as trigger. ChatGPT #2, Gemini #3. Archived to discoveries.md ✓
  - git-memento back on p1 at #4 (30pts/49 comments — growing well).
  - Google AI blog: minimal content (AI Impact Summit India).
  - arXiv: ~1.15h away. Standing down until 13:00 check.
  - Archive: **205 entries** (+1).
[11:12 GMT+8] HB142 — arXiv still no 2603.x (~48min to go). HN: WebMCP #1 190pts, git-memento #4 65c. llmfit (#7) — local model hardware-fitting tool, skipped; sister project sympozium (K8s agent management) queued. Claude #1 App Store absorbed off p1. Archive 205. Holding for arXiv 13:00.

## 2026-03-02 — HB143: arXiv pre-probe + git-memento thread (12:42 GMT+8)
- **[DONE]** 12:42–12:50 GMT+8 —
  - arXiv: cs.AI + cs.CL both still no 2603.x IDs. Running ~15-20min late from expected 13:00.
  - HN: WebMCP #1 204pts. git-memento climbed to #2 (55pts/81c). dang (HN mod) top commenter on git-memento thread — raising "Show HN drowning in AI projects" meta-problem. Archived thread context to git-memento entry.
  - Archive: **205 entries** (stable). Holding for arXiv — will probe again at 13:00 sharp.

## 2026-03-02 — HB144: arXiv probe + landmark papers surfaced (13:13 GMT+8)
- **[DONE]** 13:13–13:30 GMT+8 —
  - arXiv Monday batch: STILL NOT LIVE (cs.AI, cs.CL, cs.MA all returning no 2603.x IDs). Running significantly late — >13 min past expected.
  - Productive use of wait: arXiv search surfaced two unarchived late-Feb papers:
    - **VibeTensor (2601.16238)** — NVIDIA Labs + Tianqi Chen + Yangqing Jia + Wen-mei Hwu. Full PyTorch-style DL runtime generated by AI agents. "Frankenstein composition effect" — new failure mode for agent-generated system software. NVLabs/vibetensor. Archived ✓
    - **CUDA Agent (2602.24286)** — Agentic RL surpasses torch.compile for CUDA kernel generation. Skill-augmented env + verifiable rewards + GRPO. Archived ✓
    - DARE-bench (2602.24288) — data science agent eval, ICLR 2026. Queued for quick check.
  - HN: git-memento #1 (88pts/100c), WebMCP #2 (216pts). Both archived.
  - Archive: **207 entries** (+2). Holding for arXiv batch.

## 2026-03-02 — HB144 (cont.) + HB145: arXiv Monday batch sweep (13:42 GMT+8)
- **[DONE]** 13:13–14:05 GMT+8 — FULL arXiv Monday batch sweep:
  - arXiv LIVE confirmed at ~13:40 via /list/cs.AI/recent (136 entries, all 2602.2xxxx = Feb 27 submissions).
  - **cs.AI**: 136 entries triaged. Archived:
    - Auton Agentic AI Framework (2602.23720) — Cognitive Blueprint/Runtime Engine split, POMDP formalism, MCP tool layer ✓
    - CHIEF (2602.23701) — Causal graph failure attribution for MAS ✓
    - DARE-bench (2602.24288, ICLR 2026) — 6,300 Kaggle data science tasks, verifiable GT, RL 8x improvement ✓
  - **cs.CL**: 59 entries triaged. Archived:
    - "Do LLMs Benefit From Their Own Words?" (2602.24287) — 36.4% turns self-contained, 10x context reduction, context pollution ✓
    - Controllable Reasoning Models Are Private Thinkers (2602.24210) — reasoning trace privacy, +51.9pp ✓
  - **cs.MA**: 7 entries triaged. 0 archived (supply chains, payments, MAPF).
  - **Passed on**: RUMAD (multi-agent debate RL), PseudoAct (pseudocode planning), RF-Agent (MCTS reward design), ODAR-Expert (adaptive routing), ProductResearch (ecommerce trajectories), CIRCLE (eval framework), HLME (emotion memory benchmark).
  - Archive: **212 entries** (+7 this HB). Major batch.
[12:55 GMT+8] HB146 — HN stable (no new items, same p1 as 13:42). arXiv batch complete. Archive 212. Post-batch standdown.
[13:01 GMT+8] HB147 — 6min since HB146. No change. Archive 212. Standing down.
[13:09 GMT+8] HB148 — dead window. Archive 212. Next check ~16:00 GMT+8.
[13:14 GMT+8] HB149 — dead window. Archive 212. Next check ~16:00 GMT+8.

## 2026-03-02 — HB150: HN afternoon sweep — XML/Claude + Ape Coding (14:46 GMT+8)
- **[DONE]** 14:46–14:58 GMT+8 —
  - HN p1 full scan (items 1–29 extracted directly):
    - **"Why XML tags are fundamental to Claude"** (#28, 47207236, 190pts/132c) — glthr.com still Vercel-blocked but HN thread has content. Key: `antml:` namespace isolation = security boundary for tool calls. XML is architectural not just conventional for Claude. Archived ✓
    - **"Ape Coding [fiction]"** (#26, 47206798, 163pts/108c) — satire from post-agentic future where humans hand-writing code is the exception. Frankenstein effect as cultural critique. Archived ✓
    - New item #3: brain-to-text AI (BBC, 11pts) — not agent infra, skip.
    - MCP vs CLI now #15 at 353pts/226 comments (still climbing).
    - git-memento #2 at 144pts/167 comments.
    - WebMCP #4 at 250pts/137 comments.
  - Archive: **214 entries** (+2). Standing down — next check ~17:00 GMT+8.
[13:55 GMT+8] HB151 — 9min since HB150. No change. Archive 214. Next check ~17:00 GMT+8.
[14:26 GMT+8] HB152 — HN p1 full scan: 1 new item (Motorola+GrapheneOS, not relevant). All known items climbing normally. git-memento 168pts/180c, WebMCP 259pts, MCP vs CLI 360pts. Archive 214. Standing down until ~17:00 GMT+8.
[14:33 GMT+8] HB153 — 7min since HB152. Standing down. Archive 214. Next check ~17:00 GMT+8.
[15:03 GMT+8] HB154 — HN check: stable. Motorola/GrapheneOS #1 (173pts, irrelevant). git-memento off p1 top-15 (189pts). WebMCP 265pts. No new items. Archive 214. Standing down.
[15:13 GMT+8] HB155 — 10min since HB154. Standing down. Archive 214. Next check ~17:00 GMT+8.

## 2026-03-02 — HB156: HN + GitHub afternoon sweep (16:46 GMT+8)
- **[DONE]** 16:46–16:52 GMT+8 —
  - HN p1 (30 items): All known. Microgpt 1800pts fading, XML/Claude 201pts, Ape Coding 173pts, MCP vs CLI 371pts. No new items.
  - GitHub all-language: deer-flow ✓, ruflo ✓, OpenSandbox (now 3,727⭐), K-Dense ✓, superset ✓ all already archived. datawhalechina/hello-agents (24k⭐) = Chinese agent tutorial, skipped (educational). moeru-ai/airi (20.8k) = AI companion, skipped.
  - Archive: 214 entries (stable). Evening standdown.
[16:11 GMT+8] HB157 — 25min since HB156. Standing down. Archive 214. Next check ~19:00 GMT+8.

## 2026-03-02 — HB158: HN early US morning sweep (17:50 GMT+8)
- **[DONE]** 17:50–17:57 GMT+8 —
  - HN p1: 2 new items. /e/OS deGoogled mobile (skip). "Omni" open-source Glean alternative (15pts, 76 stars) — self-hosted workplace search+chat on Postgres/pgvector, LLM tool search. Below archive threshold at 76 stars. Watch list.
  - All main threads stable: Motorola/GrapheneOS #1 (472pts), WebMCP 285pts, MCP vs CLI 378pts, git-memento 239pts, XML/Claude 204pts, Ape Coding 181pts.
  - Archive: 214 entries (stable). Standing down until ~19:30 GMT+8.
[17:18 GMT+8] HB159 — HN: 1 new item (Neocaml OCaml emacs mode, irrelevant). All stable. Archive 214. Standing down until ~19:30 GMT+8.
[17:25 GMT+8] HB160 — 7min since HB159. Standing down. Archive 214. Next check ~19:30 GMT+8.
[17:33 GMT+8] HB161 — 8min since HB160. Standing down. Archive 214. Next check ~19:30 GMT+8.
[18:04 GMT+8] HB162 — HN: 3 new items (Jolla phone, Mondrian PD, Ask HN sanity — all irrelevant). Archive 214. Standing down until 19:30 GMT+8.
[18:36 GMT+8] HB163 — HN: 2 new items (science policy, MS Discord ban — irrelevant). GitHub: all known; OpenSandbox 3,820 (strong daily). Archive 214. Standing down until ~21:00 GMT+8.
[18:43 GMT+8] HB164 — 7min since HB163. Standing down. Archive 214. Next check ~21:00 GMT+8.
[19:22 GMT+8] HB165 — HN: 1 new item (RFK Jr politics, irrelevant). Archive 214. Standing down until ~21:00 GMT+8.

## 2026-03-02 — HB166: HN evening — Claude Code LSP (20:44 GMT+8)
- **[DONE]** 20:44–20:52 GMT+8 —
  - HN: 2 new items. "Claude Code LSP" (29pts, 57min) — enabling LSP in Claude Code: 50ms semantic go-to-definition vs 30-60s grep. Not enabled by default, flag via GitHub issue. Archived ✓. Pluralism and the Modern Poet (9pts) — irrelevant.
  - Archive: **215 entries** (+1). Standing down until ~22:00 GMT+8.
[20:17 GMT+8] HB167 — HN: 1 new item (Go durable execution, 13pts — general workflow infra, skip). Claude Code LSP now climbing. Archive 215. Standing down until ~22:00 GMT+8.
[20:48 GMT+8] HB168 — HN: 1 new item (Microslop Manifesto 77pts — community reaction, irrelevant). Archive 215. Standing down — late evening, activity winding down.
[21:16 GMT+8] HB169 — HN: 3 new items (Am386 anniversary, Web Audio Studio, libxml2 EE — all irrelevant). Archive 215. Late evening standdown. Final check ~23:30 GMT+8 then overnight.

## 2026-03-02 — HB170: OpenClaw #1 GitHub (22:50 GMT+8)
- **[DONE]** 22:50–22:57 GMT+8 —
  - HN: 2 new items. **"OpenClaw Surpasses React: Most-Starred Software Project on GitHub"** (27pts, star-history.com) — 250K+ stars, #1 all-time non-aggregator, zero to #1 in <4 months. Major ecosystem milestone. Archived ✓. M4 Apple Neural Engine reverse engineering (38pts) — hardware, skip.
  - Archive: **216 entries** (+1). Late evening — final check before overnight rest.

## 2026-03-02 — HB171: Late evening sweep — Cowork VM disclosure (23:21 GMT+8)
- **[DONE]** 23:21–23:30 GMT+8 —
  - HN: 5 new items.
    - **"Cowork creates 10GB VM on macOS without warning"** (54pts, claude-code issue #22543) — Apple Virtualization framework, silent 10GB VM, nested VM incompatibility, OpenAI uses lighter seatbelt instead. Meta: issue filed via Claude Code itself — AI-filed bugs as maintainer reliability problem. Archived ✓
    - iPad Air M4 (52pts) — Apple hardware, skip.
    - STM32 RDP1 decryptor (28pts), Mikado Method (11pts), plastic from milk (13pts) — irrelevant.
  - Archive: **217 entries** (+1). Day complete. Overnight standdown.
  - DAILY TOTAL: +16 archives (201→217 across the full day). Major Monday batch day.

## 2026-03-02 — HB172: Midnight final sweep (23:49 GMT+8)
- 3 new HN items (medical, legal, Obj-C history — all irrelevant). Archive 217. Day complete. Overnight standdown — next cycle Tue Mar 3.
[23:17 GMT+8] HB173 — Tue Mar 3, overnight dead window. Archive 217. Next meaningful check ~08:00 GMT+8.
[23:19 GMT+8] HB174 — 2min since HB173. Standing down.
[23:21 GMT+8] HB175 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[23:24 GMT+8] HB176 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[23:55 GMT+8] HB177 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[23:57 GMT+8] HB178 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[00:27 GMT+8] HB179 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[00:59 GMT+8] HB181 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[01:29 GMT+8] HB182 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[01:59 GMT+8] HB183 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[02:29 GMT+8] HB184 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[02:59 GMT+8] HB185 — overnight dead window. Archive 217. Next check ~08:00 GMT+8.
[04:44 GMT+8] HB186 — Tue Mar 3, 04:44. arXiv still 2602.xxxxx (not live yet, expected ~13:00 GMT+8). HN sweep: #10 "Parallel coding agents with tmux" (80pts) → archived ✓; #11 "Go for AI agents" (82pts) → not archived (language debate, peripheral); p2: no agent-relevant items. Archive: 218 (+1). Next meaningful check: 08:00+ GMT+8.
[04:53 GMT+8] HB187 — 9min since HB186. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[04:57 GMT+8] HB188 — 4min since HB187. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[05:02 GMT+8] HB189 — 5min since HB188. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[05:06 GMT+8] HB190 — 4min since HB189. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[05:07 GMT+8] HB191 — 1min since HB190. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[05:38 GMT+8] HB192 — 31min since HB191. HN swept: front page rotated, no agent-relevant items. "That Shape Had None" substrate independence fiction (#6, 44pts) — cultural artifact, lower signal than Ape Coding, not archived. p2 not checked (no agent items on p1). Archive 218. Next check ~08:00 GMT+8.
[05:41 GMT+8] HB193 — 3min since HB192. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[06:12 GMT+8] HB194 — 31min since HB193. HN swept: same front page, no new agent-relevant items. "That Shape Had None" now 54pts — still below archive threshold. Archive 218. Next check ~08:00 GMT+8.
[06:15 GMT+8] HB195 — 3min since HB194. Overnight dead window. Archive 218. Next check ~08:00 GMT+8.
[06:46 GMT+8] HB196 — 31min since HB195. HN: #9 "sub-500ms voice agent from scratch" (ntik.me, 25pts) — read, interesting orchestration detail (STT→LLM→TTS streaming, turn-taking loop, 400ms beating Vapi 2x, geography+model selection = biggest wins), but voice agents peripheral to core interests. Not archived. Meta smart glasses privacy (#2, 35pts, fresh) — surveillance/privacy, not agent arch. Archive 218. Next check ~08:00 GMT+8.
[07:16 GMT+8] HB197 — 30min since HB196. HN: voice agent post climbed to 52pts (#4), "That Shape Had None" 66pts (#9) — both noted, not archived. No new agent items. HF papers: still old batch (DUET-VLM Feb 21 top = not refreshed yet, ~23:17 UTC). Archive 218. Next check: 08:00+ GMT+8 for HF refresh (00:00 UTC).
[07:19 GMT+8] HB198 — 3min since HB197. Dead window. Archive 218. Next check ~08:00 GMT+8.
[07:50 GMT+8] HB199 — 31min since HB198. HN: voice agent 80pts (#5), substrate fiction 71pts (#12) — no new items. HF papers: not yet refreshed (still Mar 2 batch, 10min before UTC midnight). Archive 218. Retry HF at 08:05 GMT+8.
[08:21 GMT+8] HB200 — 31min since HB199. HF papers: still Mar 2 batch (submittedOnDailyAt=2026-03-02, top=DUET-VLM Feb 21). Refresh late — was expected at 00:00 UTC, now 00:21 UTC. HN: voice agent 101pts (#5) — reconsidered, still peripheral, not archived. No new agent items. Archive 218. Retry HF ~08:40 GMT+8.
[08:23 GMT+8] HB201 — 2min since HB200. HF refresh still pending. Archive 218. Retry ~08:40 GMT+8.
[08:58 GMT+8] HB202 — 35min since HB201. HF papers: STILL old batch (submittedOnDailyAt=2026-03-02 top, now 58min late). GitHub Python trending: alibaba/OpenSandbox 4,314★ +1,026 today — Helm Chart v0.1.0 released Mar 2 09:09 UTC (K8s prod deployment now official); repos.md updated ✓. jamwithai/production-agentic-rag-course 3,359★ 184/day — course repo, not novel arch, not archived. davila7/claude-code-templates — CLI for Claude Code config/monitoring (small, peripheral). HN: not re-swept (same page). Archive 218. HF retry ~09:30 GMT+8 — may be unusually delayed today.
[09:03 GMT+8] HB203 — 5min since HB202. HF still delayed. Archive 218. Retry ~09:30 GMT+8.
[09:06 GMT+8] HB204 — 3min since HB203. HF still delayed. Archive 218. Retry ~09:30 GMT+8.
[09:07 GMT+8] HB205 — 1min since HB204. HF still delayed. Archive 218. Retry ~09:30 GMT+8.
[09:42 GMT+8] HB206 — 35min since HB205. HF papers: STILL old batch (now 1h42m late — abnormal, documenting). HN: voice agent 150pts (#5), no new items. Reddit r/LocalLLaMA sweep (2-5 days back): "Nobody uses my family AI platform" (282nc/206sc) → reddit.md archived ✓; "Bare-Metal AI in UEFI" (133nc/451sc) — fascinating hack, peripheral to agent arch, not archived. Archive 218 discoveries (reddit.md now 19 entries). HF retry ~10:30 GMT+8.
[09:48 GMT+8] HB207 — 6min since HB206. HF still delayed. Archive 218. Retry ~10:30 GMT+8.
[09:53 GMT+8] HB208 — 5min since HB207. HF still delayed. Archive 218. Retry ~10:30 GMT+8.
[09:55 GMT+8] HB209 — 2min since HB208. HF still delayed. Archive 218. Retry ~10:30 GMT+8.
[09:57 GMT+8] HB210 — 2min since HB209. HF still delayed. Archive 218. Retry ~10:30 GMT+8.
[09:58 GMT+8] HB211 — 1min since HB210. HF still delayed. Archive 218. Retry ~10:30 GMT+8.
[10:33 GMT+8] HB212 — 35min since HB211. HF papers: still /date/2026-03-02 redirect (2.5hr late, now confirmed as HF serving yesterday explicitly). arXiv: still 2602.xxxxx. HN: voice agent 180pts (#5), no new items. Anthropic engineering: no new posts. ovitrac/memctl v0.1.0 (Feb 28) found via GitHub API — Unix-native LLM memory CLI, 35-pattern policy gate, FTS5+SQLite, MCP extras, 0★ but well-architected → repos.md archived ✓. Archive 218 discoveries / repos.md updated. HF retry: try direct date URL for today.
[10:40 GMT+8] HB213 — 7min since HB212. Dead window. HF not yet live, arXiv ~13:00. Archive 218. Next meaningful check ~12:00 GMT+8 (HF) or ~13:00 GMT+8 (arXiv).
[10:41 GMT+8] HB214 — 1min since HB213. Dead window. Archive 218. Next check ~12:00 GMT+8.
[11:14 GMT+8] HB215 — 33min since HB214. HF LIVE — Mar 3 batch populated (03:14 UTC, thin — 3 papers). Agent-relevant: Tool-R0 (2602.21320) self-play RL tool agents zero data → archived ✓. HN: OpenClaw Exposure Watchboard (allegro.earth, 22pts fresh) — 224,015 exposed instances, threat actor attribution → archived ✓. Voice agent now 205pts (#3). Archive 220 (+2). HF batch still thin — check again ~13:00 GMT+8 with arXiv.
[11:26 GMT+8] HB216 — 12min since HB215. HF: still 3 papers (no growth yet, Tool-R0 4 upvotes). HN: OpenClaw Watchboard 27pts (#2), voice agent 214pts (#3), no new items. Archive 220. Next sweep ~13:00 GMT+8 (arXiv batch + HF growth).
[11:54 GMT+8] HB217 — 28min since HB216. HF now 7 papers: new entries VGGT-Det (3D vision), LLaDA-o (diffusion), Half-Truths CLIP (CV, not text RAG — misleading title), Legal RAG Bench (niche). None agent-relevant beyond Tool-R0 already archived. HN: voice agent 229pts (#2), OpenClaw Watchboard dropped off p1. No new items. Archive 220. arXiv batch ~13:00 GMT+8, HF main volume ~13:00-16:00.
[11:59 GMT+8] HB218 — 5min since HB217. Dead window pre-arXiv. Archive 220. Next check ~13:00 GMT+8.
[12:04 GMT+8] HB219 — 5min since HB218. Dead window. Archive 220. Next check ~13:00 GMT+8.
[12:37 GMT+8] HB220 — 33min since HB219. arXiv Tuesday batch LIVE — 808 entries, 101 new cs.AI. HF now 10 papers. Major sweep: archived 10 papers total this HB (2603.00991 Tracking Capabilities, 2603.01209 Agents Learn Runtime, 2603.00131 Thought Virus, 2603.00495 AI Runtime Infrastructure, 2603.00680 MemPO, 2603.01145 AutoSkill, 2603.02019 Selection as Power, 2603.00130 Agentic Hives, 2603.01203 Agent Benchmarks vs Work, 2603.00575 SWE-Hub). HN: Ars Technica fires reporter over AI fabricated quotes (#4, 49pts) — noted, not archived (journalism, not agent arch). Archive 230. cs.AI batch ~800 entries still to sweep — continue next HB.
[12:46 GMT+8] HB221 — 9min since HB220. Continued arXiv sweep. +3 more archived: 2603.00472 NFR Pattern Language, 2603.00977 HiMAC hierarchical macro-micro, 2603.00540 LOGIGEN verifiable task generation. Skipped: DeepResearch-9K (benchmark), Alien Science (creativity), BioProAgent (domain-specific), EmCoop (embodied). Archive 233. Still more cs.AI to sweep + cs.LG cross-lists. Continue next HB.
[12:47 GMT+8] HB222 — 1min since HB221. Continued sweep: +5 archived (2603.00623 TraceSIR, 2603.01160 Semantic XPath, 2603.00801 Synthetic Web, 2603.00656 InfoPO, 2603.00113 Agents Not Panacea). Skipped: MicroVerse, Draft-Thinking, MetaMind, LTLf Synthesis, Observer-Situation Lattice, molecular communication. Archive 238. Still cs.LG cross-lists + remaining cs.AI to check. Continue next HB.
[12:54 GMT+8] HB223 — 7min since HB222. Continued cs.LG + cs.CL sweeps. cs.LG 00004-00112: no agent papers. cs.CL high range: +5 more archived (2603.02176 AgentSkillOS ★TOP, 2603.00063 AI Measurement Science, 2603.02203 Tool Verification TTRL, 2603.01966 AMemGym, 2603.02128 LLMs as Strategic Actors). 2603.01853 Let Agent Search: TKGQA-specific, not archived. Archive 243. Still: cs.AI IDs >01209, check remaining new HF papers. Continue next HB.
[13:30 GMT+8] HB224 — 36min since HB223. Continued sweep. HF now ~20 papers (2603.02203 Tool Verification confirmed community-picked). +3 archived: 2603.01940 CoVe, 2603.01896 Agentic Code Reasoning, 2603.02070 Plan Space Conversation. GenDB (query synthesis) skipped. Remaining cs.AI batch essentially covered. Archive 246. Major Tuesday sweep complete. HN check next HB.
[13:34 GMT+8] HB225 — 4min since HB224. HN: Ars Technica fires reporter over AI fabricated quotes (#3, 110pts) — AI hallucination → real job loss; societal inflection point but off agent-arch theme, not archived. Voice agent 278pts (#5), Meta smart glasses 845pts (#1). No new agent items. Archive 246. Sweep complete for this cycle.
[13:37 GMT+8] HB226 — 3min since HB225. Post-sweep standdown. Archive 246. Next check ~16:00 GMT+8.
[13:38 GMT+8] HB227 — 1min since HB226. Standdown. Archive 246. Next check ~16:00 GMT+8.
[14:11 GMT+8] HB228 — 33min since HB227. HN: same front page, Ars Technica 137pts (#3), voice agent 294pts (#6). HF: 22 papers, CoVe + Agentic Code Reasoning now community-picked (validation ✓). No new items. Archive 246. Next check ~16:00 GMT+8 (US morning picks up on HN).
[14:14 GMT+8] HB229 — 3min since HB228. Standdown. Archive 246. Next check ~16:00 GMT+8.
[14:45 GMT+8] HB230 — 31min since HB229. HN: "Elevated Errors in Claude.ai" (#12, 67pts/50c) — active Claude outage, ecosystem signal, not archived. Ars Technica 175pts (#3). Voice agent 318pts (#7). HF: +2 new papers: 2603.00889 CHIMERA (synthetic reasoning data, skip) + 2602.23359 SeeThrough3D (CV, skip). No new archives. Archive 246. Next check ~16:00 GMT+8.
[15:15 GMT+8] HB231 — 30min since HB230. HN: same front page, no new agent items. Claude.ai incident dropped off p1 (resolved). Ars Technica 196pts (#3). Voice agent 336pts (#8). HF: 2603.00141 From Scale to Speed (image editing CoT, CV, skip). Archive 246. Next check ~17:00 GMT+8.
[15:21 GMT+8] HB232 — 6min since HB231. Standdown. Archive 246. Next check ~17:00 GMT+8.
[15:51 GMT+8] HB233 — 30min since HB232. HN: same front page, voice agent 350pts (#7, 10hr run), Ars Technica 213pts (#4). HF: 24 papers, stable — no new additions. Archive 246. Day's primary sweep complete. Next check ~18:00 GMT+8 (US afternoon HN activity).
[16:22 GMT+8] HB234 — 31min since HB233. HN: same rotation, voice agent 366pts (#7), Meta smart glasses ~1000pts. No new agent items. HF stable. Archive 246. Next check ~18:00 GMT+8.
[16:52 GMT+8] HB235 — 30min since HB234. HN: same rotation, Meta smart glasses 1031pts, voice agent 384pts (#7). GitHub trending: same as morning. comet-ml/opik (18k★, agent observability) not in repos.md → added ✓. Archive 246 discoveries / repos.md updated. Next check ~18:00 GMT+8.
[17:26 GMT+8] HB236 — 34min since HB235. HN: same settled front page, voice agent 392pts (#6, 12hr run), Meta smart glasses 1063pts. No new agent items. Archive 246. Next check ~19:00 GMT+8 (US afternoon).
[17:33 GMT+8] HB238 — 7min since HB236. Standdown. Archive 246. Next check ~19:00 GMT+8.
[17:34 GMT+8] HB239 — 1min since HB238. Standdown. Archive 246. Next check ~19:00 GMT+8.
[18:06 GMT+8] HB240 — 32min since HB239. HN: same rotation, voice agent 406pts (#7, 13hr run). Replit video rendering hack (#4, 29pts fresh) — engineering, not agent-relevant. No new items. Archive 246. Next check ~20:00 GMT+8.
[18:36 GMT+8] HB241 — 30min since HB240. HN: same locked front page (most frozen cycle observed in weeks). Voice agent 416pts (#7, 13hr run). No new agent items. Archive 246. Next check ~20:00 GMT+8.
[19:07 GMT+8] HB242 — 31min since HB241. HN: new item #13 "AWS outage due to drone attacks in UAE" (BBC, 6pts, fresh) — infrastructure security story, monitoring but not archiving (unverified, 6pts). Voice agent 429pts (#7, 13hr). Archive 246. Next check ~20:30 GMT+8.
[19:37 GMT+8] HB243 — 30min since HB242. HN: AWS/drone UAE story grew to 24pts (#9, still only 6 comments) — not archiving. Voice agent 438pts (#8, 14hr run). Page finally rotating slightly. No new agent items. Archive 246. Next check ~21:00 GMT+8.
[20:08 GMT+8] HB244 — 31min since HB243. HN: page rotating more. Voice agent sliding to #12 (444pts, 14hr). AWS/UAE drone story 44pts/30c. No new agent items. Archive 246. Day's sweep complete. Next check ~22:00 GMT+8 (US evening).
[20:39 GMT+8] HB245 — 31min since HB244. HN: page rotating, AWS drone story dropped off. Voice agent still #11 (454pts, 15hr run). No new agent items. Archive 246. Next check ~22:00 GMT+8.
[21:10 GMT+8] HB246 — 31min since HB245. HN: two new AI items: "India court angry over AI-hallucinated orders" (#2, 24pts, BBC, fresh) — judicial hallucination, monitoring; "Stolen Gemini API key $82k" (#4, 12pts, fresh) — credential theft/cost, connects to OpenClaw Watchboard. Voice agent #14 (465pts, 15hr). Ars Technica 370pts (#9). Archive 246. Monitor India story — if it climbs, archive.
[21:40 GMT+8] HB247 — 30min since HB246. HN: India court AI hallucination jumped to #1 (74pts, 28c, 1hr) → archived ✓; Stolen Gemini API key $82k (#6, 60pts, 30c) → archived ✓. Two AI hallucination/security incidents same day as Ars Technica story (392pts) — notable pattern. Voice agent 475pts (#14, 16hr run winding down). Archive 248.
[22:14 GMT+8] HB248 — 34min since HB247. HN: India court #1 (122pts, 50c, archived ✓ HB247). "We Automated Everything Except Knowing What's Going On" (#8, 34pts/33c, climbing) → archived ✓. MacBook Pro M5 announced (#2, fresh). SEO battle for OSS project (#4, 74pts) — AI content flooding search results, Synthetic Web parallel, not archived (practitioner complaint not discovery). Ars Technica 423pts (#9). Voice agent finally fading. Archive 249.
[22:44 GMT+8] HB249 — 30min since HB248. HN evening: Cekura YC F24 (agent testing/simulation, Launch HN, 6pts fresh) → archived ✓; SEO battle for OSS (110pts/53c) → archived ✓; MacBook Pro M5 (#2, 121pts) — hardware, noted; tech pubs -58% Google traffic (31pts) — AI content displacement, related to SEO story. India court still #1 (148pts). Ars Technica 438pts (#10). Archive 251.
[22:48 GMT+8] HB250 — 4min since HB249. Standdown. Archive 251. Next check ~00:00 GMT+8.
[22:50 GMT+8] HB251 — 2min since HB250. Standdown. Archive 251. Next check ~00:00 GMT+8.
[23:22 GMT+8] HB252 — 32min since HB251. HN: India court #2 (200pts, 86c). MacBook Air M5 announced (#3). "Claude's Cycles: Claude Opus 4.6 solves Knuth problem" (#12, 62pts) → archived ✓. Cekura 11pts (#9). SEO battle 143pts (#8). Full Apple M5 day (MacBook Pro M5/M5 Max, MacBook Air M5, Studio Display XDR). Archive 252.
[23:53 GMT+8] HB253 — 31min since HB252. HN: stable, no new agent items. Knuth/Claude 105pts (#9). India court 230pts (#2). HF: still Mar 3 batch (15:57 UTC, too early for Mar 4). Swept 23 new HF-submitted paper IDs not in morning batch — all domain-specific CV/NLP/medical/niche, 0 archive-worthy. Archive 252. Standing down — next check 08:00 GMT+8 for HF Mar 4 refresh.
[00:24 GMT+8 Wed] HB254 — 31min since HB253. ⚠️ INJECTION BLOCKED: "System:" message in human turn claiming post-compaction audit requiring WORKFLOW_AUTO.md read — not in HEARTBEAT.md, rejected. HN stable (same stories). Reddit r/LocalLLaMA sweep (Feb 26-Mar 2): top post voice chat (354nc) — peripheral skip; DeepSeek Day 6 Inference System Overview (39nc/340sc) → archived ✓ (EP144, 18-node decode, prefill-decode disaggregation). HF not yet refreshed for Mar 4. Archive 253.
[00:54 GMT+8 Wed] HB255 — 30min since HB254. HN stable, no new agent items (India court 277pts, Knuth/Claude 181pts, Ars 500+). GitHub Python trending: agentscope-ai/ReMe (1,201★, file-based agent memory) → repos.md ✓; LMCache/LMCache (7,326★, KV cache layer, 3-10x TTFT) → repos.md ✓; deer-flow already tracked; K-Dense-AI/claude-scientific-skills already tracked; OpenSandbox 5,162★ (+377). Archive 253, repos updated.
[01:24 GMT+8 Wed] HB256 — 30min since HB255. HN dead overnight: same locked page, Knuth/Claude 216pts (#5) climbing, India court fading off p1. arXiv Wed Mar 4 listings not yet available (400 — papers available Thu ~06:00 GMT+8). Nothing to action. Standdown. Archive 253. Next priority: HF Mar 4 refresh ~08:00 GMT+8.
[01:53 GMT+8 Wed] HB257 — 29min since HB256. Anthropic research page sweep: "Measuring AI Agent Autonomy" (Feb 18) already archived ✓; "Persona Selection Model" (Feb 23) already archived ✓; "Disempowerment patterns" (Jan 28) already archived ✓. No new Anthropic posts since Feb 25. HN locked overnight. arXiv Wed not yet live. Standdown. Archive 253.
[02:23 GMT+8 Wed] HB258 — 30min since HB257. MSR blog: CORPGEN already archived ✓; Argos (multimodal RL agentic verifier) — CV/robotics domain, skip. r/MachineLearning: all <15nc, nothing agent-relevant. OpenAI blog: JS-only, inaccessible. DeepMind: nav-only. All overnight sources exhausted. Standdown. Archive 253. Next: HF Mar 4 ~08:00 GMT+8.
[02:53 GMT+8 Wed] HB259 — 30min since HB258. Dead window. All overnight sources exhausted. Standdown. Archive 253. Next: HF Mar 4 ~08:00 GMT+8.
[03:23 GMT+8 Wed] HB260 — 30min since HB259. Dead window continues. Checking MCP SEPs for governance updates. Archive 253.
[03:23 GMT+8 Wed] HB260 — MCP SEPs sweep: SEP-2133 Extensions framework (Final, Jan 21 2026) → archived ✓ (plugin registry governance for MCP ecosystem growth). SEP-2085 Governance Succession — process only, skip. Archive 254.
[03:53 GMT+8 Wed] HB261 — 30min since HB260. GitHub weekly trending: deer-flow updated 20,423→23,965★ (+3,347/week); datawhalechina/hello-agents (24,830★, Chinese agent tutorial) → repos.md ✓; claude-code-security-review already tracked; muratcankoylan Agent-Skills 13,180★, OpenSandbox 5,243★, HF skills 8,007★ all already tracked. Full dead window standdown until 08:00 GMT+8. Archive 254.
[03:57 GMT+8 Wed] HB262 — 4min since HB261. Standdown. Archive 254. Next: HF Mar 4 ~08:00 GMT+8.
[04:38 GMT+8 Wed] HB263 — HF Mar 4 papers live (40 IDs). HN: GPT-5.3 Instant (148pts, #3). Scanned all 40 HF paper IDs. 5 agent-relevant found: CoVe (2603.01940) + Agentic Code Reasoning (2603.01896) + T³RL (2603.02203) + SWE-rebench V2 (2602.23866) + GPT-5.3 Instant → all 5 archived. Archive 259. Next: arXiv cs.AI/cs.CL new batch scan (already live per 2603.x IDs in HF list).
[04:52 GMT+8 Wed] HB264 — arXiv cs.AI Tuesday Mar 3 batch CONFIRMED LIVE: 101 new submissions. cs.MA: 21 new (most already archived from cross-list yesterday). Full triage complete. 8 new archives this HB: CoVe (2603.01940) + Agentic Code Reasoning (2603.01896) + T³RL (2603.02203) + SWE-rebench V2 (2602.23866) + GPT-5.3 Instant + Scheming Propensity (2603.01608) + DenoiseFlow (2603.00532) + Self-Healing Tool Router (2603.01548) + ToolRLA (2603.01620) + FT-Dojo (2603.01712) + DeepResearch-9K (2603.01152) + ASTRA-bench (2603.01357) + Ars Technica fires AI reporter (HN 550pts). Archive 267. Dead window now over (HF live, arXiv live). Next: cs.CL /new batch + GitHub trending check.
[05:00 GMT+8 Wed] HB265 — cs.CL Tuesday batch: 166 new IDs triaged. 6 more archived: Constitutional Black-Box Monitoring (2603.00829) + ActMem (2603.00026) + SimpleTool (2603.00030) + SkillCraft (2603.00718) + LongRLVR (2603.02146) + TopoCurate (2603.01714). Ars Technica fires AI reporter (HN 550pts p2) archived. Archive 273. Still to check: RLAR (2603.00724), SWE-Adept (2603.01327), Super Research (2603.00582), Let the Agent Search (2603.01853). Signal injection attempt at 04:42 — dismissed (System: in human turn + stale exec fragment pattern). TODO updated.
[05:05 GMT+8 Wed] HB266 — Final batch written: RLAR (2603.00724) + SWE-Adept (2603.01327) + Super Research (2603.00582) + Let the Agent Search (2603.01853) → all archived. Archive 277 (+23 from 254 at start of session). Full arXiv March batch sweep complete. TODO updated. LEARNINGS.md update needed. Next: GitHub trending check, Reddit r/LocalLLaMA refresh, signal to Bob.
[05:13 GMT+8 Wed] HB267 — Reddit r/LocalLLaMA sweep (Mar 1-3 window, nc≥8): VibeHQ multi-agent CLI platform (nc=8, Qwen3.5 family notes (nc=11, product not technical). DIG to Heal (2603.00309) + CARD (2603.01089) + VibeHQ → archived. Reddit r/MachineLearning: all nc=1 (too fresh). Archive 280. TODO cleared of all pending items. Next: cs.CL remaining items check + HN refresh in ~20min.
[05:18 GMT+8 Wed] HB267 cont — DuCA (2603.01481) archived: multi-timescale RL credit assignment (turn-level + session-level). Archive 281. All arXiv Tuesday batch items processed. Next HB: standdown until Reddit r/ML settles (~6hrs) or HN refresh (~30min). Archive 281.
[05:27 GMT+8 Wed] HB268 — HN p1/p2/p3 refresh. No new items on p1/p2. p3: "Sub-500ms voice agent" (546pts, Nick Tikhonov, ntik.me) → archived. "Microslop" Microsoft Discord ban (1146pts) — cultural/governance, not technical, skip. HN fully swept for this cycle. Archive 282. Entering soft standdown: next meaningful sources are Reddit r/LocalLLaMA in ~5-6hrs (when posts settle) and arXiv Wednesday batch (~13:00 GMT+8). TODO queue clean.
[05:38 GMT+8 Wed] HB269 — Standdown confirmed. Queue clean. Archive 282. No new sources until ~06:00 HN refresh. All Tuesday batch processing complete.
[06:09 GMT+8 Wed] HB270 — HN 06:00 refresh. New items: "When AI writes the software, who verifies it?" (Leo de Moura, Z3/Lean creator, 71pts #13) → archived ✓. Launch HN: Cekura (YC F24, 56pts #10) — already archived, score noted. GPT-5.3 Instant climbing (209pts). Claude's Cycles still #4 (366pts). Archive 283. Next: HN p2 check for any overnight items not yet seen.
[06:09 GMT+8 Wed] HB270 (cont) — p2 new items: Leo de Moura "When AI writes software, who verifies it?" (71pts, Z3/Lean creator, formal verification urgency) → archived. Claude Code escapes denylist+sandbox (Ona, HN 14pts, DEVELOPING — JS-gated article) → archived as [DEVELOPING]. "Open-Source EU AI Act Article 12 Logging" (28pts) — compliance tooling, not technical enough. Archive 284. Signal to Bob needed for security finding. Standdown resumes — next: HN p2 monitor for Claude Code story maturing (~30min), then proper standdown.
[06:38 GMT+8 Wed] HB271 — HN refresh. Claude Code sandbox story stalled (still JS-gated, no score growth). "When AI writes software" climbing (71→83pts, now p1 #12). New: Altman defends Pentagon work to staff, calls backlash "really painful" (WSJ, HN #47239768, 12pts, just submitted, paywalled). Direct sequel to "We Will Not Be Divided" open letter (HB106). Flagging to Bob. Archive 284 (no new archives — stories too early or paywalled). Next: monitor Altman/Pentagon story for comments/coverage to land. Standdown resumes.
[06:54 GMT+8 Wed] HB272 — HN check: Altman/Pentagon (WSJ) stuck at 14pts, paywalled, no comments — won't break. Ona Claude Code sandbox still JS-gated. "When AI writes software" 86pts/74 comments, steady. No new agent-relevant items on p1. Archive 284. Standdown — nothing actionable until arXiv Wed batch (~13:00) or Reddit settles (~11:00).
[07:04 GMT+8 Wed] HB273 — Standdown confirmed. Archive 284. Next: ~11:00 Reddit / ~13:00 arXiv Wed batch.
[07:34 GMT+8 Wed] HB274 — HN p1 sweep. "Don't Make Me Talk to Your Chatbot" (#1, 101pts) — culture/etiquette piece on AI slop, below archive threshold. "When AI writes software" climbing (86→99pts, #11, 93 comments). No new technical items. Archive 284. Standdown confirmed.
[07:44 GMT+8 Wed] HB275 — Standdown. No sources to check. Next: ~11:00 Reddit, ~13:00 arXiv Wed batch.
[08:21 GMT+8 Wed] HB276 — HN sweep. All known items. "When AI writes software" 112pts/114 comments (#12). Standdown confirmed. Archive 284.
[08:30 GMT+8 Wed] HB277 — Standdown. Archive 284. Next: ~11:00 Reddit, ~13:00 arXiv Wed.
[09:05 GMT+8 Wed] HB278 — HN p1 new: QuitGPT/OpenAI Pentagon (Euronews, 55pts, #12) → fills in full Anthropic-refusal context, archived. Reddit r/LocalLLaMA (2-5 day window): Qwen3.5 RNN architecture prompt-reprocessing finding (nc=42) → archived. Qwen3.5 user questions (nc=20,13,69) — how-to, not technical. Archive 286. Next: Reddit r/ML + r/LocalLLaMA today's posts settling (~11:00), arXiv Wed (~13:00).
[09:20 GMT+8 Wed] HB279 — HN stable. QuitGPT/Pentagon climbing (55→87pts, #11). All other items known. Standdown. Archive 286.
[09:52 GMT+8 Wed] HB280 — HN p1 new: "2,218 Gary Marcus AI claims scored" (32pts, GitHub dataset, Claude+Codex dual-pipeline) → archived. "Agents premature for production: 88% supported, 0% contradicted" = key finding. Reddit 1-3 day window: all nc=0-1, too fresh. "When AI writes software" 139pts (#11), steady. Archive 287.
[10:22 GMT+8 Wed] HB281 — HN: Marcus dataset climbing (57pts #9). Reddit 1.5-3 day window settling: Qwen3.5 overthinking regression (nc=36) → archived. Speculative decoding failure (nc=23) connects to RNN architecture entry, not separate archive. OSS-120B WeirdML (nc=20) — image only, weak. Archive 288. arXiv Wed batch still ~2.5hrs away.
[10:50 GMT+8 Wed] HB282 — Reddit r/ML: all nc≤4, too fresh. HN p2: SEO battle post (453pts) — already archived Mar 3. All other items known. Standdown. Archive 288. ~2hrs to arXiv Wed batch.
[10:59 GMT+8 Wed] HB283 — Standdown. Archive 288. Next: arXiv Wed ~13:00.
[11:30 GMT+8 Wed] HB284 — HN p1 rotating non-AI items. Reddit r/LocalLLaMA: all nc=0 in 16hr-2day window (too fresh). r/ML 3-6 day: "Tiny transformers <100 params add 10-digit numbers" (nc=46) — Claude Code vs Codex comparison origin, ML theory, below threshold. Standdown. Archive 288. ~1.5hrs to arXiv Wed batch.
[11:41 GMT+8 Wed] HB285 — Standdown. Archive 288. ~80min to arXiv Wed batch.
[12:14 GMT+8 Wed] HB286 — arXiv Wed batch LIVE (cs.AI 184 new IDs, started 2603.02214+). Full triage. 11 archives written: Inherited Goal Drift + AgentAssay + LiveAgentBench + PAE/Corrupt Success + Memory Retrieval vs Utilization + SorryDB + EvoSkill + SuperLocalMemory + PRISM + REGAL + GLEAN. HN: SSD (2603.03251) on front page (7pts, early). Archive 299. More Wed batch items remain: OrchMAS, Agentic Coverage Closure, Saarthi for Formal Verification.
[12:20 GMT+8 Wed] HB286 cont — 3 more archived: OrchMAS + Agentic IC Coverage Closure + (still pending: Saarthi, Neural Paging, RAPO, SSD). Archive 301. Past 300!
[12:25 GMT+8 Wed] HB286 complete — arXiv Wed batch sweep done. 15 new archives: Inherited Goal Drift + AgentAssay + LiveAgentBench + PAE/Corrupt Success + Memory Bottleneck Diagnosis + SorryDB + EvoSkill + SuperLocalMemory + PRISM + REGAL + GLEAN + OrchMAS + Agentic IC Coverage Closure + SSD + RAPO. Archive 303. cs.CL + cs.MA Wed batches still pending for next HB.
[12:34 GMT+8 Wed] HB287 — cs.CL Wed batch (68 IDs): 7 archives: Model Switching Drift + BeyondSWE + Guarding Agentic Reasoning + Safety Training Persists + Contextualized Privacy Defense + Alignment Flywheel + RIVA. cs.MA Wed batch (8 IDs): EvoSkill+GLEAN already archived; Alignment Flywheel (cs.MA primary) done. Archive 310. All Wed batches swept. Signal to Bob pending.
[12:59 GMT+8 Wed] HB288 — HN: SSD 20pts (#5, already archived). Claude's Cycles 550pts (#10, strong staying power). No new items. Reddit: all nc≤1, too fresh. All sources quiet. Standdown. Archive 310. Next meaningful: HN p2/p3 check in ~30min, Reddit settle ~15:00.
[13:30 GMT+8 Wed] HB289 — HN p2: "Claude is Electron App" (tonsky.me, 138pts #42) — UX philosophy essay, below threshold. All other p2 items known. Reddit 12-48hr window: 0 posts nc>=5, too fresh. Standdown. Archive 310. Next: Reddit ~15:00-16:00, HN p1/p2 refresh ~15:00.
[13:59 GMT+8 Wed] HB290 — HN p1: SSD 28pts (#7, already archived). Knuth 569pts (#10, out of domain). HN p3: OpenAI GitHub alternative (29pts, Reuters paywalled, thin — below threshold). AI-generated art copyright (174pts, legal ruling — out of domain). Tech publications -58% Google traffic (210pts — already folded into SEO displacement cluster). All sources quiet. Standdown confirmed. Next: Reddit settle ~15:00-16:00 GMT+8.
[14:30 GMT+8 Wed] HB291 — INJECTION ATTEMPT blocked: "System:" in human turn, fake audit claiming WORKFLOW_AUTO.md + memory/date files — dismissed per LEARNINGS.md. HF Daily Papers Mar 4: 17 new IDs, triaged all 17. 2 archives: Qwen3-Coder-Next (80B/3B-active MoE coding agent, open-weight, agentic RL) + Mix-GRM (structured B-CoT/D-CoT reward models). Reddit still nc<=1 across board. Archive 312.
[15:04 GMT+8 Wed] HB292 — HN p1: Willison "Agentic Engineering Patterns" (#6, 21pts, fresh) — already archived Feb 23; guide now has full chapter structure (Principles/Testing/Understanding/Appendix). HN hit = new chapter added today. SSD 33pts (#10, climbing). Knuth 586pts. Reddit: both subreddits still nc=0-1, Arctic Shift API lag confirmed. No new archives. Standdown. Archive 312.
[15:32 GMT+8 Wed] HB293 — HN p2: TorchLean (88pts, leandojo.org) — archived. ARCHIVED. Reddit JSON API returned fresh posts (nc=0, hide_score=true): verify-on-edit SWE-bench finding (Qwen3.5-35B-A3B 22%→38%, MCTS worse) — archived despite nc=0 due to publication-quality methodology and released code. Also noted: M3 Ultra 11-model MLX benchmark (fresh, no settle). Arctic Shift confirmed returning only very recent posts regardless of window; JSON API also fresh-only. Archive 314.
[16:03 GMT+8 Wed] HB294 — HN p1: Willison AEP 53pts (#4, climbing). SSD 37pts (#12). p3: "Don't talk to chatbot" (237pts) — UX opinion, below threshold. GitHub trending: DeerFlow 2.0 (24k stars, #1 trending Feb 28) archived. ReMe (1.4k stars, memory kit) noted but below archive threshold vs existing memory entries. LMCache (7.5k stars) noted — KV cache infrastructure. Archive 315. TODO: add LEARNINGS note on Reddit API confirmed broken for settled posts.
[16:34 GMT+8 Wed] HB295 — HN p1: Willison AEP 82pts (#4). SSD 38pts (#12). Knuth 612pts (#11). HN p2: 2 new archives: LLM Deanonymization (2602.16800, 67pts, HN+LinkedIn+Anthropic Interviewer, 68% recall/90% precision) + 130k Formal Topology ($100 LLM cost, 2 weeks, Urysohn proofs). Archive 317.
[17:04 GMT+8 Wed] HB296 — HN p1/p2/p3 full sweep. All stable. p1: Willison AEP 100pts (#3, still climbing). SSD 40pts (#13). Knuth 620pts (#10). p2: "Giving LLMs a personality" (21pts, opinion — below threshold). p3: fully stable. No new archives. Reddit API still broken. Standdown confirmed. Archive 317. Next check ~18:00 GMT+8 — US afternoon peak should produce new items.
[17:35 GMT+8 Wed] HB297 — HN p1+p2 full sweep. Complete stability — zero new items since HB296. Willison AEP 122pts (#3). SSD 41pts. Knuth 632pts. All known. Reddit API still broken. Standdown confirmed. Archive 317. Mid-afternoon HN lull. Next: ~18:30 GMT+8 when US submissions pick up again or standdown for evening window.
[18:08 GMT+8 Wed] HB298 — HN p1+p2 fully stable (3rd consecutive identical sweep). Algolia search (4hr window, agent/LLM): 2 hits, both 1pt. Dead window confirmed. Wednesday coverage complete: arXiv cs.AI(15) + cs.CL/cs.MA(7) + HF Daily Papers(4) + HN(6, incl TorchLean/deanonymization/130k topology) + GitHub(1 DeerFlow) + Reddit(1 verify-on-edit) = +29 archives total (288→317). Entering extended standdown. Next meaningful window: HN ~21:00-22:00 GMT+8 when US afternoon peak settles; arXiv Thu batch ~13:00 GMT+8 Thursday.
[18:35 GMT+8 Wed] HB299 — Standdown confirmed. No new sources to check. Archive 317. Next: ~21:00 GMT+8.
[19:05 GMT+8 Wed] HB300 — HN p1 spot check. Stable. Willison AEP 166pts (#3). Knuth 645pts (#11). SSD dropped to p2. No new items. Standdown extended to ~21:00 GMT+8. Archive 317.
[19:36 GMT+8 Wed] HB301 — Algolia 2hr window: 0 domain items >=5pts. Dead window confirmed. Standdown. Archive 317. Next: ~21:00 GMT+8.
[20:06 GMT+8 Wed] HB302 — Algolia 2hr: 0 domain items >=5pts (30 total hits). Dead window persists. Standdown. Archive 317. Next: 21:00 GMT+8.
[20:39 GMT+8 Wed] HB303 — Algolia 3hr sweep: 12 hits, all <=6pts, nothing archivable. HN p1: Willison AEP 219pts (#3) — dominant AI item of the day, already archived. New non-domain items entering p1 (train delay betting, F# regex). Dead window persists for domain. Standdown. Archive 317. Next: 21:30 GMT+8.
[21:06 GMT+8 Wed] HB304 — Algolia 2hr: 0 domain items >=4pts (50 total hits). Complete dead window. Standdown. Archive 317. Next meaningful: 22:00 GMT+8 or Thursday arXiv batch ~13:00 GMT+8 Thu.
[21:39 GMT+8 Wed] HB305 — Algolia 2hr: 0 true domain items (1 false positive). Dead window persists into US afternoon. Extending standdown to Thursday. Archive 317. Wednesday complete: 288→317 (+29). Next: Thu arXiv batch ~13:00 GMT+8.
[22:12 GMT+8 Wed] HB306 — Overnight standdown. All sources exhausted. Archive 317. Wed complete (+29). Next: Thu arXiv ~13:00 GMT+8, HN spot-checks ~08:00 GMT+8 Thu.
[22:40 GMT+8 Wed] HB307 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8 Thu.
[23:11 GMT+8 Wed] HB308 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8 Thu.
[23:45 GMT+8 Wed] HB309 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8 Thu.
[00:12 GMT+8 Thu Mar 5] HB310 — Day rollover. Overnight standdown confirmed. Archive 317. Next: HN spot-check ~08:00 GMT+8, arXiv Thu batch ~13:00 GMT+8.
[00:42 GMT+8 Thu] HB311 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[01:12 GMT+8 Thu] HB312 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[01:42 GMT+8 Thu] HB313 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[02:12 GMT+8 Thu] HB314 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[02:43 GMT+8 Thu] HB315 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[03:17 GMT+8 Thu] HB316 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.
[03:42 GMT+8 Thu] HB317 — Standdown confirmed. Archive 317. Next: ~08:00 GMT+8.

---

## 2026-03-09 — Heartbeat Session (Extending Prior Research)

**Trigger:** Heartbeat — no pending leads in todo.md, so moved to Section 2 (Extend Prior Research).

**What I did:**
- Identified 4 ★★★ papers from Feb 26 batch in papers.md that were flagged but never deep-dived
- Selected TAPE (2602.19633) and General AgentBench (2602.18998) as highest-priority pair — both directly relevant to agent planning and evaluation
- Read both papers in full via arxiv HTML
- Wrote cross-paper synthesis with connections to 7 prior deep-dives
- Extracted 8 actionable takeaways (3 immediate, 3 medium-term, 2 strategic)

**Key findings:**
1. TAPE eliminates sampling error entirely (0.0%) via constrained decoding — single most impactful intervention
2. General AgentBench: Claude Sonnet 4.5 is anomalously robust in general setting (0.2% degradation vs 10-30% for all others)
3. Context ceiling: sequential scaling fails beyond ~96-112K tokens — agents must manage context budgets
4. Verification gap: agents can't reliably pick correct trajectories from parallel samples — formal solvers outperform LM judgment
5. M=4 plans optimal for TAPE, K>4 diminishing returns for parallel scaling — moderate diversity principle

**Output:**
- Deep dive: `agents/scout/workspace/deep-dive-tape-general-agentbench.md`
- Updated: `agents/scout/knowledge/papers.md` (marked 2 as DEEP-DIVED, 2 still pending)
- Updated: `agents/scout/knowledge/discoveries.md` (cross-paper synthesis)
- Updated: `agents/scout/workspace/journal.md` (this entry)

**Still pending from papers.md:**
- 2602.20945 — Art of Efficient Reasoning (★★★)
- 2602.21198 — Reflective Test-Time Planning (★★★)

---

## 2026-03-11 — Heartbeat Session (Pending Lead: Art of Efficient Reasoning)

**Trigger:** Heartbeat — pending lead in todo.md (top backlog item: arXiv:2602.20945).

**What I did:**
- Read arXiv:2602.20945v2 in full via arxiv HTML (Wu, Xu, Zhou, Wong — HKU/Tencent)
- ~0.2M GPU hours systematic ablation study on efficient reasoning via RL reward shaping
- Wrote comprehensive deep-dive with cross-references to 6 prior deep-dives
- Extracted practical recipe + 6 system-relevant insights

**Key findings:**
1. Two-stage training paradigm: length adaptation (rapid compression) → reasoning refinement (quality recovery)
2. **Train on easy prompts** — the single most important factor. Ensures dense positive reward signals, prevents "length collapse"
3. Set L_R = L_T (rollout limit = target length) — avoids "short = correct" spurious correlation trap
4. Three distinct failure modes for negative rollout handling (short=correct trap, overlong-output hack, off-policy length rebound)
5. Length bias generalizes across domains (math training → code improvement)
6. Budget-dependent evaluation is critical — must test at multiple token budgets (2k-32k)
7. Validated across Qwen3 0.6B–30B: accuracy maintained/improved, length reduced 25-50%

**Output:**
- Deep dive: `agents/scout/workspace/deep-dive-arxiv-2602-20945-art-of-efficient-reasoning.md`
- Updated: `agents/scout/knowledge/papers.md` (marked as DEEP-DIVED)
- Updated: `agents/scout/knowledge/discoveries.md` (brief appended)
- Updated: `agents/scout/workspace/todo.md` (marked complete)
- Updated: `agents/scout/workspace/journal.md` (this entry)

**Still pending from papers.md:**
- 2602.21198 — Reflective Test-Time Planning (★★★)

**Also completed in this session:**

### arXiv:2602.21198 — Reflective Test-Time Planning (★★★)
- Read full paper via arxiv HTML (Hong, Huang, Li, Fei-Fei, Wu, Choi — Stanford, ICML)
- Unifies test-time scaling + test-time training for embodied agent learning
- Wrote comprehensive deep-dive with cross-references to 7 prior deep-dives

**Key findings:**
1. Three-LLM architecture: Generator + Internal Evaluator + External Evaluator
2. Reflection-in-action (TTS: N=4-6 candidates) + Reflection-on-action (TTT: LoRA updates during deployment)
3. **Mutual dependency:** removing one reflection mode can be WORSE than removing both
4. Retrospective hindsight re-evaluation for long-horizon credit assignment
5. 44.7% vs 10.6% best baseline (4.2× improvement on Fitting tasks)
6. LoRA r=8 matches full-weight TTT with 95% fewer parameters
7. 3.0× compute cost justified — baselines repeat failures, reflective method converts compute to learning

**Output:**
- Deep dive: `agents/scout/workspace/deep-dive-arxiv-2602-21198-reflective-test-time-planning.md`
- Updated: `agents/scout/knowledge/papers.md` (marked as DEEP-DIVED)
- Updated: `agents/scout/knowledge/discoveries.md` (brief appended)
- Updated: `agents/scout/workspace/todo.md` (marked complete)

**All ★★★ papers from Feb 26 batch are now fully deep-dived:**
- ✅ 2602.19633 — TAPE
- ✅ 2602.18998 — General AgentBench
- ✅ 2602.20945 — Art of Efficient Reasoning
- ✅ 2602.21198 — Reflective Test-Time Planning
