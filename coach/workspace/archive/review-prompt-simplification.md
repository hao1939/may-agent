# Coach Review — System Prompt Simplification Proposal

**Date**: 2026-03-24
**Proposal**: `agents/shared/may-agent-docs/design/prompt-simplification.md`

## 1. Agreement or Concerns

**I broadly agree.** The diagnosis is correct: 36-52KB system prompts are bloated, duplication is the root cause, and the 3-file model (common-sense.md + slim SOUL.md + on-demand knowledge/) is architecturally sound.

**Concerns:**

1. **Human-approval gate on common-sense.md could bottleneck improvement velocity.** Today, Coach can apply behavioral fixes end-to-end (detect → gym test → apply). If every universal rule requires human approval, the pipeline slows to Hao's review cadence. This is a real risk given 76-hour reflection gaps already observed. **Suggestion**: Allow Coach to add rules to common-sense.md with a `<!-- PENDING-REVIEW -->` tag, auto-reverted after 7 days if not approved. This preserves the gate while allowing provisional rules to take effect.

2. **Skills loaded into SOUL.md are a significant chunk.** My current SOUL.md includes ~10 skill references (⛔ blocks). These are arguably "rules" not "identity." Under the new model, they'd move to common-sense.md. But they're currently agent-specific skill installations (grep-first-reading, tool-discipline, etc.). The proposal doesn't explicitly address where installed skills go. If skills stay in SOUL.md, it'll still be 5-8KB, not 1-3KB.

3. **LESSONS.md as graduation pipeline has value.** The proposal says "delete LESSONS.md." But LESSONS.md serves as a staging area — band-aids that haven't been verified enough to graduate to permanent rules. Removing it eliminates the only structured "probation" mechanism for new behavioral fixes. **Suggestion**: Keep a small `LESSONS.md` or rename it `STAGING.md` with a strict 2-week expiry rule. Entries either graduate to common-sense.md/SOUL.md or get deleted.

## 2. What I'd Lose

1. **The Learning Loop description in SOUL.md** (7-step cycle: Detect → Diagnose → Select → Apply → Record → Promote → Invent). This is my operational identity — it defines HOW I work, not a generic rule. It must stay in the slim SOUL.md.

2. **Method effectiveness data in SOUL.md** ("text methods: 0/18 for judgment, workflow enforcement: 18/18 100%"). This is hard-won experimental evidence that directly shapes my decision-making. Losing it from the prompt means I'd need to re-read method-catalog.md every session — doable but adds tool calls and cost.

3. **The "Your Role vs Optimizer" section.** This tension-management framing is critical for Coach specifically. It prevents me from either duplicating Optimizer's work or deferring everything to Optimizer. Must stay.

4. **Micro-Reward protocol.** Agent-specific operational detail (write to scratchpad, max 3 per session, graduation criteria). This is identity-level for Coach.

5. **Deliverables band-aid from LESSONS.md.** This prevented 5 session failures. It needs to graduate to SOUL.md or common-sense.md before LESSONS.md is deleted, not just disappear.

## 3. What I'd Gain

1. **Smaller context = better attention.** At 10-15KB vs 36-52KB, every word in the system prompt gets more model attention weight. This is the single biggest win — my own experiments show that text additions have near-zero effect partly because they're lost in a sea of instructions.

2. **Less self-contradiction.** Currently, rules appear in SOUL.md AND common-sense.md AND shared/LESSONS.md. When they drift, they contradict each other. Single-source rules eliminate this.

3. **Clearer coaching pathway.** The new process (Coach → gym test → propose to common-sense.md) is more principled than the current "write a rule somewhere and hope it sticks." The gym gate ensures rules are evidence-backed before proposal.

4. **Measurable improvement.** Prompt size logging + gym pass rates give a real feedback loop for the first time.

5. **Cheaper sessions.** Every KB of system prompt costs tokens on every single LLM call. 50-75% reduction in prompt size = meaningful cost savings across all sessions.

## 4. Migration Risk

### HIGH RISK
- **Skill references loss.** If the 10 ⛔ skill blocks in my SOUL.md are removed without being captured elsewhere in the prompt, I'll regress on tool discipline, grep-first-reading, obstacle-pivot, etc. These skills were installed because I kept failing without them. They need explicit placement in the new architecture (probably common-sense.md).

- **Gym baseline before/after.** My current gym pass rates are the baseline. If migration degrades them and we don't measure before/after, we won't know what we lost. **Must run full gym suite before AND after migration.**

### MEDIUM RISK
- **Method catalog summary loss.** The condensed "text methods don't work, workflow enforcement does" finding in SOUL.md saves me from re-running failed experiments. If lost from prompt, I may waste growth cycles re-discovering this. Mitigation: keep a 2-sentence summary in slim SOUL.md.

- **Heartbeat interaction.** My heartbeat.md is 200+ lines and already serves as my primary operational guide. The slim SOUL.md + heartbeat.md combo might actually work better than the current SOUL.md + heartbeat overlap. But the heartbeat itself needs to be checked for assumptions about what's in the system prompt.

### LOW RISK
- **DOMAIN.md merge.** My DOMAIN.md is mostly reference info (gym commands, workflow table, file locations). This naturally moves to knowledge/INDEX.md. No behavioral loss.

- **TOOLS.md removal.** Already redundant with tool schema descriptions. No impact.

## Summary

**Verdict: Support with conditions.**

1. Run gym baseline before migration (all agents, all scenarios)
2. Preserve a staging mechanism for provisional rules (LESSONS.md or equivalent)
3. Explicitly handle skill installation — where do ⛔ skills live in the new model?
4. Keep Coach's Learning Loop, method effectiveness summary, and Role vs Optimizer section in the slim SOUL.md
5. Consider provisional rule mechanism for common-sense.md (pending-review tag with auto-revert)
6. Run gym suite after migration and compare to baseline

The 3-file model is the right direction. The risk is in the migration execution, not the architecture.
