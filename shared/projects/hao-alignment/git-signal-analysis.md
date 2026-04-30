# Git Signal Analysis — Hao's Implicit Preferences

**Date**: 2025-07-02
**Source**: 50 commits by "Hao Yuan" in `/app/agents` repo (last 6 months)

## Key Patterns Extracted

### 1. Convention-Driven Architecture
Hao builds conventions and expects agents to follow them uniformly:
- `CONVENTIONS.md` — agent folder layout reference
- Per-agent `todo.md` with TODO + Tracking sections
- Per-agent `journal.md` for self-reflection across sessions
- `heartbeat.md` per agent
- `SOUL.md` identity docs for each agent
- System prompt assembly order documented

**Preference**: Structure through shared conventions, not ad-hoc rules per agent.

### 2. Consolidation Over Sprawl
- "remove obsolete operations-plan.md and improvement-plan.md"
- "bob consolidated all lessons.md — deduplicated, role-specialized, 323→148 lines"
- "clean up agent.json files, replace hardcoded paths with ~ in knowledge"
- "Restructure philosophy.md into sections A-G with ownership"

**Preference**: Fewer, richer files. Deduplicate aggressively. Remove what's obsolete.

### 3. Systematic Automation
- system-status cron (every 4h)
- drain-todo cron (every 8h)
- review-human-inputs cron
- optimizer-drain-todo cron
- Cron restructure: heartbeat entries + task instances for stateless jobs

**Preference**: Automate recurring checks. Agents should self-monitor via cron, not wait for prompts.

### 4. Agent Identity & Boundaries
- SOUL.md per agent — identity that evolves
- Coach = explore + verify (not production)
- Bob = design (not implementation)
- Tech-lead = implementation (not design)
- "workflow-first enforcement" for May
- "make QA reviews independent — frame coder output as claims to verify"

**Preference**: Agents have clear identity and bounded roles. Cross-role work is a violation.

### 5. Knowledge Hygiene
- "blind-overwrite prevention across all agents"
- "Standardize agent knowledge"
- workspace state syncs (multiple)

**Preference**: Knowledge is precious. Never overwrite blindly. Sync state regularly.

### 6. Rename/Refactor Over Patch
- `ctx.emit -> ctx.log` (consistent naming)
- Restructure cron system (not patch it)
- Move files to correct locations (operations-plan.md from docs/ to workspace/)

**Preference**: Fix the structure, don't work around it.

## New Preferences to Add

| ID | Preference | Evidence |
|----|-----------|----------|
| P6 | Convention-driven: shared conventions > per-agent rules | CONVENTIONS.md, todo.md/journal.md standards |
| P7 | Consolidation: fewer rich files, remove obsolete, deduplicate | Multiple cleanup commits |
| P8 | Automate monitoring: cron for recurring checks | 5+ cron jobs added for self-monitoring |
| P9 | Agent identity: clear roles, bounded scope, SOUL docs | SOUL.md, workflow-first, independent QA |
| P10 | Knowledge hygiene: never blind-overwrite, sync state | Explicit prevention rules |
