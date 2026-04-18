# Finding: Workflow Adoption Gap Analysis — Apr 15, 2026

## Summary

Workflow adoption varies dramatically across agents (0% to 79.4%). The mechanism is **structural heartbeat integration** — agents whose heartbeat.md contains `workflow.run()` dispatch templates AND that actually fork substantive work sessions achieve high adoption. Agents with 0% fall into two categories: (1) agents that never fork work (evaluator, may), making workflow adoption N/A, and (2) agents missing from the system entirely (amy, amy-kimi — no sessions in 48h).

## Data (Last 48 Hours)

| Agent | Total Sessions | Workflow Sessions | Rate | Has HB Workflow Docs | Forks Work? |
|-------|---------------|-------------------|------|---------------------|-------------|
| coder | 34 | 27 | **79.4%** | No (0 mentions) | No — called as worker |
| bob | 162 | 53 | **32.7%** | Yes (10+ mentions) | Yes — heavy forker |
| optimizer | 153 | 47 | **30.7%** | Yes (8+ mentions) | Yes — heavy forker |
| coach | 162 | 30 | **18.5%** | Yes (12+ mentions) | Yes — heavy forker |
| tech-lead | 163 | 12 | **7.4%** | Yes (10+ mentions) | Yes — heaviest forker (51 fork + 24 call) |
| scout | 93 | 3 | **3.2%** | Yes (6+ mentions) | Minimal (3 fork + 11 call) |
| qa | 78 | 2 | **2.6%** | Yes (3 mentions) | Minimal |
| evaluator | 253 | 0 | **0.0%** | Yes (5 mentions) | Never forks — all eval tasks |
| may | 97 | 0 | **0.0%** | No (0 mentions) | Minimal (13 fork) |

Amy/amy-kimi: 0 sessions in last 48h — excluded from analysis.

## Key Findings

### 1. Heartbeat Docs Alone Don't Drive Adoption

**The initial hypothesis was WRONG.** Having `workflow.run()` templates in heartbeat.md is necessary but not sufficient:
- **tech-lead** has the MOST workflow documentation (lens-analysis, implement-and-verify, persistent-task, parallel-research) yet only 7.4% adoption — despite being the heaviest forker (75 non-heartbeat sessions).
- **evaluator** has workflow docs but 0% — because its sessions are system-generated evaluation tasks that don't fork.
- **coach** has extensive docs (12+ mentions) but only 18.5%.

### 2. Coder's 79.4% Is Misleading — It's a Worker, Not an Adopter

Coder has zero workflow mentions in its heartbeat.md and zero heartbeat sessions. Its 34 sessions are ALL called by other agents as a workflow worker (source: `workflow` or `callAgent`). Coder doesn't *choose* to use workflows — it *is* the workflow. This is actually KE-020 in action: coder adopted workflows because it was **structurally wired** as a worker, not because it chose to.

### 3. The Real Adoption Gap Is fork-to-workflow Conversion Rate

The meaningful metric isn't "workflow sessions / total" but "workflow sessions / (fork + call dispatches)":

| Agent | Dispatched Sessions | Workflow | Conversion |
|-------|-------------------|----------|------------|
| bob | 89 | 53 | **59.6%** |
| optimizer | 76 | 47 | **61.8%** |
| coach | 87 | 30 | **34.5%** |
| tech-lead | 87 | 12 | **13.8%** |
| scout | 17 | 3 | **17.6%** |
| qa | 2 | 2 | **100%** (tiny N) |

**tech-lead is the biggest gap**: 75 dispatched sessions via `agents.fork` but only 12 use workflows. It dispatches heavily but defaults to raw fork.

### 4. The Mechanism: `workflow.run()` as Default Dispatch vs. Optional Enhancement

High-adoption agents (bob, optimizer) have a key structural pattern in their heartbeats:

> "For ALL forked work sessions, use `workflow.run('verify-wrap', task)` instead of `agents.fork()`"

This frames workflow as the **replacement for fork**, not an optional add-on. 

Low-adoption agents (tech-lead, scout) frame it as a routing table: "for X use workflow A, for Y use workflow B". This requires the agent to *classify* the task first, adding cognitive overhead that defaults to the simpler `agents.fork()`.

## Root Cause

**The adoption gap comes from framing, not awareness.** Two patterns:

1. **High adoption** = "workflow IS your dispatch mechanism — use it by default" (bob, optimizer)
2. **Low adoption** = "here's a table of workflows you CAN use" (tech-lead, coach, scout)

## Recommendations

### R1: tech-lead heartbeat — Add default workflow mandate (HIGHEST IMPACT)
tech-lead dispatches 75 non-heartbeat sessions in 48h but only 12 use workflows. Adding the "use `workflow.run('verify-wrap', task)` for ALL forked work" mandate (same as bob/optimizer) could convert 50+ sessions.

**Specific change**: Add to tech-lead's heartbeat dispatch section:
```
For ALL forked work, use workflow.run('verify-wrap', task) instead of agents.fork().
Only use raw agents.fork() for quick triage tasks < 3 ops.
```

### R2: coach heartbeat — Simplify from routing table to default
Coach has a detailed workflow routing table but 34.5% conversion. Simplify to "default = verify-wrap, override only for growth-cycle and training-sprint".

### R3: evaluator — No action needed
Evaluator's 0% is correct — its sessions are system-generated evaluations that shouldn't use workflows. The workflow docs in its heartbeat are dead code.

### R4: may — No action needed  
May's role is coordination/triage — she dispatches TO other agents. Her fork sessions are lightweight dispatches, not substantive work. Workflow wrapping would add overhead.

### R5: scout — Minor improvement possible
Scout has 17 dispatched sessions with only 3 workflows. The heartbeat already has the right framing but scout may be defaulting to `callAgent` (11 sessions) for quick lookups that genuinely don't need workflows.

## Meta-Observation

This finding validates **KE-007** (workflow enforcement is the only reliable behavioral intervention) AND **KE-020** (capability adoption requires explicit wiring). The agents with workflow docs framed as "optional routing table" behave identically to agents without docs — they default to the simpler `agents.fork()`. Only the "workflow replaces fork" framing drives adoption.

---
*Generated: 2026-04-15 | Source: .state/may.db sessions table (48h window) | Agent: optimizer*
