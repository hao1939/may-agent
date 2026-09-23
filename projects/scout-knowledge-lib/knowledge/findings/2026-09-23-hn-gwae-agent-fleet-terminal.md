---
title: "HN — Gwae makes agent status a terminal protocol problem"
source: hn
date: 2026-09-23
last_updated: 2026-09-23
type: finding
tags: [hn, coding-agents, terminal-infrastructure, observability, human-in-the-loop]
---

<ai_context>
This note records a current HN project signal and a source inspection of Gwae at commit `b636e7e0fac670fd1c8a97dee69230fcf78995ff`. It does not establish adoption, production reliability, or independently reproduce the project's performance results.
</ai_context>

# Gwae makes agent status a terminal protocol problem

## Signal

Gwae is a macOS-first terminal multiplexer designed for several concurrent CLI coding agents. Instead of shrinking panes as the fleet grows, it keeps panes full-width on a horizontally scrolling strip. Its agent-facing features include a heads-up display of pane state, a shortcut that prioritizes failed panes and then panes needing attention, and a picker for spawning installed agent harnesses.

The more reusable signal is beneath the layout: **fleet triage depends on explicit lifecycle semantics, not merely visible terminal activity**. Gwae's source combines two status channels:

- Standard OSC 133 shell markers map prompt, command start, and command completion into idle, running, and failed states. A non-zero completion stays failed through the following prompt and clears on a new command.
- For Jcode panes, a background poll reads the harness daemon's client map every three seconds. This corrects activity heuristics that can mistake spinner redraws or notification output for ongoing work, and it also prevents a quiet tool call from being mislabeled idle.

The reconciler gives a shell's non-zero exit verdict precedence over a daemon's coarse healthy/settled state. It also stops trusting a stale daemon snapshot after roughly two poll intervals plus headroom, then falls back to the terminal heuristic.

## Design implication

An operator dashboard should not infer agent state from output volume alone. A practical terminal control surface needs a small, explicit state model and a precedence policy across evidence sources:

1. **Protocol verdict:** command start/completion and exit status provide a local execution fact.
2. **Harness lifecycle:** generating, ready, or failed distinguishes quiet work from work awaiting attention.
3. **Freshness:** a once-authoritative status must lose authority when its producer stops refreshing it.
4. **Triage order:** failure and input-needed are different settled states and should route operator attention differently.

This also exposes an interoperability gap. OSC 133 describes shell-command lifecycle, while harness-specific APIs describe agent-turn lifecycle. Without a shared agent-status protocol, a multiplexer either maintains per-harness adapters or falls back to weaker activity inference. The status tile is therefore not just UI polish; it is the projection of an evidence-fusion contract.

## Boundaries and caveats

- The HN submission had one point and no comments when inspected, so it is a project-discovery signal rather than community validation.
- Gwae's documentation says it is currently developed and tested on macOS, has no daemon, and cannot detach and reattach like tmux. Individual harnesses retain their own persistence.
- The README reports sub-millisecond echo and pane-spawn medians against Herdr and tmux. The repository includes a real-PTY benchmark script, but the published spawn measurement uses five samples and this scan did not reproduce it; the numbers should be treated as author-reported, environment-specific results.
- Source inspection confirms the implemented parsing, reconciliation, staleness, and unit-test logic at the reviewed commit, not end-to-end behavior in a live terminal or with a real agent fleet.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49813028
- **Repo:** https://github.com/hongnoul/gwae
- **Reviewed commit:** https://github.com/hongnoul/gwae/commit/b636e7e0fac670fd1c8a97dee69230fcf78995ff
- **Agent usage guide:** https://github.com/hongnoul/gwae/blob/b636e7e0fac670fd1c8a97dee69230fcf78995ff/docs/agents.md
- **Status reconciliation:** https://github.com/hongnoul/gwae/blob/b636e7e0fac670fd1c8a97dee69230fcf78995ff/crates/gwae/src/harness_status.rs
- **OSC 133 parser:** https://github.com/hongnoul/gwae/blob/b636e7e0fac670fd1c8a97dee69230fcf78995ff/crates/gwae/src/tui/osc.rs
- **Benchmark harness:** https://github.com/hongnoul/gwae/blob/b636e7e0fac670fd1c8a97dee69230fcf78995ff/scripts/latency_bench.py
