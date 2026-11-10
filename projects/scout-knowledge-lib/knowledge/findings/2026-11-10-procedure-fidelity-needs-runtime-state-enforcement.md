<ai_context>
summary: "An abstract-level study reports that an executable finite-state machine enforcing tool calls, state transitions, and turn completion substantially improves long-horizon SOP adherence over prompt restatement or resume-based baselines. Treat the result as evidence for external runtime control, not proof that one FSM design generalizes across procedures, models, or environments."
triggers: ["procedure fidelity", "long-horizon agent drift", "finite-state agent control", "SOP enforcement", "runtime workflow state", "agent execution control"]
last_updated: "2026-11-10"
source_basis: "arXiv:2611.10884v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request on 2026-11-10. Scout did not inspect the full paper, FSM implementation, SOP-Bench tasks, preregistration, prompts, trajectories, grading, cost calculation, code, or supplementary analyses."
</ai_context>

# Procedure fidelity needs runtime state enforcement

**Date:** 2026-11-10  
**Source:** [Keeping LLM Agents on Procedure: Executable Finite-State Control for Long-Horizon Instruction Fidelity](https://arxiv.org/abs/2611.10884v1)  
**Source revision:** arXiv:2611.10884v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

What does the reported finite-state controller establish about keeping language-model agents faithful to long procedures?

## What the abstract reports

The paper studies work where an agent receives a skill or standard operating procedure once and must apply it over a long unattended run. The authors report that plain agents drift from the stated procedure, while restating the instructions or resuming a stopped agent merely shifts the point at which a shortcut appears.

Their intervention keeps workflow state outside the model context in an executable finite-state machine (FSM). The runtime enforces that state at three boundaries:

1. tool calls;
2. state transitions; and
3. the end of the agent's turn.

In a preregistered experiment on 200-account SOP-Bench batches, the abstract reports that Claude Haiku 4.5 with the FSM made an average of 139 decisions both correctly and according to procedure, versus 48 for the strongest baseline. The reported 95% confidence interval for the difference is [46, 130], and the controlled system retained its rate through the end of the run. Across three models, the gain reportedly tracked how much the corresponding plain agent drifted. The abstract further reports that Haiku 4.5 with the FSM averaged more procedure-correct decisions than plain Claude Sonnet 4.6 at 38% of the cost. Analyses on SWE-bench Verified, tau-squared-bench, and staged and cross-context workflows are described as additional evidence that stronger execution control can improve long-horizon reliability.

## Scout interpretation

The useful signal is not merely “use an FSM.” It is that procedural reliability depends on **where the authoritative state and checks live**. Repeating prose leaves the model responsible for interpreting, remembering, and enforcing the procedure. An executable controller instead makes the runtime responsible for admitting actions and termination against explicit workflow state.

The three enforcement points also separate distinct failure classes:

- a **tool-call gate** can reject an operation that is invalid for the current state;
- a **transition gate** can reject skipping, reordering, or inventing workflow stages; and
- an **end-of-turn gate** can reject stopping before the state's required conditions are satisfied.

This extends the earlier [Goal-Autopilot finding](./2026-06-19-arxiv-ai-agent-triage.md#260611688-goal-autopilot-anti-fabrication-firewall-for-unattended-long-horizon-agents): Goal-Autopilot focused on preventing unsupported success claims at termination, while this paper's abstract claims that external state enforcement improves fidelity throughout repeated procedural decisions. The shared design principle is that durable state plus executable admission rules can turn an instruction from model guidance into a runtime invariant.

For agent platforms, the most transferable evaluation is therefore not a generic “FSM versus prompt” comparison. It should measure each boundary separately: invalid calls admitted, invalid transitions admitted, premature turns accepted, valid work incorrectly blocked, recovery after interruption, and cost per procedure-correct decision. The controller's specification and state must also be versioned and bound to the task instance; otherwise a stale or wrongly compiled FSM can enforce the wrong procedure consistently.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 441 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, preregistration, benchmark construction, account tasks, procedure definitions, baseline implementations, prompts, model settings, number and independence of batches, trajectories, graders, statistical analysis, serving prices, code, and artifacts were not inspected.

The abstract therefore does not establish how difficult it was to author or maintain the FSM, whether its rules completely represented each SOP, how often it blocked valid actions, whether the same controller transferred without task-specific tuning, or whether the reported cost comparison includes controller construction and runtime overhead. Results involving named model versions and harnesses are system-level observations, not evidence that the controller alone caused every difference. The additional benchmark analyses are mentioned but not quantified in the abstract, so they should not be treated as demonstrated generalization from this record alone.
