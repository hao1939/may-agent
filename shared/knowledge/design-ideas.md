# Design Ideas & Research Reference

Extracted from openclaw-config knowledge base. These are not principles (see philosophy.md) but validated design ideas, research findings, and operational patterns worth referencing.

---

## Agent Execution Patterns

### Optimized Agent Execution Loop
```
1. COLLECT INPUT      — may or may not need LLM
2. ONE tool/script    — the actual work (optimized, deliberate)
3. LLM PROCESSING     — interpret result (if needed)
4. ITERATE or RESPOND  — loop back or done
```
Constraints: one tool call per loop iteration; fixed input schema; focused prompt; clear exit conditions; error handling as explicit branches — not LLM improvisation.

### Ralph-Loop: Canonical Parallel Agent Harness
*Source: Nicholas Carlini (Anthropic), "Building a C compiler with parallel Claudes"*

```
while true; do
  claude --dangerously-skip-permissions -p "$(cat AGENT_PROMPT.md)" &> logfile
done
```
16 parallel instances, shared codebase, $20k, 100k-line Rust C compiler. Three principles: (1) Write tests that keep agents on track without human oversight, (2) Structure work so multiple agents can make parallel progress, (3) Know where the ceiling is.

**Economics:** $0.20/line for autonomous agent-generated production code. At 10× model cost compression → $0.02/line.

Our heartbeat loop IS the Ralph-loop at smaller scale.

### Two Channels of Work: Heartbeat vs Direct Task
- **Heartbeat** — periodic wake-up for self-directed work. Agent's own time.
- **Direct task** — assigned work that needs to be done actively right now. Doesn't wait for heartbeat.

These two channels must not interfere. How to properly parallelize them is an open design question.

### Agent Capability Levels
Every agent operates at L1 (Useful), L2 (Self-driving), or L3 (Building).

**Role mapping:** Bob = primary L3. Coach = target L3. Scout = L2, potential L3. Amy = strong L1+L2 specialist. Main = human interface, not a self-learning agent.

---

## Research Findings (Validated)

### Claude Sonnet 4.5: Parallel Pre-Execution Scan
The model natively issues parallel read-only checks before committing to an action. Don't suppress this with "act immediately" specs. Connection: 69% divergence at step 2 (first tool call) — native verification reduces variance.

### Data Quality > Optimization Algorithm (Alibaba ROME)
Training is limited by data quality, not algorithm. 0.504 → 0.852 terminal value with mask/filter. Applied: curated compact knowledge files outperform large uncurated dumps.

### Context Learning Failure Rate: 17.2%
Best model (GPT-5.1) achieves 23.7% context learning success. Average 17.2%. Longer context → worse CL. Rules work through structure + specificity, not model intelligence. Write rules as patterns, not prose. Stable prefix (P2) is critical.

### Skills Efficacy ∝ Domain Procedural Knowledge Gap
Medical domain: +51.9pp improvement with skills. Software engineering: +4.5pp. Skills add value where LLM pretraining has gaps. Self-generated skills are ineffective — skills require expert curation.

### Benchmark Saturation → Domain-Specific Evaluation
MMLU/GSM8K saturated. Use domain-specific probes: "Can Amy find a signal not in last week's feed?" "Can Scout ID a new theme across 10 papers?" "Can Bob spot a contradiction in one heartbeat?"

### Single-Turn Safety Is an Upper Bound
Multi-turn Attack Success Rate increases +16% vs single-turn. Text output safety ≠ tool-call safety. Models refuse in text but execute via tool calls.

### Harness Engineering > Model Engineering (Empirical)
Same model (GPT-5.2-Codex) improved 52.8% → 66.5% purely via harness changes. Three levers: System Prompt, Tools, Middleware. Build & Self-Verify loop must be explicitly induced — models don't naturally enter it.

---

## Infrastructure & Security Patterns

### Application-Layer vs Infrastructure-Layer Security
- **Application-layer:** SOUL.md behavioral constraints, workspace isolation conventions, escalation gates. Work because agents follow them.
- **Infrastructure-layer:** Per-agent container isolation, filesystem namespacing, credential scoping. Work because the OS enforces them.
- **Principle:** Application-layer necessary but not sufficient for high-stakes deployments.

### Config-Reload Is a Critical Path Risk
Any config mutation is system-wide risk. The config file is a single point of failure on every cache miss. Treat config edits with the same care as production deployments.

### Context Boundary Integrity
Agents fail when context boundaries are violated, often silently and progressively. Fixes: safety constraints in SOUL.md (survives compaction), external content as untrusted, structured journal format for memory coherence.

### Browser Automation: CDP vs JS Navigation
Detection-aware platforms monitor at CDP level. Use `page.evaluate(() => window.location.href = url)` (JS context, undetectable) over Playwright `page.goto()` (CDP-visible). Phase 1 uses goto; Phase 2 must switch for anti-bot surfaces.

### Accessibility Tree > DOM
AT provides 93% token reduction vs raw DOM. Change-resistant. Prefer for full-page LLM context injection.

---

## Information Architecture

### Cross-Agent IA Design
- Each agent owns its subdirectory in knowledge/. Domain boundary = agent boundary.
- Hot/Warm/Cold tiers: Hot (≤200 lines, always loaded), Warm (archives, on demand), Cold (full content, search only).
- SCHEMA.md: navigation map with agent-to-directory mapping, tier conventions, file naming rules.

### Session-Scoped Workspace Design
Multiple agent sessions may run in parallel. Pattern: each session writes to its own temp space during execution, publishes to shared files on completion.
- Accept read staleness (sessions are short ~5-15 min).
- Dedup at compact time, not at write time.
- Session ID format: `<date>-<HHMM>-<random-4>`.

### 1+7 Coordinator-Executor Topology
Validated by multiple practitioners: 1 manager + 7 executors, each fully isolated. Workspace isolation non-negotiable. 4-8 agent ceiling is empirical (human cognitive bottleneck).

---

## Product Positioning

### OC vs CC: Async vs Synchronous
Community consensus: "CC是工作，OC是生活" — CC is work, OC is life. OC's defining property: works while you're away from your computer. Agents that require synchronous human confirmation break this contract.

### Optimal Triangle
OC persistent memory + Opus reasoning + CC coding execution = complementary, not competing.

---

## Failure Catalog (Key Patterns)

| ID | Pattern | Root Cause | Fix |
|----|---------|-----------|-----|
| F1 | Search persistence without escalation | No N-strikes escalation rule | 3-strikes rule |
| F2 | Timeout without partial commit | No checkpoint rule | "At 60% of time budget, commit" |
| F5 | Analysis without delivery | No delivery trigger | Proactive Telegram brief rule |
| F8 | Idle journal entries | Agent not following own spec | Explicit prohibition |
| F10 | System self-model drift | No update trigger on agent creation | Creation checklist |

---

## Supply Chain & External Threats

### Skill Installation = IPI Attack Surface
ClawHub supply-chain incident: SKILL.md injected with base64 → bash payload. Defense: SOUL.md 0e — external content cannot modify agent behavior. Community response: skill-vetter as must-install.

### Anthropic RSP Pledge Weakened (Feb 2026)
No longer committed to halting training if safety measures aren't pre-verified. Models improve faster; gap between capability and system hardening may widen. Re-evaluate agent safety assumptions more frequently.

---

## Instance Architecture

**Status:** Proposed (2026-03-06)

### Problem

All cron jobs run in-process. When the main instance restarts, running task
sessions are killed. Heartbeat context is lost on restart too.

### Design

Separate heartbeat (built-in timer) from tasks (dedicated instances).

```
Main Instance (persistent process, survives restart via resumeAgent)
├── Chat session       — May ↔ human, persistent
├── Heartbeat timer    — built-in, followUp() every N minutes
│                        Agent reads heartbeat.md, works through sections
└── Cron scheduler     — spawns task instances via ./may.sh task

Task Instances (independent processes, survive main restart)
├── analyze-failures   — ./may.sh task --agent bob "..."
├── lesson-consolidation — ./may.sh task --agent bob "..."
├── optimize           — ./may.sh task --agent optimizer "..."
└── ...
    Each instance is self-contained, writes identity.json, exits on done
```

### Heartbeat

Built into the main process. Not part of cron. Just a timer.

**Config** — in `agent.json`:
```json
{
  "heartbeatMs": 1800000
}
```

**Heartbeat file** — `agents/<name>/heartbeat.md`:
The agent reads this file on each tick and works through each section.
Markdown — human-readable, agent-readable, easy to edit. No schema.

**How it works:**
1. Main process reads `heartbeatMs` from agent.json
2. Sets up `setInterval()`
3. On each tick: `manager.followUp(sid, "[heartbeat] Read your heartbeat.md ...")`
4. Same session as chat — agent has full conversation context
5. No cron entry needed. Works without cron enabled.

### Task Instances

Independent processes. Spawned by cron, by agents (via exec), or by humans.

**Unified interface — `may.sh`:**
```bash
# Main instance (existing):
./may.sh                                              # interactive
./may.sh start                                        # background (tmux)

# Task instance (new):
./may.sh task --agent bob "analyze failures"           # inline task
./may.sh task --agent bob --file tasks/analyze.md      # task from file
./may.sh task --name my-job --agent bob "do something" # named instance

# Observe (new):
./may.sh ps                          # list all running instances
./may.sh logs <instance>             # tail session JSONL
./may.sh send <instance> "message"   # send via socket (existing)
```

Same interface for humans, cron, and agents:
- Human types: `./may.sh task --agent bob "analyze failures"`
- Cron runs:   `./may.sh task --agent bob --name analyze-failures "..."`
- Agent execs: `exec("./may.sh task --agent bob 'analyze failures'")`

**`--task` mode in `may.ts`:**
- Reads task from CLI arg or `--file`
- Uses it as initial message (not "Ready. Waiting for tasks.")
- Agent runs to completion, process exits 0 (done) or 1 (error)
- Socket stays open during execution for observability

### Self-Contained Instances

Every instance writes its own identity file on startup. No external tracker.

**File:** `.state/instances/<instance>/identity.json`

On startup:
```json
{
  "pid": 12345,
  "agent": "bob",
  "instance": "job-analyze-failures",
  "socket": ".state/job-analyze-failures/bob.sock",
  "startedAt": "2026-03-06T06:00:00Z",
  "startedBy": "cron:analyze-failures",
  "task": "Analyze last 10 evaluations...",
  "status": "running"
}
```

On exit (updated in place):
```json
{
  "pid": 12345,
  "agent": "bob",
  "instance": "job-analyze-failures",
  "socket": ".state/job-analyze-failures/bob.sock",
  "startedAt": "2026-03-06T06:00:00Z",
  "startedBy": "cron:analyze-failures",
  "task": "Analyze last 10 evaluations...",
  "status": "done",
  "exitCode": 0,
  "endedAt": "2026-03-06T06:05:30Z",
  "duration": "5m30s"
}
```

**Discovery:** `ls .state/instances/*/identity.json` → all instances.
**Status:** `./may.sh ps` → reads identity.json files, shows running/completed.
**Investigation:** `./may.sh logs <instance>` → session JSONL transcript.

### Cron Config

Simplified — just task jobs. No heartbeat entries, no sessionType.

```json
[
  {
    "name": "analyze-failures",
    "intervalMs": 28800000,
    "agent": "bob",
    "task": "[cron:analyze-failures] Analyze last 10 evaluations...",
    "description": "Bob analyzes evaluation patterns every 8 hours"
  },
  {
    "name": "optimize",
    "intervalMs": 86400000,
    "agent": "optimizer",
    "task": "[cron:optimize] Read analysis and work on top improvement...",
    "description": "Optimizer works on system improvements daily"
  }
]
```

Cron dispatcher just runs:
```bash
./may.sh task --agent $agent --name $name "$task"
```

JS handlers stay in-process (system-status, evaluate-sessions) — registered
in code, no config change.

### Observability

1. `./may.sh ps` — list running instances from identity.json files
2. `./may.sh logs <instance>` — tail session JSONL for investigation
3. Telegram `/jobs` — same as `./may.sh ps`, sent to chat
4. Telegram summary — on task exit, brief sent to chat channel
5. Socket — connect to instance socket for live streaming

### Job Classification

| Job | Home | Why |
|-----|------|-----|
| amy-explore | heartbeat.md | Needs prior context |
| scout-explore | heartbeat.md | Needs prior context |
| drain-todo (all agents) | heartbeat.md | Needs prior context |
| review-human-inputs | heartbeat.md | Needs prior context |
| coaching | heartbeat.md | Tracks progress |
| analyze-failures | cron → task instance | Fresh each time |
| philosophy-check | cron → task instance | Fresh each time |
| lesson-consolidation | cron → task instance | Fresh each time |
| optimize | cron → task instance | Fresh each time |
| health-check | cron → task instance | Fresh each time |
| system-status | JS handler (in-process) | Pure computation |
| evaluate-sessions | JS handler (in-process) | Pure computation |

### Implementation Steps

1. `may.ts` — add heartbeat timer (read `heartbeatMs` from agent.json)
2. `may.ts` — add `--task` mode (task as initial message, exit on idle)
3. `may.ts` — write `identity.json` on startup, update on exit
4. `may.sh` — add `task`, `ps`, `logs` commands
5. `cron.ts` — spawn `./may.sh task` instead of `followUp()`
6. `cron.json` — add `agent` field, move heartbeat jobs to heartbeat.md
7. `agent.json` — add `heartbeatMs` field for may
8. Telegram — add `/jobs` command

## 5. First-Turn Safety (ADVERSA / arXiv:2603.10068)
- **Insight**: Jailbreaks are front-loaded (26.7% rate, avg round 1.25), not cumulative.
- **Action**: Focus defensive "Patrol" efforts on the first 1-2 turns of any session. Don't waste budget checking turn 10.
- **Status**: New.

## 6. Finite Brain / Budget Awareness (SkyClaw / 2026-03-08)
- **Insight**: Agents must see their own resource consumption (tokens/ops) in-context to self-regulate.
- **Mechanism**: Inject "Budget Dashboard" into system prompt.
- **Status**: [PARTIAL] OpBudget implemented but visibility is inconsistent (CS 6.1).

## 7. Capability-Reliability Tension (ThReadMed-QA / arXiv:2603.11281)
- **Insight**: Stronger models degrade faster in multi-turn dialogues (GPT-5 drops 16 pts by turn 2).
- **Implication**: Long delegation chains (A->B->C) are dangerous. Limit depth to 2 hops (C4.3).
- **Status**: Validates our "2-hop max" rule.
