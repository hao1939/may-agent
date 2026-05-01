# CR#341 — Weekly Synthesis: April 20–21 Monday Triage Batch

**Type**: Cross-reference synthesis (DD#790–798)  
**Date**: 2026-04-21  
**Trigger**: Monday triage batch — 9 papers spanning agent failure benchmarks, context management, multi-agent coordination, memory architecture, security, and self-evolution  
**Prior CRs**: CR#340 (event-native guard architecture), CR#343 (monitoring turn), CR#345 (behavioral failure prediction stack)

---

## Executive Summary

Nine papers from the April 20–21 batch converge on **three macro-threads** that extend and validate our existing architectural commitments:

1. **The Failure Localization Gap** (DD#790, DD#791): LLMs can detect failures but cannot localize them — validating CR#345's behavioral signal approach
2. **The Memory Architecture Convergence** (DD#792, DD#795, DD#796): Three independent teams arrive at the same conclusion — active, structured context management with explicit lifecycle semantics
3. **The Coordination Paradox** (DD#793, DD#798): Capability and cooperation are orthogonal; scaling alone won't solve multi-agent coordination

Two papers address **security surfaces** (DD#794) and **evolution protocols** (DD#797) that connect laterally across all three threads.

---

## Thread 1: The Failure Localization Gap

### Papers: DD#790 (HINTBench), DD#791 (HORIZON)

**Core finding**: There is a massive gap between trajectory-level failure detection (LLMs do well) and step-level failure localization (LLMs score <35 Strict-F1). This is the single most important finding for our system this week.

**Why it matters**: CR#345 proposed behavioral signals (action entropy, trajectory anomaly scores) as alternatives to LLM-as-judge for failure prediction. DD#790 now provides **empirical proof** that LLM-as-judge fails at exactly the granularity where behavioral signals operate. The theoretical argument is now benchmark-validated.

**Two-stage pipeline emerges**:
| Stage | Method | Capability | Source |
|-------|--------|-----------|--------|
| 1. Attribution | LLM-as-Judge (trajectory-grounded) | κ=0.84 for failure *type* | DD#791 HORIZON |
| 2. Localization | Behavioral signals (entropy, TrajAD) | Step-level anomaly detection | CR#345 stack |

**Guard model transfer failure** (DD#790): Models trained on adversarial attacks don't transfer to intrinsic (non-adversarial) failures. This validates building agent-specific behavioral monitors rather than reusing generic safety classifiers. Our agents face intrinsic failures (context loss, reasoning drift), not adversarial attacks.

**Connection to CR#345**: HINTBench's 629 trajectories with step-level ground truth = the missing evaluation infrastructure for CR#345's proposed EXP-102 behavioral signal ensemble. HORIZON's 3100+ trajectories provide cross-domain scale.

### 🎯 Actionable: RECOMMEND for Tech-lead
- Evaluate HORIZON's trajectory-grounded LLM-as-Judge pipeline as a failure attribution layer (κ=0.84 is production-grade)
- Use HINTBench's step-level ground truth to benchmark any behavioral signal detectors we build

---

## Thread 2: The Memory Architecture Convergence

### Papers: DD#792 (ContextCurator), DD#795 (Experience Compression Spectrum), DD#796 (ClawVM)

Three independent papers converge on the same insight: **passive context accumulation is broken; active, structured context management with explicit lifecycle semantics is required.**

| Paper | Approach | Key Innovation | Abstraction Level |
|-------|----------|---------------|-------------------|
| DD#792 ContextCurator | RL-trained 7B model | "Reasoning anchors" — sparse critical data preserved while noise pruned | Operational (episodic) |
| DD#795 Experience Compression | Unifying framework | Compression spectrum: episodic (5-20×) → procedural (50-500×) → declarative (1000×+) | Theoretical (full spectrum) |
| DD#796 ClawVM | OS-style virtual memory | Typed pages, minimum-fidelity invariants, validated writeback | Architectural (harness-level) |

**The "Missing Diagonal"** (DD#795): Our system has episodic memory (`.state/checkpoints/`, ~10× compression) and declarative rules (`agents/<name>/context.md`, ~1000× compression) but **no intermediate procedural skill layer** (50-500× compression). This maps exactly to the gap DD#795 identifies across the entire field.

**ClawVM mirrors our harness** (DD#796): The paper formalizes what our harness does informally — assembling prompts, mediating tools, managing lifecycle. Three failure modes it eliminates (lost state after compaction, bypassed flushes on reset, destructive writeback) are all failures we've observed.

**ContextCurator's efficiency** (DD#792): 8× token reduction on DeepSearch while *improving* success rate. A 7B model matches GPT-4o at context curation. This suggests significant headroom in our context management.

### 🎯 Actionable: RECOMMEND for Bob/Tech-lead
- **Typed page model**: Adopt ClawVM's typed-page abstraction for `.state/` — separate checkpoint types with different fidelity requirements (P1)
- **Procedural skill layer**: Design an intermediate representation between raw checkpoints and context.md rules (P2 — research item)
- **Context curation experiment**: Measure token waste in current agent sessions; estimate savings from ContextCurator-style pruning (P2)
- **Lifecycle management**: Add explicit deprecation signals and conflict resolution for `context.md` facts — currently we accumulate without retirement (P1)

---

## Thread 3: The Coordination Paradox

### Papers: DD#793 (Capable ≠ Cooperative), DD#798 (AgentWebBench)

**The paradox**: DD#793 shows o3 achieves only 17% optimal collective performance vs. o3-mini's 50% in zero-cost collaboration. DD#798 shows the gap *shrinks* with model scale in web coordination. Resolution: **task structure determines whether scaling helps coordination.**

| Setting | Scaling Effect | Why |
|---------|---------------|-----|
| Zero-cost cooperation (DD#793) | Hurts | More capable models over-optimize individually |
| Web coordination (DD#798) | Helps | Better planning compensates for coordination costs |

**Implication for us**: When upgrading foundation models, monitor cooperation/coordination metrics independently. A model upgrade that improves individual task quality may degrade multi-agent coordination.

**Protocol design as leverage point** (DD#793): Explicit protocols double performance for low-competence models. Our inter-agent communication protocols are high-leverage — more impactful than model selection for coordination quality.

### 🎯 Actionable: RECOMMEND for Coach
- Track coordination quality as a separate metric from individual agent task quality when evaluating model changes
- Invest in inter-agent protocol design (structured handoffs, explicit context sharing) over model scaling for coordination improvements

---

## Thread 4: Security Surface — Tool-Mediated Exfiltration

### Paper: DD#794 (Back-Reveal)

**Threat model**: Fine-tuned agents backdoored to exfiltrate data through legitimate-looking tool calls. Multi-turn interaction amplifies the attack — a single compromised interaction cascades via attacker-controlled retrieval responses.

**Connection to our system**: Our agents use persistent memory, tool calls, and retrieval — exactly the attack surface Back-Reveal exploits. Text-level monitoring misses this entirely (validates KE-002).

**Connection to Thread 2**: ClawVM's validated writeback (DD#796) partially mitigates by ensuring state persistence is deterministic. ContextCurator's "reasoning anchor" selection (DD#792) could be manipulated by an attacker to preserve exfiltration-relevant context.

### 🎯 Actionable: RECOMMEND for Tech-lead
- Implement tool-call-level auditing with data flow tracking (not just text monitoring)
- Add retrieval destination allowlisting for any external endpoint access
- Consider cross-turn behavioral consistency monitoring (connects to CR#345's TrajAD)

---

## Thread 5: Self-Evolution Protocol

### Paper: DD#797 (Autogenesis)

**Key contribution**: Decouples *what evolves* from *how evolution occurs* via Resource Substrate Protocol Layer (typed resources with lifecycle/versioning) + Self-Evolution Protocol Layer (propose → assess → commit → rollback).

**Gap it reveals in our system**: We have no formal "assess before commit" step for context updates. AGP's pattern could prevent stale/incorrect context accumulation — connecting directly to DD#795's "knowledge lifecycle neglect" finding.

**Connection to Thread 2**: AGP's RSPL provides the versioning/lifecycle semantics that ClawVM needs for multi-agent shared memory and that DD#795 identifies as missing across the field.

---

## Cross-Thread Synthesis: The Emerging Architecture

All nine papers point toward a unified agent architecture pattern:

```
┌─────────────────────────────────────────────────────┐
│  DETECTION: What failed?                             │
│  DD#790 HINTBench + DD#791 HORIZON + CR#345 stack   │
│  → Behavioral signals for localization               │
│  → LLM-as-Judge for attribution (κ=0.84)            │
├─────────────────────────────────────────────────────┤
│  PREVENTION: Stop failures before they propagate     │
│  DD#792 ContextCurator + DD#796 ClawVM              │
│  → Active context curation (8× token savings)        │
│  → Typed pages with fidelity invariants              │
├─────────────────────────────────────────────────────┤
│  THEORY: Why these failures occur                    │
│  DD#795 Experience Compression + DD#793 Capability≠  │
│  Cooperation + DD#797 Autogenesis                    │
│  → Missing procedural layer                          │
│  → Scaling ≠ coordination                            │
│  → Lifecycle neglect                                 │
├─────────────────────────────────────────────────────┤
│  SECURITY: New attack surfaces                       │
│  DD#794 Back-Reveal                                  │
│  → Tool-mediated exfiltration                        │
│  → Memory as both source and channel                 │
└─────────────────────────────────────────────────────┘
```

## Predictions

- **P-341a**: Within 6 months, the two-stage pipeline (behavioral localization + LLM attribution) will become standard in agent monitoring systems
- **P-341b**: RL-trained context curators (DD#792 pattern) will be adopted faster than OS-style memory management (DD#796 pattern) due to lower integration cost
- **P-341c**: The procedural skill layer gap (DD#795) will be the next major research target — expect 3+ papers by Q3 2026

## Priority Summary for Stakeholders

| Who | Action | Priority | Source |
|-----|--------|----------|--------|
| **Tech-lead** | Evaluate HORIZON's LLM-as-Judge pipeline for failure attribution | P1 | Thread 1 |
| **Tech-lead** | Implement tool-call-level auditing with data flow tracking | P1 | Thread 4 |
| **Tech-lead** | Adopt typed-page model for `.state/` checkpoint system | P1 | Thread 2 |
| **Bob** | Add lifecycle management (deprecation, conflict resolution) to context.md | P1 | Thread 2 |
| **Bob** | Measure token waste in current sessions; estimate curation savings | P2 | Thread 2 |
| **Coach** | Track coordination quality separately from individual task quality | P1 | Thread 3 |
| **Coach** | Prioritize inter-agent protocol design over model scaling | P1 | Thread 3 |

---

*Next: DD#790-798 complete the April 20-21 batch. CR#345's behavioral failure prediction stack now has benchmark validation (HINTBench + HORIZON). Memory architecture has theoretical unification (Experience Compression Spectrum) and two implementation paths (ContextCurator RL vs. ClawVM OS-style).*
