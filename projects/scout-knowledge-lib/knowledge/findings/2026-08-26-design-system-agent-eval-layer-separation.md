<ai_context>
summary: "Sanity's design-system agent harness shows why documentation tests and assisted-production tests must be separate. Structured docs raised reported clean-build rates sharply, while reusable code chunks and deterministic linting improved some accessibility and responsive-design markers—but those aids also masked recently introduced documentation failures. The reusable pattern is a layered evaluation: isolate the knowledge interface first, then test the full assisted path, and treat each layer's delta as diagnostic rather than collapsing it into one success score."
triggers: ["design system agent eval", "agent-facing documentation", "documentation regression", "code chunks for agents", "deterministic lint agent", "assistance masks documentation failure", "Sanity UI eval"]
last_updated: "2026-08-26"
source_basis: "HN item 49453117, Sanity's linked engineering report, and the open-source design-system-agent-tester README were inspected. All outcome measurements are vendor-reported and the system under test was changing during the evaluation."
</ai_context>

# Separate knowledge-interface tests from assisted-production tests

**Date:** 2026-08-26  
**Source:** https://news.ycombinator.com/item?id=49453117  
**Source:** https://www.sanity.io/engineering/design-system-evals  
**Repo:** https://github.com/sanity-labs/design-system-agent-tester  
**Source:** https://designsystemdocspec.org/  
**Tags:** agent-evaluation, design-systems, documentation, deterministic-tools, accessibility, regression-diagnosis

## Finding

HN surfaced Sanity's report on testing coding agents against Sanity UI. The most useful result is not simply that structured documentation helped. It is that **agent-facing knowledge and execution assistance are different intervention layers and can conceal each other's failures**.

The open-source harness runs multiple agents on the same interface brief and records build/fix behavior, accessibility violations, inline styles, responsive screenshots, performance, component use, visual differences, token usage, and agent friction reports. Sanity moved its design-system guidance from loosely managed Markdown toward typed JSON blocks for purposes, use cases, alternatives, checklists, and reusable code chunks. In the vendor's 30-run comparisons, reported successful-build rates moved from 3% to 47% for Haiku 4.5, 20% to 90% for Sonnet 4.6, and 40% to 100% for Opus 4.8 when comparing the current and new Sanity UI setups. A separate internal 76-task suite reportedly scored the library 90/100 and found a 34-point gap between no-doc and docs-provided conditions.

Sanity then added three forms of assistance: an interactive component wizard, deterministic lint/autofix rules, and retrievable code chunks. The wizard was frequently abandoned; linting was mixed; chunks were the strongest practical aid. In the reported quality-marker runs, docs plus chunks and linting reduced accessibility violations and greatly increased responsive builds for Sonnet and Opus relative to the current UI. The intervention did not consistently reduce cost or improve every metric.

The crucial diagnostic appeared when the team disabled chunks and linting. Results fell because agents were confused by recently added components; the assistance layer had been compensating for a documentation defect. The team therefore kept the aids for production use but removed them from documentation-isolation tests.

## Reusable evaluation pattern

Treat an agent-consumed API, SDK, component library, or operating procedure as a stack of separately testable interfaces:

1. **No-guidance baseline:** what can the model infer from package names, types, and ambient training?
2. **Knowledge-interface condition:** expose only the candidate docs or retrieval corpus. This tests whether the guidance itself is sufficient and findable.
3. **Deterministic-assistance condition:** add validators, autofixes, constrained generators, templates, or approved code chunks. This tests how much safe structure can absorb model variance.
4. **Full production path:** enable every intended aid and measure endpoint quality, cost, retries, and latency.

Compare deltas between adjacent layers rather than reporting only the full-stack score. In particular:

- a weak knowledge condition with a strong assisted condition means the guardrail is compensating for poor understanding;
- a strong build score with weak accessibility or responsiveness means syntactic success is not product success;
- a validator that improves the endpoint while hiding upstream regression is useful in production but unsafe as the sole diagnostic; and
- agent explanations should be treated as symptom reports, then confirmed through controlled ablations and logs.

This extends beyond design systems. Any agent platform that combines instructions, retrieval, templates, and deterministic repair needs both **isolation evals** for each interface and **integration evals** for the delivered workflow.

## Evidence limits

These are Sanity's own measurements of an evolving Sanity library with an author-built harness, not an independent benchmark. The article does not publish raw per-run outputs, confidence intervals, prompt snapshots, package revisions, or a preregistered analysis. It also changes the Haiku label between sections (4.5 and 4.6), and comparisons between the “current” and “new” UI can conflate library API changes, documentation changes, and assistance changes.

The harness currently supports Claude models and executes generated code plus package installs, so its own README recommends sandboxing. Metrics such as successful build, axe violations, inline-style counts, and pixel diffs are useful but do not fully measure interface quality. The reported n=30 conditions show directional evidence for this specific setup; they do not establish universal effect sizes for JSON documentation, chunks, or linting.