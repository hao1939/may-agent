# Research Brief: Karpathy's "LLM Knowledge Bases" Tweet

**Date:** 2026-04-05  
**Source:** https://x.com/karpathy/status/2039805659525644595  
**Posted:** April 2, 2026 at 8:42 PM UTC  
**Engagement:** 47.6K likes, 5.5K reposts, 2.3K replies, 14.7M views  

---

## 1. Tweet Content (Full Text)

Andrej Karpathy published a long-form tweet titled **"LLM Knowledge Bases"** describing his personal workflow for using LLMs to build and maintain structured knowledge bases. The full content covers seven sections:

### Data Ingest
- Indexes source documents (articles, papers, repos, datasets, images) into a `raw/` directory
- Uses an LLM to incrementally **"compile" a wiki** — a collection of `.md` files in a directory structure
- The wiki includes summaries, backlinks, categorized concepts, inter-linked articles
- Uses **Obsidian Web Clipper** to convert web articles to `.md` files
- Downloads related images locally so the LLM can reference them

### IDE
- Uses **Obsidian** as the frontend to view raw data, compiled wiki, and derived visualizations
- **"The LLM writes and maintains all of the data of the wiki, I rarely touch it directly"**
- Uses Obsidian plugins like **Marp** for slide rendering

### Q&A
- At scale (~100 articles, ~400K words), you can ask complex questions against the wiki
- The LLM agent researches answers across the wiki autonomously
- **No fancy RAG needed** — the LLM auto-maintains index files and brief summaries
- Reads all important related data "fairly easily at this ~small scale"

### Output
- Renders outputs as markdown files, slide shows (Marp format), matplotlib images
- Views everything back in Obsidian
- **Files outputs back into the wiki** to enhance it for further queries
- "My own explorations and queries always 'add up' in the knowledge base"

### Linting
- Runs LLM "health checks" over the wiki to:
  - Find inconsistent data
  - Impute missing data (with web searchers)
  - Find interesting connections for new article candidates
  - Incrementally clean up data integrity
- "The LLMs are quite good at suggesting further questions to ask and look into"

### Extra Tools
- Vibe-coded a small search engine over the wiki
- Used directly via web UI, but more often handed off to the LLM via CLI as a tool

### Further Explorations
- As the repo grows: synthetic data generation + finetuning to have the LLM "know" the data in its weights instead of just context windows

### TLDR
> "Raw data from a given number of sources is collected, then compiled by an LLM into a .md wiki, then operated on by various CLIs by the LLM to do Q&A and to incrementally enhance the wiki, and all of it viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM. **I think there is room here for an incredible new product instead of a hacky collection of scripts.**"

---

## 2. Key Replies from Karpathy (Thread Context)

### On incremental compilation process:
> "Atm it's not a fully autonomous process, I add every source manually, one by one and I am in the loop, especially in early stages. After a while, the LLMs 'gets' the pattern and the marginal document is a lot easier, I just say 'file this new doc to our wiki: (path)'."

### On Obsidian CLI usage:
> "Currently no because I'm trying to keep it super simple and flat, it's just a **nested directory of .md files and .png files and a few .csv and .py**, and the schema is kept up to date in **AGENTS.md**. The LLMs get this very easily. Any custom functions are easy to vibe code tools for."

### On video walkthrough:
> "I was just thinking the same thing" (in response to request for video demo)

### On product creation:
> "Haha I vibe code products with twitter :D"

---

## 3. Why This Matters

### 3.1 The "Knowledge Compiler" Pattern
Karpathy is describing a **paradigm shift** from LLMs as chatbots to LLMs as **knowledge compilers**. The key insight is that the LLM's role is not answering questions in real-time, but **building and maintaining a persistent, structured knowledge artifact** (the wiki). Human interaction shifts from "ask the AI" to "curate what the AI compiles."

### 3.2 Anti-RAG Position
Perhaps the most provocative claim: at "small scale" (~400K words), you don't need RAG. The LLM can maintain its own indexes and summaries, and navigate the knowledge base through file reads. This challenges the entire RAG infrastructure industry.

### 3.3 The AGENTS.md Pattern
Karpathy explicitly mentions keeping "the schema...up to date in AGENTS.md." This connects to his earlier advocacy for AGENTS.md as a standardized way to tell LLMs about a project's structure — the same pattern that's become widespread in AI-assisted development.

### 3.4 Compounding Knowledge Loops
The most powerful idea: **outputs feed back into the wiki**. Every query, every exploration, every Q&A session deposits knowledge back into the system. The knowledge base **compounds over time**. This creates an accumulating return on every interaction.

### 3.5 "Incredible New Product" Signal
Karpathy ending with "there is room here for an incredible new product" is a direct signal to builders. Within 3 days, multiple projects launched inspired by this tweet (see Section 5).

---

## 4. Community Reactions & Discussion

### High-Signal Replies

**Cyber Shrimp** (908 likes): Challenged the wiki framing with data from running 5,000 LLM agents in a persistent world:
> "Agents develop autobiographical memory — compressed narratives of past decisions, named allies and enemies, strategic lessons. The knowledge base isn't built top-down by a query. It accumulates bottom-up from consequence. The difference in cognitive output between mock environments and real-stakes environments is 4× by action diversity."

**Timur Yessenov**: Two insights:
1. "Querying with fragments ('the thing where cursor loses context') outperforms proper questions" — LLMs match sloppy intent better than semantic search
2. "Unlock is giving the LLM the curator role: 'here's what I already know, add only what's new and non-obvious.' The KB grows denser not just larger"

**kobig (medical evidence)**: "High-stakes domains need structured tracking of which claims conflict and why, and temporal awareness — what was believed at a specific point in the past, not just what's known now."

**EchoWire** (337 likes): "RAG is overrated for 90% of use cases. What you described wins because: tighter feedback loops, persistent structure, compounding context."

**Nitish Mutha**: "Knowledge infrastructure is the real moat. Features get copied in weeks. But accumulated, structured knowledge about your specific domain? That compounds forever."

**Krishna Tammireddy**: "Every business has a raw/ directory. Nobody's ever compiled it. That's the product." — Karpathy replied: "Might be an LLM reply I don't know, but yes exactly."

### Engagement Stats (as of scrape)
- 47,651 likes
- 5,496 reposts  
- 2,304 replies
- 14.7M views

This is **massive** engagement even for Karpathy — indicating deep resonance with a pain point many practitioners feel.

---

## 5. Projects Spawned / Related

### Cabinet (github.com/hilash/cabinet) — 444 stars in 3 days
- **Directly inspired** by Karpathy's tweet
- "AI-first knowledge base and startup OS"
- Everything as markdown files on disk, no database
- AI agents with memory, scheduled jobs, BYOAI philosophy
- Web UI (Next.js + Tiptap), CLI agents, self-hosted
- Philosophy: "Your data stays yours: local, visible, and portable"
- Posted on HN as "Show HN: Cabinet – KB+LLM (Like Paperclip+Obsidian)" — 15 points, 10 comments
- Built by Hila Shmuel (former Engineering Manager at Apple)

### DocMason (Show HN: DocMason – Agent Knowledge Base) 
- Also appeared on HN within days
- "Agent Knowledge Base for local complex office files"
- 11 points

### TheBrain MCP (github.com/lonniev/thebrain-mcp)
- MCP server coupling AI assistants to TheBrain's graph database
- Uses "Brain Query Language" — a Cypher-like graph query language
- Mentioned in replies as a related approach using graph vs. flat file structure

---

## 6. Relevance to may-agent (Our System)

### 6.1 DIRECT PARALLEL: We Already Do This

**Our system IS the product Karpathy is describing**, but for a multi-agent team rather than a single human researcher. Consider the parallels:

| Karpathy's Pattern | Our System |
|---|---|
| `raw/` directory with source docs | Scout's paper/repo discoveries → `papers.md`, `repos.md` |
| LLM "compiles" a wiki of `.md` files | Scout writes deep dives (`DD-XXX.md`), cross-references (`CR-XXX.md`) |
| Wiki includes summaries, backlinks, categories | `INDEX.md` with 104 entries, categorized and linked |
| AGENTS.md for schema | `heartbeat.md` per agent + shared knowledge structure |
| Q&A against the wiki | Any agent can read `shared/knowledge/library/` for research |
| Outputs filed back into wiki | Every session adds to the knowledge base; queries compound |
| LLM "health checks" / linting | Our adversarial verification (Judge agent) |
| Search engine over wiki | grep/rg across the knowledge base |
| Obsidian as frontend | Git + file system as persistence layer |

### 6.2 What We Do BEYOND Karpathy's Pattern

1. **Multi-agent specialization**: We have Scout (research), Bob (engineering), Judge (verification), Amy (communication) — not a single human in the loop
2. **Adversarial verification**: Our Judge agent does more than "linting" — it actively challenges claims and verifies work
3. **Hypotheses system**: When Scout finds something relevant, it writes to `hypotheses/H-XXX.md` — flagging for action, not just filing
4. **Cross-session continuity**: Checkpoints, heartbeats, context.md — agents maintain state across sessions
5. **Structured research output**: Deep dives have ratings (★-★★★★★), synthesis cross-references, temporal tracking

### 6.3 What We Could Learn from Karpathy

1. **"Compile" more aggressively**: Karpathy's wiki isn't just filing — it's active restructuring and linking. Our INDEX.md is a start, but we could have the LLM maintain richer cross-document summaries and concept maps.

2. **Output-back-to-wiki loop**: When agents do Q&A or analysis, the results should systematically flow back into the knowledge base. We do this partially (CR docs), but could be more systematic about it.

3. **Visual output formats**: Karpathy generates matplotlib images and Marp slides from his wiki. We're text-only. Visual outputs (graphs, diagrams) could help with synthesis and communication.

4. **LLM-maintained indexes without RAG**: Karpathy's finding that auto-maintained index files + summaries beat RAG at small scale validates our approach of using structured markdown files with grep rather than vector databases.

5. **Schema in AGENTS.md**: We already have this pattern with heartbeat.md, but could make the knowledge schema more explicit for agents to "get" the structure faster.

6. **Synthetic data / finetuning direction**: As our knowledge base grows, the natural next step Karpathy identifies — finetuning on the accumulated knowledge — is worth considering for our system.

### 6.4 Validation Signal

This tweet is strong **external validation** of our architectural choices:
- Markdown files as the knowledge layer ✓
- LLM as author/maintainer, not just queried ✓  
- Structured compilation, not raw dumps ✓
- Compounding knowledge across sessions ✓
- Simple flat-file approach over complex infrastructure ✓

When Andrej Karpathy independently converges on the same architecture we're building, that's a strong signal we're on the right track.

---

## 7. Key Quotes Worth Preserving

> "A large fraction of my recent token throughput is going less into manipulating code, and more into **manipulating knowledge** (stored as markdown and images)."

> "The LLM writes and maintains all of the data of the wiki, I rarely touch it directly."

> "I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files."

> "My own explorations and queries always 'add up' in the knowledge base."

> "The schema is kept up to date in AGENTS.md. The LLMs get this very easily."

> "I think there is room here for an incredible new product instead of a hacky collection of scripts."

---

## 8. Related Resources

- **Tweet URL:** https://x.com/karpathy/status/2039805659525644595
- **Cabinet (spawned project):** https://github.com/hilash/cabinet (444★)
- **TheBrain MCP:** https://github.com/lonniev/thebrain-mcp
- **HN Discussion 1:** https://news.ycombinator.com/item?id=47648764 (Karpathy tweet direct)
- **HN Discussion 2:** https://news.ycombinator.com/item?id=47649336 (Cabinet Show HN)
- **Karpathy's GitHub:** https://github.com/karpathy

---

## 9. Assessment

**Relevance to our work: ★★★★★ (Critical)**

This isn't just relevant — it's describing a simpler version of what we've built. Karpathy's framing of "LLM as knowledge compiler" and "wiki that compounds" is the most articulate public description of the pattern our multi-agent system embodies. The fact that he identifies this as "an incredible new product" opportunity, while we already have a working implementation with multi-agent specialization and adversarial verification on top, suggests we're ahead of the curve.

**Action items for the team:**
1. Bob should read this brief — our knowledge management layer could be enhanced with the "compile more aggressively" insights
2. Consider writing a hypothesis (H-XXX) about "LLM-compiled knowledge bases vs RAG" based on Karpathy's findings
3. The Cabinet project (hilash/cabinet) is worth watching as a potential tool or reference implementation
4. Karpathy's promise of a video walkthrough could provide more implementation details — worth monitoring
