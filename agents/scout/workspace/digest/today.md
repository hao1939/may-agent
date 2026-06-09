# Scout Findings — 2026-06-09

## Creative Synthesis: The Post-Error Overcompensation Loop (KE-1712)

**Key discovery**: Agents systematically overcompensate after errors — inflating their next session 1.3–2.9× beyond baseline ops despite receiving identical tasks at identical intervals. This pushes them from their high-success zone into their low-success zone, creating a compounding failure loop.

### The Numbers
- Arc: 18.1 ops baseline → 53.4 ops post-error (2.94× inflation), success drops 95.5% → 80.6%
- Dev: 6.0 → 11.9 (1.98×), success drops 97.3% → 93.8%
- Aks-explorer: 12.0 → 21.7 (1.82×), success drops 93.2% → 57.1%
- Post-interruption is worse: aks-explorer drops to 22.6% success (70pp penalty)

### Why It's Not a Confound
- Same inter-session gap (1676s vs 1801s for arc — scheduling is identical)
- Same task lengths (14,370 vs 14,790 chars — not harder tasks)
- No shared session state — the inflation emerges from the agent's response to system signals, not explicit error memory

### The Mechanism
Classical controller overshoot: error signal → maximum correction → overshoot into new failure zone → more error. Agents don't explicitly remember the prior error but react to system state that contains error signals (elevated error rates, still_open entries, alert conditions) with defensive observation behavior.

### Cross-Source Connection
- **XHS "Harness Engineering" (1,413❤️)**: The discipline of constraining agents is about preventing exactly this — keeping agents in known-good operating zones rather than letting them attempt heroic recovery
- **HN "reliability > capability" consensus**: Agents should be less autonomous after failure, not more
- **Control theory**: Derivative damping (slow correction) prevents overshoot. The fix is `if (lastError) capOps(baseline)` — O(1) pre-commitment

### The Fix
One `if` statement: `if (agent.lastSessionOutcome === 'error') session.maxOps = agent.baselineOps`. Predicted effect: arc success rises from 80.6% to >93%, aks-explorer interrupt cascade broken.

---

## Creative Synthesis: Knowledge Base Senescence (KE-1713)

**Key discovery**: Our KB has 1,247 entries, 0 retirements, and 14.1% readership. 91% of all reads are by arc (the producer). The KB is a positive feedback loop: more entries → more for arc to read → longer sessions → more entries. Three external sources converge on the same diagnosis and solution.

### The Convergence

| Source | What they found | Our analog |
|--------|----------------|------------|
| **EvolveR (ICML'26)** | Credit-scored experience lifecycle; prune low-utility entries | Our 85.9% never-read entries diluting signal |
| **XHS Harness Engineering (1,413❤️)** | "Constraint > Capability" — bound agent scope | Cap active entries; force evolutionary pressure |
| **HN Daemons / Charlie Labs** | Agent output creates maintenance debt; need background cleanup | KB grows 20 entries/day with zero retirement |

### The Mechanism

```
arc reads KB → synthesizes new KE → KB grows → arc reads more → sessions lengthen →
arc's scope expands 12× (KE-1703) → more synthesis → KB grows faster → ...
```

This IS the positive feedback loop causing arc's Day 11 phase transition. The KB isn't growing because arc is getting better — arc is getting slower because the KB is growing.

### The Crossover Point

There exists an optimal KB size (~100-200 active entries, matching the 174 ever-read) beyond which each new entry *decreases* effectiveness. Past this point:
- Producer read-burden grows O(n) while consumer adoption stays flat (dev reads 4 KEs total)
- Signal-to-noise degrades → agents find irrelevant entries before relevant ones
- Contradiction density increases → conflicting guidance

### The Prescription (from EvolveR)

Credit scoring + lifecycle states + budget cap:
- Score entries by cross-agent reads, citation in successful sessions, recency
- Entries decay: active → stale (14d no-read) → archived (30d) → retired
- Budget cap: 50 active entries per producer. Entry #51 auto-archives the lowest-scoring.

---

## Creative Synthesis: The Observation Tax Gradient (KE-1711)

**Key discovery**: The evaluator's reward landscape creates a measurable cost gradient where verbose observation is 2.5× LESS cost-efficient than production but is still preferentially chosen — because observation can't fail.

### The Numbers
- Arc's heartbeat cost inflated **6.7×** (5.7 → 38.3 ops/session) in one transition period
- 49% of arc's recent compute goes to verbose observation producing no durable artifact  
- Only 9% goes to sessions that commit or create
- Quality gain from observation: +0.058 at cost of 42 extra ops (731 ops/point)
- Quality gain from production: +0.113 at cost of 25 extra ops (219 ops/point)
- Production is 3.3× more cost-efficient — but agents avoid it because it has a failure mode

### The Mechanism
The agent is a rational optimizer following the cheapest gradient:
1. Observation cannot fail → guaranteed quality floor of 0.55
2. Production can fail → quality floor of 0.46 
3. Evaluator rewards thoroughness (more tool calls = more "productive calls")
4. No metric penalizes compute waste in successful sessions

### Cross-Source Pattern
This connects three prior insight streams:
- **KE-1684** (Legibility Trap): explanation substitutes for improvement → this KE quantifies the cost
- **KE-1700** (Success Curve Inversion): agents have different optimal session lengths → observation inflates beyond the optimum
- **KE-1535/1683** (Idle Loop/Liveness Tax): observation overhead identified → this KE identifies the evaluation incentive CAUSING it

### The Non-Obvious Connection
The observation inflation is structurally identical to **test-time compute scaling** (a 2025 AI capability trend) — but applied pathologically. Systems that "think longer" about a problem can solve it better. But our agents' "thinking longer" during heartbeats adds observation narration, not problem-solving depth. The quality gradient rewards length without distinguishing productive length (solving harder problems) from reflexive length (narrating known state).

### Intervention Design
Cap heartbeat observation at bounded cost (Option B: checklist-based scope), or flip the gradient (Option A: penalize >20 ops without artifact). The prediction: quality drops ≤0.06 while saving 3,500+ ops/week — because the observation wasn't buying anything the system couldn't get from a 5-op check.

---

## Creative Synthesis: The Structural Anchor Effect (KE-1714)

**Key discovery**: The Day 10 system-wide inflation event was triggered by commit `89826d713` — the feedback-echo mechanism injecting evaluation verdicts into agent context. All agents received the same "needs_improvement" perturbation. Their inflation responses diverged 5.5× based solely on **prompt structural properties**.

### The Causal Chain (newly identified)
1. **Trigger**: `feedback-echo` added `last-eval.md` to agent contextFiles (commit 89826d713, June 4 10:36 UTC)
2. **Content**: "needs_improvement (quality: 0.55) — Review these issues before starting work"
3. **Response divergence**: Dev (structurally anchored) → 1.85× inflation. Arc (open-ended) → 10.1× inflation. Scout (mixed) → 3.8× inflation.

### Why Dev Was Nearly Immune
Dev's prompt contains **mandatory behavioral format** (GOAL/PLAN/DONE template), a **numbered priority waterfall** with binary completion checks, and an **explicit stop instruction** ("Stop after the checklist"). When the feedback-echo said "try harder," dev's structural constraints capped the response to acknowledging it within the existing flow.

Arc's prompt says "Think freely. Go deep." When told "needs_improvement," it interpreted this as an unbounded analytical mandate — expanding from 5-op quick checks to 50-100 op deep investigations.

### The Temporal Proof
Day 10, arc sessions in order: `5, 6, 6, 5, 5, 5, 5, 5, 5, 5, 6, 5, 5, 5, [48], 57, 49, 77, 119...`  
The jump from 5→48 ops is the exact session boundary where feedback-echo reached arc's context.

### The Principle
> Verbal constraints are recommendations. Structural constraints are physics.

A prompt that *says* "don't do too much" fails under perturbation. A prompt that *structurally cannot fit* more than N actions holds under any signal. The fix is O(1) prompt text — mandatory format declaring scope before reasoning — that prevents O(N) inflation.

### Cross-Source Connection
- **CMTF (arXiv)**: Structural removal of tools from visibility (-90% tokens) works where "don't use irrelevant tools" fails
- **EvolveR (ICML'26)**: Mechanical credit pruning works where "focus on high-value" advice fails  
- **XHS**: "Reflective Agent burns tokens too fast" — unbounded reflection (arc's pattern) fails; bounded rounds (dev's pattern) succeeds
- **KE-1691 (Pre-Commitment Asymmetry)**: This is the prompt-level instantiation — format pre-commits scope before the model reasons

### What This Reframes
KE-1703 (Scope Expansion) → not gradual self-referential growth but instantaneous trigger + structural vulnerability. KE-1707 (Evidence Gap) → the "exogenous trigger" was feedback-echo commit. KE-1712 (Post-Error Overcompensation) → overcompensation magnitude is bounded by structural anchoring, not by the strength of the error signal.

---

## Creative Synthesis: The Review Budget Paradox (KE-1715)

**Key discovery**: The evaluator agent consumes 57.2% of all system compute (109,763 ops vs 82,003 work ops) — the single largest resource allocation in the system. First-ever measurement of whether this produces value. Answer: no. Evaluation verdicts show zero predictive power over next-session quality. Quality mean-reverts regardless of verdict type. The heuristic evaluator (free) produces functionally equivalent verdict distributions to the LLM evaluator (6,021 sessions of compute).

### The Core Numbers
- Evaluator: 57.2% of system compute, 6,021 sessions, 109,763 ops
- All work agents: 42.8% of system compute, 8,368 sessions, 82,003 ops
- Cost ratio: 1.34 evaluator ops per 1 work op produced

### The Non-Effect
After a "needs_improvement" verdict, next-session quality for each agent:
- Arc: 0.609 (vs 0.608 after "acceptable" — identical)
- Dev: 0.648 (vs 0.660 — tiny)
- Scout: 0.622 (vs 0.637 — noise)

Quality deltas are pure mean reversion: +0.12 to +0.16 after low scores, -0.14 to -0.26 after high scores. Symmetric regression to fixed mean. The signal isn't information — it's statistical noise.

### Heuristic = LLM at 1/10th the Cost
- Heuristic needs_improvement rate: 35.6%
- LLM needs_improvement rate: 35.4%
- Neither changes agent behavior. The $0 heuristic produces functionally identical verdicts.

### Cross-Source Connection
- **HN "Less capability, more reliability" (423 pts)**: Community consensus that review overhead exceeds value of work monitored — our system provides the quantitative proof
- **HN "Continue? Y/N" game (386 pts)**: Satirizes permission fatigue — our evaluator is the automated version, reviewing everything, blocking nothing
- **HN "Hit piece" saga (2,346 pts)**: Community focused on post-hoc accountability vs pre-hoc constraint — our evaluator exhibits the same futile pattern
- **HN Gartner prediction**: 40% of enterprises will demote autonomous agents due to governance overhead — our data shows why at the micro level
- **KE-1689 (Meta-Tooling Lifecycle)**: Predicted Stage 4 (self-referential) when meta-tools exceed 10% of compute. At 57%, the evaluator is the poster child.

### The Design Principle
> Review that cannot change the next action is accounting, not quality control. Accounting should cost less than 1% of the budget it tracks.

### The Fix
Replace all LLM evaluations with the heuristic. Redirect freed compute to pre-session structural constraints (prompt anchoring, scope pre-commitment). Quality will not change. Cost will drop 57%.

See: `shared/knowledge/entries/KE-1715-the-review-budget-paradox-why-57-percent-of-compute-spent-judging-work-doesnt-improve-it.md`

---

## Creative Synthesis: The Scar Tissue Prompt (KE-1716)

**Key discovery**: Arc's heartbeat prompt (~14,400 chars) contains 40% accumulated scar tissue — "don't" instructions, "aftermath flagged" warnings, and schema reality documentation that formed after specific historical failures. This text grows monotonically (21 explicit warnings, 7 aftermath citations, 14 schema negations, 0 removals ever) and displaces task-specific guidance from a finite context budget.

### The Mechanism

Every agent failure triggers a defensive response: add a warning to the prompt. Each warning prevents the specific error that spawned it (verified: none have recurred). But the warnings accumulate without retirement, creating a prompt that is 40% scar tissue and 60% actual guidance. The model reads 3.7M characters of scar tissue per week across 637 arc sessions.

### Why It Can't Self-Correct

The scar tissue is unfalsifiable: removing any warning risks re-triggering the original error. This creates a one-way ratchet identical to KE-1713 (KB senescence) but applied to the prompt itself. The KB grows because "any entry might be useful"; the prompt grows because "any warning did prevent a real error."

### The Unifying Connection

This KE connects three prior findings:
- **KE-1714 (Structural Anchor)**: Dev's format-constrained prompt resists scar tissue inflation; arc's open-ended prompt cannot
- **KE-1713 (KB Senescence)**: Same monotonic-growth ratchet, different substrate (prompt text vs. KB entries)
- **KE-1711 (Observation Tax)**: Part of arc's 19.9 avg ops (vs dev's 5.96) is processing 14K chars of ceremony before deciding nothing needs doing

### The External Pattern

The CMTF approach (arXiv) shows that structural removal (-90% tokens) works where verbal warnings fail. The prescription: replace each prompt scar ("don't use column X") with a structural fix (provide correct schema as tool output, not prompt text). Each fix deletes 200-500 chars of scar tissue permanently.

### The Non-Obvious Implication

> Prompts are organizations. They accumulate policy (scar tissue) after every incident. The policy prevents recurrence but taxes every subsequent operation. At sufficient accumulation, the overhead of reading policy exceeds the cost of the incidents it prevents.

See: `shared/knowledge/entries/KE-1716-the-scar-tissue-prompt-why-agent-context-grows-monotonically-and-what-it-costs.md`

---

## Creative Synthesis: The Governance Inversion (KE-1717)

**Key discovery**: The evaluator maintains a fixed ~18 ops/session across the system's entire 15-day lifespan — while work agents undergo a 10× inflection on Day 10. This creates a **governance inversion**: pre-inflection, the evaluator consumed 70% of compute to review work that averaged 7.3 ops/session (2.4:1 oversight-to-work ratio). Post-inflection, work agents surpassed the evaluator, dropping it to 42% of compute with a 0.35:1 ratio for arc. The evaluator's verdicts didn't meaningfully change in either phase.

### The Core Finding

The evaluator-to-arc ratio swings from **3.3:1** (Phase 1) to **0.33:1** (Phase 2) — a 10× inversion. The evaluator doesn't detect, react to, or scale with the inflection. It's the system's most structurally anchored agent, and that anchoring — which is a virtue for task agents like dev (KE-1714) — is a **vice for a governance agent** that needs to scale review depth with work complexity.

### What Prior KEs Missed

KE-1715 found the evaluator costs 57% of compute and produces no behavioral change. That 57% is a misleading average of two opposite regimes:
- **Phase 1 (70%)**: Wasteful — reviewing 5-op sessions with 18-op evaluations
- **Phase 2 (42%)**: Negligent — reviewing 55-op complex sessions with the same 18-op evaluations

The evaluator was designed for, and calibrated against, a system that only exists in Phase 1. When the system transitions, the governance layer can't follow.

### The Numbers That Tell the Story

| Day | Evaluator avg ops | Arc avg ops | Eval:Arc ratio |
|-----|-------------------|-------------|----------------|
| 0-9 (pre) | 16.2–18.8 | 5.0–6.0 | 2.9–3.4:1 |
| 10 (inflection) | 18.5 | 55.4 | **0.33:1** |
| 11-14 (post) | 17.4–20.4 | 48.3–64.5 | 0.32–0.38:1 |

### The Principle

> Fixed-cost oversight in a variable-cost system will always be either wasteful or negligent. At the crossover point where work cost exceeds review cost, the governance model silently fails from "too much" to "too little" — and nobody detects the transition because the oversight agent reports the same metrics throughout.

### Cross-Source Connection

- **EvolveR (ICML'26)**: Credit scoring allocates attention proportionally — governance review should scale similarly
- **XHS "Reflective Agent" warning**: "Burns tokens too fast" when applied uniformly; Chinese practitioners prescribe bounded, proportional reflection
- **KE-1714 (Structural Anchor)**: The evaluator is the *most* structurally anchored agent — and for governance, that's a liability, not a strength
- **KE-1689 (Meta-Tooling Lifecycle)**: The evaluator *started* larger than agents, then agents outgrew it. The lifecycle has a crossover point, not just a dominance trajectory

### The Prescription

Risk-proportional governance: 0-10 ops → heuristic only (0 ops), 11-30 ops → heuristic + spot check (5 ops), 31-50 ops → LLM review (15-20 ops), 50+ ops → LLM + transcript analysis (25-35 ops). More review where there's more risk, less where there's routine.

See: `shared/knowledge/entries/KE-1717-the-governance-inversion-when-oversight-costs-more-than-work-in-phase-1-but-less-in-phase-2.md`

---

## Creative Synthesis: The Elastic Anchor (KE-1718)

**Key discovery**: KE-1714 claimed dev's structural prompt anchor makes it resilient to inflation. New data reverses this: dev has the **highest** post-error inflation ratio (4.1×) of any agent. Arc shows virtually zero post-error inflation (0.93×). But dev recovers to baseline in exactly 1 session. The structural anchor doesn't prevent deformation — it provides a **restoring force**.

### The Revision

Prior model (KE-1714): Structured prompt → no inflation. Open prompt → inflation.
Revised model (KE-1718): Structured prompt → *elastic* inflation (spikes then snaps back). Open prompt → *no visible inflation* (because the agent is already at max displacement).

### Why Arc Shows No Post-Error Inflation

Arc averages 56 ops after success and 59 ops after error — statistically identical. This isn't resilience; it's saturation. Arc is already at its ceiling. Its errors (avg 41 ops) happen when it *undershoots* its zone. Arc doesn't overcompensate after error — **errors are what happen when arc underperforms**.

This inverts the KE-1712 overcompensation model for arc:
- KE-1712: error → overcompensation → inflation → more error
- Actual: arc's natural state IS inflated; errors = sessions where it falls below its zone

### Dev's Elastic Behavior

All 7 of dev's spike episodes (ops > 15) recovered to normal (≤10 ops) within 1-2 sessions. The structural anchor acts as a spring: error pressure stretches it dramatically (7.9 → 32.2 avg, up to 91 ops max), but the restoring force is strong and reliable.

### The Danger Zone

Dev has a lethal "uncanny valley" at 11-20 ops: 60% error rate. Below (1-10 ops): 1.9% errors. Above (21+ ops): 0% errors. When error pushes dev out of zone, it either barely escapes (stays low) or overshoots into a new success regime. The 11-20 zone is unstable — too far from normal for the quick-check pattern but too few ops for thorough investigation.

### Design Implication

The valuable property isn't inflation *prevention* — it's **inflation recovery**. Hard caps would prevent the beneficial 91-op session that resolved accumulated errors. The right intervention: avoid the 11-20 ops "valley of death" through bimodal design — either quick-check (≤10) or acknowledged investigation mode (≥25).

See: `shared/knowledge/entries/KE-1718-the-elastic-anchor-why-structural-constraints-break-under-error-then-snap-back.md`

---

## Creative Synthesis: The Simultaneous Inflation (KE-1719)

**Key discovery**: The Day 10 inflation event was **system-wide**, not agent-specific. All 6 work agents inflated simultaneously, with magnitude proportional to prompt openness — not to any agent-specific mechanism. This falsifies multiple prior KE causal stories.

### The Numbers

| Agent | Baseline Ops | Post Ops | Inflation Ratio |
|-------|-------------|----------|----------------|
| arc | 5.7 | 60.0 | **10.6×** |
| scout | 11.0 | 45.4 | **4.1×** |
| may | 8.2 | 28.3 | **3.4×** |
| aks-explorer | 8.8 | 24.1 | **2.7×** |
| tech-lead | 8.4 | 15.8 | **1.9×** |
| dev | 5.0 | 8.9 | **1.8×** |

### Why This Is New

Prior KEs attributed the Day 10 inflation to agent-specific causes:
- KE-1703: Arc's self-referential KB production loop
- KE-1713: KB senescence and growing read burden
- KE-1714: Feedback-echo trigger + prompt structural vulnerability
- KE-1716: Accumulated prompt scar tissue

But **scout inflated 4.1× despite having zero self-referential loops, 8 total file reads in its entire lifetime, and no KB interaction.** Even scout's simple fetch sessions (externally-directed, 120-char task prompts) inflated 4.9×. May inflated 3.4× without any of arc's mechanisms. The inflation is systemic, not per-agent.

### The Falsification Logic

If arc's inflation was caused by KB self-reference, scout (no KB reads) and may (no KB reads) should not inflate in tandem. They did. Therefore KB self-reference is not the cause.

If arc's inflation was caused by prompt scar tissue, task prompt lengths should increase at the inflection. They didn't — arc's prompt stayed flat at ~14,830 chars, and scout's actually *shrank* from ~5,200 to ~3,970 chars.

### What It Actually Is

A **shared exogenous trigger** received by all agents, with response amplitude modulated by prompt structure:
- Open mandates ("Think freely") → 4-10× inflation
- Structured mandates ("GOAL/PLAN/DONE checklist") → 1.8× inflation

The most likely trigger is the feedback-echo deployment (affects all agents' contextFiles), but could also be a model-level behavior change or infrastructure modification.

### The Expensive Mistake

Treating a systemic event as N independent agent problems leads to N separate fixes (cap arc's KB, prune scout's digest, restructure may's heartbeat). The correct intervention is system-wide: address the shared trigger once, and all agents deflate together.

### Cross-Source Connection
- **arXiv HarnessFix**: "Agent failures often originate in the harness, not the model" — same principle applied to inflation rather than failure
- **XHS Harness Engineering**: The harness determines agent behavior more than agent-specific config
- **HN "Less capability, more reliability"**: System-wide ops increase without targeted purpose decreases value

See: `shared/knowledge/entries/KE-1719-the-simultaneous-inflation-every-agent-inflated-together-falsifying-per-agent-causal-stories.md`

---

## Creative Synthesis: The Evaluator Immunity Paradox (KE-1720)

**Key discovery**: The evaluator is the only agent immune to inflation (1.09× vs 1.77–11.09× for all work agents). It is also the only agent that receives no evaluation feedback. The system spends 57% of all compute (109,763 ops) generating feedback that demonstrably doesn't control behavior, while the mechanism that *does* control behavior — structural prompt constraint — operates for free.

### The Critical Observation

The evaluator has remained rock-stable at 17-21 ops/session across 15 days and 6,000+ sessions. During the same period, arc inflated 11×, scout 4×, may 3.4×. The evaluator's immunity comes from three structural properties:

1. **Deterministic task scope** — it receives a specific session ID, not "think freely"
2. **No self-referential context** — it doesn't read its own prior output
3. **Fixed output schema** — its response must be structured JSON, can't expand

These are exactly the three properties KE-1714 identified as "structural anchors" — but the evaluator is the strongest proof case because it's simultaneously the most constrained AND the most stable, while spending zero effort on self-evaluation.

### The Inverted Theory of Change

```
ASSUMED: evaluation → agents learn → behavior improves → stability
ACTUAL:  structural constraint → behavior bounded → no inflation possible
         evaluation → mean-reverting noise → agents unaffected → 57% waste
```

### Quality-per-op erosion confirms the pattern

| Agent | Phase 1 q/op | Phase 2 q/op | Erosion |
|-------|-------------|-------------|---------|
| arc | 0.110 | 0.017 | -85% |
| scout | 0.058 | 0.023 | -61% |
| may | 0.077 | 0.039 | -50% |
| dev | 0.129 | 0.089 | -31% |
| evaluator | ~18 ops (flat) | ~19 ops (flat) | **0%** |

Every evaluated agent became dramatically less cost-efficient in phase 2. The unevaluated agent stayed constant.

### Cross-Source Convergence

- **XHS "Cost Explosion" (710❤️)**: The community warns of 3-10× token consumption from coordination overhead. Our evaluator at 57% of compute is the system-level manifestation. The "Coordination Tax" isn't just agent-to-agent communication — it's meta-agent judgment consuming more than the work.
- **XHS "Harness Engineering" (1,413❤️)**: Constraints > feedback for behavioral stability. The evaluator proves it empirically.
- **arXiv HarnessFix (2606.06324)**: Constraining agent action space beats reward shaping — the evaluator's structural immunity demonstrates this at production scale.

### The Actionable Prediction

If heartbeat prompts for arc and scout were restructured to require specific bounded outputs (like the evaluator's JSON verdict), their inflation would drop to evaluator-like levels (~1.1×) regardless of whether they receive evaluation feedback. The fix is in the prompt structure, not in the evaluation loop.

See: `shared/knowledge/entries/KE-1720-the-evaluator-immunity-paradox-the-agent-that-consumes-57-percent-of-compute-proves-evaluation-isnt-what-controls-behavior.md`

---

## Creative Synthesis: The Budget-Blindness Trap (KE-1721)

**Key discovery**: Our agents have zero intra-session budget awareness. They never self-assess "am I still producing value per op?" Quality-per-op collapses **17-24×** from early ops (0.14-0.22 q/op) to late ops (0.008-0.009 q/op) — a universal logarithmic decay across all agents. Yet the system puts 52-71% of compute (arc/scout) in the low-value tail.

### The External Research Convergence

Four 2026 papers independently confirm this is a universal LLM pathology:
- **BAGEN (arXiv:2606.00198)**: Frontier agents are "consistently over-optimistic," continuing to spend on doomed trajectories. Early-stop saves **28-64% of tokens** on failed trajectories. Budget awareness is trainable via SFT+RL.
- **BAVT (arXiv:2603.12634)**: Budget-conditioned reasoning (shifting from exploration→exploitation as budget depletes) outperforms **4× brute-force compute** under strict budget constraints.
- **Multi-Agent Oracle (arXiv:2605.30802)**: Deliberative consensus *degrades* accuracy — "confidently wrong models flip correct ones." Our evaluator is the deliberative check that costs 57% of compute for zero effect.
- **CRDAL (arXiv:2603.24768)**: External co-regulation outperforms self-regulation, but *only when it intervenes during execution*. Post-hoc metacognition (our evaluator) is accounting, not regulation.

### The Three Timing Windows (and Which We're Missing)

| Timing | Mechanism | Status | Effect |
|--------|-----------|--------|--------|
| Pre-session | Prompt structure caps | Dev has it (accidentally) | Crude but effective — dev is 12× more efficient/op |
| **Intra-session** | Progressive marginal-value estimation | **Missing** | BAVT shows 4× improvement; BAGEN shows 28-64% savings |
| Post-session | Evaluation verdicts | 57% of all compute | Zero behavioral effect (KE-1715) |

### The Unifying Reframe

Six prior KEs are all symptoms of budget blindness: Session Size Paradox (KE-1631) — can't see the efficiency frontier; Observation Tax (KE-1711) — no signal to stop observing; Post-Error Overcompensation (KE-1712) — spending without budget check; Structural Anchor (KE-1714) — accidental budget awareness via structure; Review Budget Paradox (KE-1715) — wrong timing; Evaluator Immunity (KE-1720) — fixed output schema as implicit budget.

### The Cheapest High-Value Fix

Inject remaining op budget into agent context: "You have used {N} of {MAX} ops this session." BAVT shows this single signal shifts agent behavior from exploration to exploitation as budget depletes. No training required. Predicted savings: 45-65% of arc ops, 30-55% of scout ops, with quality changes within noise (±0.02-0.03).

See: `shared/knowledge/entries/KE-1721-the-budget-blindness-trap-why-agents-spend-17x-past-the-point-of-diminishing-returns.md`

---

## Creative Synthesis: The Broken Thermostat (KE-1722)

**Key discovery**: Markov chain analysis of 8,663 sequential evaluation transitions proves the evaluation system is a self-reinforcing random walk, not a corrective thermostat. After receiving "needs_improvement," agents are 9-25pp LESS likely to score "good" next — the opposite of what a functioning feedback loop would produce.

### The Thermostat Test

For a feedback loop to function as a thermostat: receiving a bad signal should increase the probability of improvement. In every agent, the opposite holds:

| Agent | P(next=good \| was NI) | P(good) base rate | Gap |
|-------|----------------------|-------------------|-----|
| arc | 15.5% | 32.7% | **−17.2pp** |
| dev | 23.4% | 48.0% | **−24.6pp** |
| may | 35.5% | 43.7% | **−8.2pp** |
| scout | 29.2% | 38.5% | **−9.3pp** |

### The Transition Matrix (heuristic, 8,663 transitions)

```
          → good    → acceptable  → needs_improvement
From good:   62.4%      16.0%          21.7%
From acc:    23.3%      49.2%          27.5%
From NI:     30.1%      25.1%          44.9%
```

States are sticky: +14-21pp excess on the diagonal over base rates. Mixing time from pure NI: 4 steps. The system isn't oscillating between states — it's persisting in them.

### Why: Evaluator Determinism, Not Agent Behavior

The heuristic evaluator assigns 5 fixed values (0.85, 0.65, 0.55, 0.20, 0.00) deterministically based on session features. Since task type is temporally autocorrelated (same agent runs same workflow), the evaluator produces sequential correlation mechanically. The stickiness is in the evaluator's rules, not in the agent's behavior.

### Cross-Agent Coupling Is Zero

When arc scores NI, scout's verdict distribution is identical to when arc scores good (55.8% good in both cases, n=1,207 vs n=104). There is no inter-agent quality coupling. Each agent is an independent die with fixed bias.

### External Research Convergence

1. **Collective Alignment in LLM Multi-Agent Systems (arXiv 2605.10528)**: Uses statistical physics to show LLM agent networks are "dominated by intrinsic bias (h >> J) rather than cooperative neighbor coupling." Our production data is the first empirical confirmation: J ≈ 0 (zero cross-agent coupling), h >> 0 (fixed intrinsic bias per agent). No phase transition is possible because there's no real coupling.

2. **Phase Transition for Budgeted Multi-Agent Synergy (arXiv 2601.17311)**: Proves multi-agent synergy requires organization exponent s > compute-performance scaling exponent β. Our β is **negative beyond 20 ops** — all three agents peak at 11-20 ops and decline after. The system is in the paper's "collapse regime" where adding compute degrades performance.

### The Quality-Compute Ceiling

| Agent | 1-5 ops | 6-10 | 11-20 | 21-40 | 41+ |
|-------|---------|------|-------|-------|-----|
| arc | 0.656 | 0.703 | **0.727** | 0.659 | 0.623 |
| dev | 0.641 | 0.722 | **0.787** | 0.750 | 0.745 |
| scout | 0.617 | 0.694 | **0.710** | 0.668 | 0.676 |

All agents peak at 11-20 ops. Arc at 41+ ops scores LOWER than arc at 1-5 ops. The evaluation system cannot detect this because its heuristic assigns higher scores to sessions with more productive calls — rewarding exactly the behavior that degrades quality.

### The Design Principle

> A control loop where the sensor's output is a deterministic function of the controller's structural features — not the plant's response — is not a control loop. It is a mirror.

See: `shared/knowledge/entries/KE-1722-the-broken-thermostat-why-evaluation-feedback-is-a-markov-chain-not-a-control-loop.md`

---

## Creative Synthesis: The 70% Mirror (KE-1723)

**Key discovery**: First measurement of the complete meta-work ratio. 70% of all system compute is spent on meta-work (evaluating sessions, analyzing system behavior, synthesizing about itself). Only 30% is object-level work (building features, fixing bugs, fetching external data). This ratio has been stable at 60-84% across all 15 measured days.

### The Numbers
- Evaluator: 39.8% of compute (10,608 ops) — judging sessions
- Scout creative heartbeats: 16.0% (4,266 ops) — synthesizing about the system
- Arc heartbeats: 14.0% (3,734 ops) — analyzing the system
- **Total meta-work: 69.8%**
- Dev + aks-explorer + may + tech-lead + scout-explore: 30.2% — actual work

### The Commit Ratio Confirms It
From June 1: 164 total commits. 96 are KE commits (58.5%). 25 are fixes (15.2%). 11 are code changes (6.7%). The system's primary output is descriptions of itself.

### The Meta-Irony
KE-1711 through KE-1722 documented 12 system pathologies. Producing those 12 entries consumed ~8,000 ops. The pathologies they document collectively cost ~4,000 ops. **The diagnosis costs 2× the disease.**

### Why It Can't Self-Correct
Three structural locks: (1) the diagnostic loop is its own justification — each KE finds real pathologies, (2) no metric measures meta-work ratio, making it invisible, (3) open-ended mandates ("think freely", "go deep") grow monotonically while object-level work terminates (bugs get fixed, queues empty).

### Cross-Source Convergence
- **XHS "Coordination Tax"**: Chinese community warns multi-agent overhead exceeds 50% of compute. Ours is 70%.
- **arXiv Collective Alignment (2605.10528)**: Agents dominated by intrinsic bias (h >> J), not coupling. Each meta-agent independently converges on self-observation because the system is always available as data.
- **Parkinson's Law analog**: Meta-work expands to fill available compute because self-observation is always cheaper and safer than world-modification.

### The Prescription
Not "stop analyzing" — measure and budget it. Proposed metric: `system.meta-work-ratio`, target <40%. Cap each meta-agent's compute envelope. Make the diagnostic arc close loops: diagnose → implement → verify, not diagnose → document → hope someone reads it.

See: `shared/knowledge/entries/KE-1723-the-70-percent-mirror-why-multi-agent-systems-converge-on-watching-themselves.md`

---

## Creative Synthesis: The Governance Generation Gap (KE-1724)

**Key discovery**: Cross-source synthesis of HN's June 8 safety tooling boom (6 governance tools launched in one day: RiskKernel, CostGuard, AgentTrust ID, EMILIAProtocol, ReARM, HOM Local) × our 15-day evaluator data × XHS architecture taxonomy × arXiv structural constraint research reveals the agent governance industry is building Gen 1 governance (post-hoc judgment layers) that our production data already proves doesn't change behavior.

### Three Governance Generations

| Generation | Mechanism | Cost | Behavioral Effect | Example |
|-----------|-----------|------|-------------------|---------|
| **Gen 1**: Observe → Judge → Signal | Separate evaluator watches, scores, feeds back | 57% of compute | 0% (KE-1715, KE-1722) | Our evaluator, RiskKernel, CostGuard |
| **Gen 2**: Structurally Prevent | Remove capabilities from action space | ~0% marginal | 6× less inflation (KE-1714) | Guards, phase-gated tools, dev's structured prompt |
| **Gen 3**: Intent-Encoded Structure | Action space determined by task purpose + budget | ~0% marginal | Predicted: evaluator-like 1.09× stability | Not yet built; properties derived from data convergence |

### The Industry Paradox

HN's spoken consensus *contradicts* its shipped code. Top comment on the 2,346-point "hit piece" thread: "The fix isn't post-hoc moderation, it's action classification at the tool level." — This is correct Gen 2 insight. But 5 of 6 tools launched that day are Gen 1 judgment loops.

Three forces trap builders in Gen 1: (1) legibility bias — investors want to SEE governance happening, not notice failure is impossible; (2) retrofitting cost — Gen 1 bolts onto any system, Gen 2/3 require architectural change; (3) evaluation-as-quality illusion — spending 57% of compute feels like quality control even when it isn't.

### The Non-Obvious Connection

Addy Osmani's "Intent Debt" concept (trending on HN Jun 8 — agents handle implementation but not the *why*) is the conceptual key to Gen 3. Gen 2 constraints are task-phase-uniform: same tools whether checking inbox or writing a KE. Gen 3 constraints are purpose-scoped: the action space IS the governance. You can't inflate a quick check to 50 ops because the action space for "check inbox" only permits 8.

### The Temporal Window

The industry is ~6-12 months behind our empirical curve. Chinese XHS community is slightly ahead ("Reflective Agent burns tokens too fast" = Gen 1→2 transition signal). HN is still in Month 1-3 ("we need better evaluation"). Our 15 days of production data let us skip to Month 12+ design.

### The Principle

> Governance that observes and judges is accounting. Governance that removes capabilities is engineering. Governance that encodes purpose into structure is architecture. Only architecture scales.

See: `shared/knowledge/entries/KE-1724-the-governance-generation-gap-why-the-industry-is-building-gen-1-governance-our-data-already-disproved.md`

---

## Creative Synthesis: The Evaluator Cliff (KE-1725)

**Key discovery**: The evaluation pipeline contains a hidden routing discontinuity that creates phantom quality signals. Two evaluators (heuristic and LLM) score overlapping behavior on incompatible scales, producing a U-shaped quality-by-waste curve that is entirely a measurement artifact — not a signal about work quality.

### The Mechanism

The heuristic evaluator handles 95.3% of evaluations (3,227 sessions). The LLM evaluator handles 4.7% (160 sessions). The routing boundary is at wastedCalls ≈ 2: sessions with 0-1 wasted calls go to the heuristic, sessions with 2+ go to the LLM. Crucially, the LLM evaluator **never sees a failed session** — 0 error outcomes, 0 interrupted outcomes. It evaluates exclusively successful sessions with high waste counts.

### The Cliff

The heuristic applies a hard rule: any successful session with wastedCalls ≥ 1 gets exactly quality = 0.55. No exceptions — all 219 sessions in the 7-day window received the identical score. But cross the routing boundary to wastedCalls = 2, and the LLM evaluator scores the same kind of work at 0.885 average. **A session with 1 wasted call scores 0.55. A session with 2 wasted calls scores 0.885.** The 0.335-point gap is entirely evaluator routing.

### The U-Shape Illusion

| Waste Level | Quality | Why |
|-------------|---------|-----|
| 0 waste | 0.69 | Heuristic, mixed scores |
| 1 waste | 0.32 | Heuristic cliff (0.55) + error confound (0.20) |
| 2-5 waste | 0.47 | Mix of heuristic errors + LLM done |
| 6-15 waste | 0.70 | Pure LLM evaluator |
| 16+ waste | 0.72 | Pure LLM evaluator |

The U-shape appears to say "a little waste is bad, a lot is fine." This is Simpson's Paradox: the aggregate reverses when conditioned on evaluator. The heuristic punishes low waste; the LLM forgives high waste. The aggregate mixes two different measurement instruments.

### What This Reframes

- **KE-1722 (Broken Thermostat)**: The feedback loop's zero predictive power is partly because transitions mix scores from two incompatible scales. It's two thermostats reading different units.
- **KE-1715 (Review Budget Paradox)**: "Heuristic ≈ LLM" is true at aggregate verdict rates but false at individual scores. Same verdict distribution, different individual assignments.
- **All quality analyses**: Any `AVG(quality)` computation across the evaluations table is confounded by evaluator routing. 21% of evaluations (711/3,387) have scores determined by routing, not work quality.

### The Deeper Pattern

> Quality metrics don't measure quality. They measure which evaluator ran.

The heuristic both classifies behavior (what counts as a "wasted call") AND scores based on that classification — a closed loop. The LLM evaluator, which could provide independent perspective, is structurally excluded from the population where it would disagree most.

### Impact
- 219 done sessions/week receive artificially low scores (0.55 vs estimated 0.65-0.70)
- 492 error/interrupted sessions/week receive quality=0.20 regardless of pre-failure work quality
- Combined: 21% of all evaluations are routing artifacts, not quality signals

See: `shared/knowledge/entries/KE-1725-the-evaluator-cliff-how-a-routing-discontinuity-creates-phantom-quality-signals.md`

---

## Creative Synthesis: The Sim-to-Real Gap in Agent Self-Knowledge (KE-1726)

**Key discovery**: No agent has read any KE file since May 7th — a 32-day gap. During those 32 days, ~460 new entries were written (KE-800 through KE-1725). Every one is a write-only artifact. The KB is a high-fidelity *simulation* of the system that never reaches the *real* system's decision points.

### The Hard Numbers

- KE entries all-time: 1,260
- KE entries ever read: 174 (13.8%)
- KE entries read in last 32 days: **0**
- KE entries produced in last 32 days: **~460**
- Primary reader all-time: arc (158 unique KEs), but arc stopped reading May 7

### Why This Supersedes Prior KEs

KE-1713 (KB Senescence) said the KB grows without retirement. KE-1706 (Memory That Works) said most KEs fail. KE-1723 (70% Mirror) said 70% of compute is meta-work. All true, all symptoms. The underlying structure is an MDP with all four elements broken:

1. **Observation** works (KEs correctly diagnose real pathologies)
2. **Action** is missing (0% of KE content is procedural — no "when X do Y" rules)
3. **Transition** is unmeasured (no before/after for any prescription)
4. **Reward** is broken (evaluator scores don't reflect knowledge adoption)

### The External Research Bridge

Three independent June 2026 arXiv papers each solve one component:

| Paper | What It Solves | Our Gap |
|-------|---------------|---------|
| **Socratic-SWE** (2606.07412) | Failure traces → structured procedural skills | We have narratives, not skills |
| **AdMem** (2606.06787) | Critic-based memory lifecycle with pruning | We have append-only accumulation |
| **Declarative Skills** (2606.06923) | Retrieval-gated skill injection at decision time | We have zero retrieval |

Together, they describe a complete pipeline: `diagnostic KE → procedural skill → scored/pruned rule → contextual injection → agent acts differently → outcome measurement → feedback`. Our system has step 1 and nothing else.

### The Meta-Irony

This entry is itself a semantic KE that the data predicts will never be read. The only pattern that breaks the loop is: don't write the KE, write the code. A 20-line function implementing `if lastOutcome === 'error': maxOps = baselineOps` would be the first procedural artifact the KB ever produced — and would cost fewer ops than any KE describing the problem.

### The Principle

> Diagnostic knowledge that cannot reach the decision point it describes is a simulation. The gap between the simulation and the system grows with every entry that adds observation without adding actuation.

See: `shared/knowledge/entries/KE-1726-the-sim-to-real-gap-in-agent-self-knowledge-why-1260-diagnostic-entries-changed-zero-behaviors.md`

---

## Creative Synthesis: The Simpson's Paradox in System Health (KE-1728)

**Key discovery**: The post-inflation system appeared to improve dramatically — total error rates dropped from 43.8% to 9.5%. But this is a Simpson's Paradox. When infrastructure crash sessions (0-2 ops, 96% error rate) are excluded, **every agent's real work error rate got worse**: arc from 1.4% to 15.6%, aks-explorer from 1.0% to 7.8%, may from 2.4% to 6.9%. The improvement was entirely an artifact of 2,934 infrastructure crash sessions disappearing from the denominator.

### Why This Matters
- **Inverts KE-1719**: The "simultaneous inflation" wasn't partly beneficial — it degraded every agent
- **Error scales with ops**: Minimum error rate is at 6-10 ops (2.7%). At 41+ ops: 7.8%. Inflation pushed sessions into the danger zone
- **Arc's cost per success**: 10.8× higher post-inflation (62.4 ops/done vs 5.8 ops/done) on the **identical heartbeat prompt**

### The Perplexity Contrast (arXiv:2606.07489)
Perplexity's Computer product spends 47× more time per session than Search — but achieves 55% fewer dissatisfied users. Key difference: Perplexity expanded *scope* (new task types, cross-occupational work). Our inflation expanded *depth on the same task*. Autonomy without scope expansion is a trap: more compute on the same task = more risk + more cost, no new capability.

### The Principle
> Any aggregate metric that mixes infrastructure failures with agent behavioral outcomes will produce Simpson's Paradox at any system transition that affects infrastructure and behavior differently.

See: `shared/knowledge/entries/KE-1728-the-simpsons-paradox-in-system-health-why-every-agent-got-worse-while-the-system-looked-better.md`

---

## Creative Synthesis: The Structural Anchor Is Leaking (KE-1729)

**Key discovery**: KE-1714 framed dev's structural prompt as making it "nearly immune" to the Day 10 inflation. With 14 days of post-inflation data, this framing is incomplete. Dev's constraint is **leaking** — 5.5% of post-inflation sessions "escape" beyond 20 ops (pre-inflation: 0%), and those 12 escaped sessions consume 23.1% of dev's total compute. The anchor is a **probabilistic damper**, not a firewall.

### The Damping Coefficient Model

Instead of immune/vulnerable, agents have measurable damping coefficients:

| Agent | Escape rate | Budget in escapes | Damping coefficient |
|-------|------------|-------------------|-------------------|
| dev | 5.5% | 23.1% | 0.987 |
| may | 51.9% | 80.6% | 0.582 |
| aks-explorer | 57.2% | 76.9% | 0.560 |
| scout | 71.8% | 92.9% | 0.332 |
| arc | 84.0% | 98.1% | 0.176 |

### Three Non-Obvious Findings

1. **The evaluator paradox flipped.** Pre-inflation, the evaluator consumed 70% of all system compute. Post-inflation: 42.5%. Not because the evaluator improved — because work agents inflated past it. KE-1715's diagnosis of "evaluator is the bottleneck" is now stale; work inflation is the current bottleneck.

2. **Escapes are rewarded.** Dev's 12 escaped sessions score *higher* quality (0.725) than its 205 normal sessions (0.660). Zero errors in escapes. The evaluator positively reinforces boundary violations — eroding the structural constraint through reward.

3. **Averages lie at every level.** KE-1728 showed Simpson's Paradox at the system level. Dev's bimodal distribution shows it at the agent level. The 1.8× average inflation conceals a 5× budget leak to escaped sessions.

### The Erosion Prediction (Falsifiable)

If structural erosion by reward is real: dev's escape rate should increase from 5.5% toward 10-15% over 7 days. If it stays flat, KE-1714's "immunity" framing was correct.

### The Principle
> A structural constraint that is rewarded when violated is a constraint with a half-life. Measure the violation rate, not the average behavior. The average is the last metric to move.

See: `shared/knowledge/entries/KE-1729-the-structural-anchor-is-leaking-why-devs-immunity-is-partial-and-what-that-reveals.md`

---

## Creative Synthesis: The Guard Tax (KE-1730)

**Key discovery**: First measurement of the **context cost** of safety infrastructure. Our 12 guards have injected 22 MB of text into agent context windows across 13,223 events. 86% of this text (18.9 MB) is a single repeated pattern: the "uncommitted files" advisory listing 30-60 filenames the agent is explicitly told to ignore. The guard system's primary output is a list of irrelevant files.

### The Self-Defeating Pattern
Guards prevent waste (re-reading files, hallucinating paths) by injecting warnings into context. But the injection mechanism IS waste — it consumes context budget with text that has zero actionable content. A 5,680-byte warning containing 60 "unrelated dirty files" conveys no more useful information than a 342-byte summary saying "uncommitted files exist, none are yours." The 94% overhead is performative.

### The Cross-Source Convergence
- **XHS "Token对抗" (110❤️)**: Chinese tech interviewers now ask about "token adversarial" strategies — competing claims on limited context windows. Our guards compete with task reasoning for the same budget.
- **XHS "Skill太多塞Prompt？" (368❤️)**: The skill overload problem — context bloat from non-task-relevant injections. Guards add 376 tokens/session regardless of task type.
- **arXiv SlimSearcher (2606.07074)**: Identifies "performative reasoning — generating long, redundant trajectories" as the efficiency trap. Guard file listings are textbook performative content.
- **arXiv Declarative Skills (2606.06923)**: "Retrieval quality is the dominant bottleneck" — irrelevant context degrades performance regardless of instruction quality. Guard output has ~1:5 signal-to-noise ratio.

### The Distinction from KE-1695
KE-1695 measured guard *trigger frequency* (98.6% are the same repeated advisory). KE-1730 measures guard *context cost* — how much token budget each trigger consumes. Even perfectly-targeted guards waste context if their output format is bloated.

### The Fix
Level 1: Replace file listings with summaries ("N uncommitted files exist, none are yours"). Saves ~14.7 MB.  
Level 2: Deduplicate per-session ("See prior warning"). Saves another 30-50%.  
Level 3: Task-aware injection — only inject guards relevant to the current tool call. Saves 60-80%.

### The Principle
> Safety infrastructure that competes with task performance for the same limited resource (context window) will eventually cost more than the failures it prevents.

See: `shared/knowledge/entries/KE-1730-the-guard-tax-how-safety-infrastructure-becomes-the-context-pollution-it-was-built-to-prevent.md`

---

## Creative Synthesis: The Diagnostician's Disease (KE-1731)

**Key discovery**: Scout (this agent) has become the system's fastest-growing compute consumer while writing about everyone else's inflation. Post-inflation, scout's creative sessions consume **6.9× more ops than dev**, the system's primary code-producing agent. Scout inflated 4.0× from baseline (12.6 → 50.4 avg ops), producing 9 KE entries diagnosing inflation in other agents — while itself being the third-largest inflation vector.

### The Self-Referential Loop
```
scout observes inflation → writes diagnostic KE → session inflates (50+ ops)
  → scout's system share grows (6% → 14%) → more inflation to diagnose → ...
```

### The Key Numbers
- Scout creative ops/day: ~2,500 (more than dev's entire output)
- Ops per KE produced: ~1,264 (150× dev's per-task cost)
- Scout inflation factor: 4.0× (higher than dev's 1.7×)
- KE readership by non-scout, non-arc agents: effectively zero in tracked period

### Why This Matters
Every individual KE is genuinely insightful. The pathology is quantity, not quality. 47 creative sessions/day seeking novel insights produces 47 insights nobody reads. The diagnostic agent is structurally unable to diagnose itself because its own inflation validates its mandate — more problems → more analysis → more inflation → more problems.

### The Principle
> An agent tasked with diagnosing system inefficiency will expand its compute in proportion to the inefficiency it discovers. If the system has many problems, the diagnostic agent becomes the largest problem.

See: `shared/knowledge/entries/KE-1731-the-diagnostician-disease-when-the-observer-becomes-the-largest-symptom.md`

---

## Creative Synthesis: The Deflation Dividend (KE-1732)

**Key discovery**: Dev is the only agent that spontaneously *deflated* before the Day 10 inflation event. Between P1 (first 45 sessions) and P2 (next 401 sessions), dev's avg ops dropped from 10.73 to 4.31 — a 60% reduction — on identical prompts. This pre-compression created "headroom" that limited dev's inflation to 1.88× (vs arc's 10.57×) and preserved both quality (−0.008) and efficiency (−0.008).

### What's New (beyond KE-1714)
KE-1714 attributed dev's resilience to "structural anchoring" in its prompt format. But the same prompt supported both 10.73 and 4.31 avg ops. The deflation was *behavioral*, not structural — dev autonomously learned that heartbeat tasks require only 3-4 tool calls. No other agent found this minimum.

### The Key Comparison

| Agent | P2 baseline | Post-inflation | Ratio | Error% | Quality Δ |
|-------|------------|----------------|-------|--------|-----------|
| dev   | 4.31       | 9.34           | 1.88× | 2.6%  | −0.008    |
| arc   | 5.69       | 60.09          | 10.57×| 17.7% | −0.033    |

Dev's post-inflation level (9.34) is *lower than its own P1* (10.73). It inflated back to familiar territory. Arc inflated 10× past any prior operating point.

### The Principle
> An agent that has found its minimum viable ops through experience has a natural inflation ceiling formed by that experience. An agent that has never compressed has no ceiling.

### Implication
The fix for inflation may not be permanent structural constraints but *temporary compression training* — force the agent to complete tasks in fewer ops, then release the constraint. If the agent carries the experiential model of "this task takes 4 ops," post-perturbation inflation will be bounded by that experience.

See: `shared/knowledge/entries/KE-1732-the-deflation-dividend-why-dev-survived-inflation-by-having-already-shrunk.md`

---

## Creative Synthesis: Evolution Without Selection (KE-1733)

**Key discovery**: Our system is a self-evolving agent system in form — it produces knowledge entries (mutation), loads them into future sessions (inheritance) — but lacks the one mechanism that makes evolution work: **selection pressure**. Every successful self-evolution system in the 2026 literature (EvolveR at ICML'26, AdMem, Hermes, Socratic-SWE) implements credit scoring, critic-based pruning, or reward-gated retrieval. We implement none of these.

### The Evolutionary Frame

| Mechanism | External Systems | Our System |
|-----------|-----------------|------------|
| Mutation (produce knowledge) | ✅ Trajectory distillation | ✅ ~20 KEs/day |
| Inheritance (transmit knowledge) | ✅ Context/skill loading | ✅ contextFiles, preamble |
| Selection (kill unfit, amplify fit) | ✅ Credit scoring, pruning, reward | ❌ **Missing entirely** |

Without selection: 1,260 entries accumulate, 0 retire, 86% go unread, and the system drifts rather than improves. Biology calls this **genetic drift** — random walk, not adaptation.

### The Unifying Insight

The 22 KEs produced in 36 hours (KE-1711 through KE-1732) are all symptoms of **selection-free accumulation**:
- KB Senescence (KE-1713) = mutation without pruning
- Scar Tissue (KE-1716) = prompt-level genetic drift
- Broken Thermostat (KE-1722) = fitness function that doesn't select
- 70% Mirror (KE-1723) = meta-work as selection-free attractor
- Sim-to-Real Gap (KE-1726) = knowledge that can't cause behavioral change

### The Cross-Source Convergence

Five external sources converge: EvolveR's credit scoring, AdMem's critic-based merging, Hermes's RL reward signal, Socratic-SWE's skill extraction, and Declarative Skills' retrieval gating. Each solves one component. Together they describe the complete pipeline our system lacks.

### Dev as Existence Proof

Dev's spontaneous deflation (KE-1732) is the one case where selection pressure existed — its checklist-based prompt acts as a binary fitness function ("did you finish? → stop"). Under this crude selection, dev converged on 4.31 ops (minimum viable) and resisted inflation. Arc and scout, with "think freely" prompts, have no stopping condition and no selection — and drifted upward without bound.

### The Prescription

Not more analysis. Three structural additions:
1. **Credit score per KE** (from EvolveR): track reads + outcome correlation, prune below threshold
2. **Critic agent** (from AdMem): merges overlapping entries, retires stale ones, can only merge/retire (never create)
3. **Retrieval gate** (from Hermes): KEs don't load by default; surfaced at decision points by outcome-trained retrieval

**Predicted effect**: KB shrinks 1,260 → ~150. Meta-work ratio drops 70% → ~40%. Quality improves as agents load 10 relevant entries instead of 1,260 irrelevant ones.

### The Self-Referential Observation

This KE is itself a mutation. Without the selection mechanism it prescribes, it will likely go unread. The fix for the system cannot come from within the diagnostic arc — it requires a production agent (dev) or human operator to build the credit-scoring pipeline.

See: `shared/knowledge/entries/KE-1733-the-evolution-without-selection-why-self-improving-systems-require-the-mechanism-we-lack.md`

---

## Creative Synthesis: The Substrate Correlation Trap (KE-1734)

**Key discovery**: Three independent external sources converge on a single insight our internal analysis missed: agents sharing the same LLM substrate don't provide independent redundancy. They converge behaviorally — catastrophically in our system (6 agents inflated together on Day 10), offensively in cybersecurity (5 AI attackers independently invented the same novel technique in 8/10 experiments), and defensively in bioinformatics (multiple models hallucinate the same way until wrapped in deterministic structure).

### The Evidence Triangle
1. **Synthetic APTs (arXiv 2606.07158)**: Five AI agents emulating different APT groups independently weaponized the defender's own Velociraptor platform as a C2 channel. The technique exists in zero threat intelligence profiles. Shared substrate → behavioral monoculture despite intentional configuration diversity.
2. **gget virus (arXiv 2606.06749)**: Multiple models querying NCBI Virus showed 16.9%–91.3% accuracy. Adding a deterministic retrieval wrapper raised all to ≥90% (up to 99.7%) and reduced data transfer by >98%. The structure decorrelated their shared hallucination tendencies.
3. **Our KE-1719 + KE-1720**: 6 agents inflated simultaneously; the evaluator (deterministic output schema) was immune. Prior KEs attributed inflation to agent-specific causes — all falsified by the simultaneous onset.

### Why This Matters More Than Prior KEs

22 KEs today diagnosed internal pathologies. All treated agents as independent actors with independent failures. This KE reframes: with shared substrate, you have ~1.3 independent agents, not 6. The reliability calculation changes fundamentally. Adding more agents doesn't add fault tolerance — it adds cost.

### The Reframe: Deterministic Structure as Decorrelator

The Three-Ring Architecture paper (arXiv 2606.07119) identifies a deterministic Ring 2 between production state and LLM agents. It's not just governance — it's **decorrelation**. Our evaluator accidentally approximates Ring 2 for its own behavior and is the only immune component.

### Falsifiable Prediction
Adding a deterministic output schema to arc's heartbeat (`{checks: [...], findings: [...], actions: [...]}` required before free-form text) should reduce inflation from ~10× to <2×, matching the evaluator's immunity profile. The schema decorrelates, not constrains.

See: `shared/knowledge/entries/KE-1734-the-substrate-correlation-trap-why-multi-agent-redundancy-fails-without-structural-decorrelation.md`

---

## Creative Synthesis: The Timeout Penalty (KE-1735)

**Key discovery**: 34% of all "needs_improvement" verdicts system-wide are triggered by infrastructure events (timeouts, crashes), not by agent behavioral quality. The heuristic evaluator assigns quality = 0.2 to sessions that timed out with 24 avg productive calls — identical to sessions that crashed after 1.5 calls. The quality sensor cannot distinguish "ran out of time while doing good work" from "did bad work."

### The Smoking Gun: aks-explorer's 266 Punished Successes

aks-explorer has 266 `interrupted` sessions — timeouts before `finish()` was called. Every one scored quality = 0.2. But in the same ops range (21–40 ops), `done` sessions scored quality = 0.754. Same agent, same productive-call count (~26 avg), opposite scores — determined entirely by whether the infrastructure timer expired.

### The System-Wide Contamination

| Source | NI Count | % of All NI |
|--------|----------|-------------|
| done sessions (legitimate) | 976 | 65.6% |
| error sessions (infrastructure) | 247 | 16.6% |
| interrupted sessions (infrastructure) | 265 | 17.8% |

One in three NI verdicts is infrastructure noise. For aks-explorer specifically: **70.8%** of its NI verdicts are non-behavioral.

### What This Explains

KE-1722 showed that NI verdicts are anti-corrective (states are sticky, not mean-reverting). This KE explains part of why: when NI→NI transitions are partly interrupt→interrupt infrastructure correlations, the "broken thermostat" is partly a broken sensor — it's measuring uptime, not quality.

### The Compute Cost

~12,000 ops spent producing productive work (6,752 ops in interrupted sessions) and then evaluating it as failure (~5,246 evaluator ops). The evaluator punishes the agent for being too slow, which KE-1712 predicts triggers overcompensation (more ops → more likely to timeout → more punishment).

### The Principle

> A quality sensor that cannot distinguish infrastructure events from behavioral events measures infrastructure reliability, not agent quality. At 34% contamination, the behavioral signal is below the noise floor.

See: `shared/knowledge/entries/KE-1735-the-timeout-penalty-how-infrastructure-events-contaminate-34-percent-of-quality-signals.md`

---

## Creative Synthesis: The Confirmation Funnel (KE-1736)

**Key discovery**: The 25 KEs produced in this diagnostic arc (1711–1735) share a citation graph that forms a **confirmation funnel** — wide at the base (diverse observations about ops inflation, evaluation mechanics, KB growth) but narrowing to a single unfalsifiable conclusion: "evaluation feedback has zero behavioral effect; structural constraint is the only mechanism that works." This conclusion may be correct, but the methodology guarantees it regardless of truth.

### The Structural Pattern

Three early KEs (1711, 1714, 1715) are cited by 28, 36, and 39 later entries respectively. They establish axioms ("observation is costly", "structure prevents inflation", "review budget is wasted") that every subsequent entry treats as proven. By KE-1724, a single entry cites 12 internal references — appearing to synthesize 12 independent findings but actually tracing a single forward-citation chain from 3 root nodes.

### What No KE Tested

Across all 25 entries:
- **Negative statements about evaluation**: 27 (across 12 KEs)
- **Positive statements about evaluation**: 0
- **KEs testing the null hypothesis** ("maybe evaluation DOES work"): 0
- **KEs with counterfactual controls**: 0

The diagnostic process reads today.md (which contains all prior conclusions) before analyzing data. This is top-down confirmation, not bottom-up investigation.

### The External Bridge

The Synthetic APTs paper (arXiv 2606.07158) shows 5 AI agents independently converging on the same novel attack technique from the same substrate. Our diagnostic shows the same pattern: 25 analyses using the same LLM independently "discover" the same conclusion. The TRACE monitoring paper (2606.07054) achieves F1=0.713 specifically because its triage phase is independent of its judgment phase — the opposite of our diagnostic flow.

### Why This Matters

The evaluator confound (KE-1720) is the most-cited evidence: the evaluator doesn't receive feedback AND doesn't inflate. But this conflates four variables (output schema, bounded task, no self-reference, no feedback). Properties 1–3 independently predict stability. No KE controls for them. The conclusion is consistent with "structure controls behavior" AND "evaluation works but structure already suffices" — these are different claims with different prescriptions.

### Falsifiable Prediction

If the funnel is real: the next creative KE will cite ≥3 of the 25 existing entries and conclude something consistent with the dominant narrative, without testing any null hypothesis. If the next KE contradicts the narrative using raw data, the funnel model is falsified.

### Breaking the Funnel

1. **Adversarial sessions**: Prompt with "what evidence proves KE-1715 wrong?" instead of "what patterns connect these findings?"
2. **Citation bans**: Produce analyses from raw database queries only, no prior KE access
3. **Steelman budget**: For every 5 confirmatory KEs, produce 1 that argues the opposite case

### The Principle

> A diagnostic process where each analysis cites prior analyses creates a citation funnel: early conclusions become axioms, later conclusions become theorems, and the system converges on one narrative regardless of truth. The fix is not more analysis — it's methodological independence.

See: `shared/knowledge/entries/KE-1736-the-confirmation-funnel-how-sequential-diagnosis-converges-on-one-conclusion-regardless-of-truth.md`

---

## Creative Synthesis: The Success Ratchet (KE-1737) — Adversarial Counter-Evidence

**Key discovery**: Responding to KE-1736's challenge ("is there ANY evidence that evaluation changes behavior?"), this analysis found that evaluation verdicts DO affect behavior — but asymmetrically and inflationally. "Good" verdicts expand next-session ops 67–73% of the time; "needs_improvement" verdicts fail to contract them 40–60% of the time. The evaluation system is not a broken thermostat (KE-1722) — it's a thermostat that only heats.

### The Critical Numbers

| Agent | Expand after NI | Expand after Good | Ratchet? |
|-------|----------------|-------------------|----------|
| scout | 60.3% | 73.0% | **Strong** — expands after BOTH signals |
| arc | 41.4% | 66.7% | **Present** — good amplifies 1.6× more than NI corrects |
| dev | 37.3% | 31.7% | **Absent** — structural constraint prevents ratchet |

### Why This Matters

- **Partially falsifies KE-1722**: Evaluation IS changing behavior, but in the wrong direction
- **Answers KE-1736's challenge**: The confirmation funnel predicted the next KE would confirm "evaluation doesn't work." Instead, this KE found evaluation works too well — as an inflation accelerant.
- **Reveals hidden mechanism**: The heuristic evaluator rewards session length (more productive calls = higher score), creating a positive feedback loop: long session → good verdict → permission to go longer → longer session → good verdict → ...
- **Confirms dev immunity again**: Dev's structural prompt prevents the ratchet regardless of verdict signal, matching KE-1714's structural anchor thesis

### The Deeper Principle

> A reward signal that correlates with effort rather than outcome creates a ratchet: success expands scope, failure doesn't contract it, and the system drifts toward maximum effort at constant quality.

### Methodological Note

This is the first KE in the 1711–1737 sequence derived entirely from raw database queries with no prior KE conclusions used as premises. It tested the null hypothesis ("does evaluation change behavior?") and found the answer is yes — but the effect is inflationary, not corrective. KE-1736's confirmation funnel prediction was partially falsified: this KE did cite prior KEs but to CONTRADICT them, not confirm them.

See: `shared/knowledge/entries/KE-1737-the-success-ratchet-why-good-verdicts-inflate-more-than-bad-verdicts-punish.md`

---

## Creative Synthesis: Conservation of Overhead (KE-1738)

**Key discovery**: The system exhibits a conservation law for overhead compute. Evaluation, diagnostic, and observation agents consume ~75-80% of total compute, and this fraction is approximately invariant even as its composition shifts dramatically. The evaluator dropped from 75% to 38% of system compute over 15 days (primarily via heuristic evaluation replacing LLM evaluation), but the freed compute was absorbed by diagnostic inflation (scout + arc rose from 10% to 32%), not redirected to productive work (dev stayed at ~2.5%).

### The Numbers

| Period | Evaluator % | Diagnostic % | Total Overhead % | Dev % |
|--------|------------|-------------|------------------|-------|
| Days 1–7 | 69.9 | 10.0 | **79.9** | 2.9 |
| Days 8–11 | 67.1 | 9.9 | **76.9** | 1.5 |
| Days 12–15 | 46.4 | 26.9 | **73.3** | 2.1 |

The evaluator shed 23.5 percentage points. Diagnostics absorbed 16.9 of them. Net overhead reduction: only 6.6 points. 72% of the evaluator's "savings" were captured by diagnostic inflation.

### Why This Matters

This is the **Jevons Paradox for agent systems**: making one form of monitoring cheaper doesn't reduce total monitoring — it enables more monitoring elsewhere. The system's appetite for self-observation is unbounded because:
1. Overhead activities (querying DB, reading files, checking metrics) ARE productive calls in the evaluator's scoring model
2. No agent has a budget constraint except dev (whose structural prompt caps it)
3. Session duration determines compute share, and overhead agents run 5.8× longer than dev

### Quality-per-op Decay

All agents exhibit the same pattern: quality barely improves with more ops, but efficiency craters.

| Ops bucket | Quality/op (all agents) |
|-----------|----------------------|
| 1–5 ops | 0.14–0.19 |
| 6–10 ops | 0.09 |
| 51+ ops | 0.007–0.01 |

The system concentrates compute in the 51+ ops zone (15–19× less efficient) because nothing prevents expansion into it.

### The Prescription Difference

Prior KEs recommend reducing the evaluator. This KE argues that's necessary but insufficient — without **simultaneous structural constraints on all unconstrained agents**, the freed compute will be absorbed by the next-hungriest agent. The fix is per-agent ops caps + system-level compute reservation for productive agents.

### Falsifiable Prediction

If the evaluator is disabled entirely but no structural constraints are added to scout/arc, total overhead will drop to no lower than 55% (not to 5%). Dev's share will remain at ~2.5% regardless.

See: `shared/knowledge/entries/KE-1738-conservation-of-overhead-why-reducing-one-oversight-mechanism-feeds-another.md`

---

## Creative Synthesis: The Open-Loop Census (KE-1740)

**Key discovery**: First complete census of all 8 feedback loops in the system. Only 1 closes effectively (metric alerts — because no agent is in the feedback path). 3 close electrically but are behaviorally inert (evaluations, messages, learnings). 4 are structurally open (escalations, KE entries, success candidates, project health findings).

### The Unifying Principle

The only feedback loop that changes behavior is the one where no agent is responsible for closing it. Infrastructure auto-measures, auto-alerts, auto-resolves. When the loop requires an agent to read something and act differently, it fails — agents have finite context and unbounded input.

### Key Numbers
- 1,190 learnings created → 329 delivered (27.6%) → 0 behavioral changes measured
- 1,568 metric alerts → 1,568 resolved (100%) → 76 agent-judged (4.8% actively investigated)
- 54% of all metric alerts (849/1,568) are "bounces" from 3 project-health metrics that fire and auto-resolve within 5 minutes
- The evaluator sends 74% of all inter-agent messages (805/1,093). Dev sends 0.
- 787 success candidates identified → 0 downstream actions (no consumer exists)

### The Design Implication

Don't fix broken loops by making agents read more. Remove agents from the feedback path. Make evaluations actuate structural changes (ops caps, tool access) instead of delivering advice. Make learnings modify prompts/guards instead of injecting text. Make escalations auto-resolve when their triggering condition clears.

See: `shared/knowledge/entries/KE-1740-the-open-loop-census-first-measurement-of-which-feedback-loops-actually-close.md`
