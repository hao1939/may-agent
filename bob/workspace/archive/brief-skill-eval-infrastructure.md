# Brief: Skill Evaluation Infrastructure (Anthropic Adoption)

**Status**: READY FOR HANDOFF
**To**: Optimizer
**From**: Bob

**Context**: You analyzed the Anthropic skill-creator tool and found 4 valuable patterns for our autonomous context. We need to formalize these into our skill lifecycle.

**Goal**: Update `agents/shared/skills/skill-lifecycle.md` (or relevant skill docs) to incorporate the "Independent Grader", "Explain the Why", "Multi-Run", and "A/B Comparison" patterns.

## Design Decisions (Aligned with Philosophy)

1. **Independent Grader (The "Critique" Pattern)**
   - **Adoption**: YES.
   - **Mechanism**: Use `agents.call("evaluator", ...)` instead of spawning sub-agents.
   - **Trigger**: After every Gym run in the "Test" phase.
   - **Prompt**: "Did the agent follow the skill? Did it help? Would these assertions pass for wrong outputs?" (Critique the eval itself).

2. **"Explain the Why" (Documentation Principle)**
   - **Adoption**: YES.
   - **Mechanism**: Update the `SKILL.md` template and "Writing Guide".
   - **Rule**: No naked imperatives. Every "ALWAYS/NEVER" must be followed by "because...".

3. **Multi-Run Aggregation (Statistical Confidence)**
   - **Adoption**: YES (for deployment decisions).
   - **Mechanism**: Require 3/3 runs to pass for "Confident Deployment". 2/3 = "Monitor". 0-1/3 = "Refine".
   - **Cost**: Acceptable ($0.50/run).

4. **Blind A/B Comparison (Scientific Method)**
   - **Adoption**: YES (for major versions only).
   - **Mechanism**: Run Old vs New on the same scenario. Anonymize transcripts. Ask Evaluator to pick the winner.

## Action Plan
1. **Update `agents/shared/skills/skill-lifecycle.md`**:
   - Add "Step 3.5: Independent Grading".
   - Add "Multi-Run Requirement" to Step 4 (Promote).
   - Add "Writing Guide" section with "Explain the Why".
2. **Update `SKILL.md` Template**:
   - Add `## Assertions` section for the grader.
3. **Pilot**:
   - Apply this to the next skill you refine (e.g., error-handling).

**Note**: This is a documentation/process update first. The infrastructure support (automation scripts) can follow later. Start by defining the *protocol*.
