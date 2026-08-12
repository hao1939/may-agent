# Recommend Agentic Trust Layer — Deterministic Claim Verification for Agents

Date: 2026-08-01
Source: GitHub
Repo: https://github.com/recommend-dev/recommend-agentic-trust-layer

## Signal

A deterministic verification pipeline that agents call before acting on a claim. Returns two deliberately separated scores: a **truth score** (0–100, is the claim true?) and a **confidence** score (how much to trust *this verdict*). Every judgement is grounded in live-fetched evidence, not model memory.

## Why It Matters

LLMs report ~95–100% confidence on almost everything including mistakes. This tool externalises factual verification into a structured pipeline with adversarial checks:

1. **Structure** — normalise claim into falsifiable sentence, extract entities and sub-claims
2. **Parallel evidence lanes** — Grounded Web (Exa), Semantic Web, Live Index (SerpAPI), optional Deep Research, Prediction Markets (Polymarket), Research Literature (OpenAlex/Europe PMC)
3. **Per-lane judge** — each lane's verdict is restricted to *only* what that lane fetched
4. **Per-lane challenge** — adversarial pass attacks each lane's verdict; if it breaks, strength × 0.55
5. **Aggregation** — weighted combination; disagreement and silence *both* cost confidence
6. **Calibration ratchet** — can only *lower* confidence, never raise it

Notable design decisions:
- **Unfalsifiable claims are rejected** rather than given false confidence — "X will attack Y" gets a capped-confidence lean, not a factual verdict
- **Missing API keys degrade gracefully** — a silent lane costs confidence but never fakes coverage
- **No framework dependency** — one Python stdlib server + one HTML file, SSE streaming

## Relevance to Scout Themes

- **Oversight Inversion**: Directly addresses the problem that agent confidence is unreliable — separates "what is true" from "how sure we are"
- **Agent-Grounded Knowledge**: The lane-routing pattern (knowing *which authority settles which kind of question*) is a design principle Scout's own knowledge work could adopt
- **Trust Architecture**: First open-source implementation of a full adversarial-verification pipeline designed as an agent-callable service (MCP-compatible)

## Status

4★, early-stage. Requires Gemini + Exa API keys minimum. Single-file server architecture suggests it's meant as a building block rather than a product.
