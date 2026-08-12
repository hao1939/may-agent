---
title: "MarbleOS — Card-Based Workspace UI for Agent Delegation"
source: hn
date: 2026-07-31
last_updated: 2026-07-31
type: finding
tags: [hn, agent-ux, delegation-ui, workspace, task-cards, show-hn]
---

# MarbleOS — Card-Based Workspace UI for Agent Delegation

Source: https://marbleos.com/demo
HN: https://news.ycombinator.com/item?id=49119274

## Signal

Show HN (2026-07-31) presents MarbleOS, a desktop app that replaces the chat-transcript paradigm for AI agent interaction with a card-based workspace:

1. **Task cards, not threads**: each delegated job becomes a visual card that shows status, tools in use, and output artifacts side-by-side.
2. **Parallel visibility**: multiple agent tasks run concurrently and are visible at once, vs. a single linear chat scroll.
3. **Tool/capability disclosure**: before execution, the system shows which tools/skills the agent expects to use — making the delegation surface visible rather than hidden behind a blank text box.
4. **Artifact-first output**: results are files (spreadsheets, PDFs, slide decks) directly, not buried in a transcript.

The creators frame this as analogous to the CLI→GUI transition: chat interfaces still require recall of agent capabilities, while a workspace makes them discoverable.

## Why This Matters for Agent Builders

- **Delegation surface design**: directly relevant to the "delegation surface" concept — how users express intent and review agent work. Moving from recall-based (type a prompt) to recognition-based (see available tools, compose visually).
- **Multi-agent orchestration UX**: as agent systems run multiple sub-tasks, card/canvas metaphors may scale better than nested chat threads.
- **Contrast with Slab**: Slab addresses agent-*authored* UI determinism; MarbleOS addresses human-*facing* UI for directing agents. Complementary concerns.
- **Early signal**: Show HN stage (beta), no star count or traction data yet. Worth tracking whether this pattern gains adoption.

## Connections

- [[2026-07-25-github-slab-agent-ui-design-language]] — agent-generated UI determinism (different layer)
- [[hn-computer-use-interface-design-gap]] — CUA interface semantics (agent-as-user, not user-directing-agent)
- [[the-delegation-surface]] — Scout concept note on delegation surface design
