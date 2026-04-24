# Context Overhead Analysis — System Prompt & Session Context Audit

**Date**: 2026-04-08
**Author**: Bob (Architect)
**Scope**: All 11 active agents
**Method**: Static file analysis + session metadata (785 sessions)

---

## Executive Summary

The system's context overhead is **moderately well-managed** with one glaring outlier: **Coach's 102KB system prompt** (94KB of skills). Most agents run 10-25KB system prompts. The architecture correctly separates stable content (system prompt, cached) from per-session content (first user message, uncached), per P147 KV-Cache Discipline.

**Key findings:**
1. Coach's system prompt is **6-10× larger** than any other agent's
2. `verify-after-edit.md` is duplicated across 9 agents (28KB total disk waste, but correct design since each copy becomes part of that agent's cached system prompt)
3. 68KB of "dead files" (DOMAIN.md, LESSONS.md, TOOLS.md) sit on disk, removed from prompt but never cleaned up
4. Scout accumulates 135KB of non-prompt working files that it reads during heartbeats (journal, todo, signals)
5. Knowledge routing is lean: 19 entries, keyword matching, 2-5 one-liner injections during heartbeats only

---

## 1. System Prompt Composition

The system prompt (cached, stable across sessions) is assembled from:
- **SOUL.md** — agent identity, role, methodology
- **common-sense.md** — shared rules (2.9KB, loaded for all agents)
- **skills/*.md** — all markdown files recursively loaded from agent's skills directory
- **Runtime environment** — generated at startup (~500 bytes)

### Per-Agent System Prompt Sizes

| Agent | SOUL.md | Skills | Common | Generated | **Total** | **≈ Tokens** |
|-------|---------|--------|--------|-----------|-----------|-------------|
| amy | 6,042 | 137 | 2,937 | 500 | **9,616** | 2,400 |
| amy-kimi | 2,861 | 3,263 | 2,937 | 500 | **9,561** | 2,400 |
| optimizer | 4,961 | 2,483 | 2,937 | 500 | **10,881** | 2,700 |
| scout | 2,540 | 8,068 | 2,937 | 500 | **14,045** | 3,500 |
| tech-lead | 3,259 | 8,054 | 2,937 | 500 | **14,750** | 3,700 |
| bob | 2,992 | 9,818 | 2,937 | 500 | **16,247** | 4,100 |
| may | 2,513 | 10,355 | 2,937 | 500 | **16,305** | 4,100 |
| qa | 5,865 | 7,335 | 2,937 | 500 | **16,637** | 4,200 |
| coder | 0 | 20,757 | 2,937 | 500 | **24,194** | 6,000 |
| evaluator | 5,417 | 32,831 | 2,937 | 500 | **41,685** | 10,400 |
| **coach** | **4,557** | **94,077** | **2,937** | **500** | **102,071** | **25,500** |

### Distribution

- **Light** (< 15KB): amy, amy-kimi, optimizer, scout — well-sized
- **Medium** (15-25KB): tech-lead, bob, may, qa, coder — reasonable
- **Heavy** (25-50KB): evaluator — borderline, monitor-session.md alone is 11KB
- **Extreme** (> 100KB): **coach** — 94KB of skills is instruction debt personified

---

## 2. Session Context Composition

The session context (first user message, changes per session, NOT cached) includes:
- **context.md** — persistent context facts
- **context_files** — from agent.json (only may has this: conversation-state.md)
- **Task history** — recent session digests (~1.5KB)
- **Checkpoint** — last checkpoint data (~500 bytes)
- **Knowledge routing** — keyword-matched KE one-liners (heartbeats only, ~300 bytes)
- **Active recall** — spaced repetition questions (when applicable)

### Per-Agent Session Context Sizes

| Agent | context.md | ctx_files | History | Checkpoint | **Total** |
|-------|-----------|-----------|---------|------------|-----------|
| coder | 925 | 0 | ~1,500 | ~500 | ~2,925 |
| amy | 1,020 | 0 | ~1,500 | ~500 | ~3,020 |
| evaluator | 1,131 | 0 | ~1,500 | ~500 | ~3,131 |
| qa | 1,159 | 0 | ~1,500 | ~500 | ~3,159 |
| coach | 1,354 | 0 | ~1,500 | ~500 | ~3,354 |
| optimizer | 1,541 | 0 | ~1,500 | ~500 | ~3,541 |
| scout | 2,088 | 0 | ~1,500 | ~500 | ~4,088 |
| amy-kimi | 2,105 | 0 | ~1,500 | ~500 | ~4,105 |
| bob | 2,754 | 0 | ~1,500 | ~500 | ~4,754 |
| tech-lead | 2,980 | 0 | ~1,500 | ~500 | ~4,980 |
| may | 6,007 | 1,765 | ~1,500 | ~500 | ~9,772 |

Session context is well-managed across all agents. Even the largest (may at ~10KB) is modest.

---

## 3. Total Overhead Per LLM Call

Total overhead = system prompt + session context. This is the **minimum** input tokens before any conversation history:

| Agent | System Prompt | Session Context | **Total Overhead** | **≈ Tokens** |
|-------|--------------|-----------------|-------------------|-------------|
| amy | 9,616 | 3,020 | 12,636 | 3,200 |
| amy-kimi | 9,561 | 4,105 | 13,666 | 3,400 |
| optimizer | 10,881 | 3,541 | 14,422 | 3,600 |
| scout | 14,045 | 4,088 | 18,133 | 4,500 |
| qa | 16,637 | 3,159 | 19,796 | 5,000 |
| tech-lead | 14,750 | 4,980 | 19,730 | 4,900 |
| bob | 16,247 | 4,754 | 21,001 | 5,300 |
| may | 16,305 | 9,772 | 26,077 | 6,500 |
| coder | 24,194 | 2,925 | 27,119 | 6,800 |
| evaluator | 41,685 | 3,131 | 44,816 | 11,200 |
| **coach** | **102,071** | **3,354** | **105,425** | **26,400** |

---

## 4. Coach Deep Dive — The 94KB Skills Problem

Coach's skills directory contains **20 markdown files** totaling 94KB:

### Breakdown by category:

**agent-conventions/ (43KB — convention reference library)**
- SKILL.md (8.4KB) — index of all conventions
- model-specific.md (10KB) — per-model behavioral patterns
- operational.md (7KB) — cron, heartbeat, runtime patterns
- behavior.md (6.5KB) — behavioral rules
- structure.md (4KB) — directory structure conventions
- coordination.md (3.8KB) — inter-agent coordination
- knowledge-mgmt.md (3.6KB) — knowledge management rules

**convention-exercises/ (11KB)**
- SKILL.md (1.6KB) — exercise index
- k1-no-reread-autoloaded.md (5KB) — specific exercise
- b7-project-relative-paths.md (4.5KB) — specific exercise
- b1-read-before-write.md (4.2KB) — specific exercise

**Other skills (40KB)**
- reactive-lesson.md (5.3KB)
- red-team.md (4.7KB) + red-team/SKILL.md (4.3KB) — 9KB total for red-team
- consolidate-memory.md (4.5KB)
- micro-reward.md (4.5KB)
- growth-cycle.md (3.6KB)
- verify-after-edit.md (3.1KB) — same as everyone else
- log-error.md (2.8KB)
- transient-skill.md (2.6KB)

### The Instruction Overhead Paradox (KE-025) applied to Coach

KE-025 established that more context files **decrease** task completion. Coach has 25,500 tokens of instruction overhead before any work begins. Per DD-537's findings, this level of context likely **reduces** Coach's effectiveness.

The irony: the agent responsible for improving other agents through skills has the most instruction debt in the system.

### What Coach actually does (from session data):
- 140 sessions, 26.7 avg ops, max 252 ops
- Primary tasks: growth cycles, convention exercises, reactive lessons, red-teaming
- The agent-conventions directory (43KB) is a **reference library** that should be on disk but NOT loaded into every prompt

---

## 5. Evaluator Deep Dive — 33KB Skills

Evaluator's skills are more justifiable but still heavy:

- monitor-session.md (10.9KB) — core evaluation logic
- score.md (5.8KB) — scoring methodology
- challenge-agent.md (3.2KB) — challenge design
- manage-backups.md + SKILL.md (3.4KB) — backup management
- detect-p53-drift/SKILL.md (1.8KB) — drift detection
- detect-drift.md + SKILL.md (2.8KB) — drift detection
- drift-controller/SKILL.md (1KB) — drift control
- revert-change.md (1.5KB) — revert capability
- verify-skill.md (0.9KB) — skill verification
- patrol.md (0.7KB) — patrol behavior
- delegation-metrics.md (0.6KB) — delegation tracking

monitor-session.md (11KB) and score.md (6KB) are the core of what evaluator does — these are defensible. The 6 drift-related files (7KB total) could likely be consolidated.

---

## 6. Duplicated Content

### verify-after-edit.md (3.1KB × 9 agents = 28KB on disk)

Present in: amy-kimi, bob, coach, coder, may, optimizer, qa, scout, tech-lead

Two variants exist (md5):
- `18db1ec...` — amy-kimi, coach, coder, may, qa, tech-lead (6 agents)
- `dda3aab...` — bob, optimizer, scout (3 agents)

**This is architecturally correct** — each agent needs its own copy in skills/ to be loaded into its system prompt. The shared skills library is NOT auto-loaded. But it means any update to verify-after-edit requires updating 9 copies.

### read-before-edit.md (duplicated across 4 agents)
- bob: 2,668 bytes
- amy-kimi (absent)
- may: 1,592 bytes
- scout: 2,708 bytes
- tech-lead: 2,431 bytes

---

## 7. Dead Files on Disk

Files removed from the system prompt per Hao directive but never deleted:

| Agent | DOMAIN.md | LESSONS.md | TOOLS.md | Total |
|-------|-----------|------------|----------|-------|
| amy | 3,094 | 1,608 | 630 | 5,332 |
| amy-kimi | 2,532 | 1,281 | 1,986 | 5,799 |
| bob | — | — | 1,632 | 1,632 |
| coach | 2,504 | 1,551 | 3,136 | 7,191 |
| coder | — | 1,076 | — | 1,076 |
| evaluator | 7,888 | 1,742 | 2,138 | 11,768 |
| may | 2,283 | 1,273 | 1,590 | 5,146 |
| optimizer | 8,431 | 2,760 | 2,090 | 13,281 |
| qa | 7,609 | 340 | 873 | 8,822 |
| tech-lead | 3,293 | 3,759 | 1,782 | 8,834 |
| **Total** | | | | **68,881** |

These don't cost tokens but they confuse agents who might `read()` or `grep` them thinking they're authoritative. No heartbeat.md references them, so they're truly dead weight.

---

## 8. Working Files Read During Heartbeats

Some agents accumulate large working files that aren't in the system prompt but get read during heartbeats:

| Agent | File | Size | Notes |
|-------|------|------|-------|
| scout | journal.md | 60KB | Append-only research journal |
| scout | todo.md | 42KB | Task list (should be pruned) |
| scout | signals.md | 21KB | Signal tracking |
| scout | postboard_brief.md | 12KB | Briefing document |
| bob | journal.md | 28KB | Research journal |
| optimizer | periodic-tasks.md | 13KB | Task definitions |

Scout's 135KB of working files is a concern — reading all of these during heartbeats means 33K+ tokens per heartbeat just for "what am I working on?" content.

---

## 9. Recommendations

### P0: Coach Skills Pruning (save ~60KB / 15K tokens)

**Move agent-conventions/ to a reference directory, not skills/.**

The convention library (43KB) is reference material that Coach should `read()` on demand, not have injected into every prompt. Create `agents/coach/reference/conventions/` and move the files there. Only keep the SKILL.md index in skills/ with a pointer to the reference location.

Similarly, convention-exercises/ (11KB) are scenario definitions that should be read when running exercises, not on every prompt.

**Target**: Coach system prompt from 102KB → ~48KB (still the largest, but 50% reduction).

### P1: Evaluator Drift Consolidation (save ~5KB)

Consolidate the 6 drift-related files (detect-drift.md, detect-drift/SKILL.md, detect-p53-drift/SKILL.md, drift-controller/SKILL.md, revert-change.md, manage-backups.md + manage-backups/SKILL.md) into 2 files: drift-detection.md and drift-remediation.md.

### P1: Dead File Cleanup (save confusion, not tokens)

Delete DOMAIN.md, LESSONS.md, TOOLS.md across all agents. These were removed from prompt injection months ago and no heartbeat references them. Their continued existence is a trap for agents who might read them thinking they're current.

### P2: Scout Working File Rotation (save heartbeat tokens)

Scout's journal.md (60KB), todo.md (42KB), and signals.md (21KB) should have rotation/archival. Keep only last 2 weeks in the active file, archive the rest. This saves ~25K tokens per heartbeat.

### P2: Shared Skill Dedup Infrastructure

Currently each agent copies skills to their own directory. This is correct for prompt injection but creates maintenance burden. Consider a build step that generates per-agent skill directories from a manifest, so updates propagate automatically.

### NOT Recommended: Pruning common-sense.md

At 2.9KB (730 tokens), common-sense.md is lean and contains genuinely necessary guardrails (evidence-first, verify writes, two git repos, commit before finish). This is the kind of environmental knowledge KE-001 says actually works.

### NOT Recommended: Reducing context.md

Context.md files are 1-6KB per agent and contain persistent project knowledge that meets the KE-001 criteria (hard-to-discover environmental facts). These are well-sized.

---

## 10. Connection to KE-025 and KE-052

This analysis directly validates KE-025 (Instruction Overhead Paradox):
- Coach's 94KB of skills is the poster child for instruction debt
- The convention library is exactly the kind of "detailed workflow description" KE-025 says to prune
- Most content in agent-conventions/ is about how OTHER agents should behave — not actionable for Coach's current task

KE-052 (Structural Access Constraints) predicts that simply loading all conventions into the prompt is less effective than a navigation structure that surfaces the right convention for the current task. Coach should:
1. Keep a minimal index in the prompt
2. `read()` specific convention files on demand when running relevant exercises

This converts 43KB of always-present content into ~1KB of index + on-demand loading.

---

*Bob (Architect) | 2026-04-08 | Context Overhead Analysis*
