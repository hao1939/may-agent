<ai_context>
summary: "Pinned review of Kiln Harness Tuner: optimizing an agent's tools, prompts, skills, model, and settings is a search process that needs train-only agent access, validation-bound promotion, an unread external test, and explicit limits on what the gate can prove."
triggers: ["Harness Tuner", "agent harness optimization", "tool optimization", "held-out evaluation", "promotion gate", "train val test", "eval overfitting"]
last_updated: "2026-11-13"
source_basis: "HN item 50484443 plus static inspection of Kiln-AI/harness-tuner README, how-it-works, concepts, limitations, repository tree, and latest commit metadata at e13f6e77481cdb16befdd3146f49adeb5c7edb89. Scout did not install or run the tuner, Kiln, agents, evals, tests, or the producer-reported production case."
</ai_context>

# Harness optimization needs held-out promotion gates

**Date:** 2026-11-13  
**Disposition:** new knowledge  
**Question:** What evaluation boundary is needed when an agentic optimizer can rewrite not only prompts, but also tools, skills, models, and settings?  
**HN:** https://news.ycombinator.com/item?id=50484443  
**Repo:** https://github.com/Kiln-AI/harness-tuner  
**Reviewed version:** commit [`e13f6e77481cdb16befdd3146f49adeb5c7edb89`](https://github.com/Kiln-AI/harness-tuner/commit/e13f6e77481cdb16befdd3146f49adeb5c7edb89)

## Source observation

The Show HN presents Harness Tuner as an eval-driven loop that can change an agent's tools, prompts, skills, model, provider, settings, retrieval, fine-tunes, and sub-agent configuration. The HN author specifically says tool rewrites have produced the largest gains they have seen. The repository describes those rewrites as wrappers that can trim tool responses, combine repeated calls, loop over results, or perform deterministic computation before returning data to the model.

That breadth changes the evaluation problem. The optimizer is not merely selecting wording inside a fixed program; it is searching over much of the effective agent implementation. Harness Tuner's documented control structure separates the evidence used at each stage:

1. **Agents can inspect only train data.** The gateway exposes train items and traces to the planning, building, and analysis roles and refuses agent requests for non-train items.
2. **Validation controls baseline promotion.** Experiments branch from a current baseline, measure targeted hypotheses on train, and only declared promotion candidates proceed to a full validation gate. The gate compares each candidate with the current baseline across active evals before changing the baseline.
3. **Test remains outside the optimization loop.** The loop never reads the test split. The operator must run the final test separately, so the reported shipping number is not one the optimizer used to design or promote candidates.
4. **Eval definitions are partly frozen by capability.** Ordinary optimization roles receive typed gateway operations and cannot add items or judge configurations to the evals being measured. Experimental eval building is a separate capability and is off by default.
5. **Optimization and integrity are distinct checks.** The loop has copy and shape heuristics, plus a read-only generality review, but its own limitations document says these checks can miss short, paraphrased, sampled-out, skill-level, or tool-description leakage. A validation win is therefore not a general proof of non-memorization or semantic integrity.

The repository also makes a subtler limitation explicit: repeated validation-based promotion can steer durable optimizer memory toward the validation set even when individual agents cannot read validation examples. Test isolation is therefore not redundant. Validation chooses among candidates; an unread test estimates the consequence of the whole accumulated search process.

## Interpretation

A system that lets agents improve the surrounding harness should be evaluated like an adaptive program search, not like a one-shot prompt edit. The effective hypothesis space includes data presentation, tool semantics, control flow, model choice, and the grader-facing behavior of the complete agent. The broader that space becomes, the less a train improvement—or even one validation promotion—establishes by itself.

A reusable admission pattern is:

- bind every experiment to one explicit hypothesis and parent configuration;
- expose construction agents only to training evidence;
- prevent those agents from rewriting the acceptance oracle they are scored against;
- compare promotion candidates with the current accepted baseline on held-out validation evidence;
- preserve regressions and integrity flags separately from the aggregate objective;
- keep a final test unread by the optimizer and run it outside the search loop;
- retain the exact candidate configuration, evidence split, and promotion lineage so a reported gain can be audited or reversed.

The important distinction is between **promotion evidence** and **shipping evidence**. Validation can authorize the next baseline within a search process. It cannot certify the final system after many adaptive decisions, especially when small evals, noisy judges, heuristic leakage checks, or repeated reuse of validation evidence leave residual uncertainty.

## Evidence boundary and limitations

The README reports a production agent with 2.5× fewer failures, 6× lower cost, and 2× lower latency on held-out data after tuning, but the inspected repository material does not supply an independently reproduced result bundle for that claim. It should be treated as producer-reported motivation, not established comparative evidence.

The project's own limitations are material: small evals can be underpowered; a quality promotion means no clear loss rather than proof of no loss; judge errors and noise estimates can affect decisions; repeated validation decisions can overfit through memory; the time limit is not a hard stop; one-run locking is local to one machine and state folder; experimental eval building can create incomplete split structure; integrity checks are heuristic; and no test covers a complete live run. Scout did not assess whether every code path enforces the documented capability and split boundaries.

Scout inspected the source statically and did not install dependencies, run the CLI, start Kiln, invoke a coding agent, execute an eval, reproduce the reported production result, or run the project tests. The finding supports the evaluation architecture and its disclosed limits, not the tuner's effectiveness or security in production.

## Primary evidence

- [HN launch and author discussion](https://news.ycombinator.com/item?id=50484443)
- [Project overview and claimed tuning surface](https://github.com/Kiln-AI/harness-tuner/blob/e13f6e77481cdb16befdd3146f49adeb5c7edb89/README.md)
- [Train/validation/test access and promotion flow](https://github.com/Kiln-AI/harness-tuner/blob/e13f6e77481cdb16befdd3146f49adeb5c7edb89/docs/how-it-works.md)
- [Experiment, baseline, promotion, and memory concepts](https://github.com/Kiln-AI/harness-tuner/blob/e13f6e77481cdb16befdd3146f49adeb5c7edb89/docs/concepts.md)
- [Measurement, containment, integrity, recovery, and testing limitations](https://github.com/Kiln-AI/harness-tuner/blob/e13f6e77481cdb16befdd3146f49adeb5c7edb89/docs/limitations.md)
- [Pinned repository tree](https://github.com/Kiln-AI/harness-tuner/tree/e13f6e77481cdb16befdd3146f49adeb5c7edb89)
- **Discovery query:** HN Algolia `search_by_date` for `AI agent`, `agents`, `MCP`, and `coding agent`
