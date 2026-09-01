<ai_context>
summary: "Living seed-first topic map for Scout's Xiaohongshu research loop, including source connections, value scores, confidence, contradictions, blocks, and next explorations."
triggers: ["XHS topic map", "Xiaohongshu research loop", "topic clusters", "XHS deep dive", "seed-first research"]
last_updated: "2026-09-01"
source_basis: "XHS retained local evidence through 2026-08-19, seed reconciliation at 2026-09-01T09:53:22Z, and related arXiv discovery/full-paper review on 2026-09-01."
</ai_context>

# Xiaohongshu Living Topic Map

This map starts from the [human-collection seed ledger](./xhs-seed-ledger.md).
The direct seed set is currently unobserved, so the first cycle uses retained
local XHS evidence as an explicit fallback. No retained URL is called a human
seed unless a readable collection snapshot confirms it.

## Revisable value rubric

Once direct seeds are readable, **seed connection** is the first selector.
Until then it stays `U` (unknown), and the fallback score uses five 0–3 axes:

- **L — local XHS support:** specificity and number of deduplicated retained
  XHS sources.
- **C — cross-source support:** accessible independent evidence that can test,
  refine, or contradict the XHS signal.
- **I — operational impact:** consequence for building, evaluating, or
  governing agents.
- **G — resolvable gap:** important uncertainty that a bounded deep dive can
  reduce now.
- **F — freshness:** recency of the retained XHS or related evidence.

The score is `L+C+I+G+F` out of 15. Engagement affects discovery priority only;
it is not evidence quality.

## Active clusters

| Cluster | Seed connection | Score | Supporting sources | Current finding / uncertainty | Confidence | Next exploration |
|---|---|---:|---|---|---|---|
| **Self-evolution reliability and evaluation authority** | U | **13** (`3+3+3+2+2`) | [Retained XHS packet](./findings/2026-08-06-xhs-self-evolving-agent-control-surface.md); [cross-source self-improvement note](./findings/2026-07-23-hn-self-improving-agent-loops.md); arXiv [`2608.22610v1`](https://arxiv.org/abs/2608.22610v1) | XHS metadata says attention is moving from generic self-evolution toward evaluator independence, learning state, and human interference. Cross-source evidence adds task-order, security, executor-compatibility, and coalition confounders. Unknown: whether any of these posts are human-collected or whether full XHS content supports more than their visible metadata. | Moderate-high for the cross-source reliability pattern; low for unseen XHS post contents. | Reproduce or independently audit `2608.22610` once code is released; on seed access, deep-read any collected evaluator/skill-reliability post first. |
| **Long-horizon persistence and governed memory** | U | **11** (`3+3+3+1+1`) | [Persistence-infrastructure packet](./findings/2026-07-22-xhs-agent-persistence-infrastructure.md); [long-horizon packet](./findings/2026-07-21-xhs-long-horizon-agents-survey.md); [ICML-memory packet](./findings/2026-07-29-xhs-icml2026-agent-memory-papers.md) | Persistent agents need traceability, proactive resurfacing, and governed writes, not only retrieval. The cluster is well supported but older; direct collection relevance and recent contradictory evidence are unknown. | Moderate; several XHS records are metadata-level and one survey note contains explicit inference. | Check collected seeds for newer memory-write, forgetting, or persistence failures; prefer contradiction over another broad memory overview. |
| **Build playbooks and implementation literacy** | U | **10** (`2+2+2+2+2`) | [Retained XHS build-playbook packet](./findings/2026-08-06-xhs-build-playbooks-outperform-intros.md) | In one search packet, process maps and source-code notes had more visible engagement than generic definitions or launch framing. Unknown: collection relevance, content quality, and whether the ranking persists across queries or time. | Low-moderate; title/author/like snapshots only. | On access, compare collected build artifacts by format and inspect whether saves/comments reflect successful use rather than curiosity. |

## Selected deep dive — coalition-conditioned skill reliability

The top-scoring cluster was selected because it connects the freshest retained
XHS control-surface signal to an accessible, testable reliability mechanism.
A full-source review of arXiv [`2608.22610v1`](https://arxiv.org/abs/2608.22610v1) adds one bounded finding to the
[maintained self-improvement note](./findings/2026-07-23-hn-self-improving-agent-loops.md):
skill reliability is a property of the skill, surrounding bank, and deployment
domain, not an intrinsic label on a skill.

Observed paper evidence includes 12 candidate proposals over three seeds, a
baseline outcome gate accepting 6 versus CASS accepting 1, and the baseline's
accepted additions measuring `-1.38` percentage points on average in a
bank-size-controlled comparison. A 20-query unlabeled target probe improved all
six tested banks after masking. The authors' strongest source-to-target reversal
has a negative target point estimate whose confidence interval includes zero,
and code is promised rather than currently available. Those limits keep this
as a promising mechanism-level result, not a universal rule.

## Connections and tension

- **Self-evolution ↔ governed memory:** a growing skill or memory bank is a
  write-admission system. Coalition pollution is another form of ungated
  accumulation; target-conditioned masking is a subtraction step.
- **Build playbooks ↔ evaluation authority:** practical guides can spread a
  pattern before its reliability conditions are known. Visible engagement
  should nominate an audit, not substitute for one.
- **Contradiction to simple accumulation:** the retained XHS memory-evolution
  signal treats adaptive banks as progress; `2608.22610` shows that more
  admitted skills can reduce average performance. The claims can coexist only
  if admission and retirement evidence are explicit.
- **Blocked evidence:** direct collection membership, current engagement, full
  post text, comments, and collection removals remain unknown while the browser
  endpoint is outside this worker's reachable network namespace.

## Cycle log

| Cycle | Seed reconciliation | Related discovery | Deep dive | Map decision | Next |
|---|---|---|---|---|---|
| 2026-09-01 | Direct set unobserved; no additions, changes, or removals inferred. Local fallback: 104 stable IDs / 125 occurrences, deduplicated by ID. | arXiv query for self-evolving/self-improving agents found `2608.22610v1`; full source reviewed. | Coalition pollution and cross-domain utility reversal. | Added three active clusters; selected reliability/authority at 13/15. | Restore observational collection reachability, then reconcile and prioritize any collected evaluator or skill-bank post; independently test the paper when code appears. |
