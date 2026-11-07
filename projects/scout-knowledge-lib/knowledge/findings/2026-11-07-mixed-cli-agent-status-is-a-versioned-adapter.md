---
title: "Mixed-CLI agent status is a versioned adapter, not a generic terminal fact"
source: hn
date: 2026-11-07
last_updated: 2026-11-07
type: finding
tags: [hn, coding-agents, terminal-infrastructure, observability, interoperability]
---

<ai_context>
This note records HN item 50406983 and static inspection of Agent Manager at commit `12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f`. It does not establish adoption, production reliability, or live compatibility with any supported coding-agent CLI.
</ai_context>

# Mixed-CLI agent status is a versioned adapter, not a generic terminal fact

## Signal

Agent Manager presents Claude Code, Codex, OpenCode, Gemini CLI, Cursor CLI, Kiro CLI, and other coding agents in one tmux-backed session list. Its operator-facing statuses—working, waiting, finished, errored, idle, dead, and starting—look like a common protocol, but the inspected implementation shows that they are produced by a maintained compatibility layer rather than by terminal activity alone.

The status engine combines several forms of evidence:

- tool-specific regular expressions and layout rules for input regions, turn-end markers, busy footers, dialogs, usage limits, and other terminal chrome;
- changes in a bounded content region, with quiet-time windows used to infer when marker-less output has stopped;
- acknowledgements that map already-seen finished or waiting states back to idle without erasing a later screen change;
- Claude Code lifecycle hooks as a higher-priority source, reconciled against pane evidence for states the hooks cannot fully observe;
- versioned terminal captures and tests for individual CLIs and UI versions.

The pinned commit is itself a drift example. It fixes signed-out Claude turns that could remain classified as working, removes broad text patterns that also matched quoted or submitted text, and changes precedence so an errored hook is not overwritten by the turn summary rendered beneath the failure. In other words, a visible status label depends on source freshness, scoping, precedence, and CLI-version compatibility—not merely on whether a pane is producing bytes.

## Design implication

A mixed-runtime agent dashboard should treat normalized status as a derived claim with adapter provenance:

1. **Keep the raw evidence channels distinct.** Lifecycle events, terminal protocol markers, pane parsing, output-change heuristics, and process liveness have different failure modes.
2. **Scope text matching to the current turn.** Historical output, user prompts, quoted errors, and tool results can reproduce strings that look like live status signals.
3. **Define precedence and staleness explicitly.** A hook can be authoritative for one transition yet stale or incomplete for background work, crashes, interrupts, or a later pane state.
4. **Version fixtures with the producer.** Terminal UIs are unstable interfaces; compatibility claims need captured screens and regression tests tied to CLI versions.
5. **Represent ambiguity instead of forcing activity into success.** Waiting, errored, finished, dead, and acknowledged are operationally different even when all are “not currently streaming.”

The reusable lesson is that cross-agent supervision needs a compatibility matrix and evidence-fusion contract. A common status vocabulary is useful, but it does not become a common protocol merely because several tools are shown in one list.

## Boundaries and caveats

- The HN submission had three points and no comments when inspected, so it is a discovery signal rather than community validation.
- The repository README names thirteen supported agent CLIs, but this scan inspected only the general status engine, Claude hook path, architecture documentation, and the pinned fix; it did not audit every adapter or fixture.
- Scout did not build or run Agent Manager, its tests, tmux sessions, hooks, supported CLIs, or failure scenarios.
- The source demonstrates substantial authored test coverage and compatibility machinery, not that every current or future CLI release is classified correctly.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50406983
- **Repo:** https://github.com/wainmann/agent-manager
- **Reviewed commit:** https://github.com/wainmann/agent-manager/commit/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f
- **README:** https://github.com/wainmann/agent-manager/blob/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f/README.md
- **Status derivation:** https://github.com/wainmann/agent-manager/blob/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f/internal/execution/pollstatus.go
- **Status engine:** https://github.com/wainmann/agent-manager/blob/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f/internal/status/status.go
- **Classification and turn scoping:** https://github.com/wainmann/agent-manager/blob/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f/internal/status/classification.go
- **Claude lifecycle hooks:** https://github.com/wainmann/agent-manager/blob/12cf06d3d5617bfd2d7f9e8a47ee309f11298a4f/internal/hooks/hooks.go
