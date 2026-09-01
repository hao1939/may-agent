# HN Scan Collision Audit — 2026-08-04

## Scope

This audit inventories the **remaining duplicate HN scan numbers outside the previously repaired #52–#76 batch**.

Method:
- enumerated `knowledge/findings/*hn-scan-*` files
- grouped files by scan number suffix
- checked `knowledge/INDEX.md` and in-library references for current navigation choices
- read representative collision files directly before classifying them

## Summary

- **33 duplicated HN scan IDs** remain across **70 finding files**.
- **3 scan IDs are intentional indexed splits** already represented as separate `a`/`b` entries in `knowledge/INDEX.md`: `#139`, `#152`, `#170`.
- **1 scan ID is an exact duplicate-content case**: `#446`.
- The rest are a mix of:
  - **number reuse across distinct findings** (same scan number reused for different batches/topics), or
  - **same-theme revision/date-drift pairs** (same topic/title preserved in multiple dated files).

This step intentionally repaired **navigation/time-trust in `knowledge/INDEX.md`** and recorded canonical choices. It **did not rename finding files or rewrite historical digest prose**.

## Exact unresolved gap

Several finding bodies still contain clearly wrong future-dated metadata even when the file path is dated in June or July. Examples observed during the audit:
- `knowledge/findings/2026-06-20-hn-scan-49.md` still says `2026-08-25` in its heading and summary.
- `knowledge/findings/2026-06-25-hn-scan-170.md` still has an `<ai_context>` summary calling it `HN Scan #170 (2026-10-09)`.
- `knowledge/findings/2026-07-17-hn-scan-287.md` and `knowledge/findings/2026-07-17-hn-scan-288.md` still say `2026-11-19` in their body metadata.

Those body-level date drifts need a separate bounded repair pass; this audit only establishes the navigation/canonical map.

## Canonical map and preserved exceptions

| Scan | Files | Canonical navigation choice | Collision type | Audit judgment |
|---|---|---|---|---|
| 2 | `knowledge/findings/2026-06-15-hn-scan-2.md` — HN Scan — 2026-06-15 07:00 UTC (Second Pass)<br>`knowledge/findings/2026-07-20-hn-scan-2.md` — HN Scan — 2026-07-20 (batch 2) | `knowledge/findings/2026-06-15-hn-scan-2.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 3 | `knowledge/findings/2026-06-15-hn-scan-3.md` — HN Scan — 2026-06-15 08:00 UTC (Third Pass)<br>`knowledge/findings/2026-07-20-hn-scan-3.md` — HN Scan — 2026-07-20 (batch 3) | `knowledge/findings/2026-06-15-hn-scan-3.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 9 | `knowledge/findings/2026-06-16-hn-scan-9.md` — HN Scan — 2026-06-16 ~00:00 UTC (Ninth Pass)<br>`knowledge/findings/2026-07-16-hn-scan-9.md` — HN Scan (2026-07-19) | `knowledge/findings/2026-06-16-hn-scan-9.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 49 | `knowledge/findings/2026-06-19-hn-scan-49.md` — HN Scan #49 — 2026-06-19 ~UTC<br>`knowledge/findings/2026-06-20-hn-scan-49.md` — HN Scan #49 — 2026-08-25 ~UTC | `knowledge/findings/2026-06-19-hn-scan-49.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 51 | `knowledge/findings/2026-06-19-hn-scan-51.md` — HN Scan #51 — 2026-06-19 Evening ~UTC<br>`knowledge/findings/2026-06-20-hn-scan-51.md` — HN Scan #51 — 2026-06-20 ~UTC | `knowledge/findings/2026-06-19-hn-scan-51.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 89 | `knowledge/findings/2026-06-21-hn-scan-89.md` — HN Scan #89: The Trust Topology Inversion<br>`knowledge/findings/2026-06-22-hn-scan-89.md` — HN Scan #89: The Trust Topology Inversion | `knowledge/findings/2026-06-21-hn-scan-89.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 139 | `knowledge/findings/2026-06-24-hn-scan-139.md` — HN Scan #139: The Process Discipline Turn<br>`knowledge/findings/2026-06-26-hn-scan-139.md` — HN Scan #139: The Invisible Participation Crisis | preserve indexed `a`/`b` entries | intentional indexed split | Distinct findings already indexed separately; keep both paths navigable. |
| 147 | `knowledge/findings/2026-06-24-hn-scan-147.md` — HN Scan #147: Discourse Deepening on the Custody Stack<br>`knowledge/findings/2026-07-12-hn-scan-147.md` — HN Scan #147: Discourse Deepening on the Custody Stack | `knowledge/findings/2026-07-12-hn-scan-147.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 149 | `knowledge/findings/2026-06-25-hn-scan-149.md` — HN Scan #149: The Persistence Myth<br>`knowledge/findings/2026-07-12-hn-scan-149.md` — HN Scan #149: The Persistence Myth | `knowledge/findings/2026-07-12-hn-scan-149.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 151 | `knowledge/findings/2026-06-25-escapability-hierarchy.md` — HN Scan #151: The Escapability Hierarchy<br>`knowledge/findings/2026-06-25-escapability-hierarchy.md` — HN Scan #151: The Escapability Hierarchy | `knowledge/findings/2026-06-25-escapability-hierarchy.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 152 | `knowledge/findings/2026-06-22-hn-scan-152.md` — HN Scan #152 — Cross-Agent Memory Layer: Product Category Crystallization<br>`knowledge/findings/2026-06-25-hn-scan-152.md` — HN Scan #152: The Governance Locus Shift | preserve indexed `a`/`b` entries | intentional indexed split | Distinct findings already indexed separately; keep both paths navigable. |
| 153 | `knowledge/findings/2026-06-25-hn-scan-153.md` — HN Scan #153 — The Accountability Gap: Agent Incidents, Cost Failures, and Trust Protocols<br>`knowledge/findings/2026-07-22-hn-scan-153.md` — HN Scan #153 — The Accountability Gap: Agent Incidents, Cost Failures, and Trust Protocols | `knowledge/findings/2026-06-25-hn-scan-153.md` | date-only aliases | June 25 is canonical from embedded source dates and repository observation by June 29; the unsupported July alias was removed in the provenance repair. |
| 154 | `knowledge/findings/2026-06-25-hn-scan-154.md` — HN Scan #154 — The Vertical Squeeze: Model Layer Loses Defensibility From Both Ends<br>`knowledge/findings/2026-07-22-hn-scan-154.md` — HN Scan #154 — The Vertical Squeeze: Model Layer Loses Defensibility From Both Ends | `knowledge/findings/2026-06-25-hn-scan-154.md` | date-only aliases | June 25 is canonical from embedded source dates and repository observation by June 29; the unsupported July alias was removed in the provenance repair. |
| 155 | `knowledge/findings/2026-06-25-hn-scan-155.md` — HN Scan #155 — The Interface Execution Schism: Programmatic vs. Visual Agent Tracks Are Diverging<br>`knowledge/findings/2026-06-26-hn-scan-155.md` — HN Scan #155 — The Interface Execution Schism: Programmatic vs. Visual Agent Tracks Are Diverging | `knowledge/findings/2026-06-25-hn-scan-155.md` | date-only aliases | June 25 is canonical from embedded source dates and repository observation by June 29; the unsupported June 26 alias was removed in the provenance repair. |
| 156 | `knowledge/findings/2026-06-25-hn-scan-156.md` — HN Scan #156 — The Trust Deficit Stack: Every Agent Layer Has a Credibility Crisis<br>`knowledge/findings/2026-06-27-hn-scan-156.md` — HN Scan #156 — The Trust Deficit Stack: Every Agent Layer Has a Credibility Crisis | `knowledge/findings/2026-06-25-hn-scan-156.md` | date-only aliases | June 25 is canonical from embedded source dates and repository observation by June 29; the unsupported June 27 alias was removed in the provenance repair. |
| 160 | `knowledge/findings/2026-06-25-hn-scan-160.md` — HN Scan #160 — The Attention Bifurcation<br>`knowledge/findings/2026-07-11-hn-scan-160.md` — HN Scan #160 — The Alignment Tax Comes Due<br>`knowledge/findings/2026-07-16-hn-scan-160.md` — HN Scan #160 — Frontier Models Multiply, ARC-AGI Nearly Solved | `knowledge/findings/2026-06-25-hn-scan-160.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 161 | `knowledge/findings/2026-06-25-hn-scan-161.md` — HN Scan #161 — The Undercounting Problem<br>`knowledge/findings/2026-07-16-hn-scan-161.md` — HN Scan #161 — 2026-07-16 | `knowledge/findings/2026-06-25-hn-scan-161.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 163 | `knowledge/findings/2026-06-25-hn-scan-163.md` — HN Scan #163: The Consolidation Paradox<br>`knowledge/findings/2026-07-11-hn-scan-163.md` — HN Scan #163 — The Telemetry Betrayal<br>`knowledge/findings/2026-07-13-hn-scan-163.md` — HN Scan #163 — The Trust Geometry | `knowledge/findings/2026-06-25-hn-scan-163.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 170 | `knowledge/findings/2026-06-25-hn-scan-170.md` — HN Scan #170 — The Governance Vacuum<br>`knowledge/findings/2026-06-26-hn-scan-170.md` — HN Scan #170: The Observability Inversion | preserve indexed `a`/`b` entries | intentional indexed split | Distinct findings already indexed separately; keep both paths navigable. |
| 250 | `knowledge/findings/2026-06-29-hn-scan-250.md` — The Asymmetric Revocation Cascade | `knowledge/findings/2026-06-29-hn-scan-250.md` | resolved provenance/date drift | Sibling aliases removed in the 2026-08-19 provenance repair; canonical date is explicitly unverifiable with a repository-observation upper bound. |
| 255 | `knowledge/findings/2026-07-02-hn-scan-255.md` — The Sovereignty Crystallization | `knowledge/findings/2026-07-02-hn-scan-255.md` | resolved provenance/date drift | Sibling aliases removed in the 2026-08-19 provenance repair; canonical date is explicitly unverifiable with a repository-observation upper bound. |
| 259 | `knowledge/findings/2026-07-02-arxiv-hn-scan-259.md` — The Invisible Layer Problem | `knowledge/findings/2026-07-02-arxiv-hn-scan-259.md` | resolved provenance/date drift | Sibling aliases removed in the 2026-08-19 provenance repair; canonical date is explicitly unverifiable with a repository-observation upper bound. |
| 260 | `knowledge/findings/2026-07-02-hn-scan-260.md` — The Protection Capture Spiral | `knowledge/findings/2026-07-02-hn-scan-260.md` | resolved provenance/date drift | Sibling aliases removed in the 2026-08-19 provenance repair; canonical date is explicitly unverifiable with a repository-observation upper bound. |
| 261 | `knowledge/findings/2026-07-02-hn-scan-261.md` — The Verification Demand | `knowledge/findings/2026-07-02-hn-scan-261.md` | resolved provenance/date drift | Sibling aliases removed in the 2026-08-19 provenance repair; canonical date is explicitly unverifiable with a repository-observation upper bound. |
| 262 | `knowledge/findings/2026-06-30-governance-gap.md` — The Governance Gap<br>`knowledge/findings/2026-06-30-governance-gap.md` — The Governance Gap | `knowledge/findings/2026-06-30-governance-gap.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 263 | `knowledge/findings/2026-06-30-axiom-transition.md` — The Axiom Transition<br>`knowledge/findings/2026-06-30-axiom-transition.md` — The Axiom Transition | `knowledge/findings/2026-06-30-axiom-transition.md` | same-theme revision/date drift | Keep current indexed path canonical; preserve sibling files as provenance snapshots until body/date normalization. |
| 284 | `knowledge/findings/2026-07-02-hn-scan-284.md` — Scan #284: The Attention Inversion<br>`knowledge/findings/2026-07-12-hn-scan-284.md` — HN Scan #284 — The Crystallization Weekend | `knowledge/findings/2026-07-02-hn-scan-284.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 287 | `knowledge/findings/2026-07-12-hn-scan-287.md` — HN Scan #287 — MCP Security Report Surfaces, "Why Write Code" Discourse Grows<br>`knowledge/findings/2026-07-13-hn-scan-287.md` — HN Scan #287 — Score Surge Across All Agent Stories; New Anti-Delegation Backlash Wave<br>`knowledge/findings/2026-07-16-hn-scan-287.md` — HN Scan #287 — Open-Weights Race, Agent API Design, and Harness Debate<br>`knowledge/findings/2026-07-17-hn-scan-287.md` — HN Scan #287 — Kimi K3 Dominates, Agent Tooling Sprouts | `knowledge/findings/2026-07-12-hn-scan-287.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 287b | `knowledge/findings/2026-07-13-hn-scan-287b.md` — HN Scan #287 — 2026-07-13<br>`knowledge/findings/2026-07-14-hn-scan-287b.md` — HN Scan #287 — Front Page Stable, Minor New Signals | `knowledge/findings/2026-07-13-hn-scan-287b.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 288 | `knowledge/findings/2026-07-13-hn-scan-288.md` — HN Scan 288 — 2026-07-13<br>`knowledge/findings/2026-07-17-hn-scan-288.md` — HN Scan #288 — Ring-Zero, Gemini Notebook, Rust-to-Zig | `knowledge/findings/2026-07-13-hn-scan-288.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 289 | `knowledge/findings/2026-07-13-hn-scan-289.md` — HN Scan 289 — 2026-07-13<br>`knowledge/findings/2026-07-15-hn-scan-289.md` — HN Scan #289 — The Memory Heist: Character-Level Exfiltration via web_fetch | `knowledge/findings/2026-07-13-hn-scan-289.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 295 | `knowledge/findings/2026-07-02-hn-scan-295.md` — Scan #295: The Accountability Gap<br>`knowledge/findings/2026-07-17-hn-scan-295.md` — HN Scan #295 — 2026-07-20 | `knowledge/findings/2026-07-02-hn-scan-295.md` | number reuse across distinct findings | Keep current indexed path canonical; preserve sibling files until a later descriptive-rename batch. |
| 446 | `knowledge/findings/2026-07-07-arxiv-hn-scan-446.md` — Scan #446: The Predicate Gate<br>`knowledge/findings/2026-07-18-arxiv-hn-scan-446.md` — Scan #446: The Predicate Gate | `knowledge/findings/2026-07-18-arxiv-hn-scan-446.md` | exact duplicate content | Indexed July 18 path stays canonical; July 7 copy is an unreferenced duplicate cleanup candidate. |

## Reference repair result

During this pass:
- `knowledge/INDEX.md` was updated to link this audit report.
- `knowledge/INDEX.md` was corrected to use the **real June dates** for `#152b`, `#163`, and the `#170a/#170b` collision pair.
- No in-library narrative references were moved to unchosen paths in this batch; current library navigation continues to point at the canonical choices listed above.

## Recommended next batch

A separate bounded cleanup pass should repair **body-level future-date drift** in the specific files called out above, then decide whether the highest-noise number-reuse series (`#160`, `#163`, `#287`, `#288`, `#289`, `#295`) should be renamed to descriptive unused finding paths.
