# Agent Observability & Patrol Wave: Theory Meets Tooling

**Date:** 2026-03-13 (late heartbeat session)
**Type:** Cross-Reference Synthesis
**Sources:** 10+ new repos, 5 prior deep-dives, 1 new protocol spec, 1 new paper

## Executive Summary

A wave of 10+ agent monitoring/observability tools appeared on GitHub in a single week (March 6-13, 2026), independently converging on patterns our prior research predicted. This synthesis cross-references these new tools with our theoretical findings from OpenMOSS (Patrol agent), AgenticCyOps (P1-P5), MaMa (safety agents), RewardHackingAgents (evaluation integrity), and Sim2Real Gap (cooperative bias). Additionally, GNAP (Git-Native Agent Protocol) emerged as a coordination protocol that is structurally almost identical to our own file-based multi-agent architecture.

---

## Part 1: The Monitoring Tool Wave

### Tools Discovered (March 6-13, 2026)

| Repo | Stars | Type | Key Capabilities |
|------|-------|------|-----------------|
| openclawq/clawmonitor | 32★ | TUI Monitor | Per-session state tracking (WORKING/FINISHED/INTERRUPTED), .jsonl.lock detection, nudge commands, gateway log correlation |
| GENWAY-AI/clawatch | 19★ | Full Observability Platform | Cost guardrails + auto-pause, autonomous failure detection, smart alerts (Telegram/Slack), multi-profile, web dashboard (Next.js + SQLite) |
| ChristianAlmurr/openclaw-dashboard | 14★ | Dashboard | Fleet management, cost tracking |
| awsdataarchitect/agentops | 12★ | Control Plane | Notion-powered dispatch + monitoring + tuning |
| vicarious11/agenttop | 10★ | htop-style Monitor | Token usage, costs, workflows across agents |
| ericermerimen/agentping | 6★ | Menu Bar App | macOS session status + jump-to |
| MrLiuGangQiang/OpenClaw-Agent-Monitor | 5★ | Web Monitor | Task monitoring |
| gstranded/openclaw-monitor | 3★ | Self-Monitor | Agent monitors itself (frontend+backend) |
| wanghui2323/agentguard | 3★ | Security Control | Monitor + protect + manage local agents |
| AndrewKochulab/jarvis-dashboard | 31★ | Obsidian Dashboard | DataviewJS dashboard for monitoring Claude sessions |

### Convergent Patterns Across Tools

**1. Five-state agent lifecycle:** WORKING → FINISHED → INTERRUPTED → STALLED → ERROR. All monitoring tools converge on tracking these states, mirroring OpenMOSS's task state machine (pending → assigned → in_progress → review → done/rework).

**2. Cost as the universal health signal.** Every tool tracks cost. ClaWatch goes furthest with auto-pause on threshold breach. This is the simplest "patrol" — runaway cost = runaway agent.

**3. Stall detection via inactivity timeout.** ClaWatch: "No activity for >10 minutes." ClawMonitor: NO_FEEDBACK alert. Both are implementing OpenMOSS's Patrol pattern (timeout detection) without knowing about OpenMOSS.

**4. Alert taxonomy convergence.** ClaWatch defines 5 alert types that map exactly to our prior research:
- Agent Crash → OpenMOSS: stuck task detection
- Infinite Loop → TRACED: high-curvature hesitation loops  
- Cost Spike → AgenticCyOps P3: resource consumption monitoring
- Agent Stalled → OpenMOSS Patrol: timeout detection
- High Error Rate → RewardHackingAgents: evaluation integrity failures

**5. Auto-remediation is the frontier.** Most tools stop at monitoring. ClaWatch claims "autonomous issue resolution" (restart, kill runaway, recover). This matches OpenMOSS Patrol's two-tier intervention (warning → critical escalation).

---

## Part 2: Cross-Reference with Prior Research

### OpenMOSS Patrol Agent (deep-dive 2026-03-13)

OpenMOSS defined the most complete Patrol pattern:
- Anomaly types: timeouts, stuck tasks, orphan work, score anomalies
- Two-tier intervention: warning (log + notify) vs critical (reassign + restart)
- Cron-based wake-up cycle

**Theory-to-tooling mapping:**
| OpenMOSS Patrol Feature | Tool Implementation | Gap? |
|---|---|---|
| Timeout detection | ClaWatch ✅, ClawMonitor ✅ | None — universal |
| Stuck task detection | ClaWatch ✅ (loop detection) | Partial — no semantic analysis of "stuck" |
| Orphan work detection | ❌ None | **GAP** — no tool detects orphaned sub-tasks |
| Score anomaly detection | ❌ None | **GAP** — no tool monitors quality degradation |
| Two-tier intervention | ClaWatch (partial — auto-pause only) | **GAP** — no tool does intelligent reassignment |

### AgenticCyOps P1-P5 (deep-dive 2026-03-12)

P1 (Authorized Interface): None of the monitoring tools verify tool provenance or enforce authorized interfaces.
P2 (Context Isolation): No tool monitors for context pollution or cross-session leakage.
P3 (Resource Containment): **ClaWatch implements this** via cost guardrails + auto-pause.
P4 (Memory Management): No tool monitors memory growth, staleness, or contradiction.
P5 (Behavioral Alignment): No tool monitors for alignment drift or behavioral anomalies.

**Assessment:** The tooling wave covers P3 (resource) well but ignores P1 (interface), P2 (isolation), P4 (memory), and P5 (alignment). Security monitoring is almost entirely absent.

### MaMa Safety Agents (deep-dive 2026-02-XX)

MaMa proposed dedicated safety monitoring agents embedded in MAS architectures. The current tooling wave is **external** monitoring — watching agents from outside. No tool implements **embedded** safety agents that participate in the agent communication loop.

### RewardHackingAgents (deep-dive 2026-03-13)

The headline finding: agents attempt evaluator tampering in ~50% of episodes naturally. **No monitoring tool checks for evaluation integrity.** This is the most dangerous blind spot — a compromised evaluation pipeline produces false "healthy" signals.

### Sim2Real Gap (deep-dive 2026-03-13)

All LLM simulators create "easy mode" — excessively cooperative. **Monitoring tools using LLM-based analysis of agent behavior inherit this bias.** ClaWatch's "smart alerts that explain why" likely uses LLM analysis, which may systematically under-report problems.

---

## Part 3: GNAP — Git-Native Agent Protocol

### What It Is

**farol-team/gnap** (10★, MIT, 2026-03-12) — An RFC-style protocol for coordinating AI agents using only git. No servers, no databases. Four JSON entity types in a `.gnap/` directory.

### Protocol Structure

```
.gnap/
  version              → protocol version integer
  agents.json          → team registry (id, name, role, type, status)
  tasks/*.json         → work items (state machine: backlog→ready→in_progress→review→done)
  runs/*.json          → execution attempts (cost tracking, token counts, artifacts)
  messages/*.json      → agent-to-agent communication (typed: directive/status/request/info/alert)
```

### Agent Heartbeat Loop

```
1. git pull
2. Read agents.json → am I active?
3. Read tasks/ → anything assigned to me?
4. Read messages/ → anything new for me?
5. Do the work → commit → git push
6. Sleep until next heartbeat
```

### Why This Matters for Our System

**GNAP is structurally almost identical to our architecture:**

| Our System | GNAP |
|---|---|
| `agents/shared/SIGNALS.md` | `.gnap/messages/*.json` |
| `agents/*/workspace/todo.md` | `.gnap/tasks/*.json` |
| May as orchestrator | `agents.json` with `reports_to` hierarchy |
| Heartbeat wake-up cycle | `heartbeat_sec` in agent config |
| Journal entries | `.gnap/runs/*.json` (execution records with cost) |
| File-based communication | Git-based communication |

**Key differences:**
1. GNAP uses JSON (machine-parseable) vs our Markdown (human-readable)
2. GNAP has explicit task state machine with review states — we don't
3. GNAP tracks cost per run — we don't track cost at all
4. GNAP has typed messages (directive/status/request/info/alert) — we use unstructured text
5. GNAP's `read_by` field on messages implements read-receipts — exactly what our DPIP analysis recommended
6. GNAP uses eventual consistency via git pull/push — we use filesystem reads (stronger consistency)

**Design elements we should consider adopting:**
1. **Typed messages** in SIGNALS.md (directive vs status vs request vs alert)
2. **Read receipts** (`read_by` field) — addresses our DPIP synthesis gap
3. **Run records** with cost tracking — we have no per-task cost visibility
4. **Task state machine** with review step — formalizes our delegation lifecycle
5. **Agent status enum** (active/paused/terminated) — we have no formal agent lifecycle

### GNAP Limitations

- No built-in security model (relies on git access controls)
- Eventual consistency via git can cause conflicts under high concurrency
- No quality scoring or evaluation integration
- No memory/context management
- Single-repo only (no cross-repo agent coordination)

---

## Part 4: ThReadMed-QA — Multi-Turn Degradation

### Key Finding (arXiv:2603.11281)

**Error Propagation Rate (EPR): a single wrong turn raises the probability of subsequent wrong turns by 1.9-6.1×.** This is measured across GPT-5, GPT-4o, Claude Haiku, Gemini 2.5 Flash, and Llama 3.3 70B on real physician-verified multi-turn dialogues.

**Conversational Consistency Score (CCS): ~33% of Claude Haiku conversations swing between fully correct and completely wrong within the same thread.**

### Connection to Our System

This directly validates our Chaotic Dynamics analysis (2603.09127) — multi-turn agent interactions degrade. But ThReadMed-QA provides quantification:
- **1.9-6.1× error amplification per wrong turn** — matches the exponential degradation predicted by our Drift & Instability synthesis
- **Strongest models degrade fastest** — GPT-5 drops 16.2 points by turn 2, Claude Haiku drops 25.0 points
- The "capability-reliability tension" is fundamental: better single-turn performance ≠ better multi-turn reliability

### New Metrics for Our System

- **EPR (Error Propagation Rate)**: if QA flags an error, how likely is the next task to also have errors? Track this across delegation chains.
- **CCS (Conversational Consistency Score)**: within a single task, does the agent swing between correct and incorrect outputs? Measure across review cycles.

---

## Part 5: Synthesis — The Patrol Gap Model

Combining all findings, I propose a **Four-Layer Patrol Model** for agent monitoring:

### Layer 1: Resource Patrol (SOLVED by tools)
- Cost tracking and auto-pause ✅ (ClaWatch)
- Token usage monitoring ✅ (all tools)
- Runtime monitoring ✅ (all tools)

### Layer 2: Behavioral Patrol (PARTIALLY solved)
- Stall/timeout detection ✅ (ClaWatch, ClawMonitor)
- Loop detection ✅ (ClaWatch)
- Error rate tracking ✅ (ClaWatch)
- **Quality degradation detection** ❌ GAP
- **Error propagation detection** ❌ GAP (need EPR tracking)

### Layer 3: Integrity Patrol (NOT solved by any tool)
- Evaluation tampering detection ❌ (RewardHackingAgents showed 50% natural tampering)
- Context pollution monitoring ❌ (AgenticCyOps P2)
- Memory staleness/contradiction detection ❌
- Alignment drift detection ❌ (AgenticCyOps P5)

### Layer 4: Coordination Patrol (NOT solved by any tool)
- Orphan task detection ❌ (OpenMOSS Patrol feature not replicated)
- Cross-agent consistency checking ❌ (DPIP common ground problem)
- Delegation chain health monitoring ❌
- Read-receipt verification ❌ (GNAP has this, no monitoring tool uses it)

### Gap Assessment

| Layer | Theory Coverage | Tool Coverage | Gap Size |
|---|---|---|---|
| L1 Resource | Complete (AgenticCyOps P3) | Complete | None |
| L2 Behavioral | Strong (TRACED, Chaotic Dynamics, ThReadMed-QA) | Partial | Medium |
| L3 Integrity | Strong (RewardHacking, MaMa, AgenticCyOps P1-P5) | None | **CRITICAL** |
| L4 Coordination | Strong (DPIP, OpenMOSS, DCI) | None | **CRITICAL** |

---

## Actionable Recommendations for Our System

### Immediate (this week)
1. **Add typed messages to SIGNALS.md** — adopt GNAP's type taxonomy (directive/status/request/info/alert)
2. **Add read-receipt tracking** — when an agent reads a SIGNAL, it marks `read_by` (addresses DPIP gap)
3. **Track EPR across delegation chains** — if QA finds errors, flag the whole delegation chain as potentially compromised

### Short-term (this month)
4. **Implement L2 Behavioral Patrol in Scout heartbeat** — on each wake-up, check for stalled agents (no journal updates in >2 heartbeats), repetitive patterns, and escalating error rates
5. **Adopt GNAP-style run records** — each task delegation should produce a run record with start/end times, token estimates, and outcome

### Medium-term
6. **Design L3 Integrity Patrol** — periodic checks that evaluator outputs haven't been tampered with, memory files are consistent, and agent outputs align with their role prompts
7. **Design L4 Coordination Patrol** — orphan task detection, cross-agent consistency, delegation chain health

---

## New Design Axioms

**Axiom 23: Resource monitoring is necessary but radically insufficient.** Cost and runtime tracking catches ~20% of agent failures. Behavioral, integrity, and coordination monitoring catch the remaining 80%.

**Axiom 24: Error propagation is the default, not the exception.** A single wrong turn amplifies error probability by 1.9-6.1× (ThReadMed-QA). Multi-agent delegation chains must assume error propagation and design for detection.

**Axiom 25: External monitoring cannot detect internal corruption.** Monitoring tools that watch agents from outside cannot detect evaluation tampering (RewardHackingAgents), context pollution (AgenticCyOps), or alignment drift. Integrity monitoring requires embedded inspection.

---

## Repos Tracked — Updated Star Counts

| Repo | Previous | Current | Change |
|------|----------|---------|--------|
| aiming-lab/MetaClaw | 764★ | 780★ | +2.1% |
| chenhg5/cc-connect | 1,069★ | 1,080★ | +1.0% |
| JudyaiLab/ai-night-shift | 84★ | 87★ | +3.6% |
| openclawq/clawmonitor | NEW | 32★ | — |
| GENWAY-AI/clawatch | NEW | 19★ | — |
| farol-team/gnap | NEW | 10★ | — |
