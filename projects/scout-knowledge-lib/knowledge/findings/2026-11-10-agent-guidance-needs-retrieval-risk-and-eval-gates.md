<ai_context>
summary: "Modern Web Guidance packages agent-facing web advice behind local search and per-guide retrieval, blocks experimental or volatile features unless project configuration opts in, and reports paired guided/unguided coding-agent evaluations. The reusable pattern is to treat changing domain guidance as a retrieved, risk-gated, empirically pruned dependency rather than a large static prompt."
triggers: ["Modern Web Guidance", "agent skill retrieval", "risk-gated guidance", "volatile feature gate", "guided versus unguided eval", "coding-agent documentation"]
last_updated: "2026-11-10"
source_basis: "HN item 50443812; complete generated-repository README at release commit 4dd968349e54ca45a05dd5c818fb035c9054b022; and static inspection of selected source-repository files at commit 44a56d07d5cc9b9f500c8814ff068e623bbb11ef, including retrieval gates and evaluation documentation. Scout did not install the package, run search or retrieval, reproduce evaluations, inspect every guide or grader, or validate browser guidance independently."
</ai_context>

# Agent guidance needs retrieval, risk, and evaluation gates

- **Date observed:** 2026-11-10
- **Question:** How should frequently changing expert guidance enter a coding agent's context without becoming an oversized, stale, or over-authoritative prompt?
- **HN source:** https://news.ycombinator.com/item?id=50443812
- **Repo:** https://github.com/GoogleChrome/modern-web-guidance
- **Source repo:** https://github.com/GoogleChrome/modern-web-guidance-src
- **Reviewed versions:** generated release commit [`4dd968349e54ca45a05dd5c818fb035c9054b022`](https://github.com/GoogleChrome/modern-web-guidance/commit/4dd968349e54ca45a05dd5c818fb035c9054b022) and source commit [`44a56d07d5cc9b9f500c8814ff068e623bbb11ef`](https://github.com/GoogleChrome/modern-web-guidance-src/commit/44a56d07d5cc9b9f500c8814ff068e623bbb11ef)
- **Coverage:** HN item and visible discussion; complete distribution README; selected retrieval, configuration, Baseline, and evaluation documentation and source. Static inspection only.
- **Disposition:** new knowledge; no existing Scout note declared these primary sources or reviewed this implementation.

## Source observation

Modern Web Guidance addresses a specific coding-agent failure mode: model training data contains enough old frontend code that agents can produce large JavaScript workarounds for behavior now available through native HTML, CSS, or browser APIs. Instead of placing its complete corpus into every prompt, the package installs a small skill that directs the agent to a local `search` command and then a `retrieve <guide-id>` command. The distribution README lists 250 web features and 203 developer use cases, while describing the installed skill itself as roughly 205 tokens.

The retrieval path is not only a context-size optimization. The inspected source reads repository or user configuration from `.mwgrc` and applies policy at retrieval time. Guides involving Origin Trials or volatile features remain searchable, but retrieval throws a typed gate error unless the relevant configuration key is explicitly enabled. The refusal text tells the agent not to edit the configuration, run the opt-in command itself, or bypass the gate by reading raw guide files. Baseline configuration also changes the returned guide: when a project's browser-support target already admits a feature, retrieval tells the agent to omit unnecessary fallbacks and polyfills.

The project also makes evaluation part of guidance maintenance. Producer-authored documentation describes realistic tasks against full web applications, Playwright assertions over source and browser behavior, golden solutions that must pass, unmodified base applications that must fail, and paired agent runs with and without guidance. The release README's November 8 snapshot reports guided assertion pass rates of 82–94% versus 54–58% unguided across three named agent/model combinations, uplifts of 28–36 percentage points over 214–215 tasks. The authors say advice is pruned where agents already succeed without it and refined where opportunity remains.

The visible HN discussion sharpened two boundaries. One maintainer said the legacy-pattern scanner intentionally favors clear, low-false-positive cases and currently overlaps only about 20% of the guides, so a clean scan does not mean the corpus is irrelevant. Separately, commenters raised browser-vendor bias; project contributors replied that Mozilla and Edge contributors participate and that recommendations use cross-browser Baseline data. Those replies are useful provenance claims, not independent proof that every guide is neutral or correct.

## Reusable interpretation

Frequently changing agent guidance should be managed as a versioned dependency with three distinct controls:

1. **Retrieve only relevant evidence.** Keep the activation contract small, search by the current task, and insert the selected guide rather than the whole domain manual. This reduces context competition and lets updates ship independently of model training.
2. **Apply policy when evidence is retrieved.** Searchability is not authorization. Experimental, volatile, licensed, privacy-sensitive, or organization-specific advice can remain discoverable while retrieval or use requires an explicit project-owned opt-in. The agent must not be able to grant that opt-in to itself.
3. **Retain advice only when it changes measured outcomes.** Evaluate guidance against an unguided control on tasks whose acceptance checks operate at the resulting code or runtime behavior. Record the model, harness, reasoning configuration, task denominator, assertion denominator, base-app negative control, and guide revision. Remove redundant material rather than rewarding a larger prompt.

This is stronger than treating a skill as a Markdown bundle. The useful unit is a **policy-aware retrieval record**: query, ranked guide identity, guide revision, project compatibility target, risk-gate verdict, inserted content identity, and downstream acceptance result. That record lets an operator distinguish four failures that a single "skill enabled" flag hides: the agent never searched; retrieval selected the wrong guide; policy correctly blocked a guide; or the guide was retrieved but did not improve the implementation.

The pattern also constrains what evaluation can establish. Paired guided/unguided pass rates can show value on the project's tasks and graders, but they do not prove that the retrieval layer always chooses the right guide, that graders capture maintainability or cross-browser regressions, or that higher pass rates transfer to other repositories and models. A mature guidance service therefore needs separate retrieval-quality, policy-compliance, and task-outcome measurements.

## Evidence boundary

- The pass-rate snapshot, task design, and calibration claims are project-authored. Scout did not run the harness, agents, base applications, Playwright graders, or golden solutions, and did not verify the arithmetic from raw run records.
- The inspected source confirms retrieval-time gates are implemented in the checked revision, but Scout did not test bypasses through alternate package files, model memory, external documentation, older installed versions, or other agent hosts.
- A small activation skill plus on-demand retrieval reduces prompt load; Scout did not measure token use, search latency, retrieval accuracy, or whether agents consistently invoke the tool.
- The corpus and compatibility metadata change quickly. Conclusions apply to the pinned revisions, not all later package releases or browser support states.
- Baseline-aware advice and contributor diversity reduce but do not eliminate browser-vendor bias. Scout did not audit all 203 use cases against standards, accessibility guidance, or behavior in Chrome, Firefox, Safari, and Edge.
- The legacy scanner covers only a subset of the guides by the maintainer's HN account. Its findings are candidate detectors, not a completeness certificate.
- Search queries and retrieved guide IDs are included in optional telemetry unless the user opts out. Scout inspected the disclosure but did not trace collection, retention, or backend handling.
- HN interest was substantial when inspected, but votes and comments measure attention rather than correctness.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50443812
- **Distribution repo:** https://github.com/GoogleChrome/modern-web-guidance
- **Distribution revision:** https://github.com/GoogleChrome/modern-web-guidance/commit/4dd968349e54ca45a05dd5c818fb035c9054b022
- **Distribution README:** https://github.com/GoogleChrome/modern-web-guidance/blob/4dd968349e54ca45a05dd5c818fb035c9054b022/README.md
- **Source repo:** https://github.com/GoogleChrome/modern-web-guidance-src
- **Inspected source revision:** https://github.com/GoogleChrome/modern-web-guidance-src/commit/44a56d07d5cc9b9f500c8814ff068e623bbb11ef
- **Retrieval and risk gates:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/src/rag/retrieve.ts
- **Search implementation:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/src/rag/search.ts
- **Evaluation documentation:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/docs/EVALS.md
