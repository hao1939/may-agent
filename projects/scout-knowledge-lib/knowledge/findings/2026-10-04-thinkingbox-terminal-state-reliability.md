<ai_context>
summary: "ThinkingBox evaluates stateful business-workflow agents against executable checks of terminal backend state and side effects, then repeats each of 507 synthetic tasks 20 times. Its published results show that clean termination plus a state-changing tool call is weak completion evidence and that one-shot breadth can diverge sharply from repeat reliability; the benchmark is useful evaluation infrastructure, but its tasks are synthetic and Scout did not reproduce the runs."
triggers: ["ThinkingBox", "terminal state evaluation", "stateful agent benchmark", "repeat reliability", "observed 20/20", "tool-call proxy", "backend side effects"]
last_updated: "2026-10-04"
source_basis: "HN item 49952030, the Microsoft/Hugging Face launch article's mechanism, results, run instructions, and limitations, arXiv 2608.19741v4 abstract, and current repository/release identities. Scout did not run ThinkingBox, inspect all 507 task assertions, reproduce model campaigns, or independently validate cost and accuracy figures."
</ai_context>

# Stateful agents need terminal-state checks and repeat reliability

**Date:** 2026-10-04  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49952030  
**Article:** https://huggingface.co/blog/microsoft/thinkingbox  
**Paper:** https://arxiv.org/abs/2608.19741v4  
**Repo:** https://github.com/microsoft/thinkingbox  
**Inspected repository revision:** [`892964e7226044e5463ad188da119df838f4bec1`](https://github.com/microsoft/thinkingbox/commit/892964e7226044e5463ad188da119df838f4bec1)  
**Benchmark release:** [`thinkingbox-bench-v1.0`](https://github.com/microsoft/thinkingbox-data/releases/tag/thinkingbox-bench-v1.0) (`fcaba4c1a9debec42fda7f15bf29fe6d6b46c431`)

## Question

What does the new ThinkingBox release add to agent evaluation beyond final-answer grading or checking whether tool calls succeeded?

## Source-grounded finding

ThinkingBox makes the **terminal backend state** the main unit of evaluation. Its 507 policy-conditioned synthetic workflows cover retail, hospitality/travel, auto insurance, neobank, and consulting support. Each attempt starts in an isolated MCP-compatible session, records a full trace, extracts side effects, and applies task-specific executable checks that accept any valid trajectory while rejecting wrong, missing, or extra effects. The launch article says 477 tasks are graded on state alone and 30 also use a narrow final-response rubric.

This matters because a plausible response and apparently successful tool use are weak proxies for completion. In the article's common-set ablation—121,680 valid trials across 12 models—79,853 attempts failed executable checks. Of those failures, 67.24% still terminated cleanly, invoked a state-changing tool, and reported no final tool error. Overlapping state diagnostics found wrong field values in 77.61% of those failures, extra unintended effects in 43.30%, and missing required effects in 25.36%.

The benchmark also separates three questions that a single success rate collapses:

- **pass@1:** How often does an attempt succeed?
- **pass@20:** Does a task succeed at least once in 20 attempts (breadth)?
- **observed 20/20:** Did all 20 recorded attempts succeed (repeat reliability)?

The distinction changes model selection. In the launch results, Kimi-K3 solved 476 of 507 tasks at least once (93.89%) but passed only 68 tasks on all 20 attempts (13.41%). Claude Opus 5 solved fewer tasks at least once (79.09%) but passed 241 tasks on all 20 attempts (47.53%). These are author-reported observations from the published campaign, not Scout-reproduced measurements. The paper abstract reports a related `pass^20` statistic; it should not be silently substituted for the article's literal observed-20/20 count.

## Reusable evaluation pattern

For an agent that changes durable records, evaluate the effect rather than the narration:

1. initialize a clean, isolated state;
2. give the agent only the task, dialogue, policy, and tool schemas;
3. keep golden state, assertions, grading logic, and credentials outside the agent trust boundary;
4. inspect terminal authoritative state and derive actual side effects;
5. reject wrong, missing, and extra effects independently of clean process termination;
6. separate infrastructure errors from model outcomes, but account for every attempted episode;
7. repeat from identical starting state and report both occasional capability and all-runs reliability; and
8. pin the framework, task bundle, evaluator, and model endpoint identity behind each reported result.

This is stronger than validating a tool-call transcript: the same syntactically valid calls can leave a ticket in the wrong status, mutate the wrong record, or omit a required effect. It also sharpens deployment economics. The article reports both cost per successful attempt and cost per task that passed all 20 runs; the cheapest one-off success was not the cheapest dependable task.

## Limits

- Every public task is a synthetic reconstruction. The authors model real enterprise patterns, but no customer records or production workflows are represented.
- Scout read the launch article's mechanism, results, execution, and limitations sections plus the v4 abstract, but did not read the full paper, execute the environment, inspect all task assertions, or reproduce any model result.
- The large failure percentages come from a 12-model common-set ablation, while other article tables cover 18 models. They should not be generalized to every model or deployment.
- Task-specific executable checks are only as sound and complete as their encoded golden outcomes. State-based grading can still miss an unasserted requirement or encode an incorrect policy.
- The 20 repeats estimate reliability under the benchmark's fixed task distribution and endpoint conditions; they do not prove production reliability under drift, concurrency, outages, adversarial users, or changing policies.
- Cost figures use an author-constructed OpenRouter/list-price snapshot and are comparative estimates, not production invoices.
- The inspected repository revisions identify current source state at observation time. Scout did not establish that every result in the article was generated from those current HEAD commits; the benchmark release tag is the stronger data identity.

## Relevance to agent runtimes

A completion transition should not be mintable from an agent's final message or an exit-zero/tool-success combination. For stateful work, the completion gate needs fresh evidence from the authoritative state and explicit checks for collateral effects. Reliability reporting should also retain the difference between “this task worked at least once” and “this task worked on every recorded attempt.”

This complements [runtime verdict integrity](../agent-runtime-verdict-integrity.md), which covers protected completion evidence and negative controls. ThinkingBox adds a released, repeat-run business-workflow benchmark whose published failure breakdown quantifies how often clean traces disagree with terminal state.

## Sources reviewed

- [HN item 49952030](https://news.ycombinator.com/item?id=49952030)
- [Microsoft/Hugging Face launch article](https://huggingface.co/blog/microsoft/thinkingbox)
- [ThinkingBox paper v4 abstract](https://arxiv.org/abs/2608.19741v4)
- [ThinkingBox framework](https://github.com/microsoft/thinkingbox/tree/892964e7226044e5463ad188da119df838f4bec1)
- [ThinkingBox-Bench v1.0 release](https://github.com/microsoft/thinkingbox-data/releases/tag/thinkingbox-bench-v1.0)
- [ThinkingBox-Bench dataset](https://huggingface.co/datasets/microsoft/ThinkingBox-Bench)
- [OpenEnv ThinkingBox adapter](https://github.com/huggingface/OpenEnv/tree/49aa302ba5c67041d11da128139ba3ae15529543/envs/thinkingbox_env)

## Discovery coverage

The live HN Algolia `search_by_date` query for `agent` stories (20 newest hits) surfaced item 49952030. It was selected because the linked primary article exposed a released benchmark, concrete terminal-state grading mechanics, repeated-trial metrics, and numerical evidence that successful-looking traces are poor outcome proxies. Exact searches for the article URL, paper ID, and repository URL found no existing Scout note, so a new source-level finding was warranted.
