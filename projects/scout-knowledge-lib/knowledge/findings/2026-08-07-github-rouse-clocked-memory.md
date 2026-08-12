---
title: "rouse — Clocked Memory Turns Recall into Follow-Through"
source: github
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [github, agent-memory, reminders, scheduling, provenance, reliability]
relevance: high
---

Repo: https://github.com/a2wio/rouse

# rouse

## Overview

- **Repo:** [a2wio/rouse](https://github.com/a2wio/rouse) (7★, created 2026-08-06)
- **Revision checked:** [`1945355b1ddeb485870424ffccefb451aad4f91f`](https://github.com/a2wio/rouse/commit/1945355b1ddeb485870424ffccefb451aad4f91f)
- **What:** A dependency-free Python framework that stores agent rules, signals, intentions, tasks, notes, and reminders as inspectable files, then produces bounded session-start context and wakes the agent when a record becomes due.

## Core Signal

**Durable agent memory is starting to act like a scheduler, not merely a retrieval store.**

Most memory systems wait for a future turn to retrieve an item. Rouse gives selected records clocks: stale intentions and due reminders can initiate a wake even when no user message arrives. This changes the relevant reliability question from “will the agent recall this?” to “what delivery semantics make a remembered promise execute?”

## Source-Grounded Details

1. **Rules and signals are retrieved asymmetrically.** `rouse pack --query` always includes the persona and beliefs in full, while unmatched motivations collapse to visible one-line pointers rather than disappearing. The rationale is sound: failure to retrieve a rule must not suspend it, while situational signals can be thinned.

2. **The context pack is an index, not a memory dump.** It orders current time, live probes, due work, standing context, and file pointers; note bodies remain on disk. Failed probes render as `unknown` instead of falling back to remembered values, making freshness failure explicit.

3. **The clock deliberately implements delivery-before-acknowledgement.** `tick()` invokes the sink first and stamps the record only after success. A failed exec or webhook therefore leaves the item due. The code explicitly prefers a duplicate nudge over a swallowed one—an at-least-once delivery tradeoff.

4. **Follow-through is represented in the same filesystem as intent.** Tasks live under the intention they advance, and pending/running descendants suppress stale-parent nudges. When work finishes, the parent becomes eligible for review again, prompting the system to ask whether the result actually closed the intention.

5. **Memory provenance is designed as a runtime stamp.** The spec defines `owner`, `system`, `agent`, `untrusted`, and `unknown`, and warns that allowing the model to choose its own origin recreates the prompt-injection hole. The pack surfaces the stamp, while enforcement based on it is explicitly left to a higher layer.

6. **The implementation has substantive executable checks.** At the checked revision, Scout ran the repository's zero-dependency test suite locally: all 153 tests passed. The tests cover due-state transitions, failed-sink retry behavior, nag re-arming, stuck-reminder recovery, query asymmetry, provenance display, tree linting, and CLI wiring.

## Why It Matters

- **Promises need active state.** “Remind me” or “check this later” is not durable if it only becomes searchable text; it needs a due condition, lifecycle, and delivery path.
- **Memory and orchestration are converging.** Once intentions contain tasks and clocks, the memory tree becomes a lightweight control plane. State ownership and transition rules matter as much as retrieval quality.
- **At-least-once wakes require idempotency.** A sink can deliver successfully and fail before the stamp is persisted, or concurrent edits can lose a stamp. Downstream handlers should deduplicate by stable record ID and nudge number, and side-effecting wakes should be safe to replay.
- **Provenance must stay outside model authority.** Displaying trust labels helps only if a trusted runtime derives and writes them, and if action policy consumes them.

## Caveats

This is a new, lightly adopted repository with no declared license at the checked revision, so it is an architectural signal rather than evidence of production maturity. The file writer uses atomic replacement but intentionally does not lock; its own comment accepts a lost stamp and duplicate nudge under concurrent edits. The webhook payload has a stable record ID and nudge count, but there is no visible single-writer lease or transactional outbox, so multi-sweeper deployment would need external coordination or receiver-side deduplication. Provenance-based action enforcement is specified as future higher-layer work, not provided by this package.

## Scout Take

Clocked memory closes a gap between remembering and acting, but it also imports scheduler semantics into the memory layer. The useful invariant is not “every reminder fires exactly once”; it is **a due promise remains visible until delivery is acknowledged, and every resulting effect can tolerate replay**. That framing is both more achievable for file-backed systems and more honest about crash boundaries.

## Sources

- **Repo:** https://github.com/a2wio/rouse
- **Revision:** https://github.com/a2wio/rouse/commit/1945355b1ddeb485870424ffccefb451aad4f91f
- **GitHub API metadata:** https://api.github.com/repos/a2wio/rouse
- **GitHub search feed:** https://api.github.com/search/repositories?q=agentic+created%3A2026-08-06..2026-08-07+stars%3A%3E2&sort=stars&order=desc&per_page=20
- **README:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/README.md
- **Sweep implementation:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/rouse/core/sweep.py
- **File-write semantics:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/rouse/core/files.py
- **Pack specification:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/spec/pack.md
- **Run/reminder specification:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/spec/runs.md
- **Provenance specification:** https://github.com/a2wio/rouse/blob/1945355b1ddeb485870424ffccefb451aad4f91f/spec/provenance.md
