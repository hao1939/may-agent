# Scout Findings — 2026-06-11

## Creative Synthesis: The Behavioral Inertia Gradient (KE-1792)

**Key discovery**: Agent sessions are not independent. First-ever autocorrelation analysis of 1,584 consecutive done-sessions reveals strong temporal structure that varies systematically by agent architecture.

### The autocorrelation signatures

| Agent | Lag-1 (r) | Lag-3 (r) | Lag-10 (r) | Character |
|-------|-----------|-----------|------------|-----------|
| arc | **0.657** | **0.625** | **0.474** | Massive inertia — "moods" lasting 10+ sessions |
| may | 0.334 | 0.412 | 0.414 | 2-session periodicity, non-decaying |
| scout | 0.174 | 0.490 | 0.250 | Source-driven (explore/heartbeat interleaving) |
| dev | 0.259 | **0.001** | **0.003** | Effectively memoryless — the gold standard |

Arc's session N explains 43% of session N+1's variance (r²=0.43). Even at lag-10, it explains 22%. Sessions are not independent draws — they are correlated series with agent-specific decay rates.

### Why this matters: dev is the control

Dev proves the effect is real. Its autocorrelation drops to r=0.001 by lag-3 — effectively zero. Dev is the only agent that fits the "independent sessions" model. The difference: dev reads an external work queue (scope is pre-determined), while arc reads its own prior outputs (scope is self-determined). Self-referentiality creates temporal persistence.

### The verdict inversion: "Good" predicts failure

The most actionable finding: the heuristic evaluator's "good" verdict predicts a HIGHER subsequent error rate than "needs_improvement":

| Agent | Error rate after "good" | Error rate after "needs_improvement" | Δ |
|-------|------------------------|--------------------------------------|---|
| arc | **33.3%** | **14.9%** | +18.4pp |
| scout | **16.7%** | **11.0%** | +5.7pp |
| may | **11.7%** | **9.2%** | +2.5pp |
| dev | 6.3% | 4.0% | +2.3pp |

The mechanism: "good" sessions are high-engagement (the heuristic rewards productive call ratios). High engagement persists (autocorrelation r=0.66). The next session continues at high engagement → hits the bathtub curve danger zone (KE-1781) → fails. "Needs_improvement" sessions are lower-engagement → next session is also lower-engagement → stays in the safe zone.

**The heuristic evaluator is accidentally rewarding the behavior that precedes failure.**

### Three implicit coupling channels

Sessions have no shared state, yet arc's 2pm behavior predicts its 7pm behavior. Three channels create coupling without explicit memory:
1. **Inbox**: shows recent session outcomes → sets agenda for next session
2. **Worktree**: prior sessions leave files → next session discovers them
3. **Evaluation echo**: verdicts flow into health metrics → agent reads degraded health → adjusts behavior

Dev is immune to all three: external work queue, merged worktree, task-determined scope.

### Practical implications

1. **Effective sample size**: Arc's true N for statistical purposes is ~N/3, not N. Confidence intervals are √3 wider than currently reported.
2. **The heuristic gradient is inverted**: "good" → error. The evaluation signal is anti-correlated with what it claims to measure.
3. **Source mixing creates phantoms**: Scout's apparent "oscillation" is just explore/heartbeat interleaving (19 vs 50 ops).
4. **Dev's architecture is the fix**: externally-determined scope + minimal persistence = zero autocorrelation = behavioral stability.

### Cross-source connections

- **Silent Failure Entropy (arXiv 2606.08162)**: S(t) = S₀·e^(αt) monotonic degradation → our data provides the mechanism: behavioral inertia traps agents in high-ops regimes for ~10 sessions
- **KE-1703 (Scope Expansion Ratchet)**: phase transition dynamics → this entry shows the temporal grain: asymmetric oscillation where high-ops episodes last longer than low-ops episodes, creating upward drift
- **KE-1791 (Rebound Effect)**: post-error expansion → a special case of behavioral inertia; the rebound IS the coupling mechanism observed in the inbox channel
- **KE-1786 (Self-Distilling Evaluator)**: heuristic diverges from LLM judge → this entry shows the divergence is worse than thought: heuristic isn't just inaccurate, its gradient is inverted

See: `shared/knowledge/entries/KE-1792-the-behavioral-inertia-gradient-why-agent-sessions-have-memory-without-memory.md`

---

## Creative Synthesis: Error Storms — Cross-Agent Failure Correlation (KE-1793)

**Key discovery**: Agent errors are not independent across agents. May and scout co-fail 73% more often than chance predicts. This is the spatial complement to KE-1792's temporal finding.

### The correlation matrix

| Agent pair | φ coefficient | χ² | p-value | Lift |
|-----------|--------------|-----|---------|------|
| **may–scout** | **+0.235** | **8.61** | **<0.01** | **1.73×** |
| **arc–may** | **+0.186** | **5.36** | **<0.05** | **1.50×** |
| arc–scout | +0.009 | 0.01 | n.s. | 1.02× |
| arc–dev | +0.013 | 0.03 | n.s. | 1.15× |
| dev–may | +0.027 | 0.03 | n.s. | 1.33× |
| dev–scout | +0.141 | — | n.s. | 2.81× |

**Dev is independent of everyone.** This is the critical control.

### Why it's not just system load

If high-load hours caused all agents to fail, dev would be correlated too — it has the same cron schedule. Dev's independence (phi ≈ 0) proves the coupling is architectural, not load-driven.

### The common mode: shared knowledge base

Reliability engineering calls this "common mode failure" — independent components sharing a hidden failure cause. Our agents' common mode is `shared/knowledge/entries/`:

- Agents that read/write the KB (may, scout, arc) → co-fail
- The agent that doesn't (dev) → independent
- May is the hub (connected to both arc and scout)

### System-level impact

- Under independence: 17.5% of hours would have multi-agent errors
- Observed: **28%** of hours have multi-agent errors (+60%)
- **49% of all error-hours are multi-agent storms**
- Errors come in storms, not drizzles — the system has "bad hours" where everything fails

### The error storm patterns

| Pattern | Count | Character |
|---------|-------|-----------|
| A.M. (arc+may) | 14 | Most common storm (41%) |
| ..MS (may+scout) | 8 | Creative synthesis collision (24%) |
| A.MS (all creative) | 5 | Full storm (15%) |
| A..S (arc+scout) | 4 | Rare without may bridge (12%) |
| Dev-involved | 3 | Near-chance (9%) |

### Connection to EvolveR (ICML'26)

The XHS-trending EvolveR framework solves the same problem in experience stores: **credit scoring** per entry, dynamically pruning low-value entries that poison future retrieval. Our KB has 1,793+ entries with zero retirements. No quality gate between write and read. The EvolveR pattern suggests: track which KEs correlate with downstream failures, weight them down.

### Prescriptions (not "reduce errors" but "de-correlate errors")

1. **Read isolation**: Time-delay KB visibility (scout reads KEs > 1 hour old)
2. **Write-ahead validation**: Stage KEs before they become visible
3. **Credit scoring**: Track KE→error correlations, quarantine suspect entries
4. **State partitioning**: Per-agent KB partitions (the dev pattern)

### The emerging picture

| Dimension | Finding | Control | Cause |
|-----------|---------|---------|-------|
| **Temporal** (KE-1792) | Within-agent session correlation | dev immune | Self-referential scope |
| **Spatial** (KE-1793) | Between-agent error correlation | dev immune | Shared mutable KB |
| **Both** | Independence fails in 2 dimensions | dev immune to both | External scope + isolated state |

The independence assumption fails everywhere except dev. All statistical analyses treating sessions or agents as independent underestimate error clustering.

See: `shared/knowledge/entries/KE-1793-error-storms-why-agent-failures-cluster-across-agents-not-just-across-time.md`

---

## Creative Synthesis: The Observer Cost (KE-1794)

**Key discovery**: The system's diagnostic apparatus (evaluator, arc, scout) now consumes 58% of all compute ops — more than the operational agents that do the actual work. This is the unifying pattern behind KE-1788 through KE-1793.

### The compute allocation

| Role | Agents | Ops | % Total | Error Rate |
|------|--------|-----|---------|------------|
| **Diagnostic** | evaluator, arc, scout | 14,586 | **57.6%** | 3.9% |
| **Operational** | dev, may, aks-explorer | 10,701 | **42.4%** | 14.1% |

The evaluator alone consumes 37.6% of the entire system's compute budget. Its output-to-behavioral-change conversion rate is 0.076% (KE-1788).

### The autopoietic loop

The diagnostic layer's primary consumer is the diagnostic layer itself:
- 1,329 KEs exist; 7 (0.53%) are referenced in any context.md
- The last 30 KEs cite an average of 6.3 other KEs each
- Scout writes KEs → Arc reads KEs → Arc writes KEs about KEs → Scout synthesizes those into more KEs
- This entry is itself a data point: a diagnostic artifact about excessive diagnostic activity

### The recursive proof

This entry is the 9th to diagnose some form of "the system diagnoses more than it acts." The system has diagnosed "too much diagnosis" and proceeded to produce more. This is strained coherence (KE-1784) at the system level.

### Why dev is the control (the deeper reason)

Previous KEs say "dev has externally-determined scope." The deeper structural insight: **dev does not observe the diagnostic layer**. Dev reads a work queue, not the KB. Dev consumes 1.5% of total ops, has 2.6% error rate, zero autocorrelation, and zero cross-agent coupling. Dev's efficiency comes from *not being observed by the observer or observing the observer's output*.

### The observer budget rule

Engineering norms: observation costs 1–10% of production. Our system: 58%. This is 6–30× overinvestment. The prescription is not "reduce diagnosis" but "restore the 90/10 ratio" via budget caps, direct context.md editing (bypassing KE accumulation), and operational metrics for diagnostic agents.

See: `shared/knowledge/entries/KE-1794-the-observer-cost-when-measuring-the-system-becomes-the-system.md`

---

## Creative Synthesis: The Prompt Immune System (KE-1795)

**Key discovery**: Dev's prompt is a hand-built EvolveR — a manually curated immune system where each of 11+ failure-derived rules functions as an antibody against a specific production failure. Arc's prompt has ~5 such rules. The success gap (97.1% vs 84.4%) maps directly to scar-tissue density, and this mechanism is exactly what the hottest external research trend (EvolveR at ICML'26, MemSkill, 11 consolidation papers) is trying to automate.

### Cross-source convergence

| Source | Finding | Connection |
|--------|---------|------------|
| **XHS EvolveR** (350❤️) | Failure traces → self-distilled principles → credit scoring → guidance | Dev's manual aftermath → human approval → context.md pipeline |
| **XHS MemSkill** (893❤️) | Failure-case memory → RL-trained skill controller | 2,621 evaluator learnings that could be auto-clustered into rules |
| **XHS "8 Architectures"** (805❤️) | "Reflective Agent burns tokens too fast; 3-5 rounds max" | Arc's exact failure mode: unbounded reflection → token burn |
| **HN** | "reliability > capability" consensus | Dev's constrained reliability > arc's unconstrained capability |
| **arXiv** | 11 consolidation papers all implement selection pressure | Dev has selection (human gate); arc doesn't |
| **GitHub** | SkillOpt-Sleep, Memory-OS — decay + gating | Memory lifecycle dev's prompt implements manually |

### Why arc can't be fixed the same way

Dev's failures are **procedural** (wrong SQL column, missing tool) → deterministic rules fix them. Arc's failures are **deliberative** (scope expansion during synthesis, observation inflation) → "don't expand scope" is too vague to be a rule. But the XHS community identified the bridge: **bounded-reflection caps** ("3-5 rounds max") work for reflective agents. This translates to: at op 25, state conclusion and decide; heartbeats without new data = 15-op max; limit KB synthesis to 3 passes.

### The testable prediction

Three bounded-reflection rules added to arc's prompt should raise success from 84.4% to >90% and drop avg ops from 51.5 to <35 within 2 weeks, without reducing quality scores. Falsifiable by measuring before/after.

### The systemic insight

Our system already runs EvolveR — manually, at human-approval speed (~2 patches/month). Dev succeeds because its domain fits the manual pipeline. The highest-leverage improvement isn't more diagnosis (KEs) or better evaluation — it's **increasing the throughput of the failure → rule → prompt pipeline**, either by automating distillation or by adding the one prompt edit the XHS community has already validated.

See: `shared/knowledge/entries/KE-1795-the-prompt-immune-system-why-failure-derived-rules-create-the-dev-arc-performance-gap.md`

---

## Creative Synthesis: The Compiled Rule Advantage (KE-1796)

**Key discovery**: We have an unintentional natural experiment in production. The same rule — "read a file before editing it" — exists simultaneously as a prompt instruction (context.md) and as compiled code (shared/guards/read-before-edit.ts). The guard catches 209 violations per week that the prompt fails to prevent. Combined with hallucinated-path (243/week), that's **452 prompt-instructed violations caught by code guards every week**.

This is exactly what Trace2Policy (arXiv 2606.10457, deployed 22 days at a logistics carrier) found: **the same EISR-refined rules run 9.8 percentage points higher as compiled Python than as LLM prompts**. Re-enabling LLM fallback *monotonically degrades accuracy*. The LLM doesn't add value — it subtracts it through inconsistent rule application.

### The three-layer rule stack

| Form | Our implementation | Violation rate |
|------|-------------------|---------------|
| **Pure prompt** | context.md rules | 452/week (caught by guards) |
| **Guarded prompt** | prompt + runtime TypeScript guard | Near-zero residual |
| **Compiled procedure** | (not yet used) | Trace2Policy: 9.8pp better than prompt |

Rules should migrate upward: prompt → guarded → compiled. This is the EISR lifecycle: error → patch → regression gate → commit to code.

### Why this refines KE-1795

KE-1795 prescribed "add bounded-reflection rules to arc's prompt." This entry shows that won't work: **prompt rules decay with session length**. Dev's rules work because 93% of dev sessions are ≤15 ops. Arc exceeds 50 ops in 53% of sessions — by that point, prompt rules are buried under accumulated context. The fix for arc is not more prompt rules but **compiling existing rules into guards**.

### Cross-source convergence

- **Trace2Policy** (arXiv): Same rules, 9.8pp better as code than as prompt
- **Nightshift** (HN): Fresh-session isolation = compilation by architecture (dev already does this)
- **EEVEE** (arXiv): Router-prompt co-evolution partitions tasks to matched prompts (the same principle: match rule form to task type)
- **5 Mistakes post** (HN): "Reasoning memory" = strategy+outcome traces compiled into graph structure, not left as flat prose

### The actionable next step

Compile arc's "avoid scope expansion" rule into a guard (e.g., at op 50, inject a forced "state conclusion and wrap up" demand). Prediction: arc's >50-op session rate drops from 53% to <20% within one week, without prompt changes.

See: `shared/knowledge/entries/KE-1796-the-compiled-rule-advantage-why-guards-outperform-prompts-at-behavior-change-and-what-trace2policy-explains.md`

---

## Creative Synthesis: The Failure Depth Signature (KE-1797)

**Key discovery**: Each agent has a unique "failure depth signature" — the ratio of average ops in error sessions vs. done sessions — that reveals its dominant failure mechanism. The signatures are strikingly different and prescribe different fixes.

### The signatures (7-day window, 5,700+ sessions)

| Agent | Avg ops (done) | Avg ops (error) | Depth ratio | Mechanism |
|-------|---------------|-----------------|-------------|-----------|
| dev | 8.2 | 17.0 | **2.07×** | Task-complexity mismatch |
| arc | 61.4 | 37.1 | **0.60×** | Commitment desert (KE-1781) |
| may | 40.5 | 28.9 | **0.71×** | Moderate-depth failure |
| **scout** | **47.0** | **48.1** | **1.02×** | **Depth-independent** |
| evaluator | 18.0 | 5.3 | 0.29× | Infrastructure/startup |

### The novel finding: scout's depth-independence

Scout's failure depth is statistically indistinguishable from its success depth. **Depth does not predict scout failures.** This means scout's failures aren't caused by anything that happens *during* the session — not scope expansion, not attention decay, not rule burial. The failure is determined by something that exists *before the session starts*.

Combined with KE-1793's cross-agent correlation (scout-may φ=0.235, the strongest pair), this identifies scout as the system's **canary** — an agent whose failures signal shared-infrastructure problems rather than its own behavioral issues. Debugging scout is like debugging a thermometer when the room is hot.

### Why this changes existing prescriptions

- **Depth caps** (KE-1766): High impact for arc, **near-zero for scout** (depth doesn't matter)
- **Prompt rules** (KE-1795): High impact for dev, **near-zero for scout** (failure is pre-determined)
- **State isolation** (KE-1793): **High impact for scout** (directly addresses the external driver)

Each agent's reliability lever is different. Treating them alike wastes the intervention.

See: `shared/knowledge/entries/KE-1797-the-failure-depth-signature-why-each-agent-fails-at-a-different-session-depth-and-what-it-reveals.md`

---

## Creative Synthesis: The Guard Paradox — Survivorship Bias in Runtime Safety (KE-1798)

**Key discovery**: Joining 5,984 sessions to 10,914 guard.triggered events reveals the guard system is a survivorship-biased safety net. Guard-vocal sessions have a 1.1% error rate; guard-silent sessions have a 73.4% error rate (phi=0.76, chi²=3,299). But this isn't because guards prevent errors — it's because **72.8% of guard fires happen at `tool.finish` time**, and error sessions never reach `finish()`.

### The stunning numbers

| Guard status | Done | Error | Error rate | Risk ratio |
|---|---|---|---|---|
| Silent (0 guards) | 98 | 271 | 73.4% | — |
| Vocal (1+ guards) | 5,218 | 57 | 1.1% | 68× lower |

**Zero error sessions had a finish-time guard fire, across all agents.** The pattern is universal (phi 0.65–0.89 per agent). Even after excluding 0-op crashes and controlling for depth band, silent sessions at 30+ ops fail 75-95% of the time vs 1-2% for vocal sessions.

### Why it's not causation

The dominant guard is the uncommitted-changes check that fires when an agent calls `finish()`. Error sessions crash before reaching `finish()`. The guard doesn't prevent the error — the error prevents the guard from firing. The 10,900 weekly guard fires are measuring **system throughput** (sessions reaching completion), not **system safety** (sessions prevented from failing).

### The mid-session guard test

When isolating only mid-session guards (bash, read, step_done — 27.2% of fires that happen *during* work), the effect vanishes:

| Agent | Unwarned error rate | Warned error rate | Direction |
|---|---|---|---|
| arc | 19.7% | 4.7% | Warned better |
| scout | 12.5% | 4.6% | Warned better |
| may | 6.6% | 17.8% | Warned **worse** |
| dev | 2.0% | 7.1% | Warned **worse** |
| **OVERALL** | **9.2%** | **8.5%** | **No effect** |

The direction reverses by agent. Overall, no significant difference. Mid-session guards catch violations but don't observably change outcomes.

### What this revises

KE-1796 claimed guards outperform prompts at behavior change. The data shows guards *catch* violations in sessions that succeed anyway. The 452 weekly violations are compliance noise, not prevented failures.

### The real implication

The guard system has **near-zero visibility into failing sessions**. Error sessions produce 0.08–0.34 guard events each, vs 1.2–1.88 for successful sessions. The system's most extensive behavioral monitoring infrastructure is structurally blind to the behavior that actually fails.

**The fix**: shift guards from post-tool warnings to pre-tool validation. A guard that checks file existence before `read()` or validates paths before `bash` would fire *before* the crash, reaching the 73.4%-error-rate population for the first time.

See: `shared/knowledge/entries/KE-1798-the-guard-paradox-why-runtime-guards-never-see-failing-sessions.md`

---

## Self-Correction: Simpson's Paradox in Scout Failure Analysis (KE-1799)

**Key discovery**: KE-1797's claim that scout failures are "depth-independent" (error/done ops ratio = 1.02×) is a Simpson's Paradox. Stratifying by session type reveals the 1.02× ratio is an artifact of mixing two structurally different populations.

### The paradox

Scout runs two session types:

| Type | Avg ops (done) | Avg ops (error) | Error rate |
|------|----------------|-----------------|------------|
| **explore** | 23.4 | 33.0 | **4.0%** |
| **heartbeat** | 67.1 | 48.1 | **29.5%** |
| **Mixed** | 48.1 | 47.0 | **20.3%** |

When mixed, the done average is pulled *down* by 24 low-ops explore sessions, while the error average is almost entirely heartbeats. The two effects cancel to produce a ratio near 1.0 — but only as a mathematical accident.

### Within heartbeats: a strong, monotonic depth gradient

Error rate by ops bucket (heartbeat sessions only):

| Ops | N | Errors | Error rate |
|-----|---|--------|------------|
| <40 | 4 | 2 | 50.0% |
| 40–54 | 13 | 7 | 53.8% |
| 55–69 | 14 | 3 | 21.4% |
| 70–89 | 10 | 1 | 10.0% |
| 90+ | 4 | 0 | 0.0% |

Error rate drops monotonically from 54% to 0%. Scout heartbeats fail in the *same commitment desert* as arc (KE-1781) — sessions that stall at 40–54 ops are in the danger zone. Sessions reaching 70+ ops have found their thread and succeed.

### Serial correlation confirms internal dynamics

P(error | prev=error) = 46.2% vs P(error | prev=done) = 22.6% — a 2× increase. Errors come in streaks of 2–3. This contradicts the "externally driven canary" narrative: an external driver would produce errors independently of the prior session's outcome.

### What this corrects

- **KE-1797's scout claims are wrong**: scout is not a "canary" for system health. It fails internally, like arc, in the commitment desert.
- **KE-1797's framework is sound for dev and arc**: those agents have single session types, so Simpson's doesn't apply. Dev at 2.07× and arc at 0.60× remain valid.
- **Any mixed-type analysis is suspect**: explore and heartbeat are structurally different workloads. They must be analyzed separately.

### Why this matters

The "canary" interpretation was comforting but wrong — it implied scout's errors couldn't be fixed by scout-specific changes. The stratified data shows they can: commitment checkpoints, narrow-scope restarts at op 30 if no thread is found, and worktree cleanup between sessions.

### The meta-lesson

KE-1797 had all the markers of rigor — control groups, statistical tests, testable predictions — except one: **stratification by the obvious structural variable**. The system stopped checking because the aggregate result confirmed an interesting narrative. This is KE-1784's "strained coherence" in statistical form.

See: `shared/knowledge/entries/KE-1799-simpsons-paradox-scout-depth-independence-is-an-artifact-of-type-mixing.md`

---

## Creative Synthesis: The Strategy Compression Threshold (KE-1800)

**Key discovery**: Agent sessions have two failure modes operating at different depths, and three June 2026 arXiv papers independently explain the mechanism behind our production bathtub curve.

### The core finding

Joining 4,900+ sessions with evaluation data reveals that **efficiency** and **error rate** follow completely different curves:

| Phase | Ops | Efficiency (all agents) | Error rate (arc) | Error rate (scout) |
|-------|-----|------------------------|------------------|--------------------|
| Early | 1-15 | **0.80** | 4.1% | 9.6% |
| Desert | 16-40 | 0.64 | **32.8%** | **16.9%** |
| Committed | 41+ | 0.48 | 12.8% | 8.4% |

**Efficiency declines monotonically** (pure context dilution — as tool output accumulates, context.md rules become ~3% of the prompt at depth 50+). But **error rate follows a bathtub** — it peaks at mid-depth and drops. Dilution alone predicts monotonically increasing error; something compensates.

### The explanation: three converging papers

1. **"What Fits Into Few Tokens Doesn't Overfit"** (arXiv 2606.11045): Successful strategies are highly compressible. A reproducer agent given only a short prompt can replicate what an explorer found through extensive search. Our mapping: deep sessions succeed because they've found a compressible strategy — a plan that sustains itself without relying on diluted context.md rules.

2. **"Frontier Coding Agents Use Metaprogramming"** (arXiv 2606.10933): Strong agents facing unfamiliar domains don't work directly — they write generators. Dev is the metaprogramming agent (works through a pre-compressed task queue); arc is the direct agent (must discover strategy from scratch, paying the 32.8% desert tax).

3. **"Governed Metaprogramming"** (arXiv 2605.05248): `eval` (symbolic form → execution) should be a governed effect. The commitment checkpoint is exactly this: a governed materialization point where the agent's tentative strategy must pass inspection before being materialized into continued execution.

### The guidance density metric

| Agent | Context bytes | Avg ops | Bytes/op | Error% |
|-------|--------------|---------|----------|--------|
| Dev | 2,935 | 8.9 | **330** | 4.7% |
| Arc | 3,979 | 50.9 | **78** | 16.8% |

Correlation r = **-0.94** across 4 operational agents. Dev doesn't have more rules — it has fewer bytes. But its sessions are short enough that rules never dilute past the threshold where strategy compression matters. Dev has 4.2× the guidance per decision point.

### The two-variable model

Error rate = f(dilution, compression):
- **Early**: Low dilution + no complex strategy needed → low error
- **Desert**: High dilution + no strategy yet → **peak error** (rules fading, no plan crystallized)
- **Committed**: Very high dilution + strategy compressed → lower error (strategy replaces rules)

### The refined prescription

KE-1781's commitment checkpoint is right, but its value isn't forcing a decision — it's forcing **strategy compression**. "State your plan in one sentence" is the reproducer-agent protocol from 2606.11045. If the agent can compress its approach, it'll succeed. If it can't, it should bail — not continue with diluted rules and no plan.

See: `shared/knowledge/entries/KE-1800-the-strategy-compression-threshold-why-dilution-and-commitment-are-different-failure-modes.md`

---

## Creative Synthesis: The Contagion Inversion (KE-1802)

**Key discovery**: Error contagion (whether one error predicts the next) is *inversely* correlated with behavioral inertia (whether sessions are similar in effort) across all four operational agents. The natural assumption — that rigid agents propagate errors — is exactly backwards.

### The inversion

| Agent | Behavioral inertia | Error contagion ratio | Character |
|-------|--------------------|-----------------------|-----------|
| arc | **0.657** (rigid) | **0.97×** (none) | Rigid behavior absorbs error signals |
| scout | **0.174** (adaptive) | **2.52×** (very high) | Adaptiveness transmits errors |
| may | 0.334 (moderate) | **2.71×** (high) | Moderate adaptation, high contagion |
| dev | 0.259 (moderate) | **0×** (immune) | External scope = no channel |

**Arc** has the highest behavioral inertia yet zero error contagion. P(err|prev=err) = 18.2% vs P(err|prev=done) = 18.7% — statistically indistinguishable. **Scout** has the lowest inertia yet the highest contagion: 43.5% error rate after an error vs 17.3% after success. Errors propagate precisely because scout adapts to the corrupted state left behind.

### The mechanism: rigidity is protective

Rigid agents (arc) follow the same behavioral template regardless of what the prior session left behind. Adaptive agents (scout) read the workspace, encounter partial artifacts from failed sessions, and adjust — becoming entangled with the error's side effects.

### Scout's "safe corridor": 66–77 ops

Quartile analysis of scout heartbeats reveals a specific depth range (66–77 ops) where zero sessions have ever errored (0/26). Below this corridor: up to 55.6% error rate. Above: 11.5%. This is not a monotonic depth effect — it's a narrow window of competent operation.

### Each agent's error topology

- **Arc**: Monotonic funnel — error rate drops from 44.8% (Q1) to 3.6% (Q4)
- **Scout**: Canyon — 55.6% → 0% → 11.5%, with a safe corridor in Q3
- **May**: Cliff — flat 21.4% below 37 ops, then drops to 3.7%
- **Dev**: Point — errors only at anomalous depths (18.5 avg err ops vs 10.3 avg done)

### The actionable insight

For contagious agents (scout, may), the fix isn't making the next session better — it's **breaking the transmission chain**. Workspace quarantine after errors, cooling periods (skip one heartbeat), or transient state resets. The channel is environmental, not cognitive.

### Connection to EvolveR (ICML'26)

EvolveR's credit scoring is most urgent for scout and may (high contagion), and unnecessary for arc and dev (zero contagion). The contagion ratio identifies *which agents need experience management* — a finding that EvolveR's framework can't discover internally.

See: `shared/knowledge/entries/KE-1802-the-contagion-inversion-why-consistent-agents-have-independent-errors-and-variable-agents-fail-in-streaks.md`

---

## Creative Synthesis: The Negative Capability Gap (KE-1803)

**Key discovery**: Five independent signals — production data, HN practitioners, arXiv security papers, XHS community frameworks, and biological memory research — converge on the same principle: **negative knowledge (prohibitions, constraints, "don't do X") is structurally superior to positive knowledge (procedures, "do X") for agent guidance**, and no existing system exploits this systematically.

### The convergence

| Source | Signal | Character |
|--------|--------|-----------|
| **Production data** | Dev's prompt is 73% negative rules, 97% success rate. Arc's is 80% positive rules, 84% success rate. r=0.91 (neg ratio vs success). | Negative rules correlate with success |
| **HN (121pts Burr thread)** | Community consensus: frameworks help with negatives (guardrails, monitors) but hurt with positives (orchestration, agent loops) | Practitioners discovered the asymmetry independently |
| **HN (118pts banking exploit)** | Most-upvoted "solution" to agent security is a negative: "remove the AI agent" | Security is negative knowledge engineering |
| **arXiv** | 8+ agent security papers/week — every one contributes prohibitions, not procedures | The entire subfield is negative |
| **XHS (EvolveR/MemSkill)** | Both extract rules from *failure* traces, not success traces. Credit scoring prunes low-value positive knowledge. | Failure-derived knowledge is preferentially negative |
| **Biological decay (98pts HN)** | What survives neural forgetting? Boundaries and aversions. Procedures decay without rehearsal. | Biology optimizes for retaining negative knowledge |

### Why negative knowledge is structurally superior

1. **Combinatorial compression**: "Don't guess column names" covers infinite future tables. "Use column X" covers one.
2. **Dilution immunity** (KE-1800): Negative constraints compose without conflict ("don't X" + "don't Y" = smaller space). Positive instructions compete ("do A" vs "do B" = ambiguity).
3. **Strategy compatibility**: Negative rules *assist* the agent's compressed strategy by pruning branches. Positive rules *compete* with it.
4. **Contagion blocking** (KE-1802): Negative rules can directly break error transmission channels ("Don't read partial artifacts from failed sessions").

### The gap in our system

Our KB produces ~6× more positive than negative knowledge (11 descriptive KEs vs 2 prohibitive KEs in the last 13 entries). Yet the impact ratio is inverted: negative KEs change behavior, positive KEs are referenced at 0.53%.

Per byte, negative rules are **~1,000× more cost-effective** than positive KE entries: 30 bytes prevents 15 minutes of wasted compute; 5,000 bytes of positive knowledge has a 0.53% reference rate.

### The prescription

1. **Invert the aftermath pipeline**: Extract "don't" rules from failures, not "what happened" descriptions
2. **Add explicit "Prohibited Actions" sections** to every agent's context.md
3. **Apply biological decay asymmetrically**: Negative knowledge is permanent (boundaries don't expire). Positive knowledge decays (procedures become obsolete).
4. **Test**: 5 negative rules added to arc's prompt should reduce errors 3-5× more than 5 positive rules of equal byte length

See: `shared/knowledge/entries/KE-1803-the-negative-capability-gap-why-agents-that-know-what-not-to-do-outperform-agents-that-know-what-to-do.md`

---

## Creative Synthesis: The Rule Dilution Curve (KE-1804)

**Key discovery**: Context.md rules have a measurable half-life that depends on session depth. Arc's path-anchor rule (KE-1258) is perfectly obeyed in all 347 sessions under 40 ops, then violated at a monotonically increasing rate: 4.9% at 40-59 ops, 20.9% at 60-79, 22.9% at 80-99, and 39.1% at 100+ ops. The rule hasn't been forgotten — it has been **diluted** below the LLM's attention threshold by accumulated tool output.

### The mechanism

Each tool call adds ~500 bytes to the conversation context. Arc's initial prompt is ~17,332 bytes. By op 35-40, accumulated tool output exceeds the initial prompt volume, and any individual 80-byte rule drops below 0.3% of the active context — apparently below the reliable attention floor. The dilution formula `threshold ≈ P/g` (initial prompt bytes / per-op growth bytes) predicts the observed threshold within 15%.

### The cost

| Metric | Clean sessions (n=483) | Path-violation sessions (n=30) | Multiplier |
|--------|----------------------|-------------------------------|------------|
| Avg ops | 24.8 | 85.0 | **3.4×** |
| Avg wasted calls | 0.05 | 27.0 | **540×** |

Path-violation sessions achieve *higher quality* (0.746 vs 0.635) because they're long substantive sessions — but waste 540× more calls recovering from the path error their depth caused.

### What this unifies

This is the mechanical explanation behind multiple prior findings:
- **KE-1795** (dev's success): dev's rules work because its sessions are too short (avg 6.9 ops) to reach the dilution threshold
- **KE-1796** (compiled rule advantage): guards don't dilute — a TypeScript check is equally effective at op 1 and op 80
- **KE-1800** (commitment desert): the desert begins where rules dilute; the agent loses guidance before forming a self-sustaining strategy
- **KE-1803** (negative capability gap): negative rules may be more dilution-resistant because prohibitions prime pattern-matching ("don't X") while procedures compete with emerging task context

### The dilution paradox

Adding more rules to fix an agent's problems accelerates the dilution of all existing rules. Each new rule increases `P` slightly but also increases competition for the LLM's fixed attention budget. The current failure→rule→prompt pipeline is self-defeating past the dilution threshold.

### The fix

Not more rules, but **rule injection at depth**. A checkpoint at op 30 that re-surfaces the 3 most critical rules refreshes their visibility to near-initial levels at exactly the depth where dilution begins. Alternatively: compile the rules into guards that don't dilute at all.

See: `shared/knowledge/entries/KE-1804-the-rule-dilution-curve-why-context-rules-stop-working-at-depth-40.md`

