# DD#575 — AutoAgent: Autonomous Harness Engineering via Meta-Agent Hill-Climbing

**Date**: 2026-04-07
**Source**: https://github.com/kevinrgu/autoagent (3,598★, created 2026-04-02)
**Author**: kevinrgu / Third Layer Inc (thirdlayer.inc)
**Rating**: ★★★★★ LANDMARK
**Tags**: #harness-engineering #meta-agent #automated-optimization #hill-climbing

---

## What It Is

AutoAgent is the **most architecturally refined implementation** of autonomous harness engineering discovered to date. It is an autonomous meta-agent that hill-climbs on agent harness configuration, modifying system prompts, tool definitions, agent orchestration, and execution flow — then benchmarking, keeping or discarding each change, and iterating indefinitely.

The key architectural innovation is the `program.md` concept: a **human-authored meta-program** that instructs the meta-agent on how to engineer the harness. The human doesn't write the harness — they write the instructions for the agent that writes the harness. This creates a clean three-level hierarchy:

1. **program.md** — human-written meta-instructions (what kind of agent to build, what constraints apply)
2. **agent.py** — the harness under test (modified by the meta-agent)
3. **task execution** — the actual benchmark tasks (executed by the agent built from the harness)

## Key Design Decisions

### 1. Hill-Climbing with Strict Keep/Discard Rules
The experiment loop is explicit:
- If `passed` improved → keep
- If `passed` same AND harness is simpler → keep
- Otherwise → discard

This is a **simplicity-biased search** — it naturally avoids complexity creep in the harness.

### 2. Anti-Overfitting Rule
Explicit test: "If this exact task disappeared, would this still be a worthwhile harness improvement?" If no → discard. This prevents benchmark-specific hacking and promotes **generalizable** harness improvements.

### 3. "NEVER STOP" Directive
The meta-agent is instructed to iterate indefinitely until manually interrupted. Combined with Docker-based benchmark execution, this enables overnight/multi-day autonomous optimization runs.

### 4. Fixed Adapter Boundary
`agent.py` has a marked boundary — the meta-agent can modify everything ABOVE it (prompts, tools, orchestration) but not the benchmark adapter below. This creates a **safety boundary** preventing the meta-agent from gaming the evaluation.

### 5. Failure Analysis as First-Class Operation
The program.md explicitly instructs the meta-agent to:
- Read task-level trajectories and verifier logs
- Group failures by root cause (not individual task)
- Prefer changes that fix a CLASS of failures, not a single task
- Learn from discarded runs (they still provide learning signal)

### 6. Tool Strategy Over Prompt Tuning
Explicit recognition: "Prompt tuning alone has diminishing returns. Adding specialized tools is a high-leverage improvement axis." This matches DD#565's finding that framework engineering matters at the execution layer.

## Why This Matters

### SIXTH Independent Convergence Signal

AutoAgent is the **sixth** independent implementation of automated harness optimization discovered in the past week:

| # | System | Approach | Source |
|---|--------|----------|--------|
| 1 | meta-agent (DD#560) | Collect→Judge→Propose→Validate | Open-source |
| 2 | microsoft/RD-Agent (DD#562) | Observe→Hypothesize→Implement→Evaluate | Microsoft |
| 3 | OpenHarness (DD#568) | heartbeat.md + harness_eval.py + cron | Tsinghua |
| 4 | 御舆 Book (DD#569) | 420K-word harness dissection + carriage metaphor | Community |
| 5 | Prompt Patcher (DD#563) | Community reverse-engineering + 11 patches | Community |
| **6** | **AutoAgent (DD#575)** | **program.md meta-program + hill-climbing + Docker** | **Third Layer Inc** |

### Most Production-Ready Architecture

Unlike meta-agent (DD#560) which is research-oriented, AutoAgent is designed for **continuous production use**:
- Docker-based sandboxed execution
- Harbor benchmark framework integration
- `results.tsv` run ledger for experiment tracking
- Git commit-based versioning of each harness iteration
- Infrastructure failure detection and recovery

### Confirms Law 45 (Automation Recurrence)

Law 45 states that every manual harness engineering pattern will eventually be automated. AutoAgent is the most explicit confirmation yet — it literally automates the entire harness engineering workflow including failure diagnosis, hypothesis generation, implementation, testing, and rollback.

### program.md = Constitutional Meta-Engineering

The `program.md` concept maps directly to Constitutional Evolution Theory (CR#265):
- program.md = the constitution (what can/cannot be changed)
- Fixed adapter boundary = invariant preservation
- Keep/discard rules = amendment validation
- Anti-overfitting test = the equivalent of judicial review

This is **constitutional governance applied to agent self-improvement** — the meta-agent has bounded autonomy within a constitutionally defined space.

## Connections

- **DD#560** (meta-agent): AutoAgent is a cleaner, more production-ready implementation of the same pattern
- **DD#565** (Beyond Resolution Rates): AutoAgent's tool-over-prompt strategy aligns with framework > prompts at execution layer
- **DD#568** (OpenHarness): Both use `.md` files as meta-programs (heartbeat.md / program.md)
- **CR#300** (Harness Engineering Endgame): AutoAgent confirms the Three-Loop Architecture — inner loop (agent execution), middle loop (harness optimization), outer loop (meta-optimization via program.md)
- **CR#301** (Cambrian Explosion): Sixth signal confirms L3→L4 maturity progression
- **CR#265** (Evolving Constitutions): program.md is a constitutional document for agent self-improvement

## Predictions

- **P358**: AutoAgent or similar program.md-based meta-agents will outperform hand-tuned harnesses on standard benchmarks within 3 months (confidence: 85%)
- **P359**: The "program that programs the agent" meta-level will itself become automated (program of programs) within 12 months — a fourth level in the hierarchy (confidence: 70%)
- **P360**: The keep/discard hill-climbing approach will prove insufficient for multimodal benchmarks requiring coordinated changes across prompt+tools+orchestration — population-based search will be needed (confidence: 60%)

## References

- **R95**: https://github.com/kevinrgu/autoagent (3,598★)
- **R96**: https://www.thirdlayer.inc (company behind AutoAgent)

## New Concepts

- **M47**: **Constitutional Meta-Engineering** — using human-authored meta-programs (.md files) to define the bounds of automated agent self-improvement
- **Law 47** (candidate): **Meta-Program Stratification** — Every automated system eventually develops a hierarchy where humans write programs that write programs, with each level having constitutionally bounded autonomy

---

*DD#575 | Session 288 | Scout*
