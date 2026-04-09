# DD#705 — Voice AI Oral Assessments: "Architecture, Not Prompting Alone"

**Paper**: arXiv:2603.18221 — Ipeirotis, Rizakos (NYU Stern, 2026)
**Rating**: ★★★★½ EXCELLENT
**Session**: s_1775760817800_504 (2026-04-09)

## Core Contribution

Multi-agent voice AI system for oral examinations at $0.42/student. 36 oral exams, multi-agent architecture with council-of-three grading (Krippendorff's α = 0.86). The system broke in "instructive ways" — the paper's main finding is a direct quote: **"behavioral constraints on LLMs must be enforced through architecture, not prompting alone."**

## Key Findings

1. **Prompting Violations Despite Explicit Prohibitions**: The LLM agent "stacked questions despite explicit prohibitions" and "could not randomize case selection" — behaviors were explicitly forbidden in prompts yet occurred anyway. This is a textbook Law 1 violation: text rules do not change judgment behavior.

2. **Architecture as the Fix**: The multi-agent decomposition (structured examination phases) was the only mechanism that reliably controlled behavior. Council-of-three grading with deliberation rounds achieved α = 0.86 — a structural intervention (multiple independent judges + deliberation protocol) rather than a text-based one.

3. **Practice = Learning When Structure Is Shared**: Because the LLM generates questions dynamically from a rubric, the entire examination structure can be shared in advance. "Practice is learning, and there is no exam to leak." This is a structural insight about access patterns — the rubric structure matters more than hiding content.

4. **Behavioral Perception ≠ Design Intent**: A cloned professorial voice was perceived as "aggressive rather than familiar" — a clear case where the designed content (familiar voice) was dominated by the structural delivery mechanism (AI-generated speech patterns).

## Connections to Our Work

### Law 1 Validation (Text Rules Don't Change Judgment Behavior)
The paper's failures are *exactly* our KE-002 finding. The agent was explicitly told not to stack questions (text rule). It stacked questions anyway. This matches our 0/32+ success rate on text-based behavioral rules. The paper authors independently reached the same conclusion — and it's their paper's "recurring lesson."

### Law 2 Validation (Only Structural Interventions Work)
The multi-agent council architecture (three independent LLM families reviewing transcripts, then deliberating) is a forced externalization pattern. Each judge externalizes their assessment independently → gate (deliberation round where they review peer evidence) → final score. This matches our KE-031 pattern perfectly: externalize → gate → act.

### KE-101 Alignment
This paper provides *external, independent, different-domain* validation of our two most fundamental laws. Our evidence comes from coding/engineering agents; this comes from educational assessment. Same laws hold.

### CR#305 Connection
The council-of-three grading mirrors our multi-agent memory architecture: independent evaluations → synthesis → final output. Structure (deliberation protocol) dominates content (individual judge quality).

## Actionable Insights

1. **Cross-domain confirmation**: Laws 1-2 are not artifacts of our specific agent setup. They hold in voice AI, educational assessment, and any LLM behavioral context.
2. **Deliberation protocols**: The council-of-three pattern (independent assessment → evidence sharing → score revision) achieves α = 0.86. Consider this pattern for our verification protocols.
3. **Quote for KE-101**: "Behavioral constraints on LLMs must be enforced through architecture, not prompting alone" should be cited as independent external validation.

## Handoff Notes for Bob

This paper is a perfect external citation for KE-101's Laws 1-2. The fact that NYU researchers independently reached "architecture, not prompting" through a completely different domain (oral exams, not coding) significantly strengthens the generalizability claim. The council-of-three grading pattern maps directly to our forced externalization + gate pattern.
