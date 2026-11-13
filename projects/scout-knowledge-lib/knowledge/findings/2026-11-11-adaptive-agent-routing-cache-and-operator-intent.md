<ai_context>
summary: "Adaptive model routing is a stateful control and serving decision: preserve explicit operator choices, bind each decision to its turn, price warm-cache loss, and expose cache readiness to the router. ShadowPrefill reports that cross-model switches lose prefix reuse and evaluates speculative low-priority warming of the unchosen model; the paper and opencode-gearbox evidence are producer-authored, and Scout did not reproduce either system or their measurements."
triggers: ["adaptive model routing", "reasoning effort routing", "subagent model selection", "prompt cache economics", "routing fallback", "operator model choice", "ShadowPrefill", "cross-model prefix cache", "model switch tax"]
last_updated: "2026-11-13"
source_basis: "miguelmartens/opencode-gearbox at commit e56751c6f80d9163e984fea1433bbc2e56d071a3; complete non-truncated 124-entry Git tree plus selected README, design, implementation, and producer-authored tests. ShadowPrefill arXiv:2611.13176v1 full HTML paper and HN item 50488359."
</ai_context>

# Adaptive agent routing must price cache loss and preserve operator intent

**Date:** 2026-11-11  
**Disposition:** New knowledge  
**Repo:** https://github.com/miguelmartens/opencode-gearbox  
**Reviewed revision:** [`e56751c6f80d9163e984fea1433bbc2e56d071a3`](https://github.com/miguelmartens/opencode-gearbox/commit/e56751c6f80d9163e984fea1433bbc2e56d071a3)  
**Content read:** Complete non-truncated 124-entry recursive tree; README; design; prompt classifier and judge; routing implementation; selected producer-authored routing, classifier, and judge-model tests.

## Source observation

`opencode-gearbox` is a new OpenCode plugin that assigns a reasoning-effort level to each prompt and can route subagents to cheaper models. Its useful signal is not the general claim that cheaper models can save money—that is already covered in [The Token Economics Trap](../the-token-economics-trap.md)—but the constraints its implementation places around a routing decision.

At the pinned revision:

- A named effort level bypasses the judge, while a manually selected model variant pauses automatic routing. An agent definition with an explicit model retains that model; the router may adjust effort but does not replace the operator's selection.
- The prompt hook stores a decision by user-message ID. Producer-authored tests cover a prompt queued during an active turn and assert that it cannot change the running turn's effort; the queued prompt receives its own later decision.
- Judge, model-catalog, session-lineage, and related reads share a bounded deadline. Timeout, provider error, unreadable output, or unknown model state falls back to the last level or `medium`; routing failures leave the request unchanged rather than blocking it.
- A fresh subagent may move to a cheaper model because it has no warm prompt cache. A resumed subagent or main session is switched only when an estimated saving exceeds a configured margin after accounting for cache-read, cache-write/input, and expected-output cost. A resumed subagent is not promoted to a more expensive model by this mechanism.
- The README explicitly says main-chat switching does not work on the tested OpenCode 2.2.6 hook surface, so that path remains feature-detected rather than presented as current behavior.

## Interpretation

Adaptive routing is a **control-plane decision with state**, not just prompt classification. A defensible router should keep at least four receipts separate:

1. **Intent receipt:** Did the user or agent definition explicitly choose a model or effort level?
2. **Turn receipt:** Which exact prompt and session state produced this decision?
3. **Economic receipt:** Did the expected savings include the cost of abandoning a warm cache and the classifier call itself?
4. **Fallback receipt:** What level and model were actually used when judging or state lookup failed?

This also clarifies where routing should differ by lifecycle. A new child session has little cache value to preserve, while an established session can make a nominally cheaper model switch more expensive. “Choose the cheapest capable model” is therefore incomplete without cache ownership, session age, and an explicit minimum-saving threshold.

The repository complements the earlier Sabi observation in [The Token Economics Trap](../the-token-economics-trap.md#a-router-can-behave-as-designed-and-still-cost-more): policy correctness and economic superiority still require separate evidence. `opencode-gearbox` adds a more local implementation lesson—calculate the switching boundary before mutation and preserve explicit human configuration—but does not prove that its policy saves money or maintains task quality in deployment.

## November 13 update — cache readiness is part of the routing state

HN item [50488359](https://news.ycombinator.com/item?id=50488359) surfaced
[ShadowPrefill](https://arxiv.org/abs/2611.13176v1), a Microsoft Azure
Research paper that measures and then tries to hide the cache cost already
identified above. The paper's central observation is that prefix KV belongs to
a model: after a per-call router switches models, the target may have none of
the recent conversation cached. Across its agentic workloads, same-model calls
had a token-weighted prefix hit rate of 80–89%, versus 44–65% after a switch;
switch calls took 1.5–3.2 times as long. Its production coding-agent trace had a
mean context of 63K tokens.

ShadowPrefill speculatively computes the exact prefix KV on the model not chosen
for the current call. It treats this as low-priority serving work: harvest only
measured SLO slack, evict shadow entries before ordinary entries, spill long
shadows to host memory, and fall back to a normal cold switch when warming is
incomplete. This changes the router's economic input. A switch should be priced
against the **currently warm fraction of the candidate model**, not a fixed
model-pair penalty, and the router can expose its next-model probabilities to
prioritize speculative work.

The producer-authored evaluation includes trace-driven simulation over 22 model
pairs and a 16-H100 vLLM testbed adding two SWE-bench pairs. Across the paper's
24 pairs and five suites/traces, reported switch-call latency fell 8.5–21.4%,
LLM-call latency 3.7–17.7%, and routed token cost 22.5–46.1%. In the simulator,
the complete colocated design raised energy per SLO-compliant request by 0.4%
and did not reduce normal-traffic SLO attainment. These aggregates need their
conditions preserved: benefits grew with long contexts, were small when decode
dominated, and depended on host-memory retention for the 63K-token coding
trace.

The speculative work is not free or universally efficient. The paper reports
that 63% of shadow tokens were unused because the next route was unknown. On a
prefill/decode-disaggregated cluster, warming otherwise-idle prefill GPUs raised
energy per good request by 11.5%, despite latency gains. With five candidate
models, warming every alternative wasted 89% of shadow tokens and used 2.8%
more energy; warming only the top candidate traded some latency gain for 0.1%
more energy. Rare switches, very large decode-heavy targets, long reasoning
outputs, and heavily loaded serving pools also reduced or erased benefit.

This extends the earlier control-plane finding into a serving-plane receipt set:

1. **Intent and turn receipts** still determine whether automatic switching is
   allowed and which request the decision belongs to.
2. **Route receipt:** which model was selected, with what candidate scores and
   expected quality/cost tradeoff?
3. **Cache-readiness receipt:** how much exact prefix is warm on each candidate,
   where that KV resides, and how old or eviction-prone it is?
4. **Speculation receipt:** how many shadow tokens and how much energy were spent,
   whether they were later used, and whether normal-traffic SLOs changed?
5. **Fallback receipt:** did the call use a complete warm prefix, a partial tail,
   host-tier recovery, or a cold switch?

A router can therefore behave correctly at the policy layer yet lose its cost
or latency advantage in the serving layer. Conversely, cheaper switching can
justify more frequent routing only after task quality, energy, cache occupancy,
and foreground SLOs are measured separately.

## Limitations

- The repository was created on 2026-11-11 and had three GitHub stars when inspected; there is no adoption or production-reliability evidence here.
- All implementation, tests, benchmark descriptions, and compatibility statements are producer-authored.
- Scout inspected source and tests statically but did not install dependencies, run the test suite or benchmark, execute OpenCode, call any model provider, or measure latency, quality, cache behavior, or cost.
- The README reports provider and OpenCode compatibility, but Scout did not independently verify those environments. It also says OpenCode 2.2.6 does not fire the hook needed for main-chat model switching.
- Passing unit tests would establish encoded behavior only; they would not establish that the judge classifies difficulty correctly, that expected-output constants predict real calls, or that routed tasks retain quality.
- ShadowPrefill is a v1 research paper from its system's authors. Scout read the complete HTML paper but did not inspect code or raw traces, run its simulator or vLLM prototype, reproduce the 16-H100 testbed, or validate benchmark scoring and Azure-derived traffic assumptions.
- The simulation depends on specified cached-token pricing, SLOs, provisioning, traffic replay, and model-pair selection. The GPU testbed used two FusionBench pairs and two SWE-bench pairs; its SWE-bench accuracy sample contained 50 of 500 Verified tasks.
- The paper's method assumes operator control of model-serving pools and spare capacity. It does not directly apply to a client that can choose only hosted API endpoints and cannot schedule low-priority prefix work or inspect candidate cache state.
- Lower routed token billing is not lower total resource use. Shadow computation, host-memory occupancy, extra prefill throughput, and cluster architecture materially affect the energy and capacity result.
- HN contributed discovery only: item 50488359 had two points and no comments when inspected.

## Sources inspected

- HN item: https://news.ycombinator.com/item?id=50488359
- ShadowPrefill v1: https://arxiv.org/abs/2611.13176v1
- ShadowPrefill full HTML: https://arxiv.org/html/2611.13176v1
- Repository: https://github.com/miguelmartens/opencode-gearbox
- Pinned tree: https://github.com/miguelmartens/opencode-gearbox/tree/e56751c6f80d9163e984fea1433bbc2e56d071a3
- README: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/README.md
- Design: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/docs/superpowers/specs/2026-11-10-opencode-gearbox-design.md
- Prompt rules: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/core/rules.ts
- Judge protocol: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/core/judge.ts
- Routing implementation: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/src/server/routing.ts
- Routing tests: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/test/server/routing.test.ts
- Judge-model tests: https://github.com/miguelmartens/opencode-gearbox/blob/e56751c6f80d9163e984fea1433bbc2e56d071a3/test/server/judge-model.test.ts
