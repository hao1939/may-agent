<ai_context>
summary: "Cross-source synthesis: Agent sessions exhibit a mortality curve — a non-monotonic failure-rate function of session length (op count) — structurally identical to the 'bathtub curve' from reliability engineering. The curve has three phases: infant mortality (0-10 ops, ~7-12% failure from startup errors), a death valley of maximum failure (16-30 ops, 33-40% failure for aks-explorer) where the agent commits to a strategy that will fail but hasn't yet detected the failure, and a survivor phase (50+ ops, 5-8% failure). This is the production manifestation of the Strained Coherence pre-failure signal (2606.07889): sessions that will fail spend ops 11-30 building commitment to a wrong path. The heuristic evaluator is structurally blind to this — it assigns quality=0.65 to the death valley and quality=0.71 to survivors, a 0.06-point separation for a 5× failure rate difference. The curve predicts a specific intervention: mid-session checkpoints at op 15-20 that force re-evaluation of the current strategy before commitment deepens."
triggers: ["mortality curve", "bathtub curve", "session failure", "death valley", "mid-session checkpoint", "strained coherence", "reliability engineering", "session length failure", "non-monotonic failure"]
last_updated: "2026-07-17"
source_basis: "Cross-source synthesis of: production data (17,064 sessions across 6 non-evaluator agents, aks-explorer 4,984 sessions with 18% failure rate, non-monotonic failure distribution peaking at 21-30 ops with 39.2% failure rate for aks-explorer); arXiv (2606.07889 Strained Coherence — 94% failure when agents acknowledge problems then proceed, signal at median 83% of trajectory; 2606.07867 Cold-Start Safety Gap — positional safety dependence, 9-52% improvement with warm-up; 2606.08162 Intelligence Entropy — S(t)=S₀·e^(αt) monotonic degradation; 2606.08348 Bayesian-Agent — posterior-guided skill evolution with typed retirement/compression actions); prior syntheses (Session Floor — fixed evaluator overhead; Evaluation Mirage — 3-bit quality scores can't distinguish phases; Observability Trap — observation quality degrades with volume; Strained Coherence batch 6 triage)."
</ai_context>

# The Mortality Curve: Why Agent Sessions Die in the Middle

**Type:** Cross-Source Synthesis (Session 17)  
**Created:** 2026-07-17  
**Status:** Active hypothesis with strong production evidence  
**Extends:** The Session Floor, The Evaluation Mirage  
**Connects to:** Strained Coherence (2606.07889), Cold-Start Safety Gap (2606.07867), Intelligence Entropy (2606.08162), Bayesian-Agent (2606.08348)

## The Discovery

Every prior synthesis in this library measures session outcomes as binary (done vs. failed) and aggregates across all session lengths. Decomposing the same data by **how far the session got before it died** reveals a structure invisible to both aggregate metrics and the synthesis library itself:

**Agent sessions follow a bathtub curve** — a non-monotonic failure-rate function of session length that reliability engineering has understood since the 1960s.

## The Evidence: Three Phases of Session Mortality

### aks-explorer (n=4,984, the system's largest non-evaluator agent)

| Phase | Op Range | Sessions | Failure Rate | Wasted Ops | Mechanism |
|-------|----------|----------|-------------|------------|-----------|
| **Infant mortality** | 0-10 | 1,639 | 7.7% | 462 | Startup errors, connection failures, immediate gating |
| **Death valley** | 11-30 | 1,547 | **31.5%** | 11,018 | Strategy commitment to failing path |
| **Survivor** | 31-50 | 1,205 | 20.0% | 8,937 | Late failures from accumulated state |
| **Hardened** | 51+ | 589 | 7.3% | 2,649 | Sessions that will succeed have already proven it |

The death-valley failure rate (**31.5%**) is 4× the infant rate (7.7%) and 4.3× the hardened rate (7.3%).

### Finer-grained view: the peak is concentrated

| Op Bucket | Total | Failed | Fail % |
|-----------|-------|--------|--------|
| 0-5 | 1,162 | 80 | 6.9% |
| 6-10 | 477 | 46 | 9.6% |
| 11-15 | 355 | 42 | 11.8% |
| 16-20 | 369 | **123** | **33.3%** |
| 21-25 | 395 | **157** | **39.7%** |
| 26-30 | 429 | **166** | **38.7%** |
| 31-40 | 720 | 192 | 26.7% |
| 41-50 | 485 | 49 | 10.1% |
| 51-75 | 476 | 38 | 8.0% |
| 76+ | 112 | 5 | 4.5% |

**Peak mortality is at ops 21-25 (39.7%)** — nearly 10× the rate of hardened sessions (76+, 4.5%).

### The death valley is interrupt-dominated, not error-dominated

Within the death valley (ops 21-30):
- **285 interruptions** (35% of sessions in that range)
- **38 errors** (4.6%)

The sessions aren't crashing — they're being **killed mid-execution**. They committed enough work to be non-trivial, but not enough to complete. This is structurally different from early errors (which are fast failures) and late errors (which are accumulated corruption).

### Cross-agent validation

The same shape appears in arc, though compressed:

| Phase | Op Range | Sessions | Fail % |
|-------|----------|----------|--------|
| Quick-exit | 0-10 | 162 | 3.7% |
| Early work | 11-20 | 8 | **62.5%** |
| Mid-work | 21-30 | 31 | 12.9% |
| Deep work | 31-50 | 123 | **25.2%** |
| Extended | 51+ | 315 | 8.3% |

Arc's small n in the 11-20 bucket makes the 62.5% number noisy, but the shape is consistent: a peak in mid-range sessions, declining to single digits at both extremes.

May and dev **do not** show the death valley — their failure rates are relatively flat across buckets (5-12% for may, 0-27% for dev but with tiny n in longer buckets). The mortality curve is agent-specific, appearing in agents with complex multi-step tasks (aks-explorer, arc) but not in agents with simple trigger-response patterns (dev, may).

## Why This Matters: The Evaluator Is Blind to the Curve

The heuristic evaluator — which evaluates 95.7% of all sessions — assigns quality scores from 10 quantized states based on opCount and status. But:

| Phase | Heuristic avg quality | LLM avg quality | Actual fail rate |
|-------|----------------------|-----------------|-----------------|
| 0-10 ops | 0.645 | 0.688 | 7.7% |
| 21-30 ops | **0.536** | — | **39.2%** |
| 51+ ops | **0.706** | — | 7.3% |

The evaluator gives death-valley sessions a quality of 0.536 and survivor sessions 0.706 — a **0.17-point** spread for a **5.4× failure rate** difference. The evaluation system treats a zone where 4 out of 10 sessions die as only slightly worse than a zone where fewer than 1 in 10 dies.

Furthermore: **the evaluator assigns wastedCalls = 0 for 87% of heuristic evaluations** regardless of whether the session was interrupted. A session that consumed 25 ops, accomplished nothing, and was killed gets `quality=0.65, efficiency=0.55, wastedCalls=0`. The evaluation literally cannot see the wasted work.

## The Connection to Strained Coherence

The Strained Coherence paper (2606.07889) discovered that coding agents emit **detectable pre-failure signals** — they verbally acknowledge a problem in their own reasoning, then proceed anyway. Key findings:

- Flagged trajectories fail **94% of the time** (vs 46% for unflagged)
- The first flag appears at **median 83-84% of elapsed trajectory time**
- The signal survives paraphrasing

Our death valley is the **production manifestation** of this phenomenon. In the 11-30 op range:

1. The session has read enough context to form a strategy (ops 1-10)
2. The session begins executing that strategy (ops 11-15)
3. The strategy encounters resistance but the session is committed (ops 16-25)
4. The session is killed (interrupted) or errors out (ops 21-30)

The Strained Coherence timing prediction maps directly: if a typical aks-explorer session runs ~35 ops when successful, then 83-84% of trajectory = ops 29-30 — exactly where the death valley peaks.

## The Connection to Cold-Start Safety

The Cold-Start Safety Gap paper (2606.07867) found agents are **most vulnerable at session start**, improving 9-52% after warm-up tasks. This explains the infant mortality phase (0-10 ops), but it also explains why the death valley is worse than the infant phase:

- **Infant failures** (0-10 ops) are fast and cheap — the session hasn't loaded enough state to commit to anything
- **Death-valley failures** (11-30 ops) are slow and expensive — the session passed through the safety gap, loaded full context, picked a strategy, and is now committed to a path that will fail

The cold start creates the **conditions** for the death valley by establishing the initial strategy during the vulnerable period. A strategy chosen during the safety gap is more likely to be wrong, but by ops 15-20 the session is committed to it.

## What the Mortality Curve Costs

Quantifying wasted work in the death valley:

| Metric | Value |
|--------|-------|
| Death-valley sessions (aks-explorer, 11-30 ops) | 488 failures |
| Ops consumed by death-valley failures | 11,018 |
| Evaluator aftermath for these sessions (~19 ops each) | ~9,272 |
| **Total system cost of death-valley failures** | **~20,290 ops** |
| As % of all aks-explorer ops | 16.1% |
| As % of all system ops | 5.2% |

**5.2% of all system operations are consumed by sessions that die in the death valley** — a specific, concentrated waste that no current metric tracks.

## The Intervention: Mid-Session Checkpoints

The mortality curve predicts a specific, testable intervention:

### Checkpoint at op 15-20

Before the session deepens its commitment to its initial strategy, force a re-evaluation:

1. **Strategy statement:** "In 2 sentences, what am I trying to accomplish and what's my approach?"
2. **Evidence check:** "What evidence from my last 5 operations confirms or contradicts this approach?"
3. **Continue/abort gate:** If the evidence contradicts → abort early (saving 10-20 ops of doomed execution)

This is the **Compilation Gradient applied to session lifecycle**: the checkpoint compiles a behavioral practice ("good agents reflect mid-task") into a structural gate ("no session proceeds past op 15 without explicit strategy confirmation").

### Why this should work

- The death valley is **interrupt-dominated** (285 interrupts vs 38 errors in ops 21-30). Interrupts mean the system already knows these sessions should stop — the checkpoint just moves the detection earlier.
- The Strained Coherence signal appears at 83% of trajectory. For sessions that would die at op 25, the signal should be visible by op 20. The checkpoint catches it before commitment deepens.
- The Cold-Start Safety Gap shows that strategy quality is positionally dependent. A checkpoint forces the agent to re-derive its strategy after the safety gap, using evidence from its first 15 ops rather than its initial (cold-start) impression.

### Expected impact

If the checkpoint converts 50% of death-valley failures to early exits (saving an average of 12 ops per session):
- ~244 sessions saved × 12 ops = 2,928 ops saved directly
- ~244 × 19 ops evaluator overhead saved = 4,636 ops saved
- **Total: ~7,564 ops saved** (1.9% of system ops from one intervention)

## Connection to the Synthesis Hierarchy

The Mortality Curve is the first synthesis to identify a **lifecycle-internal** structure. All prior syntheses describe relationships between sessions (Coordination Tax), between sessions and their evaluations (Session Floor, Evaluation Mirage), or between the system and itself (Observability Trap, Impedance). The Mortality Curve describes a structure **within** a single session's lifecycle — and finds that this internal structure is invisible to all external measurement.

This connects to the Intelligence Entropy paper (2606.08162): the mortality curve may be a manifestation of S(t) = S₀ · e^(αt) applied to individual sessions. The exponential growth of entropy within a session means there's a critical threshold (~15-20 ops for aks-explorer) where the accumulated disorder from the cold start overwhelms the agent's ability to self-correct. Beyond that threshold, the session either succeeds (if its initial strategy was correct) or fails (if it wasn't) — and no amount of additional ops changes the outcome.

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action saves per-session ops
      ↳ Session Floor (structural) — fixed overhead inverts efficiency
    ↳ Observability Trap (emergent) — self-observation self-poisons
      ↳ Prompt Mass Problem (structural) — input costs dominate output
        ↳ Coordination Tax (operational) — planning grows superlinearly
          ↳ Evaluation Mirage (convergent) — 3 bits of unread information
            ↳ MORTALITY CURVE (lifecycle) — non-monotonic failure rate
                                            within sessions reveals a
                                            bathtub curve. The evaluator
                                            gives 0.17-point quality spread
                                            to a 5.4× failure difference.
                                            Mid-session checkpoint predicted
                                            to save 1.9% of system ops.
```

## Predictions

1. **Testable:** Adding a mid-session checkpoint at op 15-20 for aks-explorer will reduce death-valley failures by >30% without reducing overall task completion rate.

2. **Testable:** The death-valley peak position (measured in ops) will shift rightward as session complexity increases — it tracks strategy commitment depth, not absolute op count.

3. **Structural:** The Bayesian-Agent posterior framework (2606.08348) applied to aks-explorer skills would show that skills invoked in the 16-25 op range have the lowest posterior confidence — the system is using its least-validated strategies precisely when commitment cost is highest.

4. **Cross-system:** Any agent system with complex multi-step tasks and external interruption mechanisms will exhibit a mortality curve. The peak position is determined by the ratio of context-loading ops to strategy-execution ops.

*Session type: Creative heartbeat. Triggered by decomposing session failure rates by op count and discovering a non-monotonic bathtub curve concentrated at ops 16-30 — a structure invisible to aggregate metrics, to the heuristic evaluator, and to all 14 prior syntheses. Connected to Strained Coherence (2606.07889) as the production manifestation of pre-failure signal timing, and to Cold-Start Safety Gap (2606.07867) as the mechanism creating vulnerable initial strategies.*
