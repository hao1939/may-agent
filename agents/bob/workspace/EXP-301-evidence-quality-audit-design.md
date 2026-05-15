# EXP-301: Verification Evidence Quality Audit

**Hypothesis**: H-300 — Agents cargo-cult `verification_evidence` in finish() calls, citing vague tool references without substantive proof of correctness.

**Created**: 2025-05-02
**Status**: DESIGNED — awaiting execution
**Priority**: P2

## Background

The `verification_evidence` field is mandatory for `finish(success)`. But mandatory ≠ meaningful. If agents learn to satisfy the check with minimal-effort strings like "Step 12: bash showed tests pass" without actually verifying their work, the field becomes security theater.

Prior findings suggest structural guards can backfire (KE-091: forced verification harms complex tasks, -12-15pp from stacking interventions). So before proposing any fix, we need data on whether this is actually a problem.

## Method

### Phase 1: Sample Collection (1 session)
1. Query 20 recent `finish(success)` calls across agents (bob, coach, optimizer, tech-lead, scout)
2. Extract the `verification_evidence` arrays
3. Score each entry 1-5:
   - **1**: Placeholder/generic ("Step N confirmed success")
   - **2**: Names the tool but vague result ("bash showed tests pass")
   - **3**: Specific tool + specific claim ("read(src/app.ts) confirmed new export exists")
   - **4**: Specific + quotes output ("bash test exit code 0, 14/14 tests pass")
   - **5**: Multi-step chain proving correctness ("wrote file → read verified content → test confirmed behavior")

### Phase 2: Analysis
- Compute mean score per agent and overall
- Identify patterns: Do certain agents or task types produce worse evidence?
- Check correlation: Do low-evidence sessions have more rework/bugs?

### Success Criteria
- If mean < 3.0: Design a lightweight intervention (NOT a new mandatory rule — those backfire per KE-091)
- If mean >= 3.0: Close as "no problem" — evidence quality is adequate
- If mean 2.5-3.0: Monitor but don't intervene

## Constraints
- Do NOT add new mandatory rules. Per KE-123, stacking interventions causes -12-15pp regression.
- Any intervention should be structural (e.g., better prompt examples) not procedural (e.g., "you must do X").
- Sample must span at least 3 different agents to avoid agent-specific bias.

## Expected Outcome
Based on system observation, I predict mean ~2.5 — technically present but often shallow. The intervention (if needed) would be adding 2-3 high-quality examples to context.md files, leveraging KE-133's finding that few-shot helps compliance tasks.

## Relationship to Other Work
- **KE-091**: Forced verification guards harm complex tasks → don't make evidence rules stricter
- **KE-123**: Stacking interventions causes regression → any fix must replace, not add
- **KE-133**: Few-shot helps compliance → potential intervention mechanism
- **EXP-247**: Structural auditor validated → could be extended to audit evidence quality
