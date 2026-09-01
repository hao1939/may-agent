---
title: "Moli — Agent Browsers Can Make Pixels an Explicit Cost Tier"
source: github
date: 2026-08-27
last_updated: 2026-08-27
type: finding
tags: [github, browser-agents, computer-use, headless-browser, cost-control, cdp, webdriver]
relevance: high
---

Repo: https://github.com/lexmount/moli

# Moli — Agent Browsers Can Make Pixels an Explicit Cost Tier

## Signal

Moli is an Apache-2.0 Rust headless browser built for agent workloads. Its useful
architectural signal is not merely that it is lighter than Chromium: it splits
browser state into explicit cost tiers. DOM, JavaScript, CSS state, networking,
and storage remain live by default, while real layout, coordinate input, and
pixels are opt-in. Optional image, font, audio, video, media, and text-track
fetches are separately gated.

This turns a common agent optimization—prefer structured page state over
screenshots—into a runtime contract rather than a prompting preference.

## Concrete Design

1. **Structure is the default control path.** The CLI can emit HTML, Markdown,
   JSON, or a compact semantic tree. CDP, WebDriver Classic, and WebDriver BiDi
   share one browser kernel and scheduler, so existing automation clients can
   use the same DOM-first runtime.

2. **Geometry is explicit and snapshot-based.** Default mode returns
   deterministic mock geometry without real layout or paint. `--layout` enables
   real geometry, hit testing, coordinate input, screenshots, and screencasts.
   A geometry request builds a layout tree from current DOM/style state and
   retains only a frozen snapshot; screenshots rebuild it and discard paint
   state afterward.

3. **Resource families are capability switches.** `--resource` fetches all
   optional visual/media resources, while narrower flags opt into individual
   families. Persistence is also selective through profile, cache, and cookie
   options. Expensive or stateful behavior is therefore visible in launch
   configuration rather than silently inherited from a full browser.

4. **Unsupported surfaces fail explicitly.** The project states that
   unsupported protocol paths return errors rather than fabricated browser
   actions, events, observations, or visual results. For agents, this distinction
   matters: protocol compatibility should be an observable partial contract,
   not a plausible-looking success response.

## Evidence and Boundary

The repository reports that Moli 0.1.1 passed 1,071 of 1,308 comparable tasks
(81.88%) in its affiliated Lexbench corpus, versus Chrome at 99.85%. A separate
557-task common-completion slice reports median peak memory of 92 MiB for Moli
and 697 MiB for Chrome, with median CPU time of 100.6 ms and 687 ms,
respectively. These are project-authored, benchmark-specific results—not an
independent production validation—and the compatibility gap to Chrome remains
material.

The README also names intentional exclusions: no GUI, GPU compositor,
high-fidelity Canvas/WebGL/media playback, persistent multi-frame paint system,
or pixel-for-pixel Chrome parity. The strongest supported conclusion is thus
**selective browser fidelity**, not drop-in browser equivalence.

At retrieval, GitHub API metadata showed 1,299 stars, 76 forks, Apache-2.0, and
a 2026-08-10 creation date. Repository metadata and README claims are volatile;
the analysis above was checked against commit
[`e5f4ef1f5fdd4f64c8c15e69dfebf61a4b9a8e49`](https://github.com/lexmount/moli/commit/e5f4ef1f5fdd4f64c8c15e69dfebf61a4b9a8e49).

## Implication

Browser-agent infrastructure should expose a **representation ladder** as a
policy and accounting boundary:

1. semantic/DOM state for extraction and element targeting;
2. real geometry only when spatial reasoning or coordinate input is required;
3. pixels only when visual evidence is required;
4. optional media and persistent state only when the task authorizes them.

This refines the library's existing interface-aware computer-use finding.
“Combine structure and vision” is incomplete guidance unless the runtime also
records which representation was requested, what it cost, how fresh it is, and
whether the requested fidelity was actually available. A mock box, frozen
layout snapshot, fresh screenshot, and continuously rendered page are different
evidence classes even if all satisfy the same protocol method.

## Sources

- Repo: https://github.com/lexmount/moli
- GitHub API metadata: https://api.github.com/repos/lexmount/moli
- README at inspected revision: https://github.com/lexmount/moli/blob/e5f4ef1f5fdd4f64c8c15e69dfebf61a4b9a8e49/README.md
- Inspected revision: https://github.com/lexmount/moli/commit/e5f4ef1f5fdd4f64c8c15e69dfebf61a4b9a8e49
- Affiliated benchmark: https://github.com/lexmount/Lexbench-Headless-Browser
- Five-engine report linked by the repo: https://github.com/lexmount/Lexbench-Headless-Browser/blob/kitesurf-eval/docs/reports/five-engine-report-20260813.md
- Resource card linked by the repo: https://github.com/lexmount/Lexbench-Headless-Browser/blob/main/docs/reports/resource-card-20260812.md
