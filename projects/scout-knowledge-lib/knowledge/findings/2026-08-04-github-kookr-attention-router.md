---
title: "Kookr — Human Attention Routing Becomes a First-Class Agent Layer"
source: github
date: 2026-08-04
last_updated: 2026-09-11
type: finding
tags: [github, hn, coding-agents, supervision, attention-routing, multi-agent, hooks, github-awareness, long-running-agents]
relevance: high
---

# Kookr

## Overview

- **Repo:** [kookr-ai/kookr](https://github.com/kookr-ai/kookr) (3★, created 2026-05-05, updated 2026-08-04)
- **Author:** kookr-ai
- **Language:** TypeScript
- **License:** Apache-2.0
- **What:** A local supervision layer for developers running several Claude Code or Codex-style coding agents in parallel, with a findings queue that explains which agent most needs human attention.

## Core Signal

Kookr's interesting move is that it does **not** treat the main scaling problem as "make one agent more autonomous."

It treats the bottleneck as **human attention across many active agents**.

The repo's architecture and user guide describe a supervisor-first system that watches agent hook streams, detects concrete blocker patterns, and routes the developer toward the most urgent intervention. The main UI surface is a prioritized **findings queue**, not a flat terminal multiplexer and not a generic multi-agent planner.

That makes Kookr less like an agent framework and more like an **air-traffic-control layer for agent fleets**.

## Concrete Design Details

1. **Observability is hook-native and event-driven.**  
   The architecture doc says Kookr watches per-agent JSONL hook files with `fs.watch()` and processes new events immediately. Current V1 findings are grounded in structured signals such as `PermissionRequest`, `Stop`, repeated tool failures, hook-health problems, and budget thresholds rather than terminal scraping.

2. **The unit of orchestration is the human interruption queue.**  
   Kookr's chosen UI is explicitly "supervisor-first triage": findings cards on the left, the selected agent terminal on the right. The user guide says healthy agents remain visible but are intentionally kept out of the urgent queue until something changes.

3. **GitHub workflow state is folded into the same attention surface.**  
   The architecture doc says Kookr extracts PR and issue references from agent tool results, polls GitHub for review and CI changes, then routes actionable updates back through the same queue used for agent anomalies. That joins live agent supervision with downstream repository-state monitoring.

4. **The system is local-first but durable.**  
   Kookr runs agents inside managed `dtach` sessions, keeps local task/session state under `~/.kookr/`, replays hook history on restart, and restores anomaly state after crashes. The persistence target is the supervisor's operational picture, not just the raw agent transcript.

5. **The repo is explicit about a staged control model.**  
   The architecture doc says V1 uses rule-based anomaly detection with structured hooks, while an LLM-powered supervisor is a later V2 layer for subtler trajectory analysis. That sequencing matters: reliable supervision is being built on deterministic signals first, with model judgment added only after the evidence layer exists.

## Why This Matters

1. **Multi-agent tooling is shifting from parallel execution to parallel supervision.**  
   Once developers can easily launch many agents, the scarce resource stops being terminal slots and becomes interruption triage.

2. **Attention routing is emerging as its own product layer.**  
   Earlier orchestration repos mostly focused on planning, delegation, memory, or merge control. Kookr instead optimizes for "which agent should the human look at right now?"

3. **Agent observability is expanding beyond the model loop.**  
   The GitHub-awareness path shows that an agent's real state includes PR reviews, CI failures, and other external workflow events, not only what appears in the terminal.

4. **Human-in-the-loop is becoming operational rather than ceremonial.**  
   Kookr is not just adding an approval button. It is trying to rank, explain, and compress the moments where human judgment has the highest leverage.

## Connections to Library Themes

- **Repo-local governance:** reinforces the move toward supervision and approval surfaces that live beside the repository workflow rather than inside a generic chat window.
- **Harness engineering:** the value comes from hooks, managed sessions, replay, and queue design, not from a new base model.
- **Multi-agent coordination:** suggests that for coding-agent teams, the key coordinator may be a human attention router rather than another autonomous planner.
- **Operational state over transcript bulk:** the important object is a live, prioritized picture of blockers and external state changes.

## Sources

- **Repo:** https://github.com/kookr-ai/kookr
- **README:** https://raw.githubusercontent.com/kookr-ai/kookr/main/README.md
- **Architecture:** https://raw.githubusercontent.com/kookr-ai/kookr/main/docs/architecture.md
- **User guide:** https://raw.githubusercontent.com/kookr-ai/kookr/main/docs/user-guide.md
- **GitHub API metadata:** https://api.github.com/repos/kookr-ai/kookr

## HN Update — One queue prices all claims on human attention (2026-08-21)

A new Show HN project, **Voro**, independently sharpens the attention-router pattern. Rather than maintain separate views for agent questions, completed diffs, proposed tasks, and ready work, its design puts all four into one ranked next-action queue. The repository's state machine derives the human's next verb from task state (`needs-input` → answer, `review` → review, `proposed` → triage, `ready` → dispatch or do), keeps running/refining work outside that queue, and gives blocked-on-human questions first-among-equals treatment. Project weight and task priority then compete through an explicit attention score; a configurable work-in-progress cap can stop the queue from offering more dispatches.

This is a useful refinement of Kookr's anomaly-centered supervision model: once agents can emit questions, proposals, and reviewable outputs, **healthy ready work is also a claim on the same scarce resource**. A supervisor that ranks only failures can still overload the operator by offering fresh dispatches while decisions and reviews accumulate. The stronger control surface prices interruption, acceptance, triage, and initiation together, while preserving distinct states so urgency does not erase what kind of judgment is required.

The evidence remains early: the HN submission had 3 points and two comments at retrieval, the repository describes itself as early software, and GitHub metadata reported zero stars. Treat this as a concrete design experiment, not adoption evidence.

### Added sources

- **Source:** https://news.ycombinator.com/item?id=49386001
- **Repo:** https://github.com/ClachDev/Voro
- **Design:** https://github.com/ClachDev/Voro/blob/main/docs/DESIGN.md
- **README:** https://github.com/ClachDev/Voro/blob/main/README.md

## HN Update — An inbox needs three independent liveness planes (2026-09-11)

**Pizza Bot OSS**, submitted in HN item 49657189, extends the attention-router
pattern from supervising several coding terminals to supervising asynchronous,
long-running work. Its visible contract is an inbox: finished runs enter global
**Unread**, durable approval requests enter global **Action**, and folders remain
an orthogonal organization layer. That separation matters because “where this
thread belongs” and “what judgment it needs now” are different dimensions; a
folder filter must not hide a pending approval from the global action queue.

The repository architecture shows that this UI is supported by three different
liveness mechanisms rather than one generic “running” state:

1. **Execution liveness:** an in-process `ProtocolRunManager` owns a run after the
   request that started it disconnects. Cancellation is generation-scoped by
   `runId`, preventing a late abort from killing a replacement run on the same
   thread.
2. **Observation liveness:** per-run sequence numbers and `since`-based replay
   fill the event gap before live-tail resumes. The client does not need to keep
   every chat component mounted or every idle thread connected for work to
   continue.
3. **Attention liveness:** a separate durable terminal-activity stream drives
   notifications, while checkpointed interrupts survive as actionable approval
   state. Completion delivery and approval routing therefore do not depend on
   the transient stream that renders model output.

Its trigger recovery further exposes why these planes need distinct semantics.
Cron intervals missed while the process was down fire once on startup, and
crash-stranded occurrences are replayed within an attempt budget. But waking
from sleep does **not** replay an in-flight occurrence because tool side effects
may already have happened. Recovery is thus conditioned on both durable state
and the kind of interruption; “reconnect,” “catch up,” and “retry execution” are
not interchangeable operations.

### Design implication

A long-running-agent inbox should derive human queues from durable lifecycle and
interrupt state, not from open sockets, mounted chat views, or a single boolean
`running` flag. Model at least three independently testable contracts:

- Can execution continue without an observer?
- Can an observer reconstruct every event gap without re-executing work?
- Can a human still find every completed result and unresolved decision after
  clients, windows, or streams disappear?

This sharpens Kookr and Voro's shared thesis: an attention router is reliable
only when the claims it ranks survive independently of the interface currently
showing them. Pizza Bot is implementation evidence, not reliability evidence;
this run did not reproduce its recovery paths, and the HN submission had one
point and no comments at retrieval.

### Added sources

- **Source:** https://news.ycombinator.com/item?id=49657189
- **Repo:** https://github.com/pizza-bot-app/pizza-bot
- **Architecture:** https://github.com/pizza-bot-app/pizza-bot/blob/main/docs/ARCHITECTURE.md
- **README:** https://github.com/pizza-bot-app/pizza-bot/blob/main/README.md
