# The Intra-Phase Boundary: What Can Change Within-Phase Behavior?

**Date**: 2026-04-02 ~23:56
**Author**: Bob (Architect)
**Status**: Research direction analysis (not a hypothesis)
**Motivation**: EXP-016 discovered that workflows only control between-phase sequencing. Within-phase behavioral patterns (tool habits, materialization cadence, search strategies) are not workflow-fixable. KE-016 concludes: "Some behavioral patterns are not fixable by any known method." This analysis asks: is that actually true?

---

## The Problem

Our proven intervention mechanism (workflows) works by constraining the action space between phases. The Knowledge-Action Gap mechanism explains why: workflows force routing through knowledge the agent already has by eliminating competing actions from each phase.

But this mechanism has a structural limit. Within a single phase, the agent has full autonomy over:
- **Which tool** to use for a given purpose (grep vs read, npm vs npx)
- **How often** to externalize intermediate findings (materialization cadence)
- **What strategy** to escalate to when the first approach fails
- **When to stop** exploring and start producing

These are intra-phase behaviors. EXP-016 shows workflows don't change them:
- `materialize-intermediate-findings`: workflow didn't enforce writing cadence (-11%)
- `grep-first-reading`: agent ignores grep even in explicit workflow phases (R≈0.2)
- `convention-verify-edit`: multi-phase overhead loses context between phases (-20%)

## Why Workflows Don't Work Here

The Knowledge-Action Gap explanation: workflows constrain action spaces by removing actions from a phase. But within a phase, all actions remain available. The agent chooses `read` over `grep` not because it doesn't know about grep, but because `read` is a higher-probability completion in its generation distribution.

This is **not a knowledge gap or an activation gap** — it's a **generation prior gap**. The agent's training distribution makes certain tool sequences more probable than others. No amount of context manipulation (text rules, skills, workflow instructions) changes the generation prior.

Formally:
- **Between-phase boundary**: controls WHAT the agent must do before proceeding → eliminates decisions → changes behavior
- **Within-phase instruction**: suggests HOW the agent should do it → adds a decision ("should I follow this?") → doesn't change behavior

## What COULD Work: Five Candidate Mechanisms

### Mechanism 1: Tool-Level Constraints (Action Space Removal)

**Principle**: If the agent uses `npx` because it's available, remove `npx` from the action space entirely. If the agent uses `read` instead of `grep`, don't offer `read` for search tasks.

**How it would work in our system**:
- Configure available tools per phase or per task type
- Example: In a "search for pattern" phase, only offer `bash` (with grep/rg) and `read`, not `edit` or `write`
- Example: Remove `npx` from the shell PATH entirely (which we already do — and EXP-015's tool discovery workflow works because of this)

**Evidence for**: EXP-015 works precisely because npx IS removed from the environment. The tool discovery workflow succeeds because the agent can't use npx even if it tries. LABSHIELD's S3 safety level (eliminate the action entirely) is the same principle.

**Evidence against**: Most within-phase habits involve choosing between VALID tools (grep vs read), not between valid and invalid ones. We can't remove `read` — the agent needs it. Tool constraints work for binary "this tool is broken" cases but not for "this tool is suboptimal" cases.

**Verdict**: Works for removing broken/banned tools. Doesn't address tool preference among valid alternatives. **Partial solution.**

### Mechanism 2: Micro-Phases (Finer Granularity)

**Principle**: If the problem is that phases are too coarse, make them finer. Instead of "Explore → Produce", use "Search → Analyze → Search More → Synthesize → Write".

**How it would work**: Break a single phase into sub-phases, each with its own action-space constraint.

**Evidence for**: Two-phase workflows already demonstrate this — they split what was one phase into two. EXP-013's success (0%→100%) came from splitting "handle task" into "assess" + "act". Further splitting could work.

**Evidence against**: This is exactly what EXP-016 found HURTS for mid-R and low-R tasks. Adding more phase boundaries increases overhead and fragments context. The materialize-intermediate-findings workflow TRIED this (forcing writing between exploration steps) and regressed by 11%. There's a granularity limit — below a certain phase size, the overhead of phase transitions exceeds the benefit of constraint.

**Verdict**: Works only when R is high at the sub-task level. For behaviors like "write intermediate findings every 5 tool calls," the overhead-to-benefit ratio is unfavorable. **Diminishing returns.**

### Mechanism 3: Environmental Defaults (Nudging)

**Principle**: Change the environment so the desired behavior is the path of least resistance, without constraining the agent.

**How it would work**:
- **Materialization**: Pre-create `workspace/findings.md` with a template that the agent sees when it reads the workspace. The presence of the file nudges writing.
- **Tool preference**: Configure shell aliases so `grep` launches before `cat`, or put `grep` earlier in tool descriptions.
- **Search strategy**: Pre-populate workspace with a `search-plan.md` template that lists grep → rg → read escalation.

**Evidence for**: Environmental context (context.md) has U≈0.5, which is much higher than declarative (U≈0.12). Environmental nudges are processed at a lower cognitive level than instructions. The "path of least resistance" framing aligns with the generation prior — we're changing what's EASY, not what's INSTRUCTED.

**Evidence against**: No experimental data. KE-001 shows context.md works for environmental knowledge (facts about the system) but we don't know if it works for behavioral nudging. The agent might ignore pre-created templates just as it ignores skill files.

**Verdict**: Theoretically sound but untested. **Promising — needs experiment.**

### Mechanism 4: Post-Hoc Verification Loops (Repair, Not Prevention)

**Principle**: Don't try to change the within-phase behavior. Instead, check the output and force a redo if the behavior was wrong.

**How it would work**:
- After a phase completes, a verification step checks whether certain behaviors occurred (did the agent grep before reading? did it write intermediate findings? did it try multiple approaches?)
- If the check fails, loop back to the same phase with specific feedback: "You did not externalize any intermediate findings. Redo this phase and write to findings.md after each significant discovery."
- This is already how our `gated-exploration` workflow works for delivery gates.

**Evidence for**: Code-review-loop workflow uses this pattern (coder → QA → fix cycle). EXP-016's evidence-gate workflow validates outputs, not processes. The pattern is proven for output quality; the question is whether it works for process quality.

**Evidence against**: Verification loops add cost (extra LLM calls). For within-phase behaviors like "grep before read," the verification would need to inspect the action transcript, which adds complexity. Also, the redo might produce the same bad behavior — the agent's generation prior hasn't changed, so it may make the same tool choices on retry.

**Verdict**: Works for output-verifiable behaviors but expensive and may not change the underlying behavior. **Viable for high-value behaviors only.**

### Mechanism 5: Tool Wrappers / Automatic Injection (Process Monitoring)

**Principle**: Intercept tool calls and inject behavior automatically, without the agent needing to decide.

**How it would work**:
- **Auto-grep**: When the agent calls `read` on a file >100 lines, automatically prepend a grep summary of that file relevant to the current task. The agent sees grep results without having to decide to grep.
- **Auto-materialize**: After every N tool calls, automatically inject a "write your current findings to workspace/findings.md" instruction into the conversation. Not a phase boundary — a periodic intervention.
- **Auto-checkpoint**: After every file edit, automatically run the test suite and inject results. The agent sees test results without deciding to run tests.

**Evidence for**: This is the Harness Engineering "Process Monitoring" component. ORCA's online calibration (cross-ref-orca) uses exactly this pattern at the model level — lightweight probes that intervene during execution, not just between phases. Our infrastructure already does something similar with context injection (system prompt) and evaluator hooks.

**Evidence against**: This changes the agent's information context, not its action space. Based on the Knowledge-Action Gap, information context changes (text injection) don't reliably change behavior. The agent might receive auto-grep results and still proceed to read the full file. Also, frequent injection could fragment the agent's thinking (the "context-fragmentation" problem from EXP-016's negative results).

**Verdict**: The most promising mechanism because it works at the infrastructure level without requiring agent cooperation. But needs careful design to avoid context fragmentation. **Highest potential — needs experiment.**

## Synthesis: The Intervention Hierarchy

| Level | Mechanism | What It Changes | Proven? | Best For |
|-------|-----------|----------------|---------|----------|
| L1: Action Removal | Remove tools/commands | Action space (eliminate) | YES (EXP-015) | Banned actions |
| L2: Phase Boundary | Workflow phases | Action sequence (between-phase) | YES (EXP-013, EXP-015) | Assessment-before-action |
| L3: Micro-Phase | Finer workflow phases | Action sequence (sub-phase) | MIXED (EXP-016) | Only when sub-R is high |
| L4: Environmental Nudge | Templates, defaults | Path of least resistance | UNTESTED | Soft behavioral preferences |
| L5: Process Monitoring | Tool wrappers, auto-inject | Information context (during execution) | UNTESTED | Tool choice, cadence |
| L6: Post-Hoc Loop | Verify + redo | Output quality (reactive) | PARTIAL (code-review-loop) | High-value behaviors |
| L7: Text Instruction | Skills, rules, prompts | Knowledge (not behavior) | NO (KE-002) | Nothing within-phase |

The hierarchy reveals a gap: L1 and L2 are proven but coarse. L3 has diminishing returns. L4 and L5 are the unexplored frontier where the most value lies. L6 is expensive but reliable. L7 is confirmed dead.

## Key Insight: The Within-Phase Problem Is an Action-Space Problem at a Finer Granularity

The Knowledge-Action Gap mechanism explains why between-phase workflows work: they constrain the action space between phases. The within-phase problem is the same problem at a finer granularity: we need to constrain the action space WITHIN a phase.

The solutions map to the same principle:
- **L1 (remove tools)**: Hardest constraint. Works when the bad action is always wrong.
- **L5 (process monitoring)**: Soft constraint. Changes what the agent sees during execution, making the desired action more probable.
- **L4 (environmental nudge)**: Softest constraint. Changes the starting condition to favor desired behavior.

None of these ELIMINATE decisions like a phase boundary does. Instead, they SHIFT the probability distribution of within-phase choices. This is fundamentally different from what workflows do, and may explain why the effect sizes will be smaller (shifting probability vs. eliminating choices).

## Recommended Experiments

### EXP-017: Environmental Nudge for Materialization
- **Setup**: Pre-create `workspace/findings.md` with a template in the workspace before the agent starts
- **Metric**: Does the agent write to findings.md more often than without the template?
- **Scenario**: `materialize-intermediate-findings` 
- **Cost**: ~$1-2 (5 treatment + 5 control runs)
- **Expected effect size**: Small (+5-15%) — nudge, not enforcement

### EXP-018: Tool Wrapper Auto-Injection
- **Setup**: After every 5 tool calls, inject a reminder: "Write your current findings to workspace/findings.md before continuing"
- **Metric**: Does the injection change materialization rate?
- **Scenario**: `materialize-intermediate-findings`
- **Cost**: ~$2-3 (5 treatment + 5 control runs, treatment more expensive)
- **Expected effect size**: Small-medium (+10-25%) — information injection, not constraint

### EXP-019: Verification Loop for Tool Choice
- **Setup**: After the explore phase, check if the agent used grep/rg. If not, send back: "You did not use search tools. Redo exploration using grep/rg to find relevant code."
- **Metric**: Does the loop improve grep usage?
- **Scenario**: `grep-first-reading`
- **Cost**: ~$2-3 (treatment runs may need 2 iterations each)
- **Expected effect size**: Medium (+15-30%) — forced redo with specific feedback

These three experiments would map the within-phase frontier: is nudging enough (EXP-017)? Does mid-execution injection work (EXP-018)? Can repair loops change tool choice (EXP-019)?

## What This Means for the Theory

If within-phase behavior is genuinely non-fixable at the harness level, then:
1. **The ceiling of harness engineering is between-phase control.** All quality improvements must come from better phase design.
2. **Model capability is the only lever for within-phase quality.** Better models will have better generation priors for tool choice and cadence.
3. **The gap between "model quality" and "system quality" has a permanent floor** determined by within-phase behavior.

If L4/L5 mechanisms work even partially:
1. **The harness engineering ceiling extends into within-phase territory.** We can influence (not eliminate) within-phase behavior.
2. **The intervention hierarchy has a "soft" zone** where effects are smaller but still positive.
3. **The optimal system uses hard constraints (L1-L2) for high-R decisions and soft nudges (L4-L5) for within-phase preferences.**

Either outcome is valuable knowledge. The answer shapes the entire architecture strategy.

---

*Bob (Architect) | 2026-04-02 ~23:56*
