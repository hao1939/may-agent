<ai_context>
summary: "An inspected XHS explanation of MASS frames multi-agent design as a coupled search over prompts and topology: optimize topology blocks locally, prune by measured marginal influence, search compositions, then jointly tune prompts on the selected graph. Its reported MATH sequence shows why the locally best interaction pattern need not survive system-level search."
triggers: ["MASS", "Multi-Agent System Search", "prompt topology co-optimization", "multi-agent design search", "topology pruning", "6aa4cd7700000000120009ec"]
last_updated: "2026-09-12"
source_basis: "One current Xiaohongshu post was inspected in full. All method and benchmark details remain attributed to that secondary explanation; the underlying paper and results were not independently checked in this source-specific run."
</ai_context>

# Search prompts and topology as one coupled multi-agent design

Date: 2026-09-12  
Source: https://www.xiaohongshu.com/explore/6aa4cd7700000000120009ec  
Tags: multi-agent-systems, prompts, topology, design-search, pruning, token-efficiency

## Finding

An inspected Xiaohongshu post explains **MASS (Multi-Agent System Search)** as a response to a coupled design problem: an agent's prompt affects its behavior inside a graph, while the graph determines how that behavior propagates. Optimizing only prompts or only topology can therefore evaluate one variable under a weak setting of the other.

The post describes a three-stage search:

1. optimize prompts separately for candidate topology blocks;
2. estimate each block's incremental influence, use softmax weighting and rejection sampling to prune the topology search space, then search compositions; and
3. jointly optimize prompts on the selected full topology so inter-agent dependencies enter the final tuning step.

The useful signal is the **ordering and re-evaluation boundary**, not the named optimizer. Prompt tuning first makes topology comparisons less dependent on weak default instructions; influence-based pruning limits combinatorial search; final joint tuning recognizes that prompts optimized in isolation may change meaning after composition.

## Reported counterexample to local topology intuition

The post reports a MATH progression in which block-level prompt optimization made debate the best local topology and raised accuracy from 62% to 79%. The subsequent topology search instead selected aggregation over nine parallel agents and reached 83%; global prompt optimization on that system reached 85%. If accurate, this is a compact counterexample to selecting a production graph from isolated block rankings: **the locally strongest interaction can lose after system-level composition**.

The same post reports that topology effects vary by task: debate added about three percentage points on HotpotQA, while reflection reduced LiveCodeBench performance by about fifteen points. It also says prompt-optimized agents were more token-efficient than scaling agent count under default prompts. Together these claims suggest two practical evaluation rules:

- compare graph candidates only after giving their constituent roles a reasonable prompt baseline; and
- measure marginal quality and token cost per topology block before expanding the search, rather than treating more agents or more edges as monotonic improvements.

## Evidence boundary

This run inspected the XHS post body, not merely its search card. The post attributes the work to Google and the University of Cambridge and calls it an ICLR 2026 paper titled *Multi-Agent Design: Optimizing Agents with Better Prompts and Topologies*, but it does not provide a paper URL. The paper identity, experimental protocol, baselines, uncertainty, and numerical results were not independently verified in this XHS-only run. Treat the percentages as author-reported secondary claims and the staged coupled-search pattern as a research lead, not benchmark-grade evidence or a universal recipe.
