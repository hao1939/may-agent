<ai_context>
summary: "Keel illustrates a narrow agent-authoring boundary for consequential systems: an agent composes a restricted typed DSL, validation rejects known structural and timing errors, and an immutable fingerprinted artifact—not the model—runs in backtest and live execution. The design reduces the agent's authority and the semantic distance between test and deployment, but product-authored documentation does not establish component correctness, data quality, realistic simulation, execution reconciliation, or production reliability."
triggers: ["Keel", "usekeel", "typed strategy language", "agent DSL", "model outside execution loop", "clock types", "backtest live parity", "immutable strategy artifact", "Hyperliquid"]
last_updated: "2026-10-01"
source_basis: "Complete Keel how-it-works Markdown twin and visible agents page, plus HN item 49924208. All implementation, validation, timing, and performance statements are publisher-authored and were not independently reproduced."
</ai_context>

# Put the agent in a typed authoring loop, not the live effect loop — Keel (HN, October 2026)

## Finding

Keel presents a concrete version of a useful boundary for consequential agents: let the model propose a small, checkable program, then run a fixed artifact without the model. In Keel's published design, an agent searches a component catalog, writes a trading strategy in a restricted DSL, validates and backtests it, and compares revisions. A saved strategy compiles to canonical JSON whose SHA-256 fingerprint covers the steps and pinned component versions. The same stored artifact is then used by the backtester and live evaluator; the documentation says a deployment is refused if the saved source no longer compiles to that fingerprint.

The restriction is semantic, not merely syntactic. Pipeline edges distinguish signals, bounded forecasts, and portfolio weights even when their underlying values have similar shapes. Values also carry a clock `(period_minutes, phase_minutes)`, cross-clock composition is constrained, and each indicator is said to have a prefix-causality test. Imports, loops, conditionals, method calls, positional arguments, and computed parameter expressions are excluded from the accepted source language. Structured findings include codes, locations, expected and actual types, and suggested repairs, giving the authoring agent a bounded correction loop rather than access to arbitrary trading code.

The sharpest reusable idea is **test-to-effect identity**. Types and validation can reject represented mistakes before execution, while the fingerprint and pinned component versions bind the reviewed strategy to the artifact that runs. Keeping the model out of per-bar evaluation also prevents a later model release or prompt-context change from silently changing an already deployed strategy. The product's agents page says the connected agent can build, backtest, and read strategies, while live account action remains in the app for a person; if enforced as described, this further separates proposal from deployment authority.

## What the evidence does not establish

These are Keel's own product and design claims. Scout read the complete published `how-it-works.md` page, the visible agents page, and the HN submission text, but did not inspect source code, connect the MCP server, create an account, run a backtest, deploy a strategy, or observe an order or receipt. The reported component counts, validation behavior, causal tests, backtest timings, and return example were not independently reproduced.

A valid typed graph proves only properties represented by the language and validator. It does not by itself prove that a component's implementation is correct, its declared clock matches upstream data, market data are complete and point-in-time accurate, fees and slippage model live execution, or the strategy is economically sound. A fingerprint binds an artifact's identity, not the truth of its assumptions. Likewise, running the same artifact in backtest and live evaluation narrows code-path drift but cannot make historical simulation and external exchange behavior identical.

The live-effect boundary also needs evidence below the strategy artifact: order authorization, account and leverage limits, idempotency, partial-fill handling, provider receipts, cancellation, and reconciliation after timeouts or ambiguous outcomes. The inspected public page mentions orders and receipts but does not specify those protocols. The stated human confirmation step is therefore important, but its exact approval binding and post-effect reconciliation remain unassessed.

## Reusable design rule

For high-consequence domains, move the agent from **acting** to **authoring a constrained artifact**:

1. expose a small catalog whose inputs, outputs, semantic domains, clocks, and versions are explicit;
2. reject arbitrary host-language escape hatches and return structured, local repair findings;
3. compile the accepted proposal into a canonical, immutable artifact;
4. bind review, simulation, deployment, and receipts to that artifact and its dependency/data identities;
5. keep deployment authority and provider-level effect reconciliation outside the authoring agent; and
6. test the validator with semantic negatives while independently testing every catalog component and external-effect path.

This architecture reduces error surface and makes review more legible. It does not convert validation into proof of profitability, component correctness, or safe external execution.

## Sources and coverage

- **HN:** https://news.ycombinator.com/item?id=49924208
- **Source:** https://usekeel.io/how-it-works
- **Markdown twin read in full:** https://usekeel.io/how-it-works.md
- **Agent/tool boundary:** https://usekeel.io/agents
- **Observation date:** 2026-10-01
- **Coverage:** Complete publisher-authored how-it-works Markdown twin, visible agents page, and HN submission text. No source revision was exposed; no implementation, account, MCP session, backtest, deployment, or live effect was inspected.
- **Disposition:** New source-grounded implementation-design signal; useful for constrained agent authoring and artifact-bound deployment, with production claims unverified.
