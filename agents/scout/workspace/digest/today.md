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

