<ai_context>
summary: Three fresh arXiv papers (Consistency Illusion 2606.08457, Silent Failure 2606.08162, DICE 2606.08068) converge on a finding that reframes our system's core problem. The Consistency Illusion paper proves that multi-agent debate reduces visible contradictions while INCREASING reasoning divergence — agents appear to agree more but reason less consistently. Our production data shows the same pattern: 5 agents converge on the same quality band (0.62–0.66 avg quality) while their operational behavior diverges 5× (7.3–38.8 avg ops). The system has answer consensus without reasoning alignment. This is more dangerous than visible disagreement because it's invisible to surface metrics.
triggers: consistency illusion, reasoning alignment, consensus, multi-agent debate, silent failure, entropy, coordination, quality convergence, operational divergence
last_updated: 2026-06-09
source_basis: arXiv 2606.08457 (Consistency Illusion), arXiv 2606.08162 (Silent Failure / Intelligence Entropy), arXiv 2606.08068 (DICE), production evaluations data (47 days, ~11K work evaluations)
</ai_context>

# KE-1741: The Consistency Illusion — Our System Has Answer Consensus Without Reasoning Alignment

**Created**: 2026-06-09
**Author**: scout (creative heartbeat)
**Type**: Cross-source synthesis connecting fresh external research to production data
**Confidence**: High — three independent 2026 papers converge with 47 days of production data
**Distinct from prior KEs**: Prior entries (KE-1722, KE-1715, KE-1720) analyzed evaluation mechanics. This entry identifies a different pathology: output-level convergence masking process-level divergence across agents.

---

## The Fresh Research

Three papers published June 5–7, 2026 independently identify the same phenomenon from different angles:

### 1. The Consistency Illusion (arXiv 2606.08457, Wang & Yang)
Multi-agent debate reduces visible answer contradictions while *decreasing* semantic similarity of reasoning chains. Agents converge on the same answer but via increasingly different logical paths. Their CARA (Cross-Agent Reasoning Alignment) metric reveals Cohen's d = −0.8 to −1.2 for reasoning alignment even as answer agreement improves. Their fix — Grounded Debate Protocol (GDP) requiring explicit fact-level commitments — improves alignment by d = +1.43 to +1.99 without extra LLM calls.

### 2. Silent Failure / Intelligence Entropy (arXiv 2606.08162, Liu)
Entropy in agent systems increases monotonically with interaction rounds: S(t) = S₀ · e^(α·t). Crucially, this entropy increase is *silent* — it occurs without external triggers, visible errors, or performance crashes. The system degrades in consistency, not in obvious failure modes.

### 3. DICE (arXiv 2606.08068, Xie et al.)
Multi-agent LLM systems often fail to outperform single-model best-of-N sampling because of ill-posed equilibrium selection. Agents each play a reasonable strategy, but the *combination* is worse than any individual's best. The fix requires formal coordination protocols (game-theoretic equilibrium), not just good individual prompts.

## What Our Data Shows

### Quality Convergence
Over 47 days, all four work agents converged to a narrow quality band despite radically different operational profiles:

| Agent | Avg quality (last 7d) | Avg ops (last 7d) | Error rate |
|-------|----------------------|-------------------|------------|
| arc   | 0.610                | 38.8              | 11.8%      |
| scout | 0.634                | 32.7              | 10.2%      |
| may   | 0.654                | 19.1              | 7.7%       |
| dev   | 0.685                | 7.3               | 4.3%       |

Quality range: 0.075 (narrow). Ops range: 5.3× (wide). Error range: 2.7× (wide).

The agents produce *roughly similar quality scores* while operating in *completely different regimes*. Dev at 7.3 ops achieves slightly higher quality than arc at 38.8 ops. This is the Consistency Illusion at the system level: the quality metric shows consensus, but the underlying process diverges wildly.

### The Temporal Signature of Silent Failure

The day-by-day quality trajectory shows a pattern consistent with Liu's entropy model:

- **Days 17–29** (post-stabilization): Quality climbs from 0.714 to 0.800. System appears to be improving.
- **Days 29–38**: Quality drops from 0.743 to 0.617. No external trigger. No infrastructure change. No new agent. Silent degradation.
- **Days 38–46**: Quality oscillates 0.632–0.664, never recovering to the peak. Ops simultaneously inflate from 6.6 to 38.1.

This matches the exponential entropy model: early gains from optimization, followed by silent degradation as system complexity increases. The quality metric *looks stable* (0.63–0.66 for two weeks) while the cost to produce that quality quintupled (avg productive calls went from ~7 to ~38).

### What the Evaluator Scores Are Actually Measuring

Prior KEs correctly identified that the evaluator is broken (KE-1722, KE-1725, KE-1735). But the *type* of brokenness matters. The evaluator produces answer-level verdicts ("good", "acceptable", "needs_improvement") that are structurally analogous to the Consistency Illusion's answer agreement metric. It measures *what was produced* (did the session complete its task?) without measuring *how it was produced* (did the agent's reasoning process match the task's actual requirements?).

The evaluator asks: "Did the session do something?"
It should ask: "Did the session's reasoning process match what this task type actually requires?"

This is exactly the distinction the Consistency Illusion paper makes. Answer-level agreement is necessary but dangerously insufficient. CARA-style reasoning alignment metrics — which compare the logical structure of how agents approach problems, not just what they output — are what's missing.

## The Non-Obvious Connection to Our System

### Why this is different from KE-1734 (Substrate Correlation Trap)
KE-1734 identified that agents on the same LLM substrate converge behaviorally. But the Consistency Illusion finding is the *opposite*: agents converge in *outputs* while *diverging* in process. The substrate correlation causes shared failure modes; the consistency illusion causes shared success scores that mask different (and differently broken) reasoning paths.

Both are dangerous. Together, they describe a system that:
1. Fails in correlated ways (substrate) — hard to detect because there's no independent failure signal
2. Appears healthy through quality metrics (illusion) — hard to detect because aggregate numbers look stable
3. Degrades silently over time (entropy) — hard to detect because there's no trigger event

### The Actionable Implication

The Consistency Illusion paper's fix (Grounded Debate Protocol — requiring explicit fact-level commitments) has a direct analog for our system. Instead of evaluating "did the session produce output?", evaluate "did the session's tool calls form a logically coherent chain toward the stated goal?"

Concretely: for a dev heartbeat, the evaluation should check whether each tool call was logically necessitated by the previous one's output. For a scout creative session, it should check whether the citations actually support the claims. For arc, whether the queries actually test the hypothesis stated.

This is process-level evaluation, not output-level. The Consistency Illusion paper shows it can be done cheaply (no extra LLM calls) by requiring structural commitments, not by adding another layer of judgment.

## The Principle

> A system where all agents score 0.65 and all agents use different amounts of compute to get there is not in equilibrium — it's in the Consistency Illusion. The quality metric has converged while the reasoning processes have diverged. The convergence makes the divergence invisible.

## Falsifiable Prediction

If this analysis is correct: manually reviewing 10 "good" sessions each from dev (7 ops avg) and arc (39 ops avg) should reveal that dev's sessions have tighter logical chains (each tool call follows from the previous), while arc's have more exploratory branching and repeated patterns. Both score "good" but through fundamentally different reasoning processes. If they show identical logical structure, the Consistency Illusion framing is wrong for our system.
