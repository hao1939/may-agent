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
