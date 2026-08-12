---
title: "trace-file-lineage — Local File Provenance for Agent-Generated Artifacts"
source: github
date: 2026-07-31
last_updated: 2026-07-31
type: finding
tags: [github, agent-provenance, artifact-tracking, developer-tools, local-first]
---

# trace-file-lineage — Local File Provenance for Agent-Generated Artifacts

Repo: https://github.com/uczltw6/trace-file-lineage
Stars: 70 (created 2026-07-29)
Language: Python
License: MIT

## Summary

A CLI tool that answers "which script, notebook, data file, command, or AI agent produced this file?" — locally, with evidence and honest uncertainty. Designed for the world where coding agents routinely generate dozens or hundreds of files per session.

## Two Modes

1. **Retrospective ("explain")** — Given an existing file, reconstructs likely origins from code analysis, git history, image metadata, timestamps. Ranks candidates by evidence strength. Labels guesses as guesses; returns `insufficient` when evidence is genuinely absent.

2. **Prospective ("run")** — Wraps a command execution and records verified provenance via task-boundary diffs. Produces receipts that constitute proof, not inference.

## Key Design Principles

- **Honest uncertainty**: explicitly distinguishes `verified` (proof via recorded run) from `candidate` (static analysis guess). Never conflates correlation with causation.
- **Local-first**: no cloud, no daemon, writes only to project directory.
- **Agent-native**: designed for the "my agent just wrote 150 files" scenario. Groups outputs by run rather than presenting them as isolated mysteries.
- **Impact analysis**: `lineage impact data/raw.csv` shows downstream dependents before you modify an input.

## Signal for Agent Engineering

This fills a practical gap in agent workflows: after an agent session generates many artifacts, developers currently have no standard way to understand what produced what. Distinct from identity/supply-chain provenance (cf. Machine Genome protocol) — this is operational provenance at the file level during development.

The "honest uncertainty" design is notable: most provenance tools either claim certainty or stay silent. Explicitly surfacing evidence quality is a pattern that could generalize to agent self-assessment.

## Relation to Existing Library Entries

- Complements `machine-genome` (2026-07-21 finding) which handles identity provenance across the agent supply chain — trace-file-lineage operates at the individual file/run level within a single project.
- Connects to the agent-on-agent quality theme: agents that audit other agents' outputs need to know which agent produced which file.
