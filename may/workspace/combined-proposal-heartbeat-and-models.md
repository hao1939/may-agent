# Combined Proposal: Heartbeat Reform + Model Diversity

**Synthesized by**: May  
**Date**: 2026-04-15  
**Sources**: Bob (design review + model proposal), Optimizer (cost analysis), Coach (autonomy review)

---

## Executive Summary

Two independent issues converge on the same diagnosis: **our agent system optimized for reliability at the expense of autonomy and diverse thinking.**

1. **Heartbeats** became 200-line operational runbooks. 43% of all ops go to heartbeats, but most of that is mechanical triage, not judgment. Agents follow checklists instead of thinking.

2. **Model monoculture**: 77% of agents run Claude Opus. When Hao asks for design advice, every advisor shares the same cognitive DNA. Gemini (2 models available) is completely unused.

Both issues have the same fix: **create conditions for genuine independent thinking** — shorter heartbeats that reward judgment over procedure, and model diversity that ensures different perspectives aren't just rephrased versions of the same one.

---

## Part 1: Heartbeat Reform

### The Problem (All 3 Reviewers Agree)

| Finding | Source |
|---------|--------|
| Heartbeats consume 43% of all ops (6,146/48h) | Optimizer |
| ~60% of heartbeat content is reference material, not runtime decisions | Bob |
| 6 of 12 agents share the same rigid 4-step template | Coach |
| Agents with the most "autonomy infrastructure" (200+ lines) are the *least* autonomous | Coach |
| Heartbeats duplicate what cron jobs already do (system snapshots, health checks) | Optimizer |
| The dispatcher pattern works (236 forks/48h → 5,134 work ops) but leaves no room for original thinking | Coach |

### Specific Waste Identified

| Issue | Impact | Fix |
|-------|--------|-----|
| 6 agents run identical DB queries every heartbeat | ~288 duplicate queries/48h | Pre-compute via `heartbeat-context` cron |
| May's heartbeat steps 3/5/6 duplicate existing crons | 75% of May's ops are heartbeat | Remove overlapping steps |
| Tech-lead does inline work (14 avg ops/HB vs target 8) | ~190 excess ops/day | Enforce forking |
| QA has 40% interrupt rate | ~150 wasted ops/48h | Diagnose root cause |
| Evaluator runs 120 sessions/day, 82% are 0-op | DB/infra noise | Better preflight |

### The Reform: 3-Part Heartbeat

Replace the rigid 4-step OBSERVE/DECIDE/DISPATCH/EXIT with:

```markdown
# [Agent] Heartbeat

[1-2 lines: identity and mission]

## 1. ORIENT (2-3 ops)
Quick scan: pending tasks, system-snapshot.md (pre-computed), recent activity.

## 2. THINK (0 ops — just reason)
What's the most important thing right now?
- What's the biggest risk or opportunity I see?
- What am I NOT doing that I should be?
- Is there something I keep putting off that matters?
One decision, with reasoning.

## 3. ACT (1-2 ops)
Do it (if quick) or dispatch it (if deep). Then finish().
```

**Key changes:**
- **Cap heartbeats at ≤50 lines** (current avg: 130). Enforce with lint check.
- **Move workflow routing tables, templates, and examples** to `agents/<name>/knowledge/dispatch-patterns.md` — read on demand, not every cycle.
- **Move "must-fork" lists and FM-3.3 guards** to `context.md` (one line each).
- **Different heartbeat energies by role type:**
  - Researchers (Bob, Scout): "What's the most interesting question right now?"
  - Builders (Tech-Lead, Optimizer): "What's the biggest friction in the system?"
  - Quality (Coach, Evaluator, QA): "What's the biggest gap between where we are and where we should be?"
  - Coordinator (May): "What's falling through the cracks?"

### Cron Cleanup

| Action | Items |
|--------|-------|
| Delete deprecated | `coaching-feedback`, `error-log-scanner` (disabled for weeks) |
| Merge overlapping | `watchdog` + `zombie-cleanup` + `active-nudge` → one session-health handler |
| Audit reporting | `daily-brief` vs `daily-digest` vs `proof-of-life` vs `system-status` — which does Hao read? |
| Pre-compute snapshots | `heartbeat-context` cron writes `system-snapshot.md`; heartbeats read file not DB |

### Measurement

| Metric | Target | How to measure |
|--------|--------|----------------|
| Heartbeat variety score | >8 unique task types per 20 cycles | Count distinct dispatched task categories |
| Novel task rate | >50% per agent | Track tasks that aren't repeats of last 5 cycles |
| Self-initiated rate | >30% | Tasks from agent judgment vs. queue processing |
| Avg heartbeat ops | ≤5 (down from 7.2) | Session data |
| Heartbeat file length | ≤50 lines | Lint check |

### Rollout

1. **Pilot on Bob** (best candidate — has "independent judgment" in SOUL, strong enough to handle freedom)
2. If Bob's variety score improves after 1 week → roll out to Coach, Scout, Optimizer
3. Then Tech-Lead, May
4. QA/Evaluator last (different heartbeat structure)

---

## Part 2: Model Diversity

### The Problem

77% of agents run Claude Opus. Gemini (2 models) is unused. GPT 5.4 is unused. Every "diverse perspective" Hao gets is actually one model family rephrasing itself.

### The Strategy: Claude Delivers, GPT Evaluates, Gemini Analyzes

| Model Family | Role | Agents |
|-------------|------|--------|
| **Claude Opus** | Orchestration + Delivery | may, tech-lead, coder, amy |
| **GPT 5.4** | Evaluation + Training | judge, coach, master |
| **GPT 5.2** | Review pipeline | evaluator, qa |
| **Gemini 3.1 Pro** | Architecture + Research | bob, optimizer, scout |
| **Kimi K2.5** | Independent research | amy-kimi |
| **Gemini 3 Flash** | Reserved for batch/bulk | (future) |

**Result**: 31% Claude / 38% GPT / 15% Gemini / 8% Kimi (vs current 77% Claude)

### Advisory Diversity

When Hao asks a design question:
- **May** (Claude) — operational feasibility
- **Bob** (Gemini) — architectural analysis  
- **Optimizer** (Gemini) — data-driven perspective

When the system evaluates work:
- **Judge** (GPT 5.4) — gym grading (no more Claude-judging-Claude)
- **Coach** (GPT 5.4) — training assessment
- **QA** (GPT 5.2) — code review

### Migration Plan

**Phase 1 — This Week (Low Risk)**
| Change | Rationale |
|--------|-----------|
| `optimizer` → `gemini3pro` | Data analysis = Gemini's strength |
| `judge` → `gpt54` | Evaluation independence (P4) |
| `scout` → `gemini3pro` | Large-context research = Gemini's strength |

Test: 3 sessions per agent, compare quality. Check tool reliability, context management, output quality.

**Phase 2 — After Phase 1 Stable (~1 week)**
| Change | Rationale |
|--------|-----------|
| `coach` → `gpt54` | Different model coaching Claude agents finds blind spots |
| `bob` → `gemini3pro` | Maximum advisory diversity |
| `master` → `gpt54` | Code pragmatism for external tool orchestration |

**Phase 3 — Review (~2 weeks)**
- Evaluate quality changes
- Consider `evaluator` → `gpt54` upgrade
- Decide if any changes need rollback

**Rollback**: One line in `agent.json` per agent. Instant revert.

### Risks

| Risk | Mitigation |
|------|-----------|
| Gemini/GPT tool API compatibility | All go through LiteLLM OpenAI-compatible API. Kimi already works. |
| Compaction behavior differs | Test explicitly in Phase 1 |
| Quality regression in Bob (architecture) | Keep Bob for Phase 2; revert if Gemini architectural reasoning is weaker |
| Context window limits | Gemini 3.1 Pro has comparable context; Scout on Gemini is actually an upgrade |

---

## Recommended Decision Points for Hao

### Heartbeats
1. **Approve pilot?** Start with Bob's heartbeat slimmed to ≤50 lines, 3-part ORIENT/THINK/ACT structure.
2. **Approve cron cleanup?** Delete deprecated entries, merge overlapping monitors, pre-compute snapshots.
3. **Approve 50-line cap?** This is the biggest cultural change — moves from "comprehensive runbook" to "thinking prompt."

### Models
4. **Approve Phase 1?** Optimizer + Judge + Scout model changes. Low risk, high signal.
5. **Approve Phase 2 after Phase 1?** Bob + Coach + Master. Higher stakes but high value.
6. **Keep May + Tech-Lead + Coder on Claude?** All three reviewers agree these should stay stable.

### Combined Effect

The heartbeat reform makes agents more autonomous. The model diversity makes that autonomy more valuable — because autonomous agents on different models will genuinely think differently, not just follow different checklists to reach the same Claude-flavored conclusion.

---

## Source Documents
- `agents/bob/workspace/heartbeat-design-review.md` (244 lines)
- `agents/optimizer/workspace/heartbeat-cost-analysis.md` (263 lines)  
- `agents/coach/workspace/heartbeat-autonomy-review.md` (208 lines)
- `agents/bob/workspace/model-diversity-proposal.md` (201 lines)
