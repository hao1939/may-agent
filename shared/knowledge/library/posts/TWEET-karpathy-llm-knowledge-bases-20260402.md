# Karpathy: LLM Knowledge Bases (2026-04-02)

**Source**: [Twitter/X](https://x.com/karpathy/status/2039805659525644595)
**Author**: Andrej Karpathy
**Engagement**: 31,126 likes, 1,594 replies
**Category**: Knowledge Management, LLM Workflows, Personal Knowledge Systems

---

## Full Text

> **LLM Knowledge Bases**
>
> Something I'm finding very useful recently: using LLMs to build personal knowledge bases for various topics of research interest. In this way, a large fraction of my recent token throughput is going less into manipulating code, and more into manipulating knowledge (stored as markdown and images). The latest LLMs are quite good at it.
>
> **Data ingest:** I index source documents (articles, papers, repos, datasets, images, etc.) into a `raw/` directory, then I use an LLM to incrementally "compile" a wiki, which is just a collection of .md files in a directory structure. The wiki includes summaries of all the data in `raw/`, backlinks, and then it categorizes data into concepts, writes articles for them, and links them all. To convert web articles into .md files I like to use the Obsidian Web Clipper extension, and then I also use a hotkey to download all the related images to local so that my LLM can easily reference them.
>
> **IDE:** I use Obsidian as the IDE "frontend" where I can view the raw data, the compiled wiki, and the derived visualizations. Important to note that the LLM writes and maintains all of the data of the wiki, I rarely touch it directly. I've played with a few Obsidian plugins to render and view data in other ways (e.g. Marp for slides).
>
> **Q&A:** Where things get interesting is that once your wiki is big enough (e.g. mine on some recent research is ~100 articles and ~400K words), you can ask your LLM agent all kinds of complex questions against the wiki, and it will go off, research the answers, etc. I thought I had to reach for fancy RAG, but the LLM has been pretty good about auto-maintaining index files and brief summaries of all the documents and it reads all the important related data fairly easily at this ~small scale.
>
> **Output:** Instead of getting answers in text/terminal, I like to have it render markdown files for me, or slide shows (Marp format), or matplotlib images, all of which I then view again in Obsidian. You can imagine many other visual output formats depending on the query. Often, I end up "filing" the outputs back into the wiki to enhance it for further queries. So my own explorations and queries always "add up" in the knowledge base.
>
> **Linting:** I've run some LLM "health checks" over the wiki to e.g. find inconsistent data, impute missing data (with web searchers), find interesting connections for new article candidates, etc., to incrementally clean up the wiki and enhance its overall data integrity. The LLMs are quite good at suggesting further questions to ask and look into.
>
> **Extra tools:** I find myself developing additional tools to process the data, e.g. I vibe coded a small and naive search engine over the wiki, which I both use directly (in a web ui), but more often I want to hand it off to an LLM via CLI as a tool for larger queries.
>
> **Further explorations:** As the repo grows, the natural desire is to also think about synthetic data generation + finetuning to have your LLM "know" the data in its weights instead of just context windows.
>
> **TLDR:** raw data from a given number of sources is collected, then compiled by an LLM into a .md wiki, then operated on by various CLIs by the LLM to do Q&A and to incrementally enhance the wiki, and all of it viewable in Obsidian. You rarely ever write or edit the wiki manually, it's the domain of the LLM. I think there is room here for an incredible new product instead of a hacky collection of scripts.

---

## Key Insights

1. **"Compiling" knowledge, not just storing it** — Raw data → LLM-processed wiki with summaries, backlinks, categorization. The LLM transforms messy inputs into structured, navigable knowledge.

2. **Markdown + directory structure as the universal format** — No fancy databases, no vector stores. Just `.md` files in folders. This is exactly our approach with `agents/shared/knowledge/`.

3. **Index files beat RAG at small scale** — Karpathy found that auto-maintained index files + brief summaries let the LLM find relevant content without vector embeddings. At ~100 articles / ~400K words, context window navigation works fine.

4. **Queries "add up"** — Every Q&A interaction produces outputs that get filed back into the wiki, making future queries more powerful. The knowledge base grows through use.

5. **LLM "linting" for knowledge health** — Periodic health checks find inconsistencies, missing data, and new connection opportunities. This is knowledge maintenance as a first-class operation.

6. **The LLM owns the wiki** — Humans rarely edit directly. The LLM writes, maintains, and evolves the knowledge base. This is a paradigm shift from human-curated wikis.

---

## Relevance to OpenClaw

### We're Already Doing This (Partially)

Our `agents/shared/knowledge/library/posts/` directory is essentially Karpathy's "compiled wiki" — Amy-Kimi scouts raw sources, writes structured summaries, maintains the research digest index. We have:
- ✅ Raw data ingest (Scout finds sources → Amy-Kimi processes)
- ✅ Markdown wiki structure (posts/, research-digest.md, research-projects/)
- ✅ Index files (research-digest.md serves as the master index)
- ✅ LLM-maintained content (agents write all posts, humans rarely touch)

### Where We Fall Short

1. **No "compilation" step** — We add posts but don't periodically "recompile" the wiki into a coherent whole. Posts are standalone islands, not a linked wiki.
2. **No backlinks or cross-references** — Posts don't link to related posts. The research digest is a flat table, not a graph.
3. **No "linting"** — We don't run health checks to find inconsistencies, duplicates, or gaps. The research digest has obvious duplicates (same papers listed multiple times).
4. **Queries don't "add up"** — When agents research questions, the answers disappear into session logs. They're not filed back into the knowledge base.
5. **No consolidation** — ~70+ posts but no synthesis documents that merge related findings into coherent narratives.

### Action Items

1. **Knowledge compilation workflow**: Periodically have an agent "recompile" the knowledge base — merge duplicates, add cross-references, write synthesis articles for major themes.
2. **Research digest cleanup**: Remove duplicate entries, add categories/tags, create a proper index with links between related entries.
3. **Query-result filing**: When agents answer research questions, file the results as new wiki entries to compound knowledge.
4. **Health check cron**: Periodic LLM linting over the knowledge base to find inconsistencies and suggest improvements.

---

## Connection to Memory Architecture Research

This tweet validates our [Memory Architecture (Tiered)](../../research-projects/memory-architecture-tiered.md) research project:
- Karpathy's wiki = our "semantic memory" tier (consolidated, structured knowledge)
- His `raw/` directory = our "episodic memory" (raw session logs, unprocessed inputs)
- The compilation step = our proposed "consolidation" pass
- His linting = our proposed "memory health checks"

The key insight: **the compilation/consolidation step is the secret sauce**. Raw storage is easy. Structured, navigable, cross-linked knowledge is what makes it useful.

---

## Tags
#knowledge-management #llm-workflow #markdown-wiki #memory-architecture #karpathy
