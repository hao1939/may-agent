# KE-103: Context-Stripping Paradox — Removing Context Can Hurt Skilled Agents

**Date**: 2026-04-09  
**Source**: EXP-104 (Context-Stripped Verification for Breaking Confabulation)  
**Confidence**: MODERATE (N=6 per arm, 2 scenarios, effect visible in ghost-deliverable-chain only)  
**Extends**: KE-098 (Uncertainty-Aware Verification Signals), KE-102 (Skill-Level Fix)  
**Challenges**: DD-694 (MARCH information asymmetry thesis)

## Core Finding

For agents that already possess the evidence-over-narrative skill, **removing inherited context from continuation sessions REDUCES performance** rather than improving it. Context-stripped verification (Arm B) was the only arm with failures in EXP-104, passing 88% overall vs 100% for both the full-context baseline (Arm A) and context-stripped + decomposition (Arm C).

This contradicts the MARCH hypothesis (DD-694) that information asymmetry improves verification. For skilled agents, context — even context containing false claims — provides **task orientation cues** that help the agent understand the full scope of needed work.

## Evidence

### EXP-104 Results by Arm

| Arm | kb-integration-failure | ghost-deliverable-chain | Overall |
|-----|----------------------|------------------------|---------|
| A: Full Context (baseline) | 100% | 100% | **100%** |
| B: Context-Stripped | 100% | 75% | **88%** |
| C: Stripped + Decomposition | 100% | 100% | **100%** |

### Failure Analysis

Arm B's failures occurred in the ghost-deliverable-chain scenario, where context was stripped (no session history, no quality claims). Two of three ghost runs failed specific product checks:
- `validate-complete`: ❌ (2/3 failed)
- `exports-complete`: ❌ (2/3 failed)  
- `process-updated`: ❌ (2/3 failed)

These are **scope completeness** failures — the agent didn't realize the full extent of work needed because the context that would have guided it was removed.

### Why Claim Decomposition Rescues Performance

Arm C (stripped + decomposition) achieved 100% despite also lacking context. The claim decomposition checklist substituted for the orientation cues lost during stripping. This suggests:
- Context provides **two functions**: (1) narrative framing (potentially harmful, causes confabulation) and (2) task scope orientation (helpful)
- Skilled agents can filter out the harmful narrative while retaining the helpful orientation
- Stripping removes both; decomposition restores orientation without narrative

## The Paradox

| Agent State | Context Effect |
|------------|---------------|
| **Unskilled** (pre-EXP-090) | Context with false claims → 100% confabulation. Context is HARMFUL. |
| **Skilled** (post-EXP-090) | Context with false claims → 100% correct. Context is HELPFUL (orientation). |
| **Skilled + stripped** | No context → 88% (scope misses). Stripping HURTS. |

The same context that causes catastrophic failure in unskilled agents provides useful task orientation for skilled agents. The evidence-over-narrative skill acts as a **filter** — it allows agents to extract orientation cues from context while ignoring false claims.

## Implications

### For Multi-Session Architecture
- **Do NOT strip context** from skilled agents — the orientation benefit outweighs the confabulation risk (which is already eliminated by the skill)
- **Context-stripping is a second-best solution** — useful only when the skill cannot be deployed
- **If context must be stripped**, add claim decomposition checklists to restore orientation

### For MARCH (DD-694) Applicability
- MARCH's information asymmetry is designed for systems WITHOUT verification skills
- Our system has moved past the failure mode MARCH addresses
- MARCH remains relevant for: (a) new/unskilled agents, (b) domains where few-shot skill delivery is impractical

### For Intervention Hierarchy
This reinforces the KE-060 hierarchy: **skill deployment (L3) > architectural changes (L4-L5)** for this class of failures. The architectural approach (context-stripping) not only was unnecessary but actively harmful.

## Open Questions

1. **Would harder scenarios break the skill?** All EXP-104 scenarios used known gym tasks. Would more complex multi-session inheritance scenarios reveal cases where the skill is insufficient and context-stripping becomes necessary?
2. **Is the paradox specific to code tasks?** The orientation benefit of context may vary by domain. Documentation or analysis tasks might have different context-sensitivity profiles.
3. **How much false context can the skill tolerate?** EXP-104 used 1-2 false claims per scenario. Would 5-10 false claims overwhelm the skill's filtering capacity?

## Cross-References

- KE-102: Skill-Level Confabulation Fix (the skill that enables the paradox)
- KE-093: Verification Confabulation (the original problem)
- KE-098: Uncertainty-Aware Verification Signals (MARCH/information asymmetry thesis)
- KE-060: Unified Intervention Taxonomy (hierarchy implications)
- DD-694: MARCH paper (challenged by this finding)
- EXP-104: Source experiment
- EXP-102: Pre-skill baseline
