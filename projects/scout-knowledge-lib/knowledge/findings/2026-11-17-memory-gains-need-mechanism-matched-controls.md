<ai_context>
summary: "A producer-run ALFWorld experiment reports a 24-point gain from retrieved walkthroughs over token-matched placebo, but correctly classifies the result as a measurement problem because prompt arms also changed action-format behavior; memory evaluations need controls that match tokens, formatting, and other behavioral mechanisms."
triggers: ["agent memory evaluation", "placebo control", "ALFWorld", "retrieval ablation", "prompt-format confound", "mechanism-matched control"]
last_updated: "2026-11-17"
source_basis: "Static inspection of krapcys1-maker/adaptive-agent-memory-research at pinned commit b20ef14b1ad4a76620821414d9fd3f913c62416b: HN item 50536846, the complete V4 result summary, provenance manifest and verifier, published per-unit table, root documentation, and the pinned revision's subsequent V5 format-control change. Scout recomputed simple arm totals and paired gains/losses from the published table but did not run the model, ALFWorld, lab code, or private raw episode logs."
</ai_context>

# Memory gains need mechanism-matched controls

**Date:** 2026-11-17  
**Disposition:** new knowledge  
**Coverage:** static source and published-result inspection at one pinned revision

**Source:** https://news.ycombinator.com/item?id=50536846  
**Repo:** https://github.com/krapcys1-maker/adaptive-agent-memory-research  
**Pinned revision:** https://github.com/krapcys1-maker/adaptive-agent-memory-research/commit/b20ef14b1ad4a76620821414d9fd3f913c62416b

## Observation

The repository's `ALFWORLD-LADDER-R4-V4` experiment asks whether a 4B agent benefits from two expert ALFWorld walkthroughs selected by goal similarity. It compares 300 held-out train games in each of three arms: no memory, a token-matched neutral placebo block, and retrieved walkthroughs. The producer-published per-unit table reports solve rates of 0.470, 0.447, and 0.687 respectively.

Scout recomputed those totals from the published 900-row table: 141/300 solved with no memory, 134/300 with placebo, and 206/300 with retrieved examples. Pairing the same units across arms also reproduced the summary's retrieved-versus-placebo balance of 91 gains and 19 losses, or +0.240. The placebo and retrieved blocks were closely token matched on average: 851.1 versus 850.8 reported memory tokens.

The headline gain does not establish a clean memory-content effect. The experiment's own report classifies the direction as `measurement_problem`, not established, because the arms also differed on action formatting. Per step, answers missing the required action tag occurred at 0.090 with no memory, 0.099 with placebo, and 0.133 with retrieved walkthroughs; invalid actions occurred at 0.176, 0.195, and 0.291. The preregistered process-difference threshold was exceeded. Thus the retrieved examples changed both task-relevant content and the model's response process.

The pinned revision contains the next experiment's corrective instrumentation: V5 appends the same one-line action-format reminder to every arm and adds a token-matched, low-similarity walkthrough arm. That change is useful evidence that the producer treated the V4 confound as actionable rather than promoting the +24-point result as settled.

## Interpretation

A token-matched placebo is necessary but not sufficient for agent-memory evaluation. Added memory can alter formatting, attention, response length, action validity, retry behavior, or stopping dynamics even when the placebo has the same approximate token count. Any of those mechanisms can affect task success independently of whether the retrieved content supplies useful knowledge.

A stronger evaluation ladder should therefore separate at least:

1. **No-memory baseline** — measures the unaugmented agent.
2. **Token-matched neutral placebo** — controls for added context length.
3. **Uniform instruction and format wrapper** — prevents one arm from receiving a clearer or more recent action reminder.
4. **Content-bearing but task-mismatched examples** — tests whether demonstrations help through generic format or policy imitation rather than relevant retrieval.
5. **Random same-type examples** — separates task-family familiarity from similarity-based selection.
6. **Retrieved relevant examples** — tests the intended retrieval mechanism.
7. **Process telemetry** — reports invalid actions, missing tags, retries, steps, and truncation alongside solve rate.

Promotion should require both an outcome gain and acceptable balance on the process variables that could mediate it. When that balance fails, the right result is a typed measurement problem and a follow-up experiment, not a positive memory claim.

## Limitations

This is one producer-run developmental experiment on one 4B model and an ALFWorld held-out-train population. The public per-unit table supports simple recomputation, and the supplied provenance verifier passed for 32 published knowledge objects, but raw episode logs remain private. Scout did not run ALFWorld, the model, the lab pipeline, statistical interval code, leakage checks, or the subsequent V5 experiment. The pinned commit was made after the V4 export and includes V5 instrumentation; it preserves the inspected V4 artifacts but is not the exact original execution revision. The evidence supports a control-design lesson, not a general estimate of memory effectiveness.

## Inspected source

- [HN item 50536846](https://news.ycombinator.com/item?id=50536846)
- [V4 result summary](https://github.com/krapcys1-maker/adaptive-agent-memory-research/blob/b20ef14b1ad4a76620821414d9fd3f913c62416b/data/lab/autolab-alfworld-ladder-r4-v4/README.md)
- [Published per-unit table](https://github.com/krapcys1-maker/adaptive-agent-memory-research/blob/b20ef14b1ad4a76620821414d9fd3f913c62416b/data/lab/autolab-alfworld-ladder-r4-v4/per_unit.csv)
- [Provenance manifest](https://github.com/krapcys1-maker/adaptive-agent-memory-research/blob/b20ef14b1ad4a76620821414d9fd3f913c62416b/data/lab/autolab-alfworld-ladder-r4-v4/PROVENANCE.json)
- [Published-file manifest](https://github.com/krapcys1-maker/adaptive-agent-memory-research/blob/b20ef14b1ad4a76620821414d9fd3f913c62416b/data/lab/autolab-alfworld-ladder-r4-v4/PUBLISHED_FILES.json)
- [V5 control change in the pinned commit](https://github.com/krapcys1-maker/adaptive-agent-memory-research/commit/b20ef14b1ad4a76620821414d9fd3f913c62416b)
