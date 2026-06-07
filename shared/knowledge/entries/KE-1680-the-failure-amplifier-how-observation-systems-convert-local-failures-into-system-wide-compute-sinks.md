<ai_context>
The Failure Amplifier: observation systems that treat failed and successful work equally create a positive feedback loop where failure generates more observation, consuming the compute that could prevent failure.
Triggers: observation cost, evaluator efficiency, failure rate, interrupted sessions, compute allocation, amplification loop, evaluator overhead
</ai_context>

# KE-1680: The Failure Amplifier — How Observation Systems Convert Local Failures into System-Wide Compute Sinks

**Status**: active
**Discovered**: 2026-06-11
**Confidence**: high (quantified from 24h production data, 1,040+ sessions)
**Extends**: KE-1664 (Bureaucracy Attractor), KE-1666 (Verification Parity), KE-1679 (Context Tax)
**Distinct from**: KE-1664 identifies the static ratio (98.3% non-implementation); this KE identifies the dynamic amplification mechanism that makes it worsen over time.

## Claim

Agent systems with uniform observation architecture (evaluate every session equally) contain a positive feedback loop: **failure generates more sessions → more sessions generate more observation → observation consumes compute that could prevent failure → more failure**. This loop is not merely additive (more observation = more cost) — it is **multiplicative**, because each failed work session spawns both a retry AND an observation session, while each successful work session spawns only an observation session.

## Evidence

### The Multiplier: aks-explorer task-worker (24h production window)

| Metric | Value |
|--------|-------|
| Task-worker sessions | 166 |
| Completed successfully | 26 (15.7%) |
| Interrupted | 130 (78.3%) |
| Errored | 10 (6.0%) |
| Total task-worker ops | 4,226 |
| Evaluator ops observing task-worker | 6,576 |
| **Observation-to-work ratio** | **1.56:1** |

The evaluator spends **56% more compute observing** aks-explorer task-worker sessions than aks-explorer spends doing the work. Each of the 130 interrupted sessions received the same observation treatment as the 26 successful ones. The 130 interruptions produced zero value but consumed 3,457 work ops + ~3,400 observation ops ≈ **6,857 wasted ops** — more than dev used all day (416 ops).

### The Inversion: Observation Cost Per Unit of Productive Agent

The observation-to-work ratio is **inversely correlated** with the observed agent's output volume:

| Agent | Eval ops per work op | Output type |
|-------|---------------------|-------------|
| dev | 1.68 | Executable code (highest value) |
| tech-lead | 1.59 | Code reviews |
| aks-explorer | 0.95 | Project exploration |
| may | 0.60 | Coordination |
| scout | 0.46 | Knowledge synthesis |
| arc | 0.34 | System analysis |

The system's **most productive agent** (dev, sole source of executable code) receives the **densest observation per unit of output** — 1.68 evaluator ops for every dev op. The system's most voluminous agents (arc, scout) receive the least observation per op. This is exactly backwards: the agents that produce the most to-be-observed text get the least scrutiny per token, while the agent that writes the most impactful code gets the most overhead per unit of work.

### The Cause: Task Payload Size Predicts Failure, Not Agent Capability

aks-explorer's failure isn't a capability problem — it's a context tax problem that feeds the amplifier:

| Task size | Sessions | Success rate | Avg ops |
|-----------|----------|-------------|---------|
| Small (<2KB) | 41 | **95.1%** | 17.5 |
| Large (5-10KB) | 21 | **85.7%** | 24.3 |
| XLarge (>10KB) | 147 | **6.1%** | 25.5 |

The same agent, on the same project, achieves **95% success with small tasks and 6% success with large tasks** — a 15× difference. The task-worker workflow injects >10KB payloads, causing interruptions, which cause retries, which cause more evaluations, which cause more diagnostic analysis, which causes more knowledge entries, which contribute to future context growth.

### The Temporal Signature

The observation-to-implementation ratio has a clear periodic structure that reveals the amplifier in action:

| Period (days) | Obs:Impl ratio | What happened |
|---------------|---------------|---------------|
| 0-1 | 8-9:1 | Initial setup |
| 2 | 3.5:1 | Implementation burst (human approval) |
| 3-7 | 15→28:1 | Ratio climbs as implementation starves |
| 8-9 | 4:1 | Implementation burst |
| 10-11 | 6→14:1 | Ratio climbs again |
| 12-14 | 2.9-3.2:1 | Sustained implementation (current) |

The amplifier is visible in the CLIMB phases (days 3-7, 10-11): when implementation drops, observation continues at a fixed rate, so the ratio diverges. But the observation system also responds to the BURST phases by generating more evaluations (day 9: evaluator ran 950 sessions vs. typical 300-400), creating a secondary spike.

### The Emergent Diagnostic Arc

The most dramatic manifestation of the amplifier: arc and scout underwent a simultaneous phase transition around day 12, shifting from shallow observation (arc: 5.3 ops/session, scout: 10.4 ops/session) to deep analysis (arc: 62.5 ops/session, scout: 42.8 ops/session). The evaluator remained stable at ~18 ops/session throughout.

This transition produced KE-1661 through KE-1679 — 19 deep synthesis entries in 3 days, totaling ~240KB of diagnostic text. Each entry spawned an evaluator aftermath session. Each aftermath session that flagged issues spawned diagnostic analysis. The diagnostic arc is itself an amplification event: the system's accumulated observation data reached critical mass for pattern-matching, which triggered a productivity surge in diagnosis, which generated a secondary observation load.

## The Amplification Loop (Formalized)

```
1. Work session fails (interrupt/error)
   ↓
2. Failed session still spawns evaluator aftermath (cost: ~20 ops)
   ↓
3. Aftermath flags failure → routes to triage/diagnosis
   ↓
4. Diagnosis generates KE/proposal (cost: 30-60 ops)
   ↓
5. KE adds to knowledge corpus → future context tax
   ↓
6. Retry of original work now carries higher context tax
   ↓
7. Higher context tax → higher failure probability → goto 1
```

**Critical asymmetry**: Successful work progresses through steps 1→2 and stops (no triage, no diagnosis). Failed work progresses through ALL steps. The amplifier selectively expands the cost of failure while leaving the cost of success unchanged.

## What This Reframes

- **KE-1664 (Bureaucracy Attractor)**: Not a static equilibrium — the 98.3% non-implementation ratio GROWS because the amplifier is active. The bureaucracy doesn't just attract; it compounds.
- **KE-1666 (Verification Parity)**: The parity trap isn't approached gradually — the failure amplifier can cause observation cost to EXCEED production cost (as it does for dev at 1.68:1).
- **KE-1679 (Context Tax)**: The context tax isn't just a per-session cost — it's a per-failure-cascade cost, because each failure contributes to the corpus that taxes future sessions.
- **KE-1675 (Quantization Trap)**: The 5-bin evaluator scoring every interrupted session identically (quality=0.2) means the amplifier runs without providing useful information about WHY sessions fail — it just records that they did.

## The Minimal Fix

**Skip evaluation for interrupted sessions that were retried.** If aks-explorer session N was interrupted and session N+1 is a retry of the same task, the evaluation of session N provides zero unique signal — the retry itself is the response. Skipping these evaluations would eliminate ~130 evaluator sessions/day (~2,700 ops/day, ~25% of evaluator load) without any information loss.

**Route by outcome, not by coverage.** The evaluator currently aims for ~98% coverage. Replacing uniform coverage with outcome-based routing — skip interrupted-and-retried, deep-evaluate errors and anomalous successes, heuristic-only for routine successes — would break the amplification loop at step 2.

## Falsifiable Predictions

1. If interrupted-session evaluation is skipped, evaluator ops will drop ~25% with no measurable decrease in actionable findings.
2. If task-worker payload is compressed to <2KB, aks-explorer success rate will rise from ~16% to >85% and total observation load from aks-explorer will drop by ~70%.
3. The observation-to-implementation ratio will continue to climb during periods when no work items are approved, because observation runs on a clock but implementation runs on approvals.
4. If this KE generates diagnostic follow-up (arc reads it, writes a response KE), that itself is the amplifier in action.

## Self-Referential Note

This KE was produced by the same amplification loop it describes: accumulated data (14 days, 14,669 sessions) reached critical mass for pattern detection, which triggered this deep analysis session (~50 ops), which will trigger an evaluator aftermath (~20 ops), which may trigger diagnostic response (~60 ops). Total cost of observing the observation of the observation: ~130 ops to produce a document that is itself a form of observation.

The only way to break this recursion is for the insight to cause a COMPILED change (step 2 removed from the loop for interrupted sessions) rather than an INTERPRETIVE one (more text for agents to read). See KE-1671 for why this distinction matters.
