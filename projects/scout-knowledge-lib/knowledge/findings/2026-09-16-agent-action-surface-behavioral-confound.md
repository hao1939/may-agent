<ai_context>
This finding reviews an HN-linked AGORA release, its pinned paper, and the corrective MCP implementation. It treats the pilot counts as author-reported observations, not independently reproduced results, and separates capability reachability from model motivation or competence.
</ai_context>

# A missing agent action can masquerade as a behavioral failure

**Date:** 2026-09-16  
**Source:** [Hacker News item 49731364](https://news.ycombinator.com/item?id=49731364)  
**Repo:** [MerariJafet/agora](https://github.com/MerariJafet/agora)  
**Reviewed release:** [`v0.3.0`](https://github.com/MerariJafet/agora/releases/tag/v0.3.0), commit [`5fc2b87b39b0735402280994cf30392c8df6ea9d`](https://github.com/MerariJafet/agora/commit/5fc2b87b39b0735402280994cf30392c8df6ea9d)

## Finding

AGORA reports a useful negative result from its public pilot: a 30-minute research cadence closed **146 consecutive rounds with no proposal and no round vote**. On its most mature challenge, reviewers produced **eight abstentions and two resolutions**; the eight abstentions reportedly shared one reason—the submission linked a claim, evidence, and artifact, but the reviewer could not inspect the primary content ([paper §7.5](https://github.com/MerariJafet/agora/blob/5fc2b87b39b0735402280994cf30392c8df6ea9d/docs/paper/AGORA_PROOF_OF_USEFUL_RESEARCH.md#L253-L267)).

The repository's diagnosis is architectural rather than psychological. The server already had cadence operations and artifact bytes, but the agent-facing Bridge/MCP surface did not expose proposal, voting, standalone evidence-resolution, or artifact-read operations. The agents therefore could not perform the rewarded actions or resolve the evidence needed to vote. Silence looked like lack of motivation; repeated abstention looked like incapacity; both could arise from an unreachable action instead.

This refines the earlier **idle-drift** pattern. “The agent planned but chose not to act” and “the runtime supplied no invocable action” can produce the same outcome trace, but they require different interventions. Prompting, incentives, or model replacement cannot repair an operation absent from the tool surface.

## Corrective pattern

At the reviewed release, AGORA adds explicit MCP tools for cadence inspection, proposal submission, round voting, standalone evidence lookup, and artifact reading. The artifact reader downloads a bounded byte range, computes SHA-256, and deliberately reports `content_hash_verified: false` when the read was truncated; it does not let partial inspection become a full-verification claim ([artifact reader](https://github.com/MerariJafet/agora/blob/5fc2b87b39b0735402280994cf30392c8df6ea9d/bridge/agora_bridge/mcp_server.py#L528-L568), [cadence and proposal tools](https://github.com/MerariJafet/agora/blob/5fc2b87b39b0735402280994cf30392c8df6ea9d/bridge/agora_bridge/mcp_server.py#L755-L834), [round voting](https://github.com/MerariJafet/agora/blob/5fc2b87b39b0735402280994cf30392c8df6ea9d/bridge/agora_bridge/mcp_server.py#L836-L861)).

A practical evaluation contract follows:

1. Enumerate every state transition the protocol rewards or requires.
2. For each transition, prove that the evaluated agent can discover and invoke a corresponding operation with the needed inputs.
3. Separately verify prerequisite observation paths: an agent asked to judge evidence must be able to read the evidence, not only its metadata.
4. Record attempted, denied, unavailable, and voluntarily declined actions as different outcomes.
5. Audit action-surface reachability before attributing a flat behavior rate to motivation, policy, reasoning, or incentives.
6. Bind strong verdicts to complete evidence coverage; a bounded or truncated read must remain visibly partial.

The key metric is not just success rate but **capability–intention coverage**: the fraction of protocol-required transitions that have a discoverable, invocable, authorized, and evidentially adequate agent path. This should be measured per evaluated runtime version because adding a server endpoint without exposing it to the agent does not change the agent's effective action space.

## Limits

The 146 empty rounds and review breakdown are author-reported pilot observations in the release paper; this review did not independently replay the public pilot or inspect raw per-round records establishing those exact counts. More importantly, the repository explicitly says the post-tooling proposal and resolution rates were **not yet measured**. The added tools make the instrumental explanation testable, but they do not yet prove it: if activity remains flat with the same reward policy after agents receive the tools, motivation, model capability, discoverability, authorization, or another workflow defect remains a live explanation. The repository is young (created 2026-09-10), and its release states that one physical operator running four processes is not four independent operators; no broad deployment claim follows.