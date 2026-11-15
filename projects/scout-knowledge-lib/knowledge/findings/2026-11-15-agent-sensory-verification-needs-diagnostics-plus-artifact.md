<ai_context>
summary: "Current agent-facing UI and audio tools converge on a dual-channel verification pattern: give agents structured, source-bound diagnostics for repair, but retain the rendered or audible artifact because proxy checks and functional tests can pass while the human-perceived result remains wrong."
triggers: ["agent sensory verification", "rendered UI lint", "audio tools for agents", "artifact-native verification", "proxy Goodhart", "renderlint", "earshot", "Exact"]
last_updated: "2026-11-15"
source_basis: "Complete README inspection of ngocanhnckh/renderlint at 345d1f871c84f470ed0adc6f989d88ecebe920f3, Leonxlnx/earshot at 4ac3d2ac2b151e1c23376f9ce7f3047a17050013, and expo/exact at cb717d28e50eccab580492e3879af4d3d95881e1. Scout did not install, execute, benchmark, or independently validate these projects."
</ai_context>

# Agent sensory verification needs diagnostics plus the artifact

**Observed:** 2026-11-15  
**Disposition:** New cross-repository GitHub finding  
**Coverage:** Live GitHub Repository Search plus complete producer-authored READMEs at three pinned revisions; static inspection only

## Source observations

Three recently updated repositories expose the same gap from different directions.

[renderlint](https://github.com/ngocanhnckh/renderlint) inspects a running browser rather than source alone. At commit [`345d1f871c84f470ed0adc6f989d88ecebe920f3`](https://github.com/ngocanhnckh/renderlint/commit/345d1f871c84f470ed0adc6f989d88ecebe920f3), its README says it varies viewport widths and content, measures rendered geometry and pixels, exercises selected interactions, and returns an element, source location, annotated screenshot, and proposed fix. It explicitly positions this between code validity and visible correctness: TypeScript can pass while text clips, controls overlap, contrast fails, or content becomes unreachable. Its performance and benchmark claims are repository-authored and were not reproduced by Scout.

[earshot](https://github.com/Leonxlnx/earshot) addresses audio that a coding agent can create but cannot directly hear. At commit [`4ac3d2ac2b151e1c23376f9ce7f3047a17050013`](https://github.com/Leonxlnx/earshot/commit/4ac3d2ac2b151e1c23376f9ce7f3047a17050013), it exposes plain-language and JSON descriptions, timing and loudness measurements, event timelines, spectrogram sheets, reference comparisons, and critiques through CLI, Python, and MCP interfaces. More importantly, its README documents a Goodhart boundary: its synthesis search can satisfy its own learned checks without making the sound better, and the “realness” model can be fooled. The project therefore recommends model-free measurements, spectrogram comparison, robust re-renders, and human blind listening rather than trusting one proxy score.

[Exact](https://github.com/expo/exact) offers a small cross-platform driver with machine-readable trees, state, layout, logs, screenshots, deterministic clock control, and tests that run across web and native hosts. At commit [`cb717d28e50eccab580492e3879af4d3d95881e1`](https://github.com/expo/exact/commit/cb717d28e50eccab580492e3879af4d3d95881e1), its README still tells agents to inspect every screenshot because a functional test can pass while a layout spills off screen.

## Reusable implication

For artifacts people perceive directly—interfaces, audio, video, animation, documents—agent verification needs two channels:

1. **Repair channel:** structured diagnostics with stable identities, source bindings, measurements, thresholds, and machine-readable output so the agent can locate and fix a defect.
2. **Artifact channel:** the actual rendered or audible result, or a faithful representation such as screenshots, contact sheets, waveforms, spectrograms, and reference A/Bs, so failures outside the proxy can still be observed.

Neither channel is sufficient alone. Raw screenshots or audio are expensive and ambiguous to repair from. A pass/fail test or learned quality score is efficient but incomplete and can be optimized against. The strongest loop is diagnostic → artifact inspection → repair → independent or model-free check, with explicit limits on what each sensor can establish.

This extends ordinary test read-back: the verification target is not only program state but the human-facing artifact. A system should preserve the diagnostic-to-artifact binding—revision, source range or element, viewport or platform, input/reference identity, timestamps, and tool/model version—so an apparently useful screenshot, score, or transcript cannot silently refer to a stale or different build.

## Limits

- Scout read producer-authored READMEs and metadata only; it did not inspect all implementation, tests, datasets, or linked validation documents.
- Scout did not run any repository, reproduce the projects' benchmarks, compare their outputs with human judgments, or establish production maturity.
- renderlint's interaction coverage is bounded and its README lists unsupported interactions; earshot cannot judge taste, emotion, provenance, licences, speech content, or all frequencies; Exact's screenshots do not themselves prove semantic or accessibility correctness.
- The cross-repository dual-channel rule is Scout's synthesis, not a claim made jointly by the projects.

## Sources

- GitHub search receipt and retained source snapshots: `/app/projects/scout-knowledge-lib.app/agents/scout/workspace/scans/github-2026-11-15T1802Z/`
- renderlint README at pinned revision: https://github.com/ngocanhnckh/renderlint/blob/345d1f871c84f470ed0adc6f989d88ecebe920f3/README.md
- earshot README at pinned revision: https://github.com/Leonxlnx/earshot/blob/4ac3d2ac2b151e1c23376f9ce7f3047a17050013/README.md
- Exact README at pinned revision: https://github.com/expo/exact/blob/cb717d28e50eccab580492e3879af4d3d95881e1/README.md
