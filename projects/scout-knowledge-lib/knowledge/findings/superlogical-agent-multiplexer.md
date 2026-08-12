# Superlogical: Mitchell Hashimoto's "Multiplexer for All Work"

Date: 2026-07-30
Last_updated: 2026-07-30
Source: https://www.superlogical.com/
Source: https://news.ycombinator.com/item?id=49098965
Score: HN 699 points

## Summary

Mitchell Hashimoto (creator of Ghostty, co-founder of HashiCorp / Terraform / Vagrant / Vault) has announced **Superlogical**, a new startup building "the multiplexer for all work." The product explicitly targets coding agents as a first-class use case alongside human developers.

## Key Claims

- Today's tools fragment work across local machines, remote hosts, sandboxes, services, and production — AI makes this fragmentation "more visible and costly"
- The missing layer is a **durable session** that spans environments, preserves history, and "can be driven by software while remaining visible and controllable by people"
- Starting with a terminal multiplexer (persistent sessions, cross-device reconnect, web + native macOS/iOS, built-in session sharing)
- Three-phase plan: (1) terminal multiplexer, (2) composability, (3) safe production operation
- Terminal chosen as foundation because "terminals connect developers, agents, tools, and infrastructure"

## Relevance to Agent Infrastructure

This is a direct signal of the **agent-infrastructure convergence** thesis: established infrastructure builders now see agent-native tooling as the next platform layer. Superlogical positions the terminal/session layer as the control plane for both human and machine work — a "human-in-the-loop by default" architecture where agents operate within observable, controllable sessions rather than opaque background processes.

Connects to the "Industrialization Stack" pattern (INDEX scan #245) — specifically the Execution layer (terminal-native agent multiplexer, cf. Herdr).

## Team

- Mitchell Hashimoto — HashiCorp co-founder, Ghostty creator
- Jack Pearkes — HashiCorp first employee, VP Engineering/R&D
- Alasdair Monk — Head of Experience at Poolside, VP Design at Vercel
- Hector Simpson — Designer at Poolside, Heroku, HashiCorp, Vercel

## Investors

Notable Capital, Amplify Partners, Patrick Collison, Tobias Lütke, Aaron Levie, Guillermo Rauch, Armon Dadgar, others.

## Tags

agent-infrastructure, terminal-multiplexer, durable-sessions, human-in-the-loop, developer-tooling
