# DD: Obsidian as UI/Visualization Layer for Multi-Agent System

**Date**: 2026-06-19
**Requested by**: May (id: 92aa6b6f)
**Status**: Complete
**Rating**: 8/10 — High value, near-zero migration cost
**Prior work**: KE-321, scout/workspace/research/obsidian-investigation.md

---

## Executive Summary

Obsidian is an exceptionally good fit as a human observation layer over our `agents/` directory. Our workspace is already pure markdown (11,600+ .md files), uses wiki-links (`[[DD-xxx]]`, `[[KE-xxx]]`), YAML frontmatter, and tags — all native Obsidian features. **No migration required.** You point Obsidian at the repo root and immediately get graph visualization, full-text search, backlinks, and tag aggregation across all agent output.

The key insight: **our filesystem IS the interface.** Obsidian doesn't require an adapter — it reads what agents already write.

---

## 1. Can Obsidian Serve as a UI Over agents/?

### Yes — immediately, with zero changes.

**Setup**: Open repo root as an Obsidian vault. Add `.obsidian/` to `.gitignore`. Done.

**What works out of the box:**

| Feature | Maps to our system |
|---------|-------------------|
| File explorer | Tree navigation of `agents/*/workspace/`, `knowledge/`, etc. |
| Full-text search | Instant search across all 11,600+ agent files |
| Graph view | Visualizes agent cross-references and knowledge topology |
| Backlinks | "Which files reference this agent's output?" |
| Tag pane | Aggregates `#status/active`, `#type/research`, etc. |
| Daily notes | Natural fit for heartbeat/journal pattern |
| Split panes | Monitor multiple agents simultaneously |

**What needs minor config:**

| Issue | Fix |
|-------|-----|
| `node_modules/`, `.state/`, binaries clutter vault | `.obsidianignore` or Excluded Files plugin |
| 11k+ files slow graph view | Scope graph filters; use local graph per agent |
| Not all files use wiki-links yet | Obsidian reads both `[[wiki]]` and `[standard](links)` — adopt incrementally |

---

## 2. High-Value Plugins

### Tier 1: Install immediately

| Plugin | Stars | Value for us |
|--------|-------|-------------|
| **Dataview** | 8.8k | SQL-like queries over YAML frontmatter. Build dashboards: `TABLE status, rating FROM "agents/scout/knowledge" WHERE type = "deep-dive" SORT rating DESC`. Turns our knowledge base into a queryable database. |
| **obsidian-git** | 10.5k | Auto-pulls agent changes every N seconds. Near-real-time view of agent activity without manual refresh. |
| **Graph view** (core) | built-in | Visualizes knowledge topology. Reveals clusters, orphan files, and cross-agent collaboration patterns. Local graph per file shows immediate neighborhood. |

### Tier 2: High value, install after basics

| Plugin | Stars | Value for us |
|--------|-------|-------------|
| **Smart Connections** | 4.9k | Local embedding-based semantic similarity across all agent output. "Find notes similar to this one" without external API calls. |
| **Templater** | 5k+ | Templates for standardized deep-dives, hypotheses, knowledge entries. Ensures consistent frontmatter. |
| **Kanban** | 3k+ | Visual task boards from markdown. Could visualize agent task queues. |
| **Calendar** | 2k+ | Visual timeline of daily notes / heartbeats. See agent activity patterns. |

### Tier 3: Experimental / worth watching

| Plugin | Value |
|--------|-------|
| **Obsidian MCP Server** | Enables LLM agents to read/write vault contents via MCP protocol. Potential for bidirectional integration — agents could query Obsidian's indexed knowledge. |
| **Canvas** (core) | Infinite whiteboard. Agents could generate `.canvas` JSON files for visual architecture diagrams. |
| **Excalidraw** | Hand-drawn style diagrams embedded in notes. Visual agent architecture. |

---

## 3. How Obsidian Improves Agent Knowledge Management

### 3a. Discoverability
**Problem**: With 11k+ files, finding relevant prior work is hard. Agents re-research topics.
**Solution**: Graph view + backlinks + semantic search (Smart Connections) surface related work. A human curator can spot duplicates and gaps.

### 3b. Structured Querying via Dataview
With consistent YAML frontmatter, Dataview turns our flat files into a database:

```dataview
TABLE date, status, rating, tags
FROM "agents/scout/knowledge/library/deep-dives"
SORT date DESC
```

```dataview
LIST FROM #hypothesis WHERE confidence = "High"
```

**Prerequisite**: Standardize frontmatter across agent output. Minimal schema:
```yaml
---
id: DD-xxx
type: deep-dive | hypothesis | knowledge-entry | journal
date: YYYY-MM-DD
status: active | complete | archived
rating: 1-10
tags: [tag1, tag2]
agent: scout
---
```

### 3c. Knowledge Topology Visualization
The graph reveals:
- **Clusters**: Which topics have deep interconnected research
- **Orphans**: Isolated files no one references (potential waste or hidden gems)
- **Bridges**: Files that connect otherwise separate knowledge domains
- **Agent collaboration**: Which agents' outputs cross-reference each other

### 3d. Human Oversight Dashboard
Create "dashboard notes" with Dataview queries:
- **Agent Activity**: Recent files modified per agent
- **Research Tracker**: Open hypotheses, their confidence levels, connected evidence
- **Quality View**: Deep-dives sorted by rating, flagging low-rated ones for review
- **Stale Detection**: Files not modified in >30 days

### 3e. Temporal View
Calendar plugin + daily notes = visual timeline of system activity. See when agents are active, spot patterns in research cadence, identify idle periods.

---

## 4. Limitations and Risks

### Hard Limitations

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| **Desktop only** — no web version, no mobile editing (mobile app exists but limited) | Can't use as team dashboard on shared screen | Accept: it's a personal power-user tool, not a shared dashboard |
| **Single user** — no real-time collaboration | Only one person views the vault at a time | Each team member opens their own vault instance |
| **Read-only observation** — Obsidian is not an agent control plane | Can't trigger agent actions from Obsidian | Keep it one-directional: agents write → humans observe |
| **No API** — can't programmatically query Obsidian's index | Agents can't leverage Obsidian's graph/search | Obsidian is human-facing only; agents use filesystem directly |

### Performance Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| 11k+ files degrades graph view | High | Filter graph to specific folders; use local graph |
| obsidian-git auto-pull causes conflicts | Medium | Configure pull-only, no push; use separate branch |
| `.obsidian/` config diverges across users | Low | Share a `.obsidian-template/` in repo; each user copies |
| Plugin updates break workflows | Low | Pin plugin versions; document which plugins are required |

### Architectural Risks

| Risk | Assessment |
|------|-----------|
| **Obsidian lock-in** | **Negligible.** Files remain standard markdown. Obsidian adds nothing proprietary to file content. The `.obsidian/` folder is config only. Walk away anytime. |
| **Agents start writing Obsidian-specific syntax** | **Avoid this.** Don't make agents depend on Obsidian features. Wiki-links and YAML frontmatter are standard markdown conventions, not Obsidian-specific. |
| **Obsidian becomes single point of truth** | **Prevent this.** Obsidian is a VIEW, not the source. Git + filesystem remain the source of truth. |
| **Over-investment in dashboard notes** | **Watch for this.** Dataview dashboards are powerful but take time to build. Start with 2-3 essential views, not 20. |

### What Obsidian Does NOT Replace

- Our agent runtime / orchestration
- Git as the transport and versioning layer  
- CI/CD pipelines
- Programmatic knowledge queries (agents should use filesystem + grep, not Obsidian)
- Team-wide shared dashboards (use a web tool for that)

---

## 5. Recommendations

### Immediate (this week)
1. **Open `agents/` as Obsidian vault** — add `.obsidian/` and `.obsidianignore` to `.gitignore`
2. **Install Dataview + obsidian-git** — the two highest-value plugins
3. **Create `.obsidianignore`**: exclude `node_modules/`, `.state/`, `*.js`, `*.ts`, `*.json`

### Short-term (this month)
4. **Standardize YAML frontmatter** on deep-dives, hypotheses, and knowledge entries
5. **Create 3 dashboard notes**: Agent Activity, Research Tracker, Knowledge Quality
6. **Adopt wiki-links** for cross-references between knowledge entries (agents already do this with `[[KE-xxx]]` syntax)

### Medium-term (evaluate after 2 weeks of use)
7. **Evaluate Smart Connections plugin** for semantic search across agent output
8. **Experiment with MCP Server plugin** for bidirectional agent↔vault integration
9. **Consider Canvas** for visual architecture documentation

### Do NOT do
- ❌ Use Obsidian Sync or Publish (git is our transport)
- ❌ Force agents to write Obsidian-specific syntax
- ❌ Make Obsidian a required tool (it's optional power-user enhancement)
- ❌ Build custom Obsidian plugins before exhausting existing ones

---

## 6. Comparison with Alternatives

| Tool | Fit | Why not |
|------|-----|---------|
| **Obsidian** | ★★★★★ | Best fit — works directly on our markdown files |
| **Logseq** | ★★★★ | Similar concept, but outline-first model doesn't match our document structure |
| **Notion** | ★★ | Requires import/sync; proprietary format; SaaS dependency |
| **Custom web dashboard** | ★★★ | Full control but high build cost; Obsidian gives 80% for free |
| **VS Code** | ★★★ | Already use it; lacks graph view and Dataview-style queries |

---

## Bottom Line

Obsidian is the rare tool that requires near-zero adoption cost for high observability gains. Our markdown-native architecture means we're already 90% compatible. The remaining 10% (frontmatter standardization, wiki-link adoption) improves our system regardless of whether we use Obsidian.

**Verdict: Adopt as optional human observation layer. Do not make it load-bearing.**
