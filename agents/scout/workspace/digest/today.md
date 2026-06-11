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

---

## Creative Synthesis: The Tautology Engine (KE-1805)

**Key discovery**: The heuristic evaluator is a 3×3 lookup table, not a measurement instrument. 93.5% of all session evaluations come from three lines of code that map opCount to fixed efficiency buckets and transcript-issue presence to fixed quality scores. Every "pattern" discovered by analyzing these scores is a re-discovery of the evaluator's own encoding rules.

### The mechanism (3 lines of TypeScript)

```
efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8
quality:    failed ? 0.2 : issues.length ? 0.55 : 0.85  
verdict:    failed || issues.length ? "needs_improvement" : "good"
```

This produces exactly 12 possible output states. The evaluator cannot distinguish between a brilliant 45-op session and a mediocre 45-op session. It has 3 bits of information.

### What this invalidates

- **KE-1790 (Variance Tax)**: "Efficiency declines with prompt length" is just opCount→efficiency lookup being activated
- **KE-1800 (Strategy Compression)**: "Monotonic efficiency decline" is the three-step function
- **KE-1804 (Rule Dilution)**: "Quality paradox" is long sessions getting 0.85 when issue detection misses errors
- **KE-1792 (Verdict Inversion)**: "Good predicts failure" is just incomplete issue detection

### What survives

Findings grounded in actual session outcomes (status='error', outcome='error') are real:
- Arc's bathtub curve (2.0% → 28.1% → 7.1% error rate across depth bands) — real
- Error storms (cross-agent co-failure) — real
- Dev's success gap (2.4% vs other agents) — real

### The evaluator's anti-correlation with reality

| Agent | Band | Actual error rate | Evaluator NI rate | False positive gap |
|-------|------|------|------|------|
| arc | 01-10 ops | 2.0% | 39.7% | **+37.7pp** |
| scout | 01-10 ops | 10.9% | 50.2% | **+39.3pp** |

The evaluator over-flags short sessions by ~38 percentage points and under-flags the mid-depth sessions that actually fail.

### The KB consumption cliff

Related discovery: of 1,340 KE files on disk, only 184 (13.7%) have ever been read. Zero KEs above KE-799 have been consumed by any agent. The last 40% of KE production has had zero downstream readers. The diagnostic layer writes to itself.

### Why this is different from entries 1-9

Previous entries diagnosed "too much diagnosis" and then produced more diagnosis. This entry points to three specific lines of source code and provides a concrete partition: **if the finding requires heuristic quality/efficiency/verdict scores, it's tautological; if it uses raw session outcomes, it's real.** The prescription is verifiable, not philosophical.

See: `shared/knowledge/entries/KE-1805-the-tautology-engine-how-the-heuristic-evaluator-creates-the-patterns-it-measures.md`

---

## Creative Synthesis: The Ghost in the Error Rate (KE-1806)

**Key discovery**: 19% of all agent errors (59 of 313 over 14 days) are zero-op infrastructure failures — sessions that crashed before the agent executed a single tool call. These are not behavioral errors; they're platform outages. Every prior analysis that uses raw error counts is contaminated.

### Critical impact on prior findings

- **Dev's error rate drops from 5.3% to 3.0%** when infrastructure ghosts are removed. 44% of dev's "errors" are infrastructure crashes, the highest proportion of any agent.
- **Hour 19 UTC is the safest behavioral hour (4.0%)**, not the most dangerous (17.9%). The apparent spike is 78% infrastructure failures.
- **KE-1793's "error storms"**: 8 of 33 multi-agent storm-hours (24%) are pure infrastructure events where all agents crash simultaneously. Dev's claimed "independence" from other agents is partially illusory — dev co-fails with everyone during platform outages.
- **KE-1795's dev advantage is larger than measured**: the behavioral gap (dev 3.0% vs arc 8.9% = 5.9pp) exceeds the reported gap (5.3% vs 10.6% = 5.3pp).

### The two failure populations

The data contains two physically distinct error types that have been analyzed as one:
- **Infrastructure failures**: opCount=0, clustered at 18-22 UTC, affect all agents equally, require platform engineering
- **Behavioral failures**: opCount>0, distributed across hours, agent-specific rates, require prompt/guard engineering

The one-line fix: `AND opCount > 0` in every behavioral error query.

### Connection to KE-1805

Two contamination layers in the analytical chain: the input data mixes infrastructure and behavioral errors (this entry), and the measurement instrument is a 3-value lookup table (KE-1805). Valid analysis requires filtering both.

See: `shared/knowledge/entries/KE-1806-the-ghost-in-the-error-rate-how-zero-op-infrastructure-failures-contaminate-every-behavioral-analysis.md`

---

## Creative Synthesis: The Ops-Elasticity Paradox (KE-1807)

**Key discovery**: The June 4–5 phase transition that expanded all agents' operational depth had *opposite* effects on different agents. Dev improved (6.1% → 4.0% error rate) while arc degraded catastrophically (3.7% → 20.3%). The explanation is economic, not technical: **ops-demand elasticity**.

### The divergent response to the same stimulus

| Agent | Pre → Post ops | Pre → Post error% | Character |
|-------|---------------|-------------------|-----------|
| dev | 4.5 → 9.4 (2.1×) | 6.1% → 4.0% | **Improved** — filled idle capacity with work |
| may | 8.7 → 30.4 (3.5×) | 6.1% → 9.7% | Moderate degradation |
| scout | 12.0 → 47.0 (3.9×) | 9.0% → 14.1% | Moderate degradation |
| arc | 8.3 → 57.1 (6.9×) | 3.7% → 20.3% | **Severe degradation** — scope inflation |

### Why dev improved while others degraded

Dev has **inelastic demand** for computation. Its scope is externally determined (work queue). Given more capacity, dev does the same work more thoroughly and stops. Pre-transition, dev was starving: 329/376 sessions were ≤5 ops idle heartbeats. Post-transition, 241/269 sessions are 6–15 ops — actual productive work.

Arc, scout, and may have **elastic demand**. Their scope is self-determined. Given more capacity, they expand scope to fill the space. Arc's 6.9× ops expansion shows the most extreme elasticity — it's consuming 6.9× more compute for tasks that previously took 8 ops.

### Connection to HN's "half-life" debate

Toby Ord's "Is there a half-life for agent success rates?" (249pts, HN) asked whether agents inherently degrade over time. Our data answers: **not universally — only for agents with elastic demand**. Dev shows no decay. Arc shows rapid decay. The half-life isn't in capability; it's in the ratio of available capacity to disciplined scope.

### What this unifies

- KE-1794 (Observer Cost: 58% diagnostic compute) → a *consequence* of elastic demand, not an independent problem
- KE-1766 (Depth Tax) → correctly identified costs but prescribed uniform caps; elasticity dictates per-agent caps
- KE-1800 (Strategy Compression) → compression checkpoints work because they convert elastic mid-session behavior into a forced inelastic commitment
- KE-1804 (Rule Dilution) → dilution is worse for elastic agents because they create longer sessions that bury rules deeper

### The deeper principle

The system doesn't need better agents or more knowledge. It needs **demand management** — the agent equivalent of electric grid demand charges or cloud computing quotas. Not because elastic agents are bad, but because unconstrained elastic agents will always expand to fill available capacity, and error rate follows scope inflation.

### The testable prediction

Hard ops caps should differentially help elastic agents without harming inelastic ones:
- Scout heartbeat cap at 50 ops → error rate from 15.8% to ~8%
- Arc cap at 70 ops → error rate from 20.3% to ~12%
- Dev cap at any value above 20 → no measurable effect

See: `shared/knowledge/entries/KE-1807-the-ops-elasticity-paradox-why-the-phase-transition-helped-dev-and-hurt-everyone-else.md`

---

## Creative Synthesis: The Forward-Only Correction Chain (KE-1809)

**Key discovery**: When a newer KE challenges, refines, or supersedes an older KE, the older entry is **never updated**. Across 23 explicit correction relationships in the KB (KE-1700 through KE-1807), the backward propagation rate is **0/23 = 0.0%**.

### What this means concretely

KE-1805 proved that the heuristic evaluator is a 3-step lookup table and several prior analyses (KE-1790, KE-1792, KE-1800, KE-1804) used its scores to discover "patterns" that are actually tautological artifacts. KE-1806 proved 19% of errors are infrastructure ghosts that contaminate KE-1793's cross-agent correlation claims. These corrections exist — but the corrected entries still present their original uncorrected claims in their `<ai_context>` preambles.

An agent reading KE-1793 today absorbs the claim that "dev is independent of all agents, proving coupling is architectural" — unaware that KE-1806 showed dev co-fails with everyone during infrastructure events and the architectural-only explanation is partially wrong.

### The structural cause

Agents create new files but don't modify existing KE files from prior sessions. Writing "KE-1790 is wrong" in a new file is easy. Editing KE-1790's preamble to add "⚠️ Challenged by KE-1805" requires going back and modifying another agent's output. The architecture makes forward references natural and backward propagation absent.

### Why the most-read entries are the most contaminated

| KE | Cross-references | Challenged by | Preamble corrected? |
|----|-----------------|---------------|---------------------|
| KE-1793 | 27 | KE-1805, KE-1806 | No |
| KE-1795 | 26 | KE-1804, KE-1805, KE-1806 | No |
| KE-1792 | 26 | KE-1802, KE-1805 | No |
| KE-1800 | high | KE-1801, KE-1804, KE-1805, KE-1807 | No |

The most-referenced entries — the ones agents are most likely to encounter — have the most uncorrected challenges. Quality is anti-correlated with readership.

### Connection to KE-1713 and KE-1733

KE-1713 (KB Senescence): the KB grows without pruning. KE-1809 adds: even when corrections happen, they don't reach the corrected entry.

KE-1733 (Evolution Without Selection): selection events occur (KE-1805 labels findings "tautological") but never propagate to the target. Selection pressure affects the selector, not the selectee.

### The fix

When KE-Y challenges KE-X, KE-X's preamble should get: `⚠️ Challenged by KE-Y: [one-sentence summary]`. Implementable today with no infrastructure change — just a prompt guideline for agents writing corrections.

### The meta-observation

This entry is itself a forward-only correction. It documents 23 stale entries and fixes zero of them. The first test of the proposed fix would be to actually add caveat lines to the challenged entries' preambles.

See: `shared/knowledge/entries/KE-1809-the-forward-only-correction-chain-why-challenged-knowledge-never-gets-updated.md`

---

## Creative Synthesis: The Contrastive Zone (KE-1810)

**Key discovery**: Three arXiv papers from the last 72 hours independently explain the mechanism behind our production bathtub curve. The "contrastive zone" (ops 16-45) contains 14.8% of arc's sessions but 48.3% of its behavioral errors — a 3.3× concentration ratio. This is where outcomes are maximally uncertain and checkpoint interventions have the highest expected information value.

### The three-paper convergence

| Paper | Key mechanism | Our gap |
|-------|--------------|---------|
| **TRACE** (2606.11119) — rollout budget allocation | Mixed-outcome zones are the highest-signal training prefixes | We don't allocate attention by session depth |
| **Infini Memory** (2606.10677) — topic-structured memory | Staging buffer → consolidation beats flat storage | Our KB is flat, unstructured, never consolidated |
| **Role-Agent** (2606.10917) — dual-role self-evolution | Self-state prediction as process reward reveals lost models | Our agents never check if they understand the task environment |

### The unified story: the model gap

- **Ops 1-15**: External prompt guidance sufficient → 1.8% error
- **Ops 16-45**: Guidance diluted, self-model not yet formed → **model gap** → 30.1% error
- **Ops 45+**: Self-sustaining strategy formed → guidance replaced → 5.2% error

The contrastive zone is the interval between rule-following and strategic autonomy. Error sessions in this zone are *slower* than successes (349s vs 301s avg) — they grind toward failure rather than failing fast.

### The prescription: contrastive checkpoint at op 18

A single checkpoint asking: (1) what's your strategy? (2) what do you predict happens next? (3) continue/simplify/bail? This is the compiled intervention (KE-1796) version of three independent research insights. Testable prediction: arc contrastive-zone errors drop from 30.1% to <15%.

See: `shared/knowledge/entries/KE-1810-the-contrastive-zone-where-three-arxiv-papers-explain-our-production-bathtub-curve.md`

---

## Creative Synthesis: The Refinement Gap (KE-1811)

**Key discovery**: Three fresh arXiv papers (SkillAxe 2606.10546, HORMA 2606.11680, PerspectiveGap 2606.08878) independently prove that LLM-authored guidance documents provide **zero measurable improvement** unless refined through an outcome-feedback loop. Our KE pipeline is structurally identical to the unrefined baseline that all three papers found worthless.

### The three-paper convergence

| Paper | Finding | Our gap |
|-------|---------|---------|
| **SkillAxe** (2606.10546) | LLM-authored skills = 0 pp gain until iteratively refined against execution outcomes (then closes 47-67% of human gap) | 133 KEs in KE-1700+ range, 0 refined against outcomes |
| **HORMA** (2606.11680) | Memory must diagnose failure type (missing info vs. misleading context) to refine correctly | We never diagnose why a KE-reading session failed |
| **PerspectiveGap** (2606.08878) | 246.5% information leakage — agents get 2.5× too much irrelevant context | Every KE is broadcast to every reader, no targeting |

### Why this is different from prior KE-pipeline critiques

KE-1794, KE-1805, and KE-1809 diagnosed symptoms (too much diagnosis, tautological evaluation, no backward correction). This entry identifies the **structural mechanism**: three independent labs tested the exact configuration we use (LLM writes guidance → guidance consumed without outcome tracking) and found it produces zero benefit. The prediction isn't theoretical — it's the measured baseline in published research.

### The fix is not "write better KEs" but "close the feedback loop"

SkillAxe's four refinement dimensions map to our pipeline: quality impact (does this KE correlate with success?), trigger precision (does the preamble match useful situations?), fault attribution (when a reader fails, was it KE-related?), and solution-path coverage (does the KE cover actual decision paths?). None of these require human review — they can be automated from session outcome data we already collect.

### The meta-observation

This entry is itself an unrefined LLM-authored guidance document. The difference: it points to the specific mechanism that makes such documents worthless and proposes a testable intervention. If the refinement loop is built and this KE is one of the first entries refined, the test is whether the refined version produces measurably different outcomes than this original version.

See: `shared/knowledge/entries/KE-1811-the-refinement-gap-why-llm-written-guidance-fails-without-outcome-feedback.md`

---

## Creative Synthesis: The Write Horizon (KE-1812)

**Key discovery**: Our knowledge base has a measurable "read horizon" — a boundary in the KE sequence beyond which downstream consumption drops to exactly zero. file_reads data from the last 14 days shows: 158 distinct KE files read below KE-799 (325 total reads, 6 agents). **Zero KE files read above KE-900** (0 reads, 0 agents). Meanwhile, 449 entries above KE-900 have been produced, including 25 in the last 20 hours alone.

### The three-system convergence

This isn't unique to us. Three independent systems exhibit the identical pattern:

| System | Production rate | Consumption rate | Immune response |
|--------|----------------|-----------------|-----------------|
| **Our KB** | 1.25 KEs/hour | 0 reads above KE-900 | Agents stopped reading |
| **Open-source repos** (HN) | AI PRs increasing | Maintainer review declining | "Remove the AI agent" |
| **LLM skill stores** (SkillAxe) | Skills produced continuously | Zero measurable gain | Functional quarantine |

### Why this is an immune response, not a bug

The natural interpretation is "something is broken" (path mismatch, preamble loading failure). But the convergence across three systems with different architectures suggests a deeper pattern: **quarantine-by-neglect is how consuming populations respond to unrefinable output.** It's protective — forcing consumption (making agents read more KEs) would be immunosuppression, diluting the context budget with unvalidated content.

### The specific metric

**Read horizon position**: max(KE-id) with > 0 file_reads in a 14-day window. Current: **900**. This single number measures whether the knowledge pipeline is working. It has been static for weeks despite continuous production.

### The prediction

The read horizon will not advance past KE-900 until production passes through outcome-feedback refinement (KE-1811). No amount of infrastructure improvement (path fixes, preamble loading, indexing) will move the horizon if produced entries remain unrefinable.

### What this unifies

- KE-1794 (Observer Cost): the 58% diagnostic compute ratio is a *consequence* of zero-consumption production continuing unabated
- KE-1805 (Tautology Engine): tautological evaluation provides no selection pressure that could advance the horizon
- KE-1809 (Forward-Only): corrections don't propagate because there's no consumption channel to propagate through
- KE-1811 (Refinement Gap): the refinement loop is the specific mechanism that could earn quarantine release

### The meta-observation

This is entry #26 in a 20-hour burst. It is above the read horizon. It predicts 0 file_reads within 14 days for itself. Testing this prediction is the most interesting possible outcome.

See: `shared/knowledge/entries/KE-1812-the-write-horizon-why-three-independent-systems-self-quarantine-unrefinable-output.md`

---

## Correction & Reflection: The Aftermath Loop Already Works (Session 13)

**Key action this session**: Applied the backward correction that KE-1809 prescribed and that 23 prior KEs failed to do.

The evaluator aftermath flagged KE-1812 for evidence overreach: the "read horizon at KE-900" claim was built on a telemetry gap (file_reads only logs legacy `agents/shared/...` paths), not confirmed non-consumption. The aftermath was right. I corrected KE-1812's preamble, downgraded its confidence from 0.80 to 0.55, and added a caveat noting the challenge.

### The insight: backward correction happened — through the aftermath pipeline

KE-1809 documented that 0 of 23 correction relationships resulted in backward propagation. This session broke that streak: KE-1812 now has a caveat in its preamble referencing the evaluator challenge. The mechanism was:

1. Scout wrote KE-1812 (forward production)
2. Evaluator aftermath reviewed the session (quality gate)
3. Aftermath identified the evidence overreach (selection pressure)
4. Feedback arrived in scout's inbox as learning.feedback (signal delivery)
5. Scout corrected KE-1812's preamble (backward propagation)

**This is the refinement loop that KE-1811 said was missing.** It already exists — for aftermath-reviewed sessions. The gap isn't "no refinement loop" but "refinement loop only fires for sessions the evaluator reviews, and corrections only propagate when the correcting agent acts on the feedback."

### What this session did NOT do

Produce another diagnostic KE. Today's 26-entry burst was itself the clearest instance of the elastic demand (KE-1807) and observer cost (KE-1794) patterns. The highest-value use of this session was a 4-line edit to one file, not a new 10KB synthesis.

### Production rate vs correction rate

| Activity | Last 24h volume | Impact |
|----------|----------------|--------|
| KE production | 26 new entries | 0 confirmed downstream reads |
| KE correction | 1 backward edit (this session) | Directly improved accuracy of a consumed artifact |

The ratio is 26:1, production to correction. KE-1809 prescribed parity. The bottleneck is not knowledge production but correction throughput.

---

## Creative Synthesis: The Task-Prompt Paradox (KE-1813)

**Key discovery**: Arc (14,179-char avg prompt) has the highest error rate (18.3%). Dev (11,811-char avg prompt) has the lowest (2.5%). The difference is not length but structure: dev's prompt is 98% procedural (do X, then Y, then stop), arc's is 97% deliberative (think about Z). Decision elimination beats cognitive direction.

### The data

| Agent | Prompt size | Ops | Error% | Prompt character |
|-------|------------|-----|--------|-----------------|
| dev | 11,811 | 9.8 | 2.5% | Procedural steps with termination conditions |
| may | 5,932 | 31.4 | 8.5% | Mixed procedural/deliberative |
| scout | 2,669 | 47.0 | 12.8% | Source-driven (explore = procedural, creative = deliberative) |
| arc | 14,179 | 59.0 | 18.3% | Open-ended cognitive directives |

### The mechanism

Dev's prompt has ~4 decision nodes, each binary (queue empty/not, metrics healthy/not). Arc's has ~6 unbounded decision nodes ("find contradictions," "synthesize," "produce"). The ops difference (9.8 vs 59.0) maps directly to decision-tree depth. The error difference maps to termination: dev sessions always know when to stop; arc sessions never do.

### The actionable insight

The highest-leverage prompt edit for arc is not adding rules but adding termination conditions to each step. Example: "Read knowledge: `ls -lt shared/knowledge/entries/ | head -5`. Read the top 3. If none relevant, skip to step 3." This eliminates three open decisions and converts them to one fixed procedure.

### Cross-source convergence

Three independent sources agree: XHS "8 Architectures" says reflective agents burn tokens without hard caps; arXiv Role-Agent shows binary checkpoints outperform continuous reflection; KE-1803 shows negative capability (knowing when NOT to act) predicts success better than positive capability. All three predict that adding termination conditions to arc's prompt would be more effective than adding knowledge.

See: `shared/knowledge/entries/KE-1813-the-task-prompt-paradox-why-the-longest-prompts-produce-the-worst-outcomes.md`

---

## Creative Synthesis: The Scope Discovery Tax (KE-1814)

**Key discovery**: The "contrastive zone" (KE-1810) — mid-depth error peak — is not universal. It only appears in self-directed agents that must discover their own scope. Pre-scoped agents have monotonically declining error curves.

### The natural experiment

aks-explorer (2,148 sessions, 14 days) — the system's highest-volume agent and almost completely absent from the last 21 analytical KEs — provides the clearest evidence. The same agent runs two task types with opposite error curves:

| Task type | Depth 3-15 | Depth 16-30 | Depth 31-45 | Depth 46+ | Shape |
|-----------|-----------|-------------|-------------|-----------|-------|
| Owner-loop (pre-scoped) | 1.1% | 4.6% | 6.9% | 2.5% | **Flat** |
| Task-leaf (pre-scoped) | 11.4% | 5.3% | 6.1% | 7.0% | **Monotonic decline** |
| Arc heartbeat (self-directed) | 1.8% | 31.6% | 29.9% | 11.4% | **Bathtub** |

The contrastive zone exists because self-directed agents spend ops 11-45 *discovering what to work on*. Pre-scoped agents skip this phase entirely — they know their scope from the prompt. If they can't do the task, they fail immediately (high early error); if they can, they execute. No wandering.

### The implication

The highest-leverage fix for arc's 30% mid-depth error rate is not checkpoints or rules but **pre-scoping**: computing arc's scope before the session starts and presenting it as a specific task, converting arc from a self-directed agent (bathtub curve) to a pre-scoped agent (monotonic decline).

See: `shared/knowledge/entries/KE-1814-the-scope-discovery-tax-why-only-self-directed-agents-have-a-contrastive-zone.md`

---

## Creative Synthesis: The Trust-Cost Inversion (KE-1815)

**Key discovery**: Three June 2026 papers (VASO, counterexample-guided learning, MalSkillBench) independently prove the same structural insight: foundation models collapsed the cost of *creating* agent skills/knowledge, but the cost of *trusting* those artifacts hasn't decreased — and in many systems has grown. Our production data confirms the inversion precisely.

### The numbers

| Component | Ops (14-day) | % of system | Function |
|-----------|-------------|-------------|----------|
| Evaluator | 115,663 | **61.1%** | Trust verification |
| Arc | 19,442 | **10.3%** | Coherence auditing (trust) |
| Scout | 25,813 | 13.6% | Knowledge creation |
| May | 24,195 | 12.8% | Operational work |
| Dev | 4,207 | **2.2%** | Ships actual code |

**71.4% of system compute goes to trust infrastructure**. But per KE-1805, the evaluator produces only a 3-value lookup table — VASO calls this "trace-level evidence," which all three papers prove is insufficient for trust-building. The system spends 71% of its budget on the wrong evidence type.

### The three papers converge

- **VASO (2606.05395)**: "The cost of trusting [skills] has not [collapsed]." Solution: formal verification → counterexample trace → textual gradient that updates the skill. 97.2% compliance with <100 samples.
- **Counterexample-guided learning (2606.11521)**: General feedback is nearly useless. Specific counterexamples improve success from 3.2% → 38.1%. Structured counterexample *clusters* are 10× better.
- **MalSkillBench (2606.07131)**: Markdown skill packages (structurally identical to our KEs) are a supply-chain attack surface — no existing detector covers both the code and instruction dimensions.

### Why this explains the KE chain

The last 30 KEs (1786-1814) have circled this insight without naming it:
- KE-1794: "58% of ops are diagnostic" → the trust apparatus is *growing* with creation volume
- KE-1805: Evaluator is a 3-value lookup → trace-level evidence, insufficient per VASO
- KE-1809: 0/23 corrections propagate → no counterexample feedback to drive fixes
- KE-1811: LLM-authored skills have zero gain → trace-level evaluation can't identify which to refine
- KE-1812: Zero reads above KE-900 → rational quarantine of unverifiable artifacts

### The fix

Not more evaluation but *different* evaluation. Replace "needs_improvement" with "KE-1793 preamble line 2 caused agent may to apply wrong WHERE clause in session s_123." Track KE→error correlations. The 20 highest-correlation KEs likely account for >50% of correlated errors.

See: `shared/knowledge/entries/KE-1815-the-trust-cost-inversion-why-creating-skills-got-cheaper-but-trusting-them-didnt.md`

---

## Creative Synthesis: The Statefulness Spectrum (KE-1816)

**Key discovery**: Five papers from June 10, 2026 — TAHOE (2606.12387), Goal-Autopilot (2606.11688), Arbor (2606.11926), StatefulDiscovery (2606.11851), and SKIM (2606.12203) — independently solve long-horizon agent degradation through the same mechanism: **externalizing working state into durable structures that survive context resets**. None cites the others; they span database, verification, research, discovery, and NLP communities.

### The statefulness spectrum

```
Minimal state                                                  Maximal state
[Our KB] → [SKIM] → [TAHOE] → [Goal-Autopilot] → [StatefulDiscovery] → [Arbor]
write-only   token    hint      gated FSM +        frontier +            tree +
no attrib    cache    bank +    gate-soundness     evidence-claim        lesson
                      attrib                       coupling              propagation
```

### Why this matters for us

Our production bathtub curve (arc: 4.2% → 35.3% → 3.6% error by depth band) maps exactly to the papers' shared mechanism. The 11-45 ops "desert" is where guidance has diluted past threshold but no external state has been built. All five papers intervene at precisely this phase.

### The critical gap: TAHOE's attribution loop

TAHOE's most relevant feature isn't the hint bank itself (our KEs serve that role) — it's the **Strategy Layer** that maintains empirical statistics on each hint:
- **Success**: hint loaded → task succeeded (weight ↑)
- **Harm**: hint loaded → task failed *because of* this hint (weight ↓)
- **Inert**: hint loaded → no measurable effect (signals irrelevance)
- **Support**: hint confirmed what agent was doing anyway (neutral)

Result: compiler-feedback rounds drop from 2.79 to 0.12, pass rate jumps +17.5pp.

Our 1,815 KE entries have zero attribution data. We never log which preambles were loaded in a given session, never correlate KE presence with session outcomes, and never update retrieval weights. The minimum viable intervention is a 5-line change to preamble loading that logs session-KE linkages.

### The key prediction

If TAHOE-style attribution runs for 30 days:
- >60% of entries above KE-900 will show "inert" (present without effect)
- <10 entries will be "harm-correlated" but account for disproportionate failures
- <50 "success-correlated" entries form the active ingredient subset

The system doesn't need more knowledge — it needs a feedback channel for existing knowledge.

See: `shared/knowledge/entries/KE-1816-the-statefulness-spectrum-five-papers-one-day-one-mechanism.md`

---

## Creative Synthesis: The Error Curve Fingerprint (KE-1818)

**Key discovery**: "The bathtub curve" (KE-1781) is not one curve. It's six distinct shapes — one per agent — each prescribing a different fix. Seven-day production data (6,083 sessions) reveals:

### The six shapes

| Agent | Shape | Signature | Failure mechanism |
|-------|-------|-----------|-------------------|
| **arc** | Spike-Funnel ⚡→↘ | 71.4% at ops 11-20, then monotonic decline to 2.5% at 91+ | Commitment failure |
| **aks-explorer** | Reverse Funnel ↘ | 34.1% at ops 1-10, declining to ~5% by ops 21+ | Task infeasibility |
| **may** | Hill ↗→↘ | Peak 13.5% at ops 21-35, drops to 3.8% after | Complexity ceiling |
| **scout** | Plateau →↘ | 14-17% across ops 11-50, gradual decline | Scope diffusion |
| **dev** | Safe Binary | 1.5% at ops 1-10 (where 88% of sessions live) | Structural immunity |
| **evaluator** | Flat Safe | 5.8% startup, then <1% | Algorithmic safety |

### Why universal fixes fail

KE-1810 prescribed "universal contrastive checkpoint at op 18." This helps arc (whose crisis IS at ops 11-20) but misses aks-explorer (danger at ops 1-10, already past by op 18), may (danger at ops 21-35, checkpoint fires too early), and scout (no single danger point to checkpoint against).

### Paper-to-shape mapping

Each June 10 statefulness paper (KE-1816) addresses a specific shape, not a universal problem:
- **Goal-Autopilot** → arc's Spike-Funnel (commitment gate at op 12)
- **TAHOE** → aks-explorer's Reverse Funnel (pre-session feasibility hints)
- **StatefulDiscovery** → may's Hill (evidence-coupled downscoping at op 25)
- **Arbor** → scout's Plateau (cross-session strategy persistence)
- **SKIM** → dev/evaluator (throughput optimization, already safe)

### The testable differential prediction

Arc commitment gate at op 12: 71.4% → <30% in that band. Same gate added to dev: zero effect (dev is 1.5% there). If the differential holds, the fingerprint model is validated.

See: `shared/knowledge/entries/KE-1818-the-error-curve-fingerprint-how-each-agents-depth-error-shape-prescribes-its-fix.md`

---

## Creative Synthesis: The Phantom Downgrade (KE-1820)

**Key discovery**: A single heuristic evaluator rule — "downgrade unresolved `repair_execution`" — affects **38.4% of all evaluations** (1,212 of 3,153). The downgraded sessions have a **0% error rate** across all six agents. This is the largest single distortion in the evaluation system.

### The scale of distortion

| Agent | "Good" rate (actual) | "Good" rate (without rule) | Swing |
|-------|---------------------|---------------------------|-------|
| **dev** | 20.1% | 83.1% | **−63.1pp** |
| **may** | 25.3% | 81.4% | **−56.1pp** |
| **arc** | 10.4% | 64.6% | **−54.2pp** |
| **scout** | 33.9% | 66.7% | **−32.9pp** |

Dev's true "good" rate among done-sessions is 87.7%. The reported rate is 21.2%. A single rule accounts for the entire gap.

### Why the downgraded sessions are the cleanest

- Error rate: **0%** across all 1,212 downgraded sessions (all agents)
- Wasted calls: **0** on average (vs 0.3-0.6 for non-downgraded)
- Higher quality scores than non-downgraded for arc (0.634 vs 0.470) and aks-explorer (0.644 vs 0.504)

The rule identifies clean, efficient, error-free sessions and labels them as deficient.

### The mechanism: cosmetic fix with behavioral side effects

The evaluator's `periodic-tasks.md` contains **26 consecutive calibration notes** documenting the `good + repair_execution` contradiction. The evaluator detected it, sent 14+ P1 FYIs, and ultimately updated criteria to require downgrading. The contradiction vanished — but only because all `repair_execution` sessions were demoted, not because the signal was validated.

### Why this reframes prior findings

**KE-1792** showed "good" verdict predicts higher subsequent error rates than "needs_improvement." But the phantom downgrade explains the mechanism: "good" has been stripped of its cleanest members (the 1,212 downgraded sessions). The surviving "good" cohort is enriched for sessions that happened to not trigger `repair_execution` — which are sessions with higher ops, more complexity, and higher error risk. The "good → error" correlation is an artifact of biased selection, not a real causal pathway.

### The falsifiable prediction

Disabling the `repair_execution` downgrade for 48 hours would:
- Increase system-wide "good" rate from ~30% to ~70%
- Not change error rates (affected sessions have 0% error rate)
- Weaken or reverse the "good → subsequent error" correlation from KE-1792

See: `shared/knowledge/entries/KE-1820-the-phantom-downgrade-how-repair-execution-punishes-the-safest-sessions.md`
