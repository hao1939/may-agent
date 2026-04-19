# Tool Verification Report — 2026-03-06T14:45Z

## Environment Summary
- **Runtime**: Node.js (node user), Debian container
- **Available CLIs**: curl, node, python3
- **API Keys Available**: Kimi/Moonshot (KIMI_API_KEY), Telegram Bot (TELEGRAM_BOT_TOKEN)
- **Writable Paths**: `/app/agents/` (node-owned), `/home/node/`
- **Read-only**: `/app/` root (root-owned, except agents/ and .state/)

## Tool Status Matrix

| Tool / API | Status | Notes |
|---|---|---|
| **curl** | ✅ WORKS | curl 7.88.1, full HTTPS support |
| **Node.js fetch** | ✅ WORKS | Native fetch API available |
| **python3** | ✅ WORKS | Python 3.11, xml.etree, json available |
| **GitHub API** | ✅ WORKS | Unauthenticated, rate-limited (60/hr). Search repos, users, code all work |
| **arXiv API** | ✅ WORKS | Must use HTTPS (`export.arxiv.org`). Atom XML format. Supports title/author/abstract search, date sorting |
| **Reddit API** | ❌ BLOCKED | IP/network blocked. Returns "whoa there, pardner!" HTML. Needs OAuth or different network |
| **HuggingFace API** | ✅ WORKS | Public model search, sorting by downloads/likes, no auth needed |
| **Kimi/Moonshot API** | ✅ WORKS | Base URL: api.moonshot.ai/v1. Models endpoint returns moonshot-v1-8k, kimi-* models. Can use for LLM inference |
| **General HTTP** | ✅ WORKS | httpbin.org, google.com both reachable. No firewall issues except Reddit |

## Detailed Findings

### GitHub API (Best Source for Repo Discovery)
- Search syntax: `q=keyword+created:>YYYY-MM-DD&sort=stars&order=desc`
- Returns: full_name, stars, forks, description, topics, language, created/updated dates
- Rate limit: 10 search requests/minute unauthenticated
- **Top trending AI agent repos (created 2026)**:
  - `zeroclaw-labs/zeroclaw` ⭐23.8k — Rust-based autonomous agent runtime (<5MB RAM), Harvard/MIT
  - `snarktank/ralph` ⭐12.2k — Autonomous AI agent loop that runs PRDs to completion
  - `Agent-Field/SWE-AF` ⭐320 — Autonomous SWE fleet of AI agents
  - `VoltAgent/awesome-ai-agent-papers` ⭐241 — Curated 2026 AI agent papers (363+ papers)

### arXiv API (Best Source for Research Papers)
- Endpoint: `https://export.arxiv.org/api/query`
- Supports: `search_query` (ti:, au:, abs:, all:), `sortBy=submittedDate`, `max_results`
- Parse with python3 xml.etree.ElementTree (Atom XML namespace)
- **Key recent papers found (2026-03-05)**:
  - "EvoTool: Self-Evolving Tool-Use Policy Optimization" — blame-aware mutation for agent tool use
  - "Beyond the Context Window" — cost-performance analysis of memory vs long-context for persistent agents
  - "Alignment Backfire" — safety interventions reverse across 16 languages in multi-agent systems

### HuggingFace API
- Endpoint: `https://huggingface.co/api/models?search=X&sort=downloads&limit=N`
- Returns: modelId, downloads, likes
- Good for tracking model popularity trends

### Kimi/Moonshot API
- Full OpenAI-compatible API with chat completions
- Available models include moonshot-v1-8k and kimi-* variants
- Could be used as a secondary LLM for analysis tasks

## Recommendations
1. **For scout/amy exploration**: Use GitHub API + arXiv API as primary sources (both reliable)
2. **Skip Reddit**: Blocked from this network. Not worth retrying without OAuth setup
3. **HuggingFace**: Good supplementary source for model tracking
4. **Kimi API**: Available for automated analysis/summarization if needed
5. **Rate limits**: GitHub 60 req/hr unauthenticated — sufficient for periodic exploration
