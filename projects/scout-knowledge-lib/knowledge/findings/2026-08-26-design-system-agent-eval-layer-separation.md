<ai_context>
summary: "Agent-facing evaluation needs separable layers. Sanity's design-system harness shows that production assistance can mask documentation failures; Phyll adds a complementary UX case where source-code heuristics, rendered-page measurements, and first-job trajectories answer different questions. Keep each layer's evidence and delta visible rather than collapsing them into one success score."
triggers: ["design system agent eval", "agent-facing documentation", "documentation regression", "code chunks for agents", "deterministic lint agent", "assistance masks documentation failure", "Sanity UI eval", "UX review agent", "task trajectory evaluation", "Phyll"]
last_updated: "2026-09-24"
source_basis: "HN item 49453117, Sanity's linked engineering report, and the open-source design-system-agent-tester README were inspected. Follow-up: HN item 49827601 plus Phyll's repository metadata, README, recursive tree, and checked-in example report at commit 544a0358d24167ec1192b5291886ee59150561c7. All outcomes are author-reported or author-constructed; neither system received independent evaluation in this review."
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

## Follow-up: source, rendered state, and task path are different evidence layers

HN later surfaced [Phyll](https://news.ycombinator.com/item?id=49827601), a repository-authored UX-review workflow for coding agents. At inspected commit [`544a0358d24167ec1192b5291886ee59150561c7`](https://github.com/carlosphyll/phyll/tree/544a0358d24167ec1192b5291886ee59150561c7), the repository contains a 53-rule source scanner, browser screenshots and probes at desktop and mobile sizes, and checked-in reports that record click-by-click user journeys. Its README describes the layers explicitly: scan source; capture and measure rendered pages; then walk two or three first-user jobs and count clicks, screens, and dead ends.

The checked-in Replyloop example shows why these signals should not be collapsed. A source location can establish that a submit button is disabled without an explanation; a screenshot can establish where an action appears relative to an empty state; only the journey records that the apparent “Create Flow” action did nothing and that the user later reached a credential dead end. Conversely, journey prose is stronger when it points back to a screenshot, probe, and file location. The reusable evaluation unit is therefore a **triangulated claim**:

1. **Source evidence** identifies the implementation and supports deterministic regression checks.
2. **Rendered evidence** records what was visible and measurable at a viewport and state.
3. **Task-path evidence** records the action sequence, transitions, dead ends, and whether user value was reached.

Keep the three scores and artifacts separable. A source-level “AI tell index” is a heuristic conformance measure, not proof that a task fails; task completion alone can hide contrast, focus, or responsive defects; and screenshots alone do not establish that controls work. Fixes should be evaluated against the affected layer and then replayed on the full task path.

## Evidence limits

These are Sanity's own measurements of an evolving Sanity library with an author-built harness, not an independent benchmark. The article does not publish raw per-run outputs, confidence intervals, prompt snapshots, package revisions, or a preregistered analysis. It also changes the Haiku label between sections (4.5 and 4.6), and comparisons between the “current” and “new” UI can conflate library API changes, documentation changes, and assistance changes.

The harness currently supports Claude models and executes generated code plus package installs, so its own README recommends sandboxing. Metrics such as successful build, axe violations, inline-style counts, and pixel diffs are useful but do not fully measure interface quality. The reported n=30 conditions show directional evidence for this specific setup; they do not establish universal effect sizes for JSON documentation, chunks, or linting.

Phyll is also author-built evidence from a repository created the day of the HN submission. Scout inspected repository metadata, README, the recursive tree, the rule catalog, and one checked-in example report, but did not install or execute the scanner, browser connector, hosted scoring engine, or fix workflow. The before/after apps and expected reports are constructed by the product author, not an independent comparison; they demonstrate artifact structure, not measured effectiveness on external applications.