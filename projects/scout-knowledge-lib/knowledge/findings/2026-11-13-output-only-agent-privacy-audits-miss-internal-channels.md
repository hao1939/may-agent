<ai_context>
summary: "AgentLeak's published benchmark reports that a clean final response is not a reliable privacy verdict for multi-agent systems: in 4,979 validated two-agent coordinator-worker traces, 41.7% had a safe final output while inter-agent messages or shared memory leaked. The operational implication is to make each normalized execution channel auditable and gate releases on channel-scoped evidence, while preserving the study's topology, language, detector, and channel-coverage limits."
triggers: ["AgentLeak", "internal-channel privacy", "multi-agent privacy audit", "output-only audit", "inter-agent message leakage", "shared memory leakage", "channel-scoped privacy gate"]
last_updated: "2026-11-13"
source_basis: "HN item 50476987, arXiv 2602.11510v3 full HTML paper and API record, Privatris/AgentLeak at revision 2c6854e1e7f4fe86111a6eac98007c8482573e68, and yagobski/agentleak at revision c8260cf7785be51a0f1572cd9520e29526a4e0d9. Scout did not reproduce the benchmark, run the repositories or tests, inspect all traces, validate the LLM judge, or assess a deployed agent system."
</ai_context>

# Output-only agent privacy audits miss internal channels

**Date:** 2026-11-13  
**Disposition:** New source-grounded finding  
**Coverage:** Complete arXiv v3 HTML paper, arXiv API record, and current repository READMEs at pinned revisions; no benchmark or tool execution

## Question

What does AgentLeak add beyond checking an agent's final response for sensitive
data, and what evidence should a practical privacy gate retain?

## Source observation

[HN item 50476987](https://news.ycombinator.com/item?id=50476987) linked the
research repository for AgentLeak. The HN item had two points and no comments
when inspected, so it is discovery evidence rather than independent validation.
The substantive evidence is the published paper and the producer-authored
repositories.

[AgentLeak v3](https://arxiv.org/abs/2602.11510v3) defines seven channels:
final output, inter-agent messages, tool inputs, tool outputs, shared memory,
logs, and generated artifacts. Its large-scale experiment focuses on final
outputs (C1), inter-agent messages (C2), and shared memory (C5). Across 1,000
English scenarios in healthcare, finance, legal, and corporate domains, the
authors report 4,979 validated traces from five models in a two-agent
coordinator-worker topology.

The central result is an **audit gap**, not merely a higher aggregate leak rate:

- final outputs leaked in 27.2% of validated traces;
- inter-agent messages leaked in 68.8%;
- total exposure across C1, C2, and C5 was 68.9%; and
- 2,076 of 4,979 traces (41.7%, reported 95% CI 40.3%–43.1%) had a safe final
  output while C2 or C5 leaked.

Thus an output-only check would have accepted those 2,076 executions despite a
recorded internal disclosure under the benchmark's policy. The paper also
reports that C2 leakage was at least C1 leakage for every evaluated model and
across all four domains. This supports a channel-coverage claim within the
experiment; it does not prove the same rates for other agents, models,
topologies, languages, or policies.

The authors' prototype interceptor is also instructive. It applied channel-
specific allowed sets to C2 and C5, reducing reported internal leakage from
31.5% to 2.4% on 120 selected scenarios while task success fell 4.7 percentage
points. The result argues against treating blanket redaction as a free fix:
privacy enforcement must preserve an explicit record of which fields a recipient
or tool legitimately needed.

## Reusable implication

A privacy gate for an agent run should evaluate a **channel-complete trace
contract**, not infer safety from the final answer:

1. Normalize every observable route—user input, final output, inter-agent
   message, shared memory, tool call, tool response, log, and generated file—
   under stable channel identities.
2. Record source, destination, sensitivity class, allowed field set, detector
   coverage, and verdict for each disclosure. A global pass should require all
   channels in the declared coverage envelope to settle.
3. Keep `clean`, `leaked`, and `unobserved` distinct. Missing tool, memory, log,
   or artifact capture cannot become a zero-leak result.
4. Test with traces where the final response is intentionally clean but an
   internal route discloses a planted value. This directly exercises the audit
   gap that output-only suites miss.
5. Bind remediation to the route: minimize delegation context, add field-level
   memory access, constrain tool arguments, sanitize logs, and inspect generated
   artifacts rather than applying one output filter everywhere.

The practical [yagobski/agentleak](https://github.com/yagobski/agentleak)
repository implements a local trace analyzer and release assertions over
normalized channels. That is relevant as an inspectable tool shape, but its
current README, bundled scenarios, and stated detector improvements are
producer-authored and are not an independent reproduction of the paper.

## Evidence limits

The paper evaluates only English scenarios and one two-agent coordinator-worker
topology. Four framework versions and five model versions were selected; rapidly
changing frameworks may behave differently. The large-scale rate estimates
cover C1, C2, and C5. C3 and C6 use targeted samples of 100 scenarios per model,
while C4 and C7 appear in an integration study, so the paper does not establish
one comparable seven-channel rate.

Eighty-two percent of detected leaks were classified through a semantic tier
that uses an LLM judge. The paper reports calibration, inter-judge agreement,
expert review, and a 7.4% false-negative rate, but those are author-reported
measurements. The paper describes its rates as conservative lower bounds; Scout
did not validate that characterization, inspect all trace labels, or reproduce
the statistics. Internal disclosure under the benchmark is a policy violation
or risk signal, not automatically proof of external attacker access, legal
breach, or real-world harm.

The research README separately preserves an unreconciled 5,694-trace summary
with rates that differ from the paper's 4,979 validated-trace results. This note
uses the paper's validated denominator and does not combine the two summaries.
Scout did not run either repository, execute tests, call the evaluated models,
review the complete dataset, or assess AgentLeak against a live May deployment.

## Primary evidence

- **HN:** https://news.ycombinator.com/item?id=50476987
- **Source:** https://arxiv.org/abs/2602.11510v3
- **DOI:** https://doi.org/10.1109/ACCESS.2026.3704541
- **Repo:** https://github.com/Privatris/AgentLeak
- **Reviewed research revision:** `2c6854e1e7f4fe86111a6eac98007c8482573e68`
- **Practical tool:** https://github.com/yagobski/agentleak
- **Reviewed practical-tool revision:** `c8260cf7785be51a0f1572cd9520e29526a4e0d9`
