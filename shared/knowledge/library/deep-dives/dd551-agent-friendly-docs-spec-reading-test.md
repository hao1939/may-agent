# DD#551 — Agent-Friendly Documentation Spec & Agent Reading Test

**Source:** https://agentdocsspec.com + https://agentreadingtest.com + https://github.com/agent-ecosystem/afdocs
**Author:** Dachary Carey (dacharycarey.com)
**Published:** April 2026 (HN frontpage April 6)
**Tags:** #agent-infrastructure #documentation #benchmarks #web-fetch #llms-txt #agent-reading

## Why This Matters (★★★★)

Two complementary projects that formalize what "agent-readable" documentation means:

1. **Agent-Friendly Documentation Spec** — 22 checks across 7 categories that evaluate how well a documentation site serves AI agent consumers
2. **Agent Reading Test** — A benchmark website with 10 test pages, each targeting a specific failure mode. Agents self-report what they found; compare against answer key for a score (max 20 points).

This is the **first formal specification** for agent-consumable web content. It grew from 10+ hours of empirical work watching Claude Code interact with documentation sites, identifying systematic failure modes.

## The 22-Check Specification

### 7 Categories

| Category | Checks | What It Evaluates |
|---|---|---|
| Content Discoverability | 6 | llms.txt exists, valid, fits single fetch, links resolve, links → markdown, embedded directives |
| Markdown Availability | 2 | .md URL support, content negotiation via Accept headers |
| Page Size | 4 | SPA/CSR detection, markdown size, HTML size, content start position |
| Content Structure | 3 | Tabbed content serialization blowup, header quality, code fence validity |
| URL Stability | 2 | Soft 404 detection, redirect behavior |
| Observability | 3 | llms.txt freshness, markdown/HTML parity, cache headers |
| Authentication | 2 | Auth gate detection, alternative access paths |

### Key Failure Modes Identified

1. **Truncation limits** — Agents hit context limits before reaching content
2. **CSS walls** — Inline CSS makes a 97-line HTML page invisible to agents
3. **SPA/CSR rendering** — Client-side rendered content is empty to fetch tools
4. **Cross-host redirects** — Agents can't follow redirects across domains
5. **Soft 404s** — Pages return 200 but with "not found" content
6. **Tabbed content blowup** — Tab UIs serialize all tabs, 5× content expansion
7. **Missing llms.txt** — No discovery mechanism for agent consumers

### Quick Wins (Highest Impact)

1. Create llms.txt < 50K characters
2. Serve .md versions via URL suffix or content negotiation
3. Keep pages < 50K characters
4. Add llms.txt pointer to every docs page
5. Use same-host HTTP redirects only

## Agent Reading Test

### Design

- 10 test pages, each targeting one failure mode
- Max 20 points (2 per page)
- Agents self-report what they found
- Compare against answer key

### Failure Modes Tested

Based on the Agent-Friendly Documentation Spec categories — tests things like:
- Can the agent find content buried after CSS?
- Can the agent handle tabbed content?
- Can the agent follow redirects?
- Can the agent detect soft 404s?
- Can the agent parse code fences correctly?

### CLI Tool: afdocs

```bash
npx afdocs check https://docs.example.com
```

Runs all 22 checks programmatically. Available as Node.js library for CI integration.

## Connection to Our System

### Direct Relevance

Our agents (Scout, Bob, etc.) constantly fetch web content via `scrape_webpage`. Every failure mode in this spec is one we encounter:
- **Truncation**: We routinely see "truncated from X to 200,000 chars"
- **SPA rendering**: GitHub trending page renders empty
- **CSS interference**: Content buried in styling
- **Missing discovery**: No standard way to find what's available

### Implications for Agent Architecture

1. **Tool improvement**: Our web fetch pipeline should implement some of these checks
2. **llms.txt adoption**: We should check for llms.txt before scraping
3. **Content negotiation**: Try .md suffix before HTML scraping
4. **Size budgeting**: Request only what fits in context

### Connects To

- **DD#541** (BenVanik Case Study) — Input quality affects agent reasoning quality
- **DD#522** (Karpathy LLM Wiki) — Compiled knowledge > fetched knowledge
- **CR#293** (Read:Edit Ratio) — Better inputs → better read:edit ratios
- **CR#294** (Agent Sandbox Infrastructure) — Infrastructure layer for agent I/O
- **Harness Engineering** research project — Agent tool quality matters

## Predictions

- **P296**: llms.txt adoption will exceed 50% of major documentation sites within 12 months
- **P297**: Agent-specific content negotiation (Accept: text/markdown) will become standard in web servers within 18 months
- **P298**: The Agent Reading Test score will become a standard metric in agent benchmarks within 6 months

## Recommendations

- **R56**: Implement llms.txt checking in our web fetch pipeline — try `{domain}/llms.txt` before general scraping
- **R57**: Add .md URL fallback — try `{url}.md` or `{url}/index.md` before HTML parsing
