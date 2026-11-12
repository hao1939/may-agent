<ai_context>
summary: "Modern Web Guidance packages agent-facing web advice behind local search and per-guide retrieval, blocks experimental or volatile features unless project configuration opts in, and reports paired guided/unguided coding-agent evaluations. Its stable-release announcement also separates up-front expert guidance from browser runtime verification. The reusable pattern is to treat changing domain guidance as a retrieved, risk-gated, empirically pruned dependency whose recommendations still require execution evidence."
triggers: ["Modern Web Guidance", "agent skill retrieval", "risk-gated guidance", "volatile feature gate", "guided versus unguided eval", "coding-agent documentation", "runtime verification"]
last_updated: "2026-11-12"
source_basis: "HN items 50443812 and 50460398; complete Modern Web Guidance 1.0 announcement; complete generated-repository README at release commit 4dd968349e54ca45a05dd5c818fb035c9054b022; and static inspection of selected source-repository files at commit 44a56d07d5cc9b9f500c8814ff068e623bbb11ef, including retrieval gates and evaluation documentation. Scout did not install the package, run search or retrieval, reproduce evaluations or announced case studies, inspect every guide or grader, or validate browser guidance independently."
</ai_context>

# Agent guidance needs retrieval, risk, and evaluation gates

- **Date observed:** 2026-11-10
- **Date revisited:** 2026-11-12
- **Question:** How should frequently changing expert guidance enter a coding agent's context without becoming an oversized, stale, or over-authoritative prompt?
- **HN sources:** https://news.ycombinator.com/item?id=50443812 and https://news.ycombinator.com/item?id=50460398
- **Announcement:** https://developer.chrome.com/blog/modern-web-guidance-v1
- **Repo:** https://github.com/GoogleChrome/modern-web-guidance
- **Source repo:** https://github.com/GoogleChrome/modern-web-guidance-src
- **Reviewed versions:** stable 1.0 announcement last updated 2026-11-10 UTC; generated release commit [`4dd968349e54ca45a05dd5c818fb035c9054b022`](https://github.com/GoogleChrome/modern-web-guidance/commit/4dd968349e54ca45a05dd5c818fb035c9054b022); and source commit [`44a56d07d5cc9b9f500c8814ff068e623bbb11ef`](https://github.com/GoogleChrome/modern-web-guidance-src/commit/44a56d07d5cc9b9f500c8814ff068e623bbb11ef)
- **Coverage:** both HN items and visible discussion; complete stable-release announcement and distribution README; selected retrieval, configuration, Baseline, and evaluation documentation and source. Static inspection only.
- **Disposition:** new knowledge; no existing Scout note declared these primary sources or reviewed this implementation.

## Source observation

Modern Web Guidance addresses a specific coding-agent failure mode: model training data contains enough old frontend code that agents can produce large JavaScript workarounds for behavior now available through native HTML, CSS, or browser APIs. Instead of placing its complete corpus into every prompt, the package installs a small skill that directs the agent to a local `search` command and then a `retrieve <guide-id>` command. The distribution README lists 250 web features and 203 developer use cases, while describing the installed skill itself as roughly 205 tokens.

The retrieval path is not only a context-size optimization. The inspected source reads repository or user configuration from `.mwgrc` and applies policy at retrieval time. Guides involving Origin Trials or volatile features remain searchable, but retrieval throws a typed gate error unless the relevant configuration key is explicitly enabled. The refusal text tells the agent not to edit the configuration, run the opt-in command itself, or bypass the gate by reading raw guide files. Baseline configuration also changes the returned guide: when a project's browser-support target already admits a feature, retrieval tells the agent to omit unnecessary fallbacks and polyfills.

The project also makes evaluation part of guidance maintenance. Producer-authored documentation describes realistic tasks against full web applications, Playwright assertions over source and browser behavior, golden solutions that must pass, unmodified base applications that must fail, and paired agent runs with and without guidance. The release README's November 8 snapshot reports guided assertion pass rates of 82–94% versus 54–58% unguided across three named agent/model combinations, uplifts of 28–36 percentage points over 214–215 tasks. The authors say advice is pruned where agents already succeed without it and refined where opportunity remains.

The visible HN discussion sharpened two boundaries. One maintainer said the legacy-pattern scanner intentionally favors clear, low-false-positive cases and currently overlaps only about 20% of the guides, so a clean scan does not mean the corpus is irrelevant. Separately, commenters raised browser-vendor bias; project contributors replied that Mozilla and Edge contributors participate and that recommendations use cross-browser Baseline data. Those replies are useful provenance claims, not independent proof that every guide is neutral or correct.

The stable 1.0 announcement makes a further distinction between **authoring guidance** and **runtime evidence**. It positions Modern Web Guidance as up-front expertise for choosing current platform features, then pairs it with Chrome DevTools for agents to run performance traces, interact with pages, record animations, test reduced-motion behavior, and inspect memory growth. The article's examples explicitly say guidance can explain how to break up long JavaScript tasks or cache SPA views, but cannot by itself prove a 50 ms main-thread target, visual correctness, preference handling, or absence of memory leaks. That is a useful boundary even though the recommended runtime tool is another Chrome project.

The same announcement reports several deployment results: a 180-run production-codebase evaluation at note inc. raised modern-web-check pass rates from 61% to 94%; WeTV says an agent now resolves 90% of failed performance checks; and MetaMask says a review bot examined roughly 480 pull requests and led engineers to fix 43 findings. These are producer-selected case studies without inspected protocols or raw records. They support investigation of guidance-plus-runtime-check workflows, not independent causal or cross-project performance claims.

## Reusable interpretation

Frequently changing agent guidance should be managed as a versioned dependency with four distinct controls:

1. **Retrieve only relevant evidence.** Keep the activation contract small, search by the current task, and insert the selected guide rather than the whole domain manual. This reduces context competition and lets updates ship independently of model training.
2. **Apply policy when evidence is retrieved.** Searchability is not authorization. Experimental, volatile, licensed, privacy-sensitive, or organization-specific advice can remain discoverable while retrieval or use requires an explicit project-owned opt-in. The agent must not be able to grant that opt-in to itself.
3. **Retain advice only when it changes measured outcomes.** Evaluate guidance against an unguided control on tasks whose acceptance checks operate at the resulting code or runtime behavior. Record the model, harness, reasoning configuration, task denominator, assertion denominator, base-app negative control, and guide revision. Remove redundant material rather than rewarding a larger prompt.
4. **Verify the recommendation in its target environment.** A guide can propose the right API or pattern without proving that the resulting page meets performance, accessibility, visual, compatibility, or resource-lifecycle requirements. Bind the retrieved guide and code revision to runtime checks under explicit devices, browser versions, user preferences, and thresholds.

This is stronger than treating a skill as a Markdown bundle. The useful unit is a **policy-aware retrieval record**: query, ranked guide identity, guide revision, project compatibility target, risk-gate verdict, inserted content identity, and downstream acceptance result. That record lets an operator distinguish four failures that a single "skill enabled" flag hides: the agent never searched; retrieval selected the wrong guide; policy correctly blocked a guide; or the guide was retrieved but did not improve the implementation.

The pattern also constrains what evaluation can establish. Paired guided/unguided pass rates can show value on the project's tasks and graders, but they do not prove that the retrieval layer always chooses the right guide, that graders capture maintainability or cross-browser regressions, or that higher pass rates transfer to other repositories and models. A mature guidance service therefore needs separate retrieval-quality, policy-compliance, and task-outcome measurements.

## Evidence boundary

- The announcement's note inc., WeTV, MetaMask, Pensionbazaar, and Policybazaar outcomes are producer-selected case studies. Scout did not inspect their protocols, repositories, baseline selection, raw runs, pull requests, issue classifications, or independent confirmations.
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
- **HN stable-release submission:** https://news.ycombinator.com/item?id=50460398
- **Stable 1.0 announcement:** https://developer.chrome.com/blog/modern-web-guidance-v1
- **Distribution repo:** https://github.com/GoogleChrome/modern-web-guidance
- **Distribution revision:** https://github.com/GoogleChrome/modern-web-guidance/commit/4dd968349e54ca45a05dd5c818fb035c9054b022
- **Distribution README:** https://github.com/GoogleChrome/modern-web-guidance/blob/4dd968349e54ca45a05dd5c818fb035c9054b022/README.md
- **Source repo:** https://github.com/GoogleChrome/modern-web-guidance-src
- **Inspected source revision:** https://github.com/GoogleChrome/modern-web-guidance-src/commit/44a56d07d5cc9b9f500c8814ff068e623bbb11ef
- **Retrieval and risk gates:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/src/rag/retrieve.ts
- **Search implementation:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/src/rag/search.ts
- **Evaluation documentation:** https://github.com/GoogleChrome/modern-web-guidance-src/blob/44a56d07d5cc9b9f500c8814ff068e623bbb11ef/docs/EVALS.md
