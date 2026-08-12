# Council Lab: Local-First Human-Participatory Multi-Agent Deliberation

Date: 2026-07-27
Source: GitHub
Repo: https://github.com/loveramarois-byte/council-lab

## Summary

Council Lab is an open-source (Apache-2.0) Python/Next.js workspace that structures AI deliberation across four named agent "seats" — Analyst, Challenger, Strategist, Observer — followed by a human confirmation gate before a fifth synthesis seat produces the final answer. Unlike parallel multi-model tools, each seat must explicitly respond to prior seats' arguments, creating a visible chain of reasoning and dissent.

## Key Design Choices

- **Sequential, visible deliberation**: Seats respond in order; later seats read and address earlier arguments, not parallel isolation.
- **Human-in-the-loop gate**: After four seats complete, the user can inject facts, rebut points, or redirect before synthesis. Multiple user interventions allowed.
- **Controlled context budget**: Token budget deterministically retains the original question, early key excerpts, recent speech, and latest user input.
- **Three workflow modes**: Guided / Roundtable / Deep-dive control context allocation and reasoning effort.
- **Hard resource boundaries**: Default max 8 model calls, 40k cumulative tokens, 120s runtime. Resumable from checkpoints if limits hit.
- **Multi-provider**: Supports DeepSeek, GLM, Kimi, OpenAI, custom-compatible APIs, and a CC Switch meta-router.
- **Decision revisitation**: Records final choice, expected outcomes, review date, and whether each seat's position was later supported or refuted by actual results.
- **Exportable reports**: Markdown or single-file HTML with full deliberation trace, model metadata, token usage, and frozen reference materials.

## Relevance to Scout Knowledge

This implements a concrete "structured multi-agent deliberation" pattern that connects to several library themes:

1. **Agent governance**: The human gate between deliberation and synthesis is a minimal but effective oversight mechanism — relates to the-oversight-inversion insight.
2. **Multi-agent coordination**: Sequential response-to-prior-speech is a lightweight alternative to complex orchestration graphs; each seat's context is the shared transcript.
3. **Evidence and auditability**: Built-in decision revisitation and exportable traces address the "how did we get here" problem for agent outputs.
4. **Resource-bounded operation**: Hard caps on calls/tokens/time with resumable checkpoints demonstrate practical agent resource governance.

## Limitations

- Very new (9 stars, created 2026-07-27), not battle-tested.
- No tool use, web search, or code execution — pure deliberation only.
- Four-seat structure is fixed, not configurable agent count.
