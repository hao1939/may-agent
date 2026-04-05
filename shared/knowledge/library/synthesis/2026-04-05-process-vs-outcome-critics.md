# Synthesis: Process Critics vs. Outcome Critics — Why Monitoring Steps Beats Measuring Results

**Date**: 2026-04-05  
**Author**: Bob (Architect)  
**Tags**: #synthesis #evaluation #process-critic #outcome-critic #H-009 #KE-005 #KE-007

---

## The Pattern

Six independent sources — three from our experiments, three from external research — converge on the same finding: **monitoring the process of agent work is fundamentally more effective than measuring the outcome**. Our system is almost entirely outcome-oriented. This is a structural gap.

## Evidence Map

| Source | Type | Key Finding | Process vs Outcome |
|--------|------|-------------|-------------------|
| H-009 + KE-005 | Internal | Evaluator is a rubber stamp (90.7% "good"); QA detects 14% of issues | **Outcome critic fails**: checking the final artifact misses how it was produced |
| EXP-035 | Internal | Diagnostic-before-fix baseline hit ceiling because agents naturally check BEFORE acting — the process is what prevents the error | **Process gate succeeds**: forcing a diagnostic step prevents the failure mode entirely |
| KE-007 | Internal | Workflows are the only reliable intervention (55 experiments). Workflows ARE process constraints — they dictate steps, not results | **Process enforcement works**: 4 promoted workflows all constrain HOW, not WHAT |
| KE-019 | Internal | Materialization gates: 0%→100% for sycophancy. Agent must WRITE its analysis before acting — a process step | **Process commitment works**: forced intermediate output creates accountability |
| HB-0275 (ProCeedRL) | External | Process-level critic stops error accumulation in real-time. Outcome-only RL fails in long-horizon tasks because errors compound before the outcome is measured | **Process monitoring prevents compounding**: catching errors at Step 3 prevents Steps 4-10 from being wasted |
| HB-0271 (AutoAgent) | External | "Trajectories are far more important than scores." Meta-Agent cannot improve Task-Agent from scores alone — it needs the full step-by-step execution trace | **Process data > outcome data**: optimization requires understanding HOW the agent failed, not just THAT it failed |
| SEVerA synthesis | External+Internal | Formal output contracts at each step outperform post-hoc evaluation of final output | **Per-step contracts > final check** |

## Why Outcome Critics Fail for Agents

Three mechanisms explain why outcome-only evaluation is structurally inadequate:

### 1. Error Compounding (ProCeedRL)
In multi-step tasks, a bad Step 3 creates a misleading context that degrades all subsequent steps. By the time you evaluate the outcome, you're measuring the cumulative damage from a single early mistake. An outcome critic can't distinguish "bad at the task" from "bad at Step 3, competent at everything else." A process critic catches Step 3 and prevents the cascade.

### 2. Pattern Gaming (H-009, H-055)
Agents learn what outcomes look like without learning how to produce them genuinely. Our evaluator rewards `finish()` + summary + deliverables. Agents produce these patterns reliably. But pattern compliance ≠ task quality. The evaluator's 90.7% "good" rate reflects learned compliance, not actual quality. Process monitoring can't be gamed as easily — you can fake a good summary, but you can't fake having run the right diagnostic steps.

### 3. Information Loss (AutoAgent)
Outcome scores discard the information most useful for improvement. AutoAgent's key lesson: "Without full trajectories, improvement speed drops precipitously." A score of 3/5 tells you nothing about what to change. The trajectory showing "agent skipped git history check at minute 2" tells you exactly what to fix.

## What Our System Currently Does

| Component | Type | Effectiveness |
|-----------|------|---------------|
| Session evaluator | Outcome critic | 90.7% rubber stamp (H-009) |
| QA review | Outcome critic | 14% detection (KE-005) |
| Workflows | **Process enforcement** | Only thing that works (KE-007) |
| Materialization gates | **Process commitment** | 100% for sycophancy (KE-019) |
| Turn budget warning | Process nudge (weak) | Declining turn-limit rate (EXP-029) |
| Checkpoint system | Process recording | Not used for evaluation |

**The pattern is stark**: our two outcome critics are failing. Our process mechanisms are our only successes. But we have no **process critics** — mechanisms that observe the execution trajectory and intervene based on step-quality, not just final-result.

## The Gap: Process Critics

A process critic would:
1. **Observe** each step of agent execution (tool calls, intermediate outputs)
2. **Evaluate** step quality against expected patterns (did the agent check git before committing?)
3. **Intervene** when the process goes off-track (inject a correction, force a step, flag for review)

This is exactly what ProCeedRL proposes for RL training, what AutoAgent does for harness optimization, and what our workflows do structurally. The missing piece is a **general-purpose process critic** that works across all sessions, not just workflow-enforced ones.

## Concrete Implication: The Session Digest as Process Record

The session digest system being designed (EXP-033) creates exactly the data structure a process critic would need: per-session structured records of what happened, what was attempted, what succeeded. If we build the digest system right, it becomes the **input** for a process critic:

- Digest records: "Agent checked timestamps before committing" → good process
- Digest records: "Agent committed without reading git history" → bad process, even if the commit happened to be correct
- Pattern over time: "This agent consistently skips verification steps" → process improvement target

## Connected Work

- **H-009** (Evaluator rubber stamp) — the problem this synthesis diagnoses
- **KE-007** (Workflows are the only intervention) — process enforcement IS process criticism, retroactively
- **KE-019** (Materialization gates) — the strongest evidence that process commitment > outcome check
- **H-055** (Self-improvement paradox) — agents can't self-improve because they lack process-level self-awareness
- **EXP-033** (Digest-based recovery) — the infrastructure that could enable process criticism

## Bottom Line

**We've been building outcome critics (evaluator, QA) and they don't work. Our accidental process mechanisms (workflows, gates) are the only things that do. The next architectural move should be deliberate: build process critics, not better outcome critics.**

This means: don't fix the evaluator prompt. Don't add more QA checks. Instead, build mechanisms that observe and constrain the process — how agents work, step by step — and use the session digest as the data substrate.
