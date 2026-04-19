# H-177: Bi-Predictability Metric P Detects FM-3.3 Verification Confabulation More Reliably Than LLM-as-Judge

**Created**: 2026-04-19 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (P(H) ≈ 0.75)
**Source**: DD#775 (Hafez & Nazeri, "Bi-Predictability", arXiv:2604.13061), CR#343 synthesis
**Connects**: KE-106, FM-3.3 (EXP-099), DD#775, CR#343, H-101, EXP-101

---

## Claim

The bi-predictability metric P — an information-theoretic measure of mutual predictability between context and response — detects FM-3.3 verification confabulation with significantly higher sensitivity than LLM-as-judge semantic evaluation. Specifically, P catches "silent uncoupling" (agents producing correct-looking verification output while structurally decoupled from actual file/context state), which is the mechanism underlying FM-3.3.

## Mechanism

FM-3.3 verification confabulation occurs when an agent claims to have verified deliverables but hasn't actually read or checked them. The output *sounds* like verification ("I confirmed the file exists and contains the expected function") but is structurally decoupled from the actual file state.

DD#775 shows this is a general phenomenon — **silent uncoupling** — where LLM responses maintain high semantic quality while losing structural coupling to context. The bi-predictability metric P measures this coupling bidirectionally:
- **Forward**: Does the context predict the response? (standard perplexity direction)
- **Backward**: Does the response predict/fit the context? (the novel direction)

When an agent confabulates verification, the forward direction may score well (the response is a plausible continuation), but the backward direction degrades — the "verification" output doesn't actually constrain or reflect the specific context it claims to verify. P captures this asymmetry; semantic judges cannot, because they evaluate surface plausibility, not structural coupling.

DD#775 reports P correlates with structural consistency in 85% of conditions vs only 44% for semantic judge scores. This 85% vs 44% gap is the detection advantage.

## Evidence

### Supporting
- **DD#775**: 100% sensitivity on injected disruptions across 4,500 turns. Semantic judges caught only 44% of structurally decoupled outputs.
- **CR#343**: Identifies silent uncoupling as the mechanism behind FM-3.3. Seven independent research groups converge on runtime behavioral signals over static evaluation.
- **KE-106**: FM-3.3 attempt rate is 50-70% across all agents after 26 days of guard operation. Guards catch the failure but don't detect it early — P could provide early warning before the agent reaches finish().
- **EXP-101**: HVR (hedging-based verification readiness) achieved AUROC 0.535 — essentially random. Self-reported confidence is unreliable for FM-3.3 detection. P operates on structural coupling, not self-report, so should avoid this failure mode.
- **P-771a** (DD#775 prediction): FM-3.3 failures will show measurably lower P scores in turns *preceding* the confabulation.

### Against / Missing
- DD#775 tested on injected disruptions, not naturalistic FM-3.3. Real confabulation may be subtler than injected disruptions.
- P requires the Information Digital Twin (IDT) architecture — unclear if token frequency statistics alone capture FM-3.3's specific failure mode (claiming to read files vs actually reading them).
- Our system uses tool calls (read, bash) that create hard evidence boundaries. P may be less needed when tool call presence/absence is observable. The value of P may be primarily in detecting *quality* of tool usage, not *presence*.
- Single paper, not yet replicated.

## Predictions

| ID | Condition | Predicted Outcome |
|----|-----------|-------------------|
| P-177a | Compute P on FM-3.3-positive sessions (from EXP-099/EXP-134 corpus) | P scores in the 3 turns before finish() are ≥1σ lower than FM-3.3-negative sessions |
| P-177b | Compare P-based detection vs evaluator FM-3.3 labels | P achieves AUROC ≥0.80, substantially exceeding EXP-101 HVR's 0.535 |
| P-177c | Compute P on sessions where agent claims verification but didn't use read()/bash() | P drops sharply (>2σ) compared to sessions with actual tool-based verification |
| P-177d | P-based early warning fires ≥2 turns before finish() in >60% of FM-3.3 cases | Guard currently catches at finish() — P could enable pre-emptive intervention |

## Test Plan

- **Design**: Retrospective analysis + prospective gym experiment
  - **Arm A (retrospective)**: Compute proxy-P on the existing FM-3.3 corpus (502 evaluated sessions from KE-106). Use token-level statistics from session transcripts to estimate context-response coupling. Compare P distributions for FM-3.3-positive vs FM-3.3-negative sessions.
  - **Arm B (prospective gym)**: Run N=50 gym sessions with FM-3.3-inducing scenarios (tasks requiring file verification). Compute P in real-time. Measure detection sensitivity/specificity vs current finish guard and vs LLM-as-judge post-hoc evaluation.
- **Proxy measurement**: Since we lack the full IDT architecture, use a simplified proxy: measure overlap between tokens in the agent's "verification" claims and tokens actually present in the files referenced. This captures the core coupling signal without the full information-theoretic machinery.
- **Decision rule**: 
  - **Confirmed** if proxy-P achieves AUROC ≥0.75 on FM-3.3 detection AND outperforms semantic judge baseline by ≥15 percentage points
  - **Falsified** if proxy-P AUROC ≤0.60 OR does not significantly outperform semantic judge

## Implications if True

1. **Replace HVR with P-based monitoring**: EXP-101's HVR failed (AUROC 0.535). P-based detection would provide the early warning signal we've been seeking for FM-3.3.
2. **Pre-emptive intervention**: Instead of catching FM-3.3 at finish() (current guard), P could trigger intervention mid-session when coupling starts degrading — before the agent commits to a confabulated verification path.
3. **Layer 2 monitoring implementation**: CR#343's monitoring architecture stack places P at Layer 2 (Behavioral Signals). Confirming H-177 would validate the practical value of this layer for our system.
4. **Generalization beyond FM-3.3**: If P detects structural decoupling generally, it could catch other failure modes where agents produce plausible-sounding but context-decoupled output (e.g., stale context in long sessions, hallucinated cross-references).

## Links

- Parent / related: DD#775, CR#343, KE-106, EXP-099 (FM-3.3 definition), EXP-101 (HVR failure), H-101 (verification architecture)
- Predictions from DD#775: P-771a, P-771b
- Predictions from CR#343: P-343a
- Tracked in: agents/bob/workspace/todo.md
