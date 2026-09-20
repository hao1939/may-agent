<ai_context>
summary: "SoL-Pi is NVIDIA's young MIT-licensed efficiency extension for the Pi coding-agent harness. Its four mechanisms are relevant design evidence for May, but the released package is not a drop-in May extension and its full-stack benchmark trades 5.7–6.3% of Pi's point-estimate score for roughly one-third lower API cost. Defer direct adoption; if May's own measurements identify repeated large-output replay as a material cost, trial only a native, deterministic ObservationPack-style projection behind existing Task, tool, guard, and transcript boundaries."
triggers: ["SoL-Pi", "NVlabs SoL-Pi", "Pi efficiency extension", "May agent token efficiency", "ObservationPack", "Action Fusion", "Online Context Compact", "Evidence-Preserving Reducer"]
last_updated: "2026-09-20"
source_basis: "Full 15-page arXiv 2609.20519v1 paper; NVlabs/SoL-Pi README, package metadata, configuration, compatibility, security, third-party notices, license, GitHub repository metadata and recent issue/PR state at main commit bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1; local May Host source at 1c8d8940a2257c2564032b504440922bb0583ad0 and App/design workspace at root revision 3ea4f2a87dd9e6c5f8d148cdb56d6c9e46422380. No SoL-Pi code was installed or executed, and benchmark claims were not independently reproduced."
</ai_context>

# SoL-Pi for May Agent: evidence and adoption proposal

**Observed:** 2026-09-20  
**Disposition:** new decision record; direct adoption deferred, one conditional native trial proposed  
**Question:** Which “SoL-Pi” is relevant, what does it actually provide, and should May use it?

## Decision in one paragraph

The relevant project is **[NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi)**, the implementation paired with the paper *SoL-Pi: Recursively Scaling Auto-Research Loops for Efficient Agent Harness* ([arXiv:2609.20519v1](https://arxiv.org/abs/2609.20519v1)). Do **not** install or adopt the released extension in May now. It targets the complete `@earendil-works/pi-coding-agent` extension lifecycle, while May uses `pi-agent-core` and `pi-ai` inside a custom Host with its own tools, guards, transcript persistence, deterministic compaction, bounded workflows, and durable Task reconciliation. Direct installation would therefore require a new integration seam and could bypass May's effect and evidence boundaries. The paper nonetheless provides useful evidence that large-result replay is a plausible efficiency target. If May's existing usage measurements show that repeated large tool results materially dominate finished, correct sessions, trial a **May-native, deterministic ObservationPack-style context projection** only; do not trial the full stack or remote log reducer first.

## Identity resolution

The supplied name had no URL, so identity cannot be logically certain. Two primary-source candidates are easy to distinguish:

- [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi) calls itself “Scaling Auto-Research Loops for Efficient Agent Harnesses,” links the matching [paper](https://arxiv.org/abs/2609.20519v1), and is directly about coding-agent harnesses. This is the overwhelmingly relevant candidate for a May-agent proposal.
- [alipay/SoloPi](https://github.com/alipay/SoloPi) is an Android automation/testing tool. Its spelling, domain, and architecture do not fit the request's agent-system context.

**Residual ambiguity:** the human did not supply a URL, so this assessment cannot prove intent from the name alone. The proposal proceeds with NVlabs/SoL-Pi because its exact styled name and subject match; if the human meant a different artifact, its URL is the smallest needed correction.

## What is verified about SoL-Pi

### Purpose and architecture

The release is a standalone, opt-in extension layered on an unmodified Pi installation. It packages four harness mechanisms found by an AI-led search process:

1. **Action Fusion** adds an optional validation command to edit/write operations, combining mutation and follow-up validation in one model-visible tool call.
2. **ObservationPack** archives text tool results larger than 10 KiB locally, sends the full result for two provider requests, then substitutes a stable handle plus a roughly 1 KiB head/tail excerpt; exact pages remain recallable.
3. **Evidence-Preserving Reducer (EPR)** sends eligible build/test logs of at least 4 KiB to a cheaper model, then accepts a smaller receipt only after deterministic schema, source-hash, exit-status, exact-quote, and size checks. It falls back to the original on failure or suspected credentials.
4. **Online Context Compact (OCC)** uses completed plan-step boundaries, estimated remaining requests, window pressure, and a cache-write/read ratio to decide when to invoke Pi's native compaction, then automatically continues in a fresh turn.

This is an **efficiency extension**, not the auto-research system itself. The released repository contains the four selected mechanisms. The paper describes the broader search: 152 proposed directions, 535 executable development environments, more than 3,000 runs, and more than 60,000 agent–environment interactions. It says metrics and tolerances were fixed outside the optimizer's control, candidates passed capability and efficiency gates, 11 public EdgeBench tasks were used for one-way acceptance, and the remaining 40 for final evaluation. Those are author-reported process facts; the archived search corpus and all causal claims were not independently audited here.

### Dependencies and deployment

At pinned main commit [`bd00588`](https://github.com/NVlabs/SoL-Pi/tree/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1):

- package version is `0.1.0`, marked `private`, and installed from Git rather than a tagged package release;
- Node.js `>=22.19.0` and npm are required;
- runtime peers are `@earendil-works/pi-agent-core`, `pi-ai`, `pi-coding-agent`, `pi-tui`, and `typebox`;
- development is pinned to Pi `0.85.1`; the project reports its 19 files/140 tests and public-API checks also pass on `0.84.2`;
- every mechanism defaults off; one project or user JSON config replaces rather than merges with the other;
- persistent archives live below the Pi session directory; remote reduction uses Pi-managed authentication and a configured provider/model.

The repository says it imports only public Pi exports and does not patch or vendor Pi. That lowers upstream-maintenance risk inside a supported Pi installation, but it does not make it portable to any system that happens to import `pi-agent-core`.

### Maturity and maintenance

Evidence points to an active but very young project, not a mature dependency:

- GitHub reports creation on 2026-09-02; the observed main branch contains 17 commits through 2026-09-18.
- The repository had about 2,645 stars, 205 forks, and 63 open issues at observation time. Popularity is not reliability evidence.
- There were no GitHub releases or tags, while `package.json` reported `0.1.0` and `private: true`.
- Open fixes at observation time included configured-shell handling, ObservationPack context preservation, stale compaction horizons, invalid fused-tool arguments, bounded reducer reads, reducer symlink handling, and compaction accounting. These show responsive hardening work but also expose unsettled behavior near precisely the filesystem, shell, context, and archive boundaries May would care about.
- The compatible Pi range is documented from tests, not expressed as a bounded peer-version contract (`*` peer versions).

**Assessment:** promising research implementation / early adopter software. Activity is current, but release discipline, compatibility surface, and field maturity are insufficient for a production May dependency without a separate qualification campaign.

### License

The repository's [LICENSE](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/LICENSE) is MIT, copyright NVIDIA. The [third-party notice](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/THIRD_PARTY_NOTICES.md) says third-party source is not vendored and lists the runtime peers as MIT. Legal compatibility looks straightforward for experimentation, subject to ordinary project review; this is not legal advice.

## Evidence strength and material limitations

### Reported results

On the 51 public EdgeBench tasks, the paper reports:

- GPT-5.6 Sol: full-stack SoL-Pi used 49.0% fewer recorded tokens and cost 33.2% less than Pi, but its average score was **42.003 vs. 44.833** (93.7% retained, a 6.3% point-estimate reduction).
- Opus 5, without backend-specific search: 44.7% fewer tokens and 33.5% less cost, with average score **42.224 vs. 44.756** (94.3% retained, a 5.7% point-estimate reduction).
- Single mechanisms sometimes performed better: ObservationPack scored 47.208 on GPT-5.6 Sol; Action Fusion scored 50.482 on Opus 5. These are separate selected “performance” points, not the full stack.
- On 63 CPU-only Terminal-Bench 4 tasks, SoL-Pi solved **15**, versus **18** each for Pi and Codex, while lowering total and per-solved-task cost relative to Pi.
- On six IMO 2026 Lean tasks, SoL-Pi and Pi each passed three; SoL-Pi cost less.
- One two-hour kernel-optimization swarm run per configuration favored the SoL-Pi worker swarm over the Pi worker swarm on result and cost, but the single-agent run remained cheapest.

The paper's “comparable performance” wording therefore includes visible capability losses in the efficiency configuration. May must choose its own non-inferiority margin; cost reduction does not erase fewer solved tasks or lower scores.

### What remains unverified or weak

- Results are author-run and were not reproduced in this assessment.
- Public EdgeBench is a narrow coding-agent panel. The 51 tasks were split 11/40 after mechanism development; public availability and a single final pass do not create a permanently secret test set.
- Point estimates are reported without uncertainty intervals in the extracted main tables.
- Development used one model backend. Transfer to one other backend is encouraging but preliminary, and activation rates/intensities changed materially.
- The complete-stack interaction analysis is descriptive; it does not isolate causal interaction effects.
- The auto-research scaling process is expensive, and the paper explicitly says it does not establish a breadth/depth scaling law or demonstrate recursive compounding.
- Dollar claims use 2026-08-17 prices and are price-sensitive. Token traffic and verified task outcomes are the more durable measurements.

## Security, privacy, and operational burden

The project's [security policy](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/SECURITY.md) correctly states that SoL-Pi runs with the Pi process's filesystem, process, network, and credential permissions and is **not a sandbox**.

Material implications:

- **Action Fusion:** model-selected shell execution occurs inside a mutation tool. Hash checks cover an intervening file change only within SoL-Pi's queue; external processes and other extensions are not globally locked. A host integrating this naively could run a shell command without its normal command-level policy, audit, progress, timeout, and guard hooks.
- **ObservationPack:** full outputs are persisted locally and are not automatically deleted when the session ends. That increases local sensitive-data footprint and requires retention alignment, access control, and cleanup.
- **EPR:** eligible logs can leave the machine for a remote reducer. The likely-secret detector is explicitly not complete. Exact-quote verification protects receipt fidelity, not confidentiality, completeness of diagnosis, or safety of the original log.
- **OCC:** plan/progress details are stored in Pi's session log. Its automatic abort/compact/continue choreography depends on Pi's exact `agent_settled`, compaction, message, and session-manager semantics. It can change interruption, continuation, and context behavior.
- **Project-local config:** trusted-project checks matter because a config can enable mutation, shell execution, local archival, and remote log reduction.

Operating the package would add Pi-version compatibility checks, config validation, local archive retention, provider/model routing for EPR, security review of model-bound logs, mechanism-specific metrics, and rollback testing. Running all four also makes attribution harder; a failure or gain must be separated by mechanism and backend.

## Fit with May's actual architecture

Reviewed May Host source revision: `1c8d8940a2257c2564032b504440922bb0583ad0`. The colocated App/design workspace was read at root revision `3ea4f2a87dd9e6c5f8d148cdb56d6c9e46422380`; no public remote for that workspace was established, so its exact local paths are retained rather than inventing web URLs.

Relevant current boundaries:

- `/app/projects/may-agent.app/docs/2a-design/architecture.md`: the Host owns durable input admission, events, state/storage, and bounded Task execution; accepted outcomes and Task closure are separate.
- `/app/projects/may-agent.app/docs/2a-design/agent-app.md`: Apps map typed input to durable work; agents and workflows are bounded executors, not owners.
- `/app/projects/may-agent.app/docs/2a-design/task-resource-engine.md`: generation/resource-version fencing, Conditions, dependencies, and exact result admission protect effects and recovery.
- `/app/projects/may-agent.app/docs/2a-design/workflows.md`: workflows are bounded recipes, not background owners or durable processes.
- `/app/projects/may-agent.app/docs/2a-design/guards.md`: tool and workflow intervention remains observable, with blocking reserved for precise high-impact boundaries.
- [`package.json`](https://github.com/hao1939/may-agent/blob/1c8d8940a2257c2564032b504440922bb0583ad0/package.json) pins `pi-agent-core` and `pi-ai` 0.85.1, but not `pi-coding-agent` or `pi-tui`. May constructs its own model/tool runner.
- May already has [deterministic transcript compaction](https://github.com/hao1939/may-agent/blob/1c8d8940a2257c2564032b504440922bb0583ad0/src/lib/compaction.ts): at a configured context threshold it preserves recent messages, original task, file/tool facts, command outcomes, and recent reasoning, then saves a compacted transcript projection. Its bash tool also truncates large output and retains the full output in a temporary file when supported.
- `/app/projects/may-agent.app/docs/2a-design/metrics.md` treats token/cost observations as signals, not acceptance authority; the runtime already records bounded context and usage observations.

### Consequence

A SoL-Pi extension cannot simply be enabled in May. It expects `pi-coding-agent` extension events, `ExtensionContext`, Pi session management, native compaction, project trust, tool replacement, and `sendMessage()` continuation semantics. May's core model dependency is shared, but its lifecycle is not.

More importantly, May's correctness boundary is broader than a Pi session. Task evidence must survive attempts, stale results must be fenced, guards must observe the real effect, and workflow completion must not be mistaken for Task completion. Any imported mechanism must remain **inside one bounded execution attempt** and must not become a second continuation, persistence, or authority layer.

## Options

### Option 1 — Install SoL-Pi as released: reject for May

**Shape:** add `pi-coding-agent`/TUI and load the Git extension around May executions.

**Benefit:** closest route to the reported benchmark behavior and least reimplementation of SoL-Pi internals.

**Costs and risks:** creates a second session/tool/compaction lifecycle; mismatches May's custom runner; may place fused shell effects behind a write/edit call instead of May's command guard boundary; duplicates transcript/archive state; risks remote log disclosure; requires version and continuation compatibility; and has no direct evidence on May's Task/workflow workload.

**Replaces/complements:** would partially replace May's tools and compaction rather than cleanly complement them.

**Verdict:** reject. Shared `pi-agent-core` package versions do not make the extension contract compatible.

### Option 2 — Port all four mechanisms into May: defer

**Shape:** independently implement native equivalents at May's tool, provider-context, and compaction boundaries while preserving Host events, Task fences, session persistence, guards, and cancellation.

**Benefit:** could retain May's authority model and potentially capture a similar efficiency frontier.

**Costs and risks:** four coupled changes, two archival paths, a remote-model data path, difficult attribution, duplicated existing compaction/truncation, and a large regression surface. The full-stack benchmark accepts a measurable score loss, and no May baseline currently proves this is the highest-value bottleneck.

**Replaces/complements:** Action Fusion would alter existing write/edit/bash behavior; OCC would compete with deterministic compaction; ObservationPack would complement tool-result projection; EPR would add a new model call and privacy boundary.

**Simplest alternative:** keep existing truncation, pagination, deterministic compaction, usage telemetry, and agent guidance; optimize only after a measured repeated-output or context-cost cohort is found.

**Verdict:** defer.

### Option 3 — Conditional May-native ObservationPack trial: recommended only after a positive baseline

**Shape:** add a context-projection experiment for selected large, text-only tool results. Preserve the original result in May's existing session artifact/retention model; show the full result for a fixed short horizon; later project a stable content-addressed handle, byte count, and deterministic head/tail excerpt; expose bounded exact recall through an existing read/artifact path. Do not replace Task evidence, tool receipts, or the original transcript.

**Expected benefit:** reduce repeated provider input without another model call, new shell authority, or automatic continuation. The paper's strongest GPT-5.6 single-mechanism score came from ObservationPack, though that remains author evidence.

**Costs and risks:** handle/recall misses, hidden relevant middle content, interaction with provider caching and May compaction, extra retained bytes, and a new projection protocol agents must understand. May's bash tool already truncates to a file, so the incremental gain may be small; baseline measurement is mandatory.

**Complements/replaces:** complements May's persisted full session and scoped reads; it should replace only repeated provider projection of selected large results, not existing storage, Task evidence, or deterministic compaction.

**No-change comparator:** current 50 KiB/2,000-line bash truncation with a full-output file, paginated reads, and 60%-threshold deterministic compaction.

**Verdict:** trial only if the baseline demonstrates material repeated-result replay. Otherwise choose no change.

## Reversible trial specification

### Entry gate

Do not implement until a fixed recent cohort of finished May sessions shows all of the following:

- repeated projection of eligible large text results is at least 15% of provider input tokens in the cohort;
- the sessions have reliable terminal outcome/evidence and token accounting;
- a representative holdout can be frozen before tuning; and
- sensitive classes and retention rules can be enumerated.

The 15% threshold is a proposed decision threshold, not a SoL-Pi result.

### Scope

- One non-production or explicitly canaried execution lane.
- One mechanism only: deterministic large-result projection and exact recall.
- Text-only outputs already retained by May; exclude secrets, credentials, binary/image data, database dumps, human conversations, Task specs/results, finish receipts, and security/audit events.
- No remote reducer, no fused mutations/commands, no automatic compaction/continuation, no changes to Task/Condition/workflow semantics.
- Fixed eligible-tool allowlist and size/horizon settings established before the holdout.

### Evaluation

Use paired or randomized matched runs on the same frozen task panel, model, model settings, tool set, source revision, attempt limits, and prices. Report distributions and per-task outcomes, not only aggregate dollars.

Success requires:

1. no accepted-result, required-test, or evidence-completeness regression beyond a predeclared non-inferiority margin (suggested starting point: no more than one task and no more than 2 percentage points, whichever is stricter);
2. at least 15% lower provider input tokens on eligible sessions and at least 10% lower total model cost at fixed prices;
3. 100% byte-exact recall for sampled handles and zero missing original artifacts during the declared retention window;
4. no cross-session handle resolution, secret-class projection, guard bypass, stale Task admission, or changed cancellation/timeout behavior;
5. separately reported recall count, failed recalls, context-compaction frequency, cache-read/write tokens, latency, and agent re-reading/verification behavior.

Use a frozen holdout after implementation tuning. Have an independent reviewer inspect outcome parity and a sample of cases where the projected excerpt omitted the ultimately relevant line.

### Rollback / exit

Disable the projection flag and return to the current provider-context path. Retain trial receipts long enough to audit, then use the existing retention policy; do not orphan a second archive. Exit rather than expand if the non-inferiority gate fails, exact recall is unreliable, cache churn erases savings, agents materially increase rereads, or operational complexity outweighs measured savings.

### Explicit non-goals

- adopting SoL-Pi as a dependency;
- reproducing its full auto-research system;
- changing May Task ownership, closure, Conditions, workflow lifetime, or guards;
- sending logs to another model;
- claiming general token savings from one model or one benchmark;
- using lower cost to justify weaker verification.

## Recommendation

**Recommendation: defer direct adoption; conditionally trial one native mechanism.** SoL-Pi is credible, relevant research and its source is unusually clear about opt-in behavior, fallbacks, and security limits. But the released software is at an early `0.1.0`/no-release stage and is coupled to a Pi coding-agent runtime May does not use. Its full-stack efficiency point also accepts visible benchmark-score reductions. May should first use its existing usage observations to establish whether repeated large-result replay is a real bottleneck. If it is, a narrow ObservationPack-style experiment has the cleanest fit: it can remain a context projection within May's existing session, evidence, guard, and Task boundaries and can be rolled back without changing durable work semantics.

## Primary sources and reviewed coverage

### SoL-Pi

- [Paper landing page and version identity](https://arxiv.org/abs/2609.20519v1) — full 15-page v1 PDF read; observed 2026-09-20.
- [Pinned repository](https://github.com/NVlabs/SoL-Pi/tree/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1) — README and top-level layout read.
- [Package metadata](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/package.json) — dependencies, version, scripts, engine, packaging.
- [Configuration](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/docs/configuration.md) — schema, defaults, trust, model route, persistence behavior.
- [Compatibility](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/docs/compatibility.md) — Pi API surface, tests, fallbacks, known integration assumptions.
- [Security policy](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/SECURITY.md) — authority, storage, reducer, project trust.
- [MIT license](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/LICENSE) and [third-party notices](https://github.com/NVlabs/SoL-Pi/blob/bd005888b9b8a3fcdb511feb91fc27d3dfa8f2b1/THIRD_PARTY_NOTICES.md).
- GitHub repository, commit, release, tag, contributor, issue, and pull-request APIs — current metadata observed 2026-09-20; no code execution or live-provider test.

### May

- Current local May Host source at `1c8d8940a2257c2564032b504440922bb0583ad0` and App/design workspace at root revision `3ea4f2a87dd9e6c5f8d148cdb56d6c9e46422380`: architecture, App, Task, workflow, guard, session, metrics, package dependency, manager, compaction, and bash-output paths named above.

## Related Scout knowledge

- [Agent self-evolution and autonomy](../agent-self-evolution-and-autonomy.md) places harness evolution among other mutable agent surfaces.
- [Agent self-evolution evidence and release controls](../agent-self-evolution-evidence-and-release-controls.md#harness-evolution-can-optimize-efficiency-without-proving-general-self-improvement) records the earlier abstract-level SoL-Pi signal. This assessment supersedes that entry only for the May-specific adoption question and full-paper coverage; the earlier note remains a useful cross-project synthesis.
