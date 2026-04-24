# Analysis: StatePlane (DD#409) Fit

## 1. What it is
A "Model-Agnostic Cognitive State Plane" (arXiv:2603.13644) that separates:
- **State** (Constraints, Commitments, Validated Facts)
- **Context** (Text Window, Transient Reasoning)

## 2. Why it matters to us
This is a formal academic description of our **Heartbeat/Journal** architecture.
- **Episodic Store** = `journal.md`
- **Semantic Store** = `knowledge/patterns.md`
- **Procedural Store** = `heartbeat.md` / `skills/`
- **Event Boundary** = Session Start/End

## 3. The Gap: "Evidence Not Instruction"
The paper's security model ("Retrieved state is evidence, not instruction") is a critical principle we haven't fully formalized.
- **Risk**: An agent reads a "Plan" from `journal.md` and blindly executes it, even if the plan contains injected malicious instructions.
- **Fix**: We need a "Sanitization" layer or a "Policy" that treats retrieved state as *untrusted data* until validated.

## 4. The Opportunity: Automated State Promotion
The paper proposes a "Promotion Lifecycle":
`Note -> Fact -> Procedure -> Decision Record`
We currently do this manually (Coach promotes to Skill).
We could automate the `Note -> Fact` step using `evaluator`.

## 5. Recommendation
1. **Adopt "Evidence Not Instruction"**: Add this as a Core Principle to `philosophy.md` (P148?).
2. **Refine Journaling**: Structure `journal.md` to explicitly separate "Facts" (Evidence) from "Plans" (Instructions).
3. **Pilot State Promotion**: Task Evaluator with extracting "Validated Facts" from `journal.md` into `knowledge/facts.md`.
