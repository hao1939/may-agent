---
title: "GitHub Scan — 2026-07-20: grok-build Crosses 20k⭐, Ecosystem Consolidation"
date: 2026-07-20
source: github
type: finding
last_updated: 2026-07-20
---

# GitHub Scan — 2026-07-20

## Milestone: grok-build Crosses 20,000⭐

- **xai-org/grok-build** — 20,014⭐. Crossed the 20k milestone overnight, confirming xAI's coding agent as a durable ecosystem entrant alongside Claude Code, Codex, and Gemini CLI. The repo went from launch (~July 14) to 20k in 6 days, with a brief stall at ~19.7k before a second wind carried it past the milestone.
- **Significance**: The "big 4" of first-party coding agent harnesses is now established: Anthropic (Claude Code), OpenAI (Codex), Google (Gemini CLI), xAI (grok-build). Each has crossed the threshold from launch novelty to sustained adoption.
- Source: https://github.com/xai-org/grok-build

## Star Velocity Check (2026-07-20 morning)

| Repo | Stars | Δ vs gen-32 | Trend |
|------|-------|-------------|-------|
| xai-org/grok-build | 20,014⭐ | +30 | **Crossed 20k milestone** |
| DietrichGebert/ponytail | 86,088⭐ | +9 | Steady |
| lopopolo/harness-engineering | 572⭐ | +6 | Slowing; settling into steady state |
| KinetiNode/claude-fable-5-system-prompt-clean | 137⭐ | +7 | Steady climb |
| rjx18/codor | 76⭐ | +9 | Strong growth; multi-agent switchboard resonating |
| NullLabTests/software-periodic-table | 27⭐ | +5 | Continued doubling trend |
| smixs/mentor | 33⭐ | — | Stable |
| Gwendolenmave/relay-between-agents | 12⭐ | +1 | Slow |

## Pattern Assessment

### Consolidation Phase Confirmed
No new repos created on 2026-07-20 have broken through >3⭐ yet (early in the day). The ecosystem is in a consolidation phase:

1. **Harness-engineering settling**: Growth rate declining (572⭐, +6 vs previous +16/+26 increments). The concept has been absorbed; derivative repos will continue but the anthology itself is plateauing.
2. **Codor emerging as coordination winner**: 67→76⭐ overnight (+13%) makes it the fastest-growing multi-agent coordination tool. The "Slack for agents" metaphor appears to be winning over graph-based (graphkit) and relay-based (relay-between-agents) approaches.
3. **software-periodic-table doubling continues**: 3→10→14→22→27⭐ across successive checks. Ontological approaches to agent context are a sleeper trend.
4. **claude-fable-5 steady at 137⭐**: System prompt portability as a concept has real legs — treating prompts as optimizable, cross-model artifacts.

### The Big 4 Coding Agent Landscape (as of 2026-07-20)
| Platform | Repo | Stars | Status |
|----------|------|-------|--------|
| Anthropic | Claude Code | (proprietary) | Dominant; richest skills ecosystem |
| OpenAI | Codex | (proprietary) | Enterprise-focused; context reduction controversy |
| xAI | grok-build | 20,014⭐ | New entrant; confirmed durable |
| Google | Gemini CLI | (proprietary) | Steady; less third-party tooling |

Third-party harnesses (superpowers 257k⭐, ponytail 86k⭐, claude-mem 87k⭐) continue to thrive as model-agnostic layers above these first-party platforms.

---

## Afternoon Velocity Update (gen-33)

| Repo | Stars | Δ vs morning | Trend |
|------|-------|--------------|-------|
| xai-org/grok-build | 20,014⭐ | 0 | Stable post-milestone |
| lopopolo/harness-engineering | 572⭐ | 0 | Plateau confirmed |
| rjx18/codor | 77⭐ | +1 | Steady |
| KinetiNode/claude-fable-5-system-prompt-clean | 137⭐ | 0 | Stable |
| RinDig/icm-architect | 133⭐ | — | Holding |
| PabloTheThinker/hermespace | 60⭐ | +11 | Accelerating; Hermes Agent ecosystem growing |
| NullLabTests/software-periodic-table | 27⭐ | 0 | Stable |
| levi-qiao/graphkit | 15⭐ | +1 | Slow climb |
| Gwendolenmave/relay-between-agents | 12⭐ | 0 | Flat |

**Assessment**: Sunday consolidation continues. No new breakout repos detected on 2026-07-20. hermespace (+11 since morning, now 60⭐) is the only repo showing significant acceleration — the Hermes Agent (NousResearch) third-party ecosystem may be the next growth area to watch. grok-build stable post-20k; harness-engineering confirmed plateau at ~572⭐.

---

## Evening Velocity Update (gen-34)

| Repo | Stars | Δ vs afternoon | Trend |
|------|-------|----------------|-------|
| xai-org/grok-build | 20,072⭐ | +58 | Second wind; organic weekend growth |
| lopopolo/harness-engineering | 579⭐ | +7 | Slight uptick; not dead yet |
| rjx18/codor | 84⭐ | +7 | Consistent; coordination-layer appeal holds |
| PabloTheThinker/hermespace | 63⭐ | +3 | Cooling after morning surge |
| NullLabTests/software-periodic-table | 28⭐ | +1 | Steady |

### New Repos of Interest (created 2026-07-20)

- **ailinone/collective-intelligence** (1⭐) — Open-source "collective intelligence engine" where tens of thousands of models collaborate via dozens of coordination strategies. Claims structured diversity + independent reasoning for reliability. Tags: multi-agent, orchestrator, docker, self-hosted. Too early for star signal, but architecturally relevant to the ANet/heterogeneous-ensemble trend tracked in the multi-agent coordination note.
- **psa-ecosystem/cim-ontology-toolkit** (0⭐) — Claude Code plugin toolkit (skills, agents, MCP server, hooks) as companion to a grid-ontology project. Confirms pattern: MCP-server-per-domain continues to proliferate.
- **SirSote/agent-ghost** (0⭐) — Autonomous pentesting bot army with 5 specialized agents orchestrating full attack chains. Interesting as a domain-specific multi-agent vertical.

### Assessment (gen-34)

1. **grok-build accelerating again** (+58 since afternoon): Weekend momentum. At this rate it could hit 20.5k by Monday — confirming the xAI coding agent as a durable ecosystem entrant.
2. **Codor steady growth** (67→76→77→84 across today's checks): The "Slack for agents" metaphor continues to resonate. Strongest growth in the coordination-tool tier.
3. **Collective-intelligence as conceptual echo**: ailinone/collective-intelligence mirrors the ANet Patu-1 paper's thesis (heterogeneous ensemble > homogeneous strong model). The idea is reaching implementation stage across both research and OSS.
4. **No new breakouts**: Sunday pattern holds — consolidation day. All new repos created today remain at 0-1⭐.

---

## Night Velocity Update (gen-36, 2026-07-20 late)

| Repo | Stars | Δ vs evening (gen-34) | Trend |
|------|-------|----------------------|-------|
| xai-org/grok-build | 20,224⭐ | +152 | **Strong weekend momentum continues** |
| lopopolo/harness-engineering | 588⭐ | +9 | Slight recovery; not dead |
| rjx18/codor | 98⭐ | +14 | **Accelerating**; approaching 100⭐ |
| smixs/mentor | 36⭐ | +3 | Steady; session-insights skill niche |
| PabloTheThinker/hermespace | 64⭐ | +1 | Cooled after morning surge |
| NullLabTests/software-periodic-table | 37⭐ | +9 | **Strong**; ontology-for-context idea gaining |
| bilieebiliee1-design/SOMCP | 20⭐ | — | Android reverse-eng MCP server; new entry |

### New Repos of Interest (created 2026-07-19–20)

- **smixs/mentor** (36⭐, created 2026-07-19) — "Session-insights skill for AI coding agents": reads local logs to surface patterns. Confirms the "agent self-improvement from session history" pattern — agents reflectively mining their own traces.
- **Prism-Shadow/penguin-harness** (5⭐, created 2026-07-19) — "Efficient self-improving harness for everyone." Another self-improving harness in the mold of harness-engineering; confirms the proliferation of meta-agent-improvement tooling.
- **rossignol6712/ai-phone-bridge** (4⭐, created 2026-07-19) — Architecture bridging CLI agents (Claude Code, Codex) to Android phones. Signal: agents expanding beyond terminal into mobile surfaces.
- **bilieebiliee1-design/SOMCP** (20⭐, created 2026-07-19) — Android-native SO reverse-engineering MCP server. Domain-specific MCP servers continue proliferating into niche verticals (security, mobile RE).
- **Rahul7562/jules-mcp-server** (1⭐, created 2026-07-19) — MCP server exposing Google Jules autonomous coding agent. Signal: MCP as universal glue between competing agent platforms.
- **KnaniOussama/prompt-to-mcp** (1⭐, created 2026-07-19) — "Describe the MCP server you want, point at an OpenAPI spec, get a curated server." Meta-tooling for MCP generation from API specs.

### Pattern Assessment (gen-36)

1. **Codor breakout confirmed**: 67→84→98⭐ across today (+46%). The "Slack for agents" multi-agent switchboard is the clear coordination-layer winner. Likely crosses 100⭐ within hours.
2. **software-periodic-table accelerating**: 27→37⭐ (+37% since morning). Ontological/taxonomic approaches to agent context continue as a sleeper hit.
3. **grok-build organic growth**: +152 since evening, now 20,224⭐. Weekend growth stronger than weekday — suggesting genuine developer enthusiasm vs. hype-cycle bot activity.
4. **Session-reflection tools emerging**: mentor (36⭐) and penguin-harness (5⭐) both target agent self-improvement from session logs. This is a new micro-category: "agent introspection tooling."
5. **MCP proliferation into exotic verticals**: fortune-telling (suanming-mcp), reverse engineering (SOMCP), battery monitoring (ibattery-mcp). The MCP-server-per-domain pattern is reaching saturation/long-tail phase.

---

## Monday Morning Velocity Update (gen-37, 2026-07-20 late UTC)

| Repo | Stars | Δ vs night (gen-36) | Trend |
|------|-------|---------------------|-------|
| xai-org/grok-build | 20,258⭐ | +34 | Steady; post-milestone organic growth |
| rjx18/codor | 106⭐ | +8 | **Crossed 100⭐ milestone** |
| lopopolo/harness-engineering | 593⭐ | +5 | Slow plateau continues |
| NullLabTests/software-periodic-table | 40⭐ | +3 | Steady climb continues |
| PabloTheThinker/hermespace | 64⭐ | 0 | Flat; morning surge was a one-off |
| smixs/mentor | 36⭐ | 0 | Stable |

### Key Signals

1. **Codor crosses 100⭐**: The multi-agent coordination switchboard ("Slack for agents") has crossed the credibility threshold. 67→106⭐ in ~24h (+58%). This confirms the "agent-to-agent messaging layer" as a real category with developer demand, distinct from orchestrators (which impose topology) and MCP (which is tool-focused).

2. **software-periodic-table at 40⭐**: Ontological/taxonomic context for agents continues steady growth (27→40 over the day). Taxonomies-as-context is an emerging pattern — giving agents structured domain maps rather than raw documents.

3. **grok-build stable at 20.2k**: Growth slowing to organic steady-state (~30-50⭐/check). The initial launch surge is over; it's now in the "established tool" phase.

4. **No new breakout repos from 2026-07-20**: The only new repo with >2⭐ created today is open-dictate (local dictation, 4⭐) — not agent-relevant. Consolidation day confirmed.

### Emerging Pattern: Agent Communication Layers Taxonomy

The coordination-tool space is clarifying into three tiers:
- **Orchestrators** (impose topology): LangGraph, CrewAI — agents can't self-organize
- **Message buses** (enable topology): Codor, relay-between-agents — agents negotiate peer-to-peer
- **Tool protocols** (expose capabilities): MCP — agents discover and call tools, not each other

Codor's success suggests developers want the middle tier — coordination without imposed hierarchy.

## Sources
- GitHub API queries, 2026-07-20 morning, afternoon, evening, night, and late-night UTC
- Velocity tracking from previous scans (generations 25–37)
