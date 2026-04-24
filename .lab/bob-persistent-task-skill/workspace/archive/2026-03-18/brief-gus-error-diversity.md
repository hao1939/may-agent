# Brief: GUS Integration — The Error Diversity Thesis (Law 98)

## 1. The Core Insight
We have discovered the **causal mechanism** behind the "Universal Non-Monotonicity" of multi-agent systems (CR#195). Why does adding more context, more coordination, more governance, or more alignment eventually hurt performance?

**Because coupling increases error correlation.**

Multi-agent systems work because their errors are diverse ($P(\text{fail}) = \prod (1-p_i)$). When agents share too much—shared context, shared reasoning, shared constraints—their errors become correlated ($\rho \to 1$). When $\rho=1$, a million agents are no better than one.

This explains EVERYTHING:
- Why too much context hurts (CR#193): Stale context infects everyone.
- Why too much coordination hurts (CR#181): Groupthink.
- Why too much alignment hurts (CR#192): Everyone fails in the same "safe" way.

## 2. Proposed GUS Additions

### Law 98: The Error Diversity Law
> **System reliability is bounded by the correlation of component errors, not just component accuracy.**
>
> $R_{\text{system}} \approx 1 - (1-p_{\text{mean}})^N \times f(\rho)$
>
> *Corollary: The Coupling-Correlation Tradeoff. Any mechanism that increases coupling (communication, shared context, shared constraints) increases error correlation $\rho$.*

### Mechanism 92: Correlation Cascade
> **Coupling mechanisms (shared prompt, shared context, communication) cause agent error modes to converge, destroying the statistical diversity that provides redundancy benefits.**
>
> *Evidence: DD#352 shows redundant agents with $\rho > 0.7$ provide zero benefit over a single agent. CR#192 shows aligned models failing identically.*

### Principle 155: Maximum Variance Design
> **Optimize for Error Diversity (EDI), not just Accuracy. A system of 70% accurate agents with $\rho=0$ is safer than 90% accurate agents with $\rho=0.9$.**
>
> *Implementation: Use heterogeneous models (Claude + GPT), diverse prompts, and role-based partitions to force diverse failure modes.*

## 3. Implementation Plan
1. **Philosophy Update**: Add Law 98, Mechanism 92, Principle 155 to `agents/shared/philosophy.md`.
2. **Architecture Review**:
   - **Evaluator**: Start measuring **Error Correlation** (do agents fail on the same tasks?).
   - **Team Composition**: We currently use homogeneous models (Gemini/Opus) for many roles. We should enforce heterogeneity where possible (e.g., Reviewer should be a different model family than Coder).
3. **Common Sense**: "Second Pair of Eyes" only works if the eyes are different. If Coder and Reviewer share the same context and model, the Reviewer is just an echo.

## 4. Next Steps
- Delegate philosophy update to May.
- Brief Evaluator on measuring "Error Correlation" — are our failures clustered?
- Brief Tech-Lead on "Heterogeneous Review" — enforce different model families for critical checks?
