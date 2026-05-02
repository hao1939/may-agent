# Next Frontier Proposal

All 12 satellite projects are complete. The system-efficiency project is winding down. This document proposes three directions for what the agent system should tackle next.

---

## Proposal 1: Cross-Agent Collaboration

**Problem**: Agents currently work in silos. One agent's output (e.g., a triage report) doesn't automatically feed into another agent's input queue. Knowledge stays trapped in individual project directories, causing duplicate work and missed context.

**Expected Impact**: 30–50% reduction in redundant analysis across agents. Faster iteration cycles when multi-agent tasks arise.

**First Concrete Step**: Build a shared output index — a single manifest file listing all recent deliverables with tags, so any agent can query "what's been produced about X?"

**Estimated Effort**: 4–6 iterations

---

## Proposal 2: Self-Healing Workflows

**Problem**: When a workflow fails repeatedly (bad file path, missing dependency, rule violation), it currently burns iterations until a human or orchestrator manually diagnoses and fixes it. The 3 no-op iterations in system-efficiency are a mild example; at scale this waste compounds.

**Expected Impact**: Eliminate >80% of repeat failures. Reduce no-op iteration rate from ~0.09 to <0.03 system-wide.

**First Concrete Step**: Create an error-pattern registry mapping common failure signatures (e.g., "file not found," "edit text not matched") to automated remediation actions (e.g., re-read then retry, create file then edit).

**Estimated Effort**: 6–8 iterations

---

## Proposal 3: Output Quality Scoring

**Problem**: Current metrics track whether files get created, not whether they're useful. A 2-line stub and a thorough 80-line analysis both count as "1 deliverable." Without quality scoring, there's an incentive to produce shallow artifacts.

**Expected Impact**: Higher-value deliverables per iteration. Clear feedback loop for workers on what "good" looks like.

**First Concrete Step**: Define a 5-point rubric (completeness, actionability, accuracy, structure, conciseness) and retroactively score the 8 deliverables from system-efficiency as a calibration exercise.

**Estimated Effort**: 3–5 iterations

---

## Recommendation

Start with **Proposal 1 (Cross-Agent Collaboration)** — it has the highest leverage because it multiplies the value of all future work across every agent. Proposal 3 can run in parallel as a lightweight scoring exercise.
