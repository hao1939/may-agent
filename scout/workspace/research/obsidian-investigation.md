# Obsidian Investigation: UI Layer for Multi-Agent Workspaces

**Date:** 2025-01-20  
**Status:** Complete  
**Summary:** Obsidian is an excellent zero-config UI layer over our existing agent workspaces. Adoption is nearly frictionless since our files are already markdown.

---

## 1. Can We Use Obsidian Directly as a UI Layer?

### Answer: Yes, with minimal friction.

**How it works:** An Obsidian "vault" is simply a folder containing markdown files. No database, no proprietary format. You point Obsidian at a directory and it indexes everything.

**What we get immediately:**
- **Graph View** — visualizes connections between agent files (if we add wiki-links)
- **Backlinks** — see which files reference each other; trace how agents cross-reference work
- **Full-text search** — instant search across all agent workspaces
- **File explorer** — tree view of `agents/*/workspace/` structure
- **Tag aggregation** — if agents use `#tags`, Obsidian aggregates them globally
- **Daily notes** — maps naturally to our journal/heartbeat pattern

**Setup:** Point Obsidian at the repo root (or a symlinked subset). The `.obsidian/` config folder it creates can be `.gitignore`'d.

### What breaks / friction points:

| Issue | Severity | Mitigation |
|-------|----------|------------|
| No wiki-links yet — our files use standard markdown links | Low | Adopt `[[wiki-links]]` incrementally; Obsidian reads both |
| `.state/` and binary files clutter the vault | Low | Use `.obsidianignore` or Excluded Files plugin |
| Large repos (>10k files) slow graph view | Medium | Scope vault to specific agent or use workspace plugin |
| Obsidian adds `.obsidian/` folder | None | `.gitignore` it |
| YAML frontmatter inconsistency | Low | Agents already use some frontmatter; standardize gradually |

---

## 2. Concepts to Adopt from Obsidian

### High-value concepts for our system:

#### Wiki-Links (`[[target]]`)
- Agents should reference other agents' work via `[[agents/architect/workspace/design]]`
- Enables automatic backlink tracking
- **Recommendation:** Adopt for cross-agent references; keep standard links for external URLs

#### Tags
- We already use some tags. Standardize:
  - `#agent/<name>` — authorship
  - `#status/active`, `#status/archived`
  - `#type/research`, `#type/decision`, `#type/journal`
- Obsidian's tag pane gives instant filtering

#### Graph Topology
- The graph reveals **knowledge clusters** and **isolated nodes** (orphan files)
- Useful for identifying: which agents collaborate, which research is disconnected
- Could inform the orchestrator about knowledge gaps

#### Dataview Plugin (community)
- Query files like a database using frontmatter metadata
- Example: `TABLE status, agent FROM "agents" WHERE status = "active"`
- **High value** for dashboards without building custom tooling

#### Canvas
- Visual layout tool for brainstorming/architecture
- Stored as `.canvas` JSON files — agents could potentially generate these

#### Daily Notes
- Maps directly to our heartbeat/journal pattern
- Template: one daily note per agent with automatic date naming

---

## 3. Practical Integration Assessment

### Opening our repo as a vault:

```
repo-root/          ← point Obsidian here
├── agents/
│   ├── scout/workspace/    ← markdown files visible immediately
│   ├── architect/workspace/
│   └── ...
├── .obsidian/      ← auto-created, gitignore
└── .obsidianignore ← exclude node_modules, .state, etc.
```

### What works out of the box:
- ✅ All `.md` files render correctly
- ✅ Standard markdown links work
- ✅ YAML frontmatter parsed for metadata
- ✅ Folder structure preserved
- ✅ Search across all agents
- ✅ File creation/editing reflected in git immediately

### What needs configuration:
- Wiki-link resolution (Obsidian defaults to shortest-path matching — configure to use relative paths)
- Excluded folders: `node_modules`, `.git`, `.state`, `dist`
- Templates for consistent agent output

### What agents should change:
- Add `[[cross-references]]` when citing other agents' work
- Standardize frontmatter: `agent`, `date`, `status`, `tags`
- Consider MOC (Map of Content) files as indexes per workspace

---

## 4. Alternatives Comparison

| Tool | Local-first | Wiki-links | Graph | Plugin ecosystem | Our fit |
|------|-------------|------------|-------|-----------------|---------|
| **Obsidian** | ✅ Files on disk | ✅ Native | ✅ Built-in | 1700+ plugins | ⭐ Best fit |
| **Logseq** | ✅ Files on disk | ✅ | ✅ | Growing | Good but opinionated (outliner-first, different file format) |
| **Foam** | ✅ VS Code extension | ✅ | ✅ | VS Code ecosystem | Good if team already in VS Code |
| **Dendron** | ✅ VS Code extension | ✅ | ✅ | Moderate | Hierarchical naming scheme conflicts with our structure |
| **SiYuan** | ✅ | ✅ | ✅ | Small | Uses custom block format, not pure markdown |
| **Notion** | ❌ Cloud | ❌ | ❌ | Limited | Non-starter (not local, not markdown) |

### Logseq
- **Pros:** Also local-first markdown, has graph view, open source
- **Cons:** Outliner format (every line is a bullet), stores in different file structure, less plugin ecosystem
- **Verdict:** Worse fit — our agents write prose and structured docs, not outlines

### Foam (VS Code)
- **Pros:** Same editor developers might use, lightweight, good wiki-link support
- **Cons:** No standalone app, less polished graph, fewer features
- **Verdict:** Good secondary option if we want IDE integration

### Recommendation: Obsidian
- Zero lock-in (it's just our files)
- Richest visualization (graph, canvas)
- Best plugin ecosystem (Dataview alone is worth it)
- Active development and large community

---

## 5. Recommended Next Steps

### Immediate (no code changes):
1. Open repo root as Obsidian vault
2. Add `.obsidian/` to `.gitignore`
3. Create `.obsidianignore` with: `node_modules`, `.git`, `.state`, `dist`
4. Install community plugins: Dataview, Graph Analysis, Templater

### Short-term (agent conventions):
1. Standardize frontmatter schema across agents
2. Add `[[wiki-links]]` for cross-agent references
3. Create MOC (Map of Content) index files per agent workspace
4. Define tag taxonomy

### Medium-term (tooling):
1. Auto-generate a daily dashboard `.md` from agent heartbeats
2. Build a canvas generator that visualizes agent task flow
3. Consider Obsidian Publish for sharing research externally
4. Explore Obsidian's Local REST API plugin for programmatic access

---

## 6. Key Insight

Our system is already 90% of the way to being an Obsidian vault. The markdown-first design means Obsidian is essentially a free, powerful UI layer we can adopt with zero migration cost. The main value-add is **making implicit connections explicit** through wiki-links and **visualizing the knowledge graph** that already exists in our agent workspaces.
