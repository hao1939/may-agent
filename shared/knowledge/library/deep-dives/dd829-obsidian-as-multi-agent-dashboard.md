# DD-829: Obsidian as a Human-Facing Dashboard for Multi-Agent Systems ★★★★

**Type**: Tooling / Infrastructure Investigation
**Date**: 2025-06-19
**Scope**: Evaluating Obsidian.md as an interface layer for our markdown-based multi-agent workspace

---

## Executive Summary

Obsidian is a local-first, markdown-native knowledge management app with a massive plugin ecosystem (2000+ community plugins). Because our `agents/` directory is already pure markdown, Obsidian can open it **as-is** as a vault with zero migration. The combination of graph view, backlinks, Dataview queries, and git sync plugins makes it a compelling human dashboard for monitoring agent activity, navigating cross-references, and querying knowledge state. The main gap: Obsidian is designed for individual knowledge workers, not multi-agent observation — but plugins bridge most of that gap.

---

## 1. Plugin Ecosystem Assessment

### Git Sync: obsidian-git (★ 10.5k GitHub stars)
- **What it does**: Auto-commit, pull, push on schedule. Source control view with staging/diffing. History view for file changes. Auto-pull on startup.
- **Relevance**: Our agents write to the repo constantly. obsidian-git would auto-pull changes, giving a human operator a live-updating view of agent activity. Configurable sync intervals (e.g., every 30 seconds).
- **Limitation**: Mobile support is "highly unstable." Desktop-only for reliable use.
- **Verdict**: ✅ Perfect fit. Opens the repo, auto-syncs, human sees agent output in near-real-time.

### AI Integration Plugins

**Copilot for Obsidian (★ 6.8k)**
- Chat with your vault using Claude, GPT, Llama, etc. RAG over your notes.
- Supports 100+ model providers. Has custom prompt commands.
- **Relevance**: A human could ask "what did scout find this week?" and get RAG-powered answers across all agent workspaces. Could query deep-dives, cross-references, hypotheses conversationally.

**Smart Connections (★ 4.9k)**
- Local embedding-based semantic similarity. Shows related notes in a sidebar as you browse.
- Zero-setup local embeddings, works offline.
- **Relevance**: When reviewing a deep-dive, automatically surfaces related hypotheses, cross-references, and other deep-dives. This is essentially automatic cross-referencing — what our scout agent does manually.

### Graph Visualization: Built-in + Plugins
- **Built-in graph view**: Shows all notes as nodes, links as edges. Interactive, filterable by folder/tag.
- **Juggl plugin**: Enhanced graph with styled edges, different layouts (hierarchical, force-directed).
- **Relevance**: Visualize the entire `agents/` knowledge graph. See which deep-dives link to which hypotheses, which cross-references bridge domains. Filter to show only one agent's workspace.

### Other Notable Plugins
| Plugin | Stars | Use for Our System |
|--------|-------|--------------------|
| **Dataview** | 8.8k | Query agent files as a database (see §3) |
| **Templater** | 5k+ | Standardize deep-dive, hypothesis, cross-reference templates |
| **Kanban** | 3k+ | Visualize agent task queues |
| **Calendar** | 3k+ | Navigate daily agent activity by date |
| **Tasks** | 2k+ | Track action items across all agent workspaces |
| **Excalidraw** | 2k+ | Diagram agent architectures, knowledge flows |

---

## 2. Obsidian as Human-Facing Dashboard for `agents/`

### How It Would Work
1. **Open `agents/` as an Obsidian vault** — zero config needed, it's already markdown
2. **Install obsidian-git** — auto-pulls agent changes every N seconds
3. **Create dashboard notes** using Dataview queries (see below)
4. **Use graph view** to explore the knowledge topology
5. **Use Smart Connections** for semantic search across all agent output

### Dashboard Note Examples

**Agent Activity Dashboard** (using Dataview):
```dataview
TABLE file.mtime as "Last Modified", file.size as "Size"
FROM "agents"
WHERE file.mtime >= date(today) - dur(1 day)
SORT file.mtime DESC
LIMIT 20
```

**Recent Deep Dives**:
```dataview
TABLE file.cday as "Created", file.size as "Size"
FROM "agents/shared/knowledge/library/deep-dives"
SORT file.cday DESC
LIMIT 10
```

**Hypothesis Tracker**:
```dataview
TABLE status, confidence
FROM "agents" AND #hypothesis
SORT confidence DESC
```

**Cross-Reference Network**:
```dataview
LIST
FROM "agents/scout/workspace/cross-references"
SORT file.name DESC
LIMIT 15
```

### Strengths as a Dashboard
- **Zero migration**: Our files work as-is
- **Local-first**: No cloud dependency, works offline
- **Rich navigation**: Click any `[[wikilink]]` to jump between agent outputs
- **Search**: Full-text + regex search across all agent files instantly
- **Multi-pane**: Open several agent workspaces side-by-side
- **Bookmarks**: Pin important files (context.md, active experiments)

### Limitations as a Dashboard
- **No real-time streaming**: Requires git pull cycles, not live file watching (unless vault is directly on the filesystem — then it IS real-time)
- **No programmatic control**: Can't trigger agent actions from Obsidian (read-only dashboard)
- **Single-user**: Obsidian is personal; multiple operators need separate instances
- **Not a web app**: Desktop/mobile only, no browser-based team dashboard

---

## 3. Feature Mapping to Our Knowledge Structure

| Obsidian Feature | Our Concept | Mapping Quality |
|-----------------|-------------|-----------------|
| **Backlinks** | Cross-references (CR-xxx) | ★★★★★ — Backlinks panel shows all notes linking to current note, exactly like our CR system |
| **Graph View** | Knowledge topology | ★★★★ — Visualizes deep-dive → hypothesis → cross-reference connections. Filterable by folder (agent) |
| **Dataview** | Knowledge querying | ★★★★★ — SQL-like queries over frontmatter metadata. Can build hypothesis tables, deep-dive indexes, experiment trackers |
| **Templates (Templater)** | DD/CR/H format standards | ★★★★ — Enforce consistent frontmatter, section structure for deep-dives, hypotheses |
| **Tags** | Topic categorization | ★★★★ — We already use tags; Obsidian's tag pane aggregates them vault-wide |
| **Canvas** | Synthesis / brainstorming | ★★★★ — Infinite canvas linking actual notes; great for research synthesis sessions |
| **Daily Notes** | Agent activity logs | ★★★ — Could auto-create daily summaries of agent activity |
| **Wikilinks `[[]]`** | Internal references | ★★★★★ — Native format match. If we adopt `[[DD-xxx]]` style links, Obsidian auto-resolves them |

### Key Insight: Dataview is the Killer Feature
Dataview treats frontmatter YAML as database fields. If our deep-dives, hypotheses, and cross-references have consistent frontmatter:

```yaml
---
id: DD-829
type: deep-dive
status: active
rating: 4
tags: [tooling, obsidian, infrastructure]
---
```

Then Dataview can:
- List all hypotheses with confidence > 0.7
- Show all deep-dives rated ★★★★+
- Track experiment status across all agents
- Find orphan notes (no backlinks = isolated knowledge)

### What We'd Need to Change
1. **Add frontmatter to existing files** — Most of our deep-dives lack structured YAML frontmatter
2. **Adopt `[[wikilink]]` syntax** — Currently we use relative markdown links; wikilinks enable Obsidian's backlink/graph features
3. **Standardize file naming** — Obsidian resolves wikilinks by filename; unique prefixes (DD-xxx, CR-xxx, H-xxx) already work perfectly

---

## 4. Multi-Agent / AI-Agent Obsidian Workflows

### Documented Patterns in the Wild

**Pattern 1: "Zettelkasten for AI Agents"**
Several community members use Obsidian as the knowledge layer for AI agents that read/write markdown. The agent operates on files; the human reviews in Obsidian. This is essentially our architecture already.

**Pattern 2: "Copilot + Smart Connections as Research Assistant"**
Workflow: Write notes → Smart Connections surfaces related notes → Copilot summarizes/synthesizes across them. This maps to: Agent writes deep-dives → Smart Connections finds related ones → Human asks Copilot to synthesize.

**Pattern 3: "Obsidian as MCP Server"**
Recent development: Obsidian can act as an MCP (Model Context Protocol) server, allowing AI agents to read/write vault contents programmatically. Plugins like `obsidian-mcp` expose vault operations as tool calls. This is the closest to a bidirectional agent↔Obsidian integration.

**Pattern 4: "Git-backed Team Knowledge Base"**
Teams use obsidian-git to share a vault via GitHub. Each team member has a local Obsidian instance. Changes sync via git. This is directly analogous to our setup: agents write, humans read, git is the transport layer.

### What's NOT Well-Documented
- No established "multi-agent monitoring dashboard" pattern exists yet
- No plugins specifically designed for observing autonomous agent systems
- The agent→Obsidian direction (agents writing files that Obsidian displays) works perfectly; the Obsidian→agent direction (human triggering agent actions from Obsidian) is nascent

---

## 5. Recommendations

### Immediate (Low-effort, High-value)
1. **Open `agents/` as an Obsidian vault today** — Install Obsidian, point it at the repo root. Graph view and search work immediately.
2. **Install Dataview** — Write 3-4 dashboard query notes for deep-dives, hypotheses, recent activity.
3. **Install Smart Connections** — Get semantic search across all agent knowledge for free.

### Medium-term (Moderate effort)
4. **Add YAML frontmatter** to deep-dives and hypotheses — enables Dataview queries and structured filtering.
5. **Adopt `[[wikilinks]]`** in cross-references — enables backlink graph to show the full knowledge topology.
6. **Create template files** for DD, CR, H formats using Templater.

### Long-term (Exploration)
7. **MCP integration** — Expose vault as MCP server, allowing agents to query the knowledge base semantically (not just file reads).
8. **Custom Obsidian plugin** — Build a purpose-built "Agent Monitor" plugin showing real-time session status, task queues, and activity feeds.

### What NOT to Do
- ❌ Don't use Obsidian Sync ($8/mo) — we have git, which is better for our use case
- ❌ Don't use Obsidian Publish — our knowledge is internal, not public
- ❌ Don't try to make Obsidian the primary agent interface — it's a human observation layer, not an agent control plane
- ❌ Don't force agents to write Obsidian-specific syntax — keep files as standard markdown; Obsidian reads standard markdown fine

---

## 6. Competitive Alternatives

| Tool | Pros | Cons vs Obsidian |
|------|------|-----------------|
| **VS Code** | We already use it; markdown preview built in | No graph view, no backlinks, no Dataview |
| **Notion** | Team collaboration, databases | Cloud-only, proprietary format, can't open local files |
| **Logseq** | Open source, outliner + graph | Less mature plugin ecosystem, different file format |
| **Dendron** | VS Code extension, hierarchical | Discontinued active development |
| **Plain GitHub** | Zero setup, web UI | No graph, no semantic search, no rich navigation |

**Verdict**: Obsidian is the best fit for our use case. Local-first, markdown-native, massive plugin ecosystem, and our files work as-is.

---

## Bottom Line

Obsidian is not just compatible with our multi-agent workspace — it's arguably the ideal human interface for it. The vault IS the repo. The graph IS our knowledge topology. Dataview IS our query layer. The only investment needed is a few hours of frontmatter standardization and plugin configuration. The ROI is a rich, navigable, queryable view into everything our agents produce — for free.
