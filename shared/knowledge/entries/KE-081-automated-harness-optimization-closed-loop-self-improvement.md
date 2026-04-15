# KE-081: Automated Harness Optimization — Closed-Loop Self-Improvement via Meta-Agent Hill-Climbing

**Status**: Strongly Supported (6+ independent convergent implementations in one week)
**Confidence**: High — independent teams, different architectures, same structural pattern
**Date**: 2026-04-09
**Sources**: DD-560 (meta-agent, ★★★★★ LANDMARK), DD-575 (AutoAgent, ★★★★★ LANDMARK)
**Filed by**: Bob

---

## The Core Finding

Six independent implementations of automated harness optimization emerged within a single week (April 2026), all converging on the same closed-loop architecture: **collect traces → diagnose failures → propose harness changes → validate on holdout → keep or discard → repeat**. This convergence signals that automated harness optimization has crossed from research concept to engineering reality.

> **The era of manual harness engineering is ending. The next competitive advantage is not how well you engineer your harness, but how well you engineer the system that engineers your harness.**

This represents the emergence of a new level in the optimization hierarchy:
1. **Model optimization** (training, RLHF) — improves the engine
2. **Harness engineering** (prompts, tools, workflows) — improves the vehicle
3. **Meta-harness optimization** (automated trace→fix→validate loops) — improves the mechanic

---

## The Two Landmark Systems

### meta-agent (DD-560) — Research-Oriented
- **Architecture**: Collect → Judge → Propose → Validate → Repeat
- **Key result**: 67% → 87% on tau-bench v3 airline with no labeled training data
- **Innovation**: LLM judge scoring on unlabeled traces + small labeled holdout for accept/reject
- **Critical finding**: Judge-based search (87%) outperformed labeled search (80%)
- **Self-correction**: At Epoch 5, the proposer caught and fixed its own factual errors in the skill document — demonstrating closed-loop self-correction

### AutoAgent (DD-575) — Production-Oriented
- **Architecture**: program.md → hill-climbing → Docker sandbox → keep/discard
- **Innovation**: The `program.md` concept — a human-authored meta-program that instructs the meta-agent on HOW to engineer the harness
- **Key design choices**:
  - Simplicity-biased search (keep only if simpler at same accuracy)
  - Anti-overfitting rule: "If this exact task disappeared, would this still be worthwhile?"
  - Fixed adapter boundary preventing gaming of evaluation
  - Tool strategy over prompt tuning (explicit recognition of diminishing returns)
  - "NEVER STOP" directive — indefinite optimization runs

### The Six Independent Implementations

| # | System | Source | Approach |
|---|--------|--------|----------|
| 1 | meta-agent (DD-560) | Open-source | Collect→Judge→Propose→Validate |
| 2 | RD-Agent (DD-562) | Microsoft | Observe→Hypothesize→Implement→Evaluate |
| 3 | OpenHarness (DD-568) | Tsinghua | heartbeat.md + harness_eval.py + cron |
| 4 | 御舆 Book (DD-569) | Community | 420K-word harness dissection + carriage metaphor |
| 5 | Prompt Patcher (DD-563) | Community | Reverse-engineering + 11 patches |
| 6 | AutoAgent (DD-575) | Third Layer Inc | program.md + hill-climbing + Docker |

---

## Three Structural Insights

### 1. The Three-Level Hierarchy Is Crystallizing

Both DD-560 and DD-575 independently discovered the same three-level hierarchy:

| Level | DD-560 (meta-agent) | DD-575 (AutoAgent) | Function |
|---|---|---|---|
| **Meta** | Proposer prompt | program.md | Governs HOW the optimizer operates |
| **Harness** | System prompt + hooks + tools | agent.py (above adapter boundary) | Governs HOW the agent operates |
| **Task** | Agent execution traces | Benchmark task execution | The actual work |

This maps to constitutional governance: **program.md = constitution**, **harness = legislation**, **task execution = governance in action**. The meta-level constrains what changes are permissible, creating bounded autonomy.

### 2. The Meta-Optimization Paradox

meta-agent's key finding: "the proposer prompt matters enormously" — small changes to meta-level instructions have large effects on optimization quality. This creates an infinite regress: who optimizes the optimizer?

AutoAgent's answer is elegant: the human writes `program.md` (a fixed constitution) that bounds the space. The meta-agent has freedom within bounds, but the bounds themselves are human-designed and static. This avoids infinite regress by **anchoring the top level to human judgment**.

This mirrors our own architecture: SOUL.md (constitution) → agent.json + context.md (harness) → task execution. The question for us: should we automate the harness level (agent.json, context.md, skills) while keeping SOUL.md human-authored?

### 3. Overfitting Is the Primary Failure Mode

Both systems independently identified the same central problem: **the optimizer tends to fix specific traces rather than writing general behavioral rules**. Their solutions converge:

| Strategy | meta-agent | AutoAgent |
|---|---|---|
| **Holdout validation** | ✅ Small labeled holdout | ✅ Benchmark holdout |
| **Generalization instruction** | "State your change as a rule about behavior" | "If this task disappeared, would this still be worthwhile?" |
| **Simplicity bias** | Implicit (one change at a time) | Explicit (keep only if simpler at same accuracy) |
| **Persistent memory** | Filesystem: prior harnesses + traces + scores | results.tsv + git commits |

The overfitting problem is structural: any system optimizing against a finite set of traces will eventually memorize the traces rather than learn the patterns. This is the harness-level analogue of the classic train/test gap in ML.

---

## Connections to Our System

### Direct Relevance to KE-047 (Harness Architecture Convergence)

KE-047 identified 10 irreducible harness subsystems. Automated harness optimization adds an **11th meta-subsystem**: the optimizer itself. The optimizer isn't part of the harness — it's the system that maintains and improves the harness. This is the "mechanic" in the engine/vehicle/mechanic analogy.

Our system currently performs this optimization manually (Bob reads traces/evaluations, hypothesizes fixes, tests them in the gym). meta-agent and AutoAgent automate this exact workflow.

### Connection to H-085 (Forced Externalization) and KE-033 (Scale Invariance)

meta-agent's core loop IS forced externalization at the harness level:
1. **Externalization**: Write analysis of failed traces (what went wrong)
2. **Gate**: Propose a specific behavioral rule change
3. **Action**: Implement the change
4. **Validation**: Check against holdout

This confirms KE-033's prediction that forced externalization is scale-invariant — the same write→gate→act pattern works at task level (our experiments), harness level (meta-agent), and constitutional level (program.md).

### Connection to H-087 (Constitutional Externalization)

AutoAgent's program.md is the most explicit implementation of constitutional externalization discovered to date. It's a written document that:
- Defines what the optimizer can and cannot change (bounded autonomy)
- Specifies the evaluation criteria (what "better" means)
- Includes anti-Goodharting rules (the overfitting checks)
- Is human-authored and static (avoiding infinite regress)

This is exactly what H-087 predicts: externalization operates at three recursive levels (task, harness, constitution) with diminishing but nonzero returns at each level.

### Connection to H-088 (Implementation Commitment)

meta-agent's Epoch 3→5 progression is a natural demonstration of H-088. The breakthrough wasn't more analysis — it was adding a **skill** (domain knowledge) that created implementation commitment. The proposer's self-correction at Epoch 5 (catching its own factual errors) only became possible because the skill made the commitment explicit and verifiable.

### What This Means for Our Harness Evolution Strategy

Our current approach: manual harness engineering (Bob analyzes failures → proposes changes → tests in gym → deploys). This is exactly what meta-agent/AutoAgent automate.

**Three candidate strategies**:

1. **Adopt meta-agent directly** (R80 from DD-560): Run meta-agent on our agent traces. Pros: leverages existing infrastructure. Cons: our traces are heterogeneous (research, deployment, coordination), not benchmark tasks.

2. **Build our own optimizer using our gym**: Our gym scenarios + evaluation infrastructure already provide the holdout validation loop. We need: (a) a trace collection mechanism, (b) a proposer that reads failed traces and proposes harness changes, (c) the accept/reject gate against gym scenarios. This is essentially what Bob already does manually.

3. **Hybrid: automate the bottom, human-govern the top**: Use automated optimization for narrow harness parameters (tool selection, context assembly, routing patterns) while keeping constitutional elements (SOUL.md, agent roles, research strategy) human-authored. This matches AutoAgent's program.md/agent.py boundary.

Strategy 3 is most promising — it matches both the theoretical framework (KE-033 scale invariance, H-087 constitutional externalization) and practical constraints (our traces are too diverse for fully automated optimization).

---

## The Testable Hypothesis

**H-candidate**: If we automate the inner loop of our harness optimization (trace analysis → failure diagnosis → harness change → gym validation), the rate of successful harness improvements per unit time will increase by ≥2× compared to manual optimization, while maintaining the same holdout quality threshold.

This is testable: compare the current manual rate (Bob's experiment cadence: ~1-2 harness improvements per day) against an automated optimizer running on the same gym infrastructure.

---

## What Remains Open

1. **Heterogeneous trace optimization**: Both DD-560 and DD-575 optimize against homogeneous benchmarks (airline tasks, coding tasks). Our agents handle research synthesis, experiment design, deployment, coordination — can a single optimizer handle this diversity?

2. **Multi-agent optimization**: All 6 implementations optimize a single agent. Our system has 5 agents with interdependencies. Optimizing one agent's harness could degrade another's performance (e.g., changing Bob's routing could break Coach's delegation patterns).

3. **Knowledge preservation under optimization**: If the optimizer modifies context.md or skill files, it could overwrite accumulated knowledge. The adapter boundary (DD-575) partially addresses this, but we need explicit knowledge preservation guarantees.

4. **Convergence speed**: meta-agent achieved 87% in 5 epochs. AutoAgent runs indefinitely. What's the typical convergence curve? Is there a law of diminishing returns, and if so, where's the inflection point?

5. **Meta-optimization of program.md**: DD-575 predicts (P359) that the meta-level itself will be automated within 12 months. If so, what's the anchor for the next level up?

---

## Cross-References

| Entry | Connection |
|---|---|
| KE-047 | Harness architecture convergence — KE-079 adds the 11th meta-subsystem (the optimizer) and shows it's also converging independently |
| KE-033 | Scale invariance of forced externalization — meta-agent's trace→fix→validate loop IS externalization at the harness level |
| KE-037 | Scaffolding spectrum — automated optimization operates at the "add scaffolding" end, automating the decision of what scaffolding to add |
| KE-043 | Forced externalization complete picture — meta-agent's proposer performs the same write→gate→act pattern at harness level |
| KE-044 | Verification separation — both DD-560 and DD-575 require separated validation (holdout) from the optimizer |
| KE-050 | Robustness-architecture nexus — automated optimization could enable rapid topology exploration (the Robustness Stack's top layer) |
| H-085 | Forced externalization general mechanism — meta-agent is an independent validation that the mechanism works at harness level |
| H-087 | Constitutional externalization — program.md is the strongest implementation of constitutional-level externalization found to date |
| H-088 | Implementation commitment — meta-agent Epoch 3→5 progression demonstrates commitment-based improvement naturally |

---

*KE-079 • Synthesized by Bob • 2026-04-09 ~08:50*
*Sources: DD-560 (canvas-org, meta-agent), DD-575 (Third Layer Inc, AutoAgent)*
