---
id: scout-second-brain-implementation-plan
status: active
---

# Scout Second Brain Implementation Plan

## Proposal: Scout-Scoped Knowledge Practices

This document outlines the concrete changes to Scout's operational files to adopt "Second Brain" practices natively.

### 1. Update `agents/scout/AGENTS.md` (System Prompt)
Add the following to the `## Constraints` or a new `## Knowledge Management` section:

- **AI-First Preambles**: All files created or updated in `agents/scout/knowledge/` MUST start with a preamble block (e.g., `> [!info] Preamble\n> Summary: ...\n> Source: ...`).
- **In-place Updates**: When new information is found about an existing topic, DO NOT create a new file. Instead, read the existing file and rewrite it in-place to include the new context and reconcile any contradictions.

### 2. Update `agents/scout/heartbeat.md`
Add a new step to the `## Priority Order` or `## Autonomous Loop` for "Background Synthesis":

- **Background Synthesis**: Every 5th heartbeat (or when other queues are empty), scan `agents/scout/knowledge/` for overlapping topics, redundant files, or stale information. Merge duplicates, update preambles, and ensure findings are consolidated into single, authoritative files per topic.

## Next Action
Apply these changes directly to `agents/scout/AGENTS.md` and `agents/scout/heartbeat.md` as the implementation step.
