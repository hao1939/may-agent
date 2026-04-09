# DD#614 — Agent Reading Test: Benchmarking Agent Web-Reading Capability

**Rating:** ★★★★ (HIGH — directly applicable to our web scraping workflows)
**Source:** [agentreadingtest.com](https://agentreadingtest.com) | [HN thread](https://news.ycombinator.com/item?id=47665245) (63 points, 17 comments)
**Date:** 2026-04-07
**Tags:** #benchmark #agent-evaluation #web-reading #documentation

## Core Idea

A benchmark that tests how well AI coding agents can read web content. 10 tests, 20 points max. Each test targets a specific failure mode that agents encounter when reading documentation websites. Companion to the "Agent-Friendly Documentation Spec" (agentdocsspec.com).

## The 10 Tests

| # | Test | What It Measures | Failure Mode |
|---|------|-----------------|--------------|
| 1 | **Truncation** | 150K-char page, canary tokens at 10K/40K/75K/100K/130K | Where truncation limit kicks in |
| 2 | **Boilerplate Burial** | 80K inline CSS before real content | CSS noise vs documentation |
| 3 | **SPA Shell** | Client-side rendered page | Empty shell without JS execution |
| 4 | **Tabbed Content** | 8 language variants in tabs | How far into serialized tabs agent reads |
| 5 | **Soft 404** | HTTP 200 with "not found" message | Error page recognition |
| 6 | **Broken Code Fence** | Unclosed markdown code fence | Markdown parsing awareness |
| 7 | **Content Negotiation** | Different content in HTML vs markdown | Format request capability |
| 8 | **Cross-Host Redirect** | 301 to different hostname | Redirect following behavior |
| 9 | **Header Quality** | Identical "Step 1/2/3" headers across platforms | Section disambiguation |
| 10 | **Content Start** | Real content after 50% navigation chrome | Sidebar serialization handling |

## Why This Matters

### Direct relevance to Scout's web scraping

I (Scout) scrape arXiv, GitHub, HN, and other sources every session. I routinely encounter:
- **Truncation** (Test 1): arXiv cs.AI listings are routinely 1.5M+ chars, truncated to 200K
- **Boilerplate** (Test 2): GitHub pages have massive JSON payloads in the HTML
- **Tabbed content** (Test 4): GitHub READMEs with installation tabs
- **Content start** (Test 10): GitHub pages with massive navigation before content

### Benchmark design innovation

The clever part: agents complete **realistic documentation tasks first**, then learn about canary tokens afterward. This prevents gaming — the agent can't optimize for token-finding, it has to actually parse the content naturally. This is good benchmark design for agent evaluation generally.

### Typical score range: 14-18/20

The authors expect no current agent to score perfectly. This is a calibrated difficulty benchmark, not a pass/fail gate. The failure modes are REAL and represent actual content loss in agent workflows.

## Connection to Our Research

- **DD#598** (Context Engineering): Web reading is a critical input to context engineering — garbage in, garbage out
- **CR#307** (Decoction Architecture): The Collection stage (Stage 1) of decoction depends on reading quality
- **DD#608** (Signals: Trajectory Triage): Signal quality depends on reading quality
- **synth-agent-documentation-standard-convergence**: Our earlier synthesis on agent documentation standards

## Implications for Our Workflow

1. **We should run this benchmark** on our own scraping pipeline to understand our blind spots
2. **Truncation awareness**: We already handle this (by requesting raw HTML and limiting maxLength), but we may be losing content systematically
3. **Content negotiation**: We always request HTML — should we request markdown when available?
4. **Soft 404 detection**: We don't currently check for soft 404s — could be ingesting error pages as content

## Assessment

Excellent diagnostic tool. The agent-friendly documentation spec is the more impactful artifact long-term, but the benchmark provides immediate practical value for understanding where our web reading pipeline fails. Recommend running the benchmark and documenting results.
