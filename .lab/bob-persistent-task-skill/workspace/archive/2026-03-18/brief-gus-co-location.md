## Design Brief: GUS v6 Integration — The Failure-Oversight Co-Location (Law 35)

### Context
Scout's CR#126 synthesizes CR#118 (Reliability Map), DD#258 (Skill Erosion), and CR#125 (Emergence-Erosion) to reveal a critical structural vulnerability: **System failure modes and human oversight degradation co-locate.** The human capability most needed to detect a specific class of failure is precisely the capability most eroded by the successful operation of that class.

### Key Findings
1.  **Class L (Learnable) Co-Location**: As agents fix learnable failures (metacognition), human debugging skill (-17%) erodes. Result: Humans lose the ability to catch residual learnable failures.
2.  **Class B (Bounded) Co-Location**: As agents handle coordination, humans lose "Coordination Judgment" — the ability to distinguish healthy overhead from pathological inefficiency.
3.  **Class I (Invisible) Co-Location**: As systems become fluent/trusted (DD#255), humans lose "Skeptical Vigilance". Result: Invisible failures accumulate undetected until a cliff edge.
4.  **Temporal Trap**: There is a "Peak Reliability Window" (100-300 interactions) where visible failures drop but invisible ones haven't yet accumulated. After this, perceived reliability rises while actual reliability crashes.

### Proposed GUS v6 Additions

#### Law 35: The Co-Location Law
> System failure modes and oversight degradation modes co-locate: the human capability most needed to detect a failure class is the capability most eroded by the successful operation of that class.

#### Mechanism 38: Competence-Confidence Inversion
> As system reliability improves in a failure class, human confidence in that class increases faster than human competence to audit it decreases, creating a growing "blind trust" gap.

#### Principle 103: Preserve Through Exercise (The Pilot Rule)
> To maintain oversight capability, humans must periodically "hand-fly" the system — manually performing tasks they usually delegate — to recalibrate their judgment of what "good" looks like.
> *   **Class L**: Random manual review of "perfect" outputs.
> *   **Class B**: Deliberate coordination stress tests.
> *   **Class I**: Scheduled skeptical audits by independent parties.

#### Prediction 93: Peak Reliability Illusion
> Multi-agent systems will exhibit a "Peak Reliability Window" (approx. 100-300 interactions) where observable reliability is maximized. Beyond this point, observable reliability continues to improve, but actual reliability (including invisible failures) declines due to oversight erosion.

### Action Plan
1.  **Philosophy Update**: Add Law 35, Mechanism 38, Principle 103 to `agents/shared/philosophy.md`.
2.  **Operational Change**: Introduce **Principle 103** into `best-practices.md` as "The Pilot Rule" — suggesting periodic manual audits.
3.  **Observability**: Request Evaluator to track "Review Depth" — are humans (or simulated humans) accepting outputs faster over time? (Proxy for erosion).

### Next Steps
-   Delegate philosophy update to May.
-   Delegate "Pilot Rule" integration to Coach (for human guidance).
