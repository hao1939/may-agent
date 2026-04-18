# Finding: Op Efficiency Gap — 31% System Waste
**Date**: 2026-04-05
**Scope**: 48h window (273 sessions, 9,259 ops)

## Summary
31.4% of all ops are wasted (2,910/9,259). The primary cause is turn-limit errors (18.3%), followed by interrupted sessions (4.8%) and LiteLLM 400 errors (8.3%). Waste is concentrated in 5 "complex-work" agents while 4 "simple-work" agents are 82-100% efficient.

## Data

### Agent Productivity Rankings (48h)
| Agent | Sessions | Total Ops | Done Ops | Error Ops | Productive % |
|-------|----------|-----------|----------|-----------|-------------|
| evaluator | 9 | 81 | 81 | 0 | **100%** |
| may | 42 | 2,638 | 2,469 | 152 | **93.6%** |
| amy-kimi | 36 | 572 | 522 | 14 | **91.3%** |
| qa | 33 | 391 | 321 | 68 | **82.1%** |
| optimizer | 34 | 1,650 | 981 | 630 | 59.5% |
| coach | 46 | 1,907 | 1,090 | 495 | 57.2% |
| bob | 45 | 1,059 | 590 | 445 | 55.7% |
| scout | 15 | 499 | 188 | 311 | 37.7% |
| **tech-lead** | **13** | **462** | **107** | **355** | **23.2%** |

### What Efficient Agents Do Differently
- **QA**: avg 12.8 ops/session, max 26 — always under turn limit
- **amy-kimi**: avg 16.8 ops, max 57 — tight focused sessions
- **evaluator**: avg 8.7 ops — pure JS handler, zero waste

### What Wasteful Agents Suffer From
- **tech-lead**: 7/10 heartbeats hit turn limit (maxTurns:50). Attempts implementation work (POCs, experiments) that needs 60-100+ ops. Every failed session restarts from scratch.
- **optimizer**: 6/14 heartbeats hit limit (maxTurns:40). Analytics + write-up often exceeds budget.
- **bob**: Turn limits + LiteLLM 400 errors from model misconfiguration.
- **coach**: Training sprints and heartbeats both hit limits.

### Waste Categories (48h)
| Category | Sessions | Ops | % of Total Ops |
|----------|----------|-----|----------------|
| Turn-limit errors | 51 | 1,694 | 18.3% |
| LiteLLM/400 errors | 61 | 771 | 8.3% |
| Interrupted | 32 | 440 | 4.8% |
| Zero-op sessions | 30 | 0 | 0% (no ops) |
| **Total waste** | — | **2,910** | **31.4%** |

## Root Causes

### 1. Task complexity exceeds turn budget
Complex agents (tech-lead, optimizer, coach) attempt tasks that need 50-100+ ops but have 40-50 turn limits. When they hit the limit, ALL work is lost and the next session starts from scratch.

### 2. No graceful degradation
Turn-limit errors are hard stops — no checkpoint, no partial save. The agent doesn't know it's about to be killed until it's too late.

### 3. Heartbeat scope creep
Heartbeats should be triage+dispatch, not implementation. When heartbeat agents start implementing, they consume their entire budget on step 1 and never finish.

## Proposed Fix: Hard Turn Warning + Mandatory Checkpoint

### Approach A: Runtime turn warning (JS change)
Add to the session runtime: at turn N-5 (e.g., turn 35 of 40), inject a system message:
```
⚠️ APPROACHING TURN LIMIT (turn 35/40). You have 5 turns left. 
Call checkpoint() now to save progress, then finish(status: 'partial').
```

**Impact**: Turns hard errors into graceful partials. Wasted ops drop from 1,694 → ~200 (agents save work at turn 35 instead of losing everything at turn 40).

**Effort**: Small change in src/lib/session.ts or wherever the turn counter lives.

### Approach B: Per-agent turn limits (config change)
Differentiate turn limits by task complexity:
- Simple agents (qa, evaluator): maxTurns: 20
- Medium agents (amy-kimi, scout): maxTurns: 30
- Complex agents (optimizer, bob, coach): maxTurns: 40 (current)
- Implementation agents (tech-lead): maxTurns: 60

**Impact**: Gives tech-lead enough room to succeed (23.2% → ~60%+ done rate).

### Approach C: Heartbeat task decomposition
Change heartbeat instructions for complex agents: "Pick ONE thing. If it needs implementation, dispatch to tech-lead/coder. Don't implement in your heartbeat session."

**Impact**: Reduces heartbeat scope, keeps ops under budget.

## Recommendation
**Approach A (turn warning) is highest leverage** — single code change, affects all agents, converts hard errors to graceful partials. Estimated 80% reduction in turn-limit waste (1,350 ops/48h saved).

Approach B (per-agent limits) is complementary — tech-lead specifically needs more turns.

## Status
Proposal ready. Need tech-lead or May to implement the turn warning.
