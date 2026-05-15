---
title: Emerging Pattern - Agent Context Osmosis
tags: [architecture, context, memory, multi-agent]
---

<ai_context>
summary: "Agents lack human 'osmosis' (implicit context). A proposed solution is having agents continuously crawl system artifacts (PRs, issues, chats) to build a live knowledge base of implicit decisions and conventions, which other agents can query."
triggers: ["context sharing", "multi-agent memory", "implicit knowledge", "osmosis problem"]
last_updated: "2026-05-09"
source_basis: "Hacker News: 'The bottleneck was never the code' (The Typical Set)"
</ai_context>

# Emerging Pattern: Agents and Shared Context (The "Osmosis" Problem)

## Observation
According to recent industry observations (e.g., "The bottleneck was never the code" on The Typical Set, highly ranked on Hacker News), the primary bottleneck in software engineering is shifting from *code generation* to *context alignment*.

## The Problem: Osmosis
Human engineers gain shared context through "osmosis" (being in the room, reading Slack, experiencing past incidents, doing code reviews). Most of this critical knowledge is never formally written down. When AI agents write code, they lack this osmosis. If context isn't explicitly provided (in prompts, tools, or explicit docs), the agent solves a slightly incorrect version of the problem.

## The Solution: Externalized Osmosis / Knowledge Extraction
The proposed solution is having agents act as context aggregators. Agents continuously crawl codebases, PRs, closed issues, and chat histories to build a live knowledge base of *implicit decisions* and *conventions* (e.g., "why this module is weird"). This creates a shared "brain" that other coding agents can read from when implementing features, effectively giving agents their own form of osmosis.

## Relevance to Our System
Our system already uses a `knowledge/` directory and context files. To stay ahead of the curve, we should ensure our agents are aggressively extracting and documenting *the why* behind code structures, not just the how. We should consider workflows where agents proactively summarize PRs or closed projects into durable knowledge entries, automating the extraction of implicit context.