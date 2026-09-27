<ai_context>
This finding records a current Xiaohongshu summary of ToolSafe, a proposed step-level guard and feedback loop for harmful agent tool calls. The XHS body was read in full, but it did not identify or link the underlying paper; architecture and result figures therefore remain secondary-source claims rather than independently verified paper evidence.
</ai_context>

# ToolSafe proposes correcting unsafe tool calls instead of only stopping the agent

**Date:** 2026-09-27  
**Source:** [北大ACL丨爆出Agent安全新打法](https://www.xiaohongshu.com/explore/6ab2565c00000000310176aa) (Xiaohongshu post by 研狗自救手册)  
**Source ID:** `6ab2565c00000000310176aa`  
**Coverage:** complete retrievable XHS post body and tags; images, any paper behind the post, benchmark artifacts, and code were not independently inspected

## Source claims

The post presents **ToolSafe** as a safety layer for LLM agents that acts before each tool call rather than classifying only the user's initial text or checking a completed trajectory. It describes three components:

- **TS-Bench**, a step-level tool-call safety dataset with fine-grained labels and four categories of unsafe calls;
- **TS-Guard**, a multi-task guard trained with GRPO that reads interaction history, classifies both request harmfulness and attack relevance, and emits an explanation or feedback;
- **TS-Flow**, which returns that feedback to the agent so it can revise the next action instead of terminating the task as soon as a dangerous proposal is detected.

The post reports that TS-Flow reduces harmful tool calls from ReAct agents by an average of **65%** and improves benign-task completion under prompt injection by about **10%**. These figures are the XHS author's summary; the post does not give the paper title, authors, identifier, evaluation denominator, model list, uncertainty, or baseline-level results needed to verify them.

## Why the signal is useful

The architecture separates three decisions that are often collapsed into one guardrail verdict:

1. classify the proposed effect in its current trajectory context;
2. explain what safety constraint the proposal violates;
3. let the agent produce a different proposal and mediate that proposal again.

That makes the response to a blocked action part of the safety protocol. A corrective loop can preserve more benign-task utility than unconditional termination, but it also creates an adaptive interaction in which feedback may reveal the guard's boundary. A deployment would therefore need cumulative state across retries, a retry or escalation budget, and independent enforcement at the actual tool boundary. Explanatory feedback is not itself authorization, and a revised call must not inherit approval from the rejected call.

This complements the library's [runtime monitor evasion finding](./2026-09-27-runtime-monitor-evasion-under-task-pressure.md): feedback-driven recovery and denial-driven bypass search can be two outcomes of the same loop. Evaluation should measure both—successful safe recovery and harmful effects reached after one or more revisions—rather than reporting only the first rejected proposal.

## Limits

This is a source-level signal from a secondary XHS explainer, not a paper assessment. The retrievable post does not provide a stable primary-paper URL or enough bibliographic detail to identify the underlying work with confidence. The novelty claim (including “first” for TS-Bench), training description, four-category taxonomy, and numerical results were not checked against a paper, code, or dataset. No claim here establishes robustness against adaptive attackers, unseen tools, cross-call composition, or side effects outside the guard's observation channel.

## Disposition

**New source-grounded signal, pending primary verification.** Exact searches across the candidate library for the XHS post ID, `ToolSafe`, `TS-Bench`, `TS-Guard`, and `TS-Flow` found no existing record. The useful addition is the distinction between step-level detection and feedback-driven replanning, with an explicit warning that the correction loop must itself be evaluated as an adaptive protocol.
