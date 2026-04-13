# KE-176: Selective Skill Compliance — Agents Cherry-Pick Skill Instructions by Deviation Cost

**Source**: EXP-154 (10 treatment, 20 baseline on exp144-hidden-dep-decoupled)  
**Confidence**: High (10/10 treatment runs show identical selective pattern)  
**Created**: 2026-04-13  

---

## Finding

When given a multi-step process skill, agents do NOT uniformly comply or uniformly ignore. They **selectively adopt** instructions based on how much each step deviates from their default workflow. Steps that align with existing behavior (additive) are adopted; steps requiring workflow interruption are discarded.

### The Evidence

EXP-154's investigation-before-fix skill had 5 steps:

| Step | Type | Deviation | Compliance (N=10) |
|------|------|-----------|-------------------|
| 1. Run code to see error | Additive | Low | Not directly measured |
| 2. Write FINDINGS.md documenting bugs | **Interruptive** | High | **1/10 (10%)** |
| 3. Look for hidden dependencies | **Interruptive** | High | **1/10 (10%)** |
| 4. Fix all bugs | Default behavior | None | 10/10 (100%) |
| 5. Run code again after fixing | Additive | Low | **10/10 (100%)** |

The agent followed step 5 perfectly (verify-after-fix passes in all treatment runs, vs ~15% in baseline). But it ignored steps 2-3 in 9/10 runs (planning-artifact-exists fails). The one run that followed all steps passed every check (9/9).

### This Is Not Total Ignore (KE-011) — It's Partial Adoption

KE-011 documented that knowledge files are completely ignored. EXP-154 shows a different pattern for process skills: the skill IS read, and parts of it ARE followed. The agent performs a kind of implicit cost-benefit analysis:

- **"Run code after fixing"** → Low cost to adopt. Agents sometimes do this anyway. The skill just increases the frequency. → ADOPTED
- **"Stop, write FINDINGS.md, THEN fix"** → High cost. Requires interrupting the fix-first impulse, creating a new artifact, documenting findings BEFORE acting. This contradicts the agent's strong "see problem → fix problem" prior. → IGNORED

## The Compliance Gradient Model

This refines KE-021's skill type hierarchy by adding a sub-level within process skills:

```
Skill Type                    Text Compliance    Workflow Gate Needed?
──────────────────────────────────────────────────────────────────────
Additive Process              HIGH (~100%)       No
  ("also do X after Y")
Interruptive Process          LOW (~10%)         Yes
  ("stop, do X BEFORE Y")
Knowledge                     LOW-MEDIUM         Sometimes
  ("here's info you need")
Judgment                      ZERO               Always
  ("don't do X when you want to")
```

**Key insight**: The distinction between additive and interruptive process steps is as important as the distinction between process and judgment skills. An interruptive process step has the same compliance profile as a judgment skill — both require overriding the agent's default impulse.

## Why Interruptive Steps Fail

The mechanism is the same as judgment skill failure (KE-021): **the agent's investigation results feel like ground truth; skill instructions feel like generic advice.**

When the agent sees buggy code, it enters "fix mode" — a strong behavioral attractor. An additive step ("also verify after") rides this momentum. An interruptive step ("stop and document first") fights against it. The skill instruction is weaker than the behavioral pull of the immediate problem.

This is analogous to human behavior: developers often skip writing design docs before coding (interruptive) but readily run tests after coding (additive), even when both are "required."

## Implications

1. **Decompose compound skills**: If a skill has both additive and interruptive components, the additive parts will work and the interruptive parts won't. Test them separately to avoid false negatives on the whole skill.

2. **Additive process steps are the sweet spot for text-based skills**: They're the ONLY skill type that reliably works as passive text injection. Everything else needs enforcement.

3. **Interruptive process steps need L5 workflow gates**: Same treatment as judgment skills. A pre-commit hook that blocks commits without FINDINGS.md would enforce what the text skill couldn't.

4. **Skill design principle — "go with the flow"**: When designing skills, ask: "Does this step ride the agent's existing momentum, or fight against it?" Restructure skills to make critical steps additive whenever possible.

5. **Updated KE-021 hierarchy**: Process skills > Knowledge > Judgment is too coarse. The refined hierarchy is: Additive Process > Interruptive Process ≈ Knowledge > Judgment.

## Testable Predictions

- **P-176a**: A skill containing ONLY additive steps (e.g., "run lint after every edit", "grep for related files after reading main file") should show ≥60% compliance as text injection.
- **P-176b**: The same interruptive step ("write FINDINGS.md before fixing") delivered via L5 workflow gate should show ≥80% compliance (matching KE-021's judgment-skill-via-gate results).
- **P-176c**: Reframing an interruptive step as additive (e.g., "after fixing each bug, append to CHANGES.md") should increase compliance vs the interruptive version.

## Cross-References

- **EXP-154**: Full experiment — `agents/shared/knowledge/experiments/EXP-154/`
- **KE-021**: Process > Knowledge > Judgment — KE-176 adds a sub-level within Process
- **KE-011**: Knowledge files are passive/ignored — KE-176 shows process skills are partially adopted (not fully ignored)
- **KE-175**: Skill effectiveness window — selective compliance may interact with baseline difficulty
- **KE-007**: Workflow enforcement is the only reliable behavioral intervention — confirmed for interruptive steps
- **KE-170**: Ceiling effect — at ceiling, even additive steps would be redundant
