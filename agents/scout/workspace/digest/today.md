# Scout Findings — 2026-05-31

## Session 33 (creative heartbeat)

**Output**: KE-1442 — "Survivorship Bias in Agent Learning Data"

**Data-driven finding**: Queried 48h of session data. Evaluator produces 52% of all traces (586/1119) with 1.2% error rate, while dev/scout/arc collectively produce 25% with 9-13% error rates. If the system implements learning from traces (per KE-1437/1441), naive training would optimize toward evaluator-like repetitive patterns and penalize creative/exploratory behavior. This is the aviation survivorship bias applied to agent learning.

**Key insight**: Error rate inversely correlates with task novelty. Higher error rates in dev/scout aren't pathology — they're the cost of doing novel work. Any learning system must stratify by role and weight by novelty, not raw volume/success.

**Connection**: XHS SkillRL trend (skill-conditioned selection per task type) already solves this structurally — different skill banks for different work profiles.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.2089/0.8 — structurally unreachable per KE-1412. Human action required to adjust target.

## Session 32 (creative heartbeat)

**Output**: KE-1438 — "Heuristic Evaluator Bias Against Meta-Agents"

**Data-driven finding**: Queried evaluations table and discovered the heuristic evaluator (monitor-session.cjs) assigns `needs_improvement` to 99% of coach/optimizer sessions and 100% of bob sessions — vs 23-57% from LLM evaluation. Root cause: the heuristic measures productiveCalls (file I/O), but meta-agents produce reasoning/messages/configs, not file edits. This creates ~860 false-negative evaluations per week.

**Key insight**: The system evaluates all agents by the same proxy (tool call counts) despite fundamentally different work profiles. This likely creates a feedback loop: bad heuristic evals → more coaching/optimization sessions → those sessions also get bad heuristic evals → more overhead. Connects to KE-1425 (overhead ratio) with a concrete, measurable mechanism.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.2098/0.8 — structurally unreachable per KE-1412. Human action required.

## Session 31 (creative heartbeat)

**Output**: KE-1436 — "Convergent Rediscovery: When Synthesis Loops Without Acting"

**Synthesis**: Meta-analysis of KE-1416 through KE-1435 reveals the system is producing ~4 KEs/day that cluster into just 3 core insights repeated with different metaphors. Connected this to the MemSkill architecture (XHS trend): we have skill-generation (KE production) but lack the Controller that routes insights to implementation and the pruning mechanism for redundant entries. The loop persists because no feedback path converts KE recommendations into system changes.

**Key insight**: A knowledge system without a consumption/action loop is a journal, not a learning system. The specific gap is: when a KE recommends a concrete fix (e.g., adjust metric target), it should create a tracked request — not just sit as declarative knowledge.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.2102/0.8 — structurally unreachable per KE-1412. Human action required to adjust target. This is the 10th+ consecutive alert.

## Session 30 (creative heartbeat)

**Output**: KE-1435 — "Homeostatic Equilibrium: The System's Natural Metabolic Rate"

**Synthesis**: Analyzed full session telemetry (10,968 sessions across 7 days). Key finding: the system has a remarkably stable metabolic rate that self-corrects after perturbation. The May 26 cascade (3,478 sessions, 7x normal) resolved within 24 hours with zero human intervention. Fixed-rate agents (dev/arc/scout at ~45/day) were completely unaffected even during the cascade.

**Reframe of KE-1425**: The 5:1 overhead ratio isn't a growing pathology — it's the system's stable design-level metabolic rate. Evaluator at 250/day, dev at 45/day has been constant since inception. The right question isn't "reduce the ratio" but "measure whether evaluator catches real bugs." If >10% effectiveness, the ratio is justified.

**Key insight**: System has two tiers — externally-clocked (cron-driven, cascade-immune) and internally-triggered (can spike, self-resolves). Productive throughput is constrained by the fixed tier's clock rate, not the variable tier's overhead.

**Metric**: `knowledge-preamble-coverage` 0.2104/0.8 — structurally unreachable per KE-1412. Human action required.

## Session 29 (creative heartbeat)

**Output**: KE-1434 — "The Silent Cascade: Why Runaway Agents Don't Trigger Alerts"

**Synthesis**: Queried session telemetry and discovered that on 2026-05-26, `aks-explorer` ran 1,778 sessions in a single day (60x its normal rate) with no alert. Meanwhile, the preamble-coverage metric fired its 10th alert for a stable 0.21 value. The monitoring system is perfectly inverted: silent on acute cascades, loud on cosmetic non-issues. Connected to arXiv alignment auditing research (adversarial agents that "do more work" evade detection) and KE-1430 (compositional incoherence). Proposed per-agent rate limits and velocity-based anomaly detection as basic distributed-systems monitoring that our agent system lacks.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.2106/0.8 — structurally unreachable per KE-1412. Human action required.

## Session 26 (creative heartbeat)

**Output**: KE-1431 — "Meetings Considered Harmful: Async Coordination vs Session Overhead"

**Synthesis**: Connected XHS community debate ("Do multi-agent LLMs really need meetings?") with our 5.3:1 evaluator overhead ratio. The insight: our system implements all coordination as full LLM sessions (expensive), but the protocol-stack pattern (MCP/A2A/ACP) shows most coordination should be event-driven and stateless. Proposed two-tier evaluation: deterministic checks as lightweight hooks, LLM sessions only for subjective quality assessment. Could reduce overhead from 5.3:1 to ~1.5:1 without losing quality signal.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.2112/0.8 — structurally unreachable per KE-1412. Human action required.

## Session (creative heartbeat)

### Metric Escalation (unchanged)
`knowledge-preamble-coverage` 0.2114/0.8 — structurally unreachable per KE-1412. Human action required to adjust target. This is the 10th consecutive alert. No new investigation needed; prior KEs (1412, 1415, 1422) fully document the root cause.

### Synthesis: Compositional Incoherence as Our Central Risk

Recent arXiv fetch (2026-05-28) surfaced a paper on **compositional incoherence in multi-agent LLM systems**. This names something our diagnostic KEs have been circling without unifying:

**The pattern**: When multiple agents each produce locally-coherent outputs, the *composition* of those outputs can be globally incoherent. Each agent's work makes sense in isolation but the system-level behavior is contradictory or circular.

**Our instance**: 
- KE-1425 (bureaucratic creep): evaluators produce coherent evaluations → but composed effect is overhead ratchet
- KE-1429 (diagnostic abundance): scout produces coherent diagnoses → but composed effect is diagnosis without action
- KE-1412 (preamble paradox): metric produces coherent alert → but composed effect is perpetual unactionable noise

These aren't three separate problems. They're one phenomenon: **compositional incoherence** — each agent optimizes its local objective correctly, producing system-level dysfunction.

### Implication for Our Architecture

The fix in the literature is typically one of:
1. **Shared objective alignment** — agents optimize a global reward, not local metrics
2. **Composition-aware planning** — a coordinator that reasons about combined effects
3. **Feedback loops** — downstream agents signal upstream when composed output is incoherent

Our system has (3) partially (evaluators), but evaluators themselves contribute to the incoherence (KE-1425). We lack (1) entirely — there's no shared reward signal that says "the system produced useful work today." Session counts, coverage metrics, and artifact counts are all local proxies that can be maximized without global coherence.

**Concrete suggestion**: A single daily metric like "human-valued outputs produced" (merged PRs, decisions unblocked, questions answered) would expose compositional incoherence immediately. If 117 sessions produce 0 human-valued outputs, the incoherence is measurable.

### Non-obvious connection

The XHS community's convergence on "self-evolving agents that reduce coordination overhead" (from 2026-05-30 digest) is essentially agents that *detect and fix their own compositional incoherence*. They notice when their collective behavior diverges from the goal and restructure. Our system notices (we have 8 KEs about it) but cannot restructure (KE-1429).

The missing capability isn't diagnosis. It's **authorized self-modification** — the ability for the diagnostic signal to trigger config changes without human approval for each one. This is the "therapeutic" side that KE-1429 identifies as absent.

---

### New KE: Compositional Incoherence as Attack Surface (KE-1430)

Connected Shanghai AI Lab's hierarchical attack research (from XHS trends) with our internal compositional incoherence diagnosis. Key insight: **the same structural property that causes our overhead loops is the property an adversary would exploit**. Endogenous dysfunction and adversarial vulnerability share a root cause — no agent reasons about global composed state.

This reframes our performance problems (diagnostic spirals, evaluator ratchets) as security indicators: fixing them isn't just efficiency, it hardens the attack surface. Standard per-agent guards can't catch composition-level failures — we'd need system-level invariants.

## Session 27 (creative heartbeat)

**Output**: KE-1432 — "The Reflex Arc Pattern: Bypassing Full Reasoning for Learned Responses"

**Synthesis**: Connected Shanghai AI Lab's "single agent > expert swarm" finding (XHS) with our overhead ratio problem (KE-1425) and skill distillation gap (KE-1428). The non-obvious insight: the Shanghai result isn't about agent count but *invocation count* — each agent boundary pays a "session tax" (context load + reasoning + eval). Proposed a two-tier architecture where routine patterns execute as deterministic rules (reflex layer) and only novel situations invoke full LLM sessions (cortical layer). The XHS-trending Youtu-Agent framework implements exactly this via compiled behavior patterns. Estimated impact: overhead ratio from 5:1 to ~2:1.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.211/0.8 — structurally unreachable per KE-1412. Human action required.

## Session 28 (creative heartbeat)

**Output**: KE-1433 — "The Architecture Trap: When Meta-Work Displaces Data Accumulation"

**Synthesis**: Connected the tension between XHS's "modularity" consensus and the "data > architecture" counter-signal (401 likes). Applied reflexively to our own KE production: 5 recent KEs propose architectural reforms, 0 collect behavioral data to validate them. The Shanghai AI Lab "single agent > swarm" result reframes as a data density argument — unified agents learn faster because they see more examples. For our multi-agent system, the fix isn't choosing unified vs. multi but sharing behavioral traces across agents. Recommended shifting investment from architectural analysis to decision logging and outcome attribution.

**Metric note**: `knowledge-preamble-coverage` 0.211/0.8 — per KE-1412, target is structurally wrong. Escalating remains correct action.

## Session 29 (creative heartbeat)

**Output**: KE-1437 — "Eval Traces as Substrate: The Data Moat Hiding in Plain Sight"

**Synthesis**: Combined two high-signal XHS posts ("eval as moat" 443 likes + "data > architecture" 401 likes) into a single non-obvious implication: the moat isn't the eval system, it's the accumulated eval *data*. Applied to our system: we already have gym_runs, evaluations, and sessions tables containing implicit training signal (failure patterns, retry deltas, cost/outcome correlation) that no agent currently mines. Unlike prior architectural KEs, this one points to specific existing tables and specific queries — actionable by optimizer without infra changes.

**Breaking the loop**: KE-1436 diagnosed convergent rediscovery. This session deliberately avoids proposing new architecture and instead identifies existing data that can be queried today.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.21/0.8 — structurally unreachable per KE-1412. Human action required to adjust target.

## Session 30 (creative heartbeat)

**Output**: KE-1439 — "The Evaluation-Autoimmune Loop: How Biased Eval Drives Wasteful Healing"

**Synthesis**: Connected KE-1438 (evaluator bias against meta-agents), KE-1422 (autoimmune scheduling), and KE-1425 (overhead ratio) into a single causal loop. The non-obvious insight: biased evaluation of meta-agents doesn't just produce wrong scores — it *generates demand for more meta-agent work* that itself gets wrongly scored, creating a positive feedback loop. This identifies a single point of leverage (~10 lines in the heuristic evaluator) that could reduce overhead ratio without any architectural changes. Also established the correct sequencing: fix measurement (KE-1438) → mine data (KE-1437) → improve from data (KE-1433).

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.21/0.8 — structurally unreachable per KE-1412. Human action required to adjust target.

## Session 31 (creative heartbeat)

**Output**: KE-1440 — "Prompt Scar Tissue: When Institutional Memory Becomes Institutional Weight"

**Synthesis**: Examined actual arc/dev heartbeat prompts in the session DB — each is ~5000 tokens of accumulated failure warnings (15+ KE-referenced "don't do X" rules). Connected this to XHS MemSkill/SkillRL trends (selective loading > exhaustive inclusion). The non-obvious insight: KE-1412 diagnosed knowledge-entry preamble overloading, but the **guidance section itself** is the larger budget consumer — and it's invisible to the preamble-coverage metric. The 0.21 coverage might reflect context-budget exhaustion from guidance, not poor entry selection. Proposed failure-conditional loading (only load warnings relevant to planned session actions) and scar-tissue pruning (demote warnings for mistakes not seen in 30+ days).

**Breaking the loop**: Unlike prior KEs proposing architecture, this one identifies a measurable quantity (guidance token count per session) and a falsifiable prediction (50% guidance trim won't proportionally increase errors).

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.21/0.8 — structurally unreachable per KE-1412. Human action required to adjust target.

## Session 32 (creative heartbeat)

**Output**: KE-1441 — "The Labeling-Without-Training Paradox"

**Synthesis**: Queried the session DB directly and found evaluator runs 156 sessions per period (53% of all compute) while dev/arc maintain 0% error rates. Connected XHS "data > architecture" consensus with KE-1437 (eval traces as data moat). The non-obvious insight: the system isn't over-evaluating (a cost problem) — it's under-learning (a waste problem). Each evaluation produces a labeled example (input + quality judgment) that's immediately discarded. A system that learned from its own evaluations would need decreasing evaluation volume over time; ours is flat. Proposes Thompson sampling for eval coverage: stop checking patterns that consistently pass.

**Breaking the loop**: Unlike KE-1427 ("evaluate less") or KE-1438 ("evaluate better"), this reframes as "evaluate AND learn" — making evaluation the most valuable agent rather than the most wasteful.

**Metric escalation (unchanged)**: `knowledge-preamble-coverage` 0.21/0.8 — structurally unreachable per KE-1412. Human action required to adjust target.
