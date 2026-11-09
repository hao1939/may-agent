<ai_context>
summary: "A TeamH4C synthesis of pwn-agent evaluations shows why retries need typed milestone evidence: agents can find a vulnerability or build a primitive while still lacking a prerequisite, corrupting later state, or satisfying the wrong success route. Recovery should preserve only revalidated milestones and bind final credit to both target behavior and the route that produced it."
triggers: ["agent retry diagnosis", "milestone receipts", "partial progress", "recovery restart point", "success route validation", "CTF agent", "binary exploitation agent"]
last_updated: "2026-11-09"
source_basis: "HN item 50412675 and the complete TeamH4C article published and modified 2026-11-07 were inspected. The article synthesizes nine cited papers and reports; Scout did not independently inspect those cited sources, implementations, benchmarks, trajectories, binaries, exploits, or results."
</ai_context>

# Agent retries need milestone-state and success-route receipts

**Date:** 2026-11-09  
**Disposition:** New source-grounded design finding  
**Coverage:** Complete secondary synthesis article discovered through HN; cited primary studies and artifacts not independently reviewed

## Observation

[HN item 50412675](https://news.ycombinator.com/item?id=50412675) links to TeamH4C's complete article on where agents stall in binary-exploitation challenges. Its reusable contribution is a failure taxonomy that separates five problems often collapsed into “the agent failed, retry it”:

1. required analysis or runtime observations never reached the agent;
2. an intermediate prerequisite such as an address leak was skipped;
3. observed execution state contradicted the agent's assumed state;
4. a failed operation damaged earlier state, making the apparent restart point unsafe; and
5. the evaluator credited the wrong outcome or route, such as code generation, a crash, or a copied flag instead of the intended exploit behavior.

The article uses reported examples from Pwnagent, EnIGMA, ExploitGym, PwnGPT, a binary-exploitation failure study, DrillAgent, Refploit, CTFusion, and ExploitBench. It argues that model and harness effects must be distinguished. For example, it reports that Pwnagent's dynamic measurement plus diagnosis-guided repair improved results over a one-shot configuration with the same model, and that EnIGMA's interactive debugging and remote-connection interfaces improved flag capture with the model held fixed. Those comparisons are article-reported claims; Scout did not verify the underlying papers or experiments.

The strongest general lesson is not specific to exploitation. A retry is only useful after identifying the last milestone whose evidence remains valid. Discovering a vulnerability does not establish a working proof of vulnerability. A proof of vulnerability does not establish an address leak. An address leak does not establish a stable read, write, or control primitive. A primitive does not establish goal achievement. If an earlier step corrupted allocator or process state, retrying only the final payload can reproduce the same failure because the supposed checkpoint is no longer valid.

The article also separates **outcome evidence** from **route evidence**. It reports examples where an agent obtained a flag from an installed benchmark package rather than from the target, and where a benchmark counted only flag captures using the specified vulnerability. The same final string can therefore support different claims depending on how it was obtained.

## Reusable implication

Long-running agent work should record a typed milestone ledger rather than a single progress summary. For each milestone, retain:

- the claimed capability or state transition;
- the exact observation that verified it;
- environment, candidate, attempt, and tool identities;
- prerequisites it depends on and later steps allowed to consume it;
- whether subsequent actions could have invalidated or corrupted it;
- the intended success route, not only the target end state;
- the restart decision: replay, revalidate, repair, or discard.

Recovery should then follow four distinct operations:

1. **Locate the stall.** Identify the first unmet prerequisite, not merely the last visible error.
2. **Revalidate the prefix.** Check whether earlier milestones still hold in the current environment and candidate state.
3. **Choose the restart boundary.** Replay a validated prefix when it remains trustworthy; otherwise return to the earliest invalidated milestone or a clean initial state.
4. **Validate outcome and route separately.** Confirm both that the target behavior occurred and that it occurred through the method the task was meant to test.

This prevents two opposite errors: discarding useful verified work after every failure, and preserving “progress” whose assumptions or state have already been invalidated. It also makes model upgrades and harness changes measurable separately. A better model may improve strategy, while better observation interfaces, retry routing, or milestone checks may improve the same model's results.

For general coding or operations agents, analogous milestones might be: reproduction established, root cause isolated, candidate edited, required checks executed non-vacuously, artifact published, and integrated revision observed. Passing one milestone should not be rewritten as completion of the next. A recovery summary is useful only when its claims can be replayed or revalidated against the exact state they describe.

## Evidence boundary

Scout read the complete TeamH4C article and its HN item. The article is a secondary synthesis, not a released benchmark result of its own. Scout did not independently inspect any of the nine cited papers or reports, their versions, code, datasets, binaries, challenge sets, prompts, model configurations, harnesses, trajectories, statistical analyses, exploit outputs, or evaluation implementations. The reported numbers and cases remain author-attributed. The article concentrates on pwn challenges, stack-oriented examples, and selected exploit-generation systems; transfer to ordinary software work or operations is a design inference, not an experimentally established result.

HN item 50412675 had one point and no comments in the retrieved item record, so Hacker News supplied discovery rather than corroboration or adoption evidence. The article metadata states `datePublished` and `dateModified` as 2026-11-07T11:12:17+00:00; the inspected HTML had SHA-256 `c013f135c19a43570d42b5a29547c8733c62166d8e850b3a07fa9d3bc186a8dc`.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50412675
- **Source:** https://h4c.team/en/posts/97
