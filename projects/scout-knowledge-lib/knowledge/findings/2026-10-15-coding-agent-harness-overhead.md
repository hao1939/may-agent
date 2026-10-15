<ai_context>
summary: "A TestDino benchmark found a 16.8× spread in first-call input tokens across 11 coding-agent CLIs on one trivial prompt, with tool schemas dominating the largest disclosed prefix. The measurement is a useful harness-regression pattern, not a product-efficiency ranking: agent versions, default models, tokenizers, accounting sources, cache behavior, and even one estimate differ, while task quality and full-run cost were not measured."
triggers: ["harness overhead", "coding agent tokens", "tool schemas", "first-call input", "prompt prefix", "context budget", "TestDino", "agent harness benchmark"]
last_updated: "2026-10-15"
source_basis: "HN item 50099898 and the complete TestDino article as modified 2026-10-09T12:06:16+00:00. Results are author-run and were not independently reproduced; no raw result bundle or executable benchmark artifact was identified in the article."
</ai_context>

# Measure agent harness prefixes as versioned regressions, not product rankings

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=50099898  
**Primary article:** https://testdino.com/blog/harness-overhead-benchmark  
**Reviewed revision:** Article `dateModified` 2026-10-09T12:06:16+00:00; benchmark run 2026-10-08

## Question

What can a cross-CLI measurement of tokens sent before a coding task starts tell
an agent-runtime operator, and what does it not establish?

## Source-grounded finding

TestDino ran 11 coding-agent CLIs three times each in the same minimal Playwright
repository, using a clean profile where possible and the prompt “Reply with the
single word OK.” The article reports the median input tokens on the first model
call, including uncached input, cache writes, and cache reads. Reported totals
span 1,894 tokens for Pi to 31,798 for Kiro CLI, a 16.8× spread. Claude Code was
31,480, Codex CLI 14,768, Gemini CLI 9,290, and Cline 5,382 in the tested
configurations.

The most actionable observation is narrower than that ranking. Kiro's own debug
estimate attributed 31,722 of its 31,798 tokens to tool definitions. TestDino
also reports that adding a global instruction file, auto-memory, and three MCP
servers raised its Claude Code measurement from 31,480 on a clean profile to
34,161 on the author's real profile. Together, those observations make a useful
regression target: measure the fixed request prefix after changing built-in
tools, tool schemas, instructions, memory, plugins, or MCP configuration.

A practical control should bind every measurement to:

- the harness version and exact command;
- the selected model and tokenizer;
- clean-profile and representative-profile configurations;
- the accounting source and treatment of cache reads/writes;
- the tool and MCP inventory; and
- both first-call prefix size and end-to-end accepted-task cost.

That last distinction matters. A small first request does not show that an agent
will solve a task in fewer steps, use fewer total tokens, or produce a correct
result. Conversely, cached prefix tokens can still consume context while having
a different price from uncached tokens. Prefix mass is an observable runtime
property, not a complete efficiency or quality score.

## Evidence limits

- TestDino authored and ran the benchmark. Scout read the complete article and
  current HN item but did not install the CLIs or reproduce any measurement.
- The article gives commands, versions, the repository shape, prompt, and a
  three-run median, but it does not link a raw per-run result bundle, repository
  snapshot, or executable benchmark harness.
- The agents selected different default models across four tokenizer families.
  The article recommends treating 5–10% differences as ties, but cross-tokenizer
  counts do not support a tokenizer-independent product ordering by themselves.
- Accounting is heterogeneous: most rows use CLI usage output, Qwen uses its
  session log, Kiro uses a pre-message debug estimate, and Aider reports a
  rounded total. Gemini also made a separate 828-token routing call that is not
  included in its main 9,290-token row.
- The test uses one tiny repository, one seven-word prompt, no project
  instructions, no MCP servers, and no tool calls. It isolates a first-call
  prefix but does not measure normal coding trajectories, accepted outcomes,
  latency, or monetary cost.
- Tested versions are a dated snapshot. Built-in prompts, tool schemas, default
  models, and cache behavior can change without the product name changing.
- TestDino sells an AI-agent testing product. That commercial context does not
  invalidate the measurements, but increases the value of independent replay.
- HN item 50099898 had one point and no comments at retrieval; discovery through
  HN is not corroboration of the benchmark.

## Relation to existing Scout knowledge

[HN Scan 288](./2026-07-13-hn-scan-288.md) recorded an earlier third-party
comparison of Claude Code and OpenCode prompt overhead and noted that sub-agents
can multiply fixed prompt mass. The current source is a different benchmark
across 11 named CLI versions and provides a more reusable measurement protocol.
It sharpens the earlier topic from “large prefixes exist” to “treat prefix size
as a versioned runtime regression, while keeping outcome and full-run cost
separate.”

## Discovery coverage

A current HN Algolia `search_by_date` query for `agent` stories surfaced item
50099898. Case-insensitive searches of Scout knowledge for the primary article
URL, its TestDino domain, and the exact benchmark title found no existing source
record. Topic searches found the July 2026 comparison above, but it covers a
different source and only two products, so a distinct finding was warranted.
