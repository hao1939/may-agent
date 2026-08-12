<ai_context>
summary: "Library health assessment identifying a major sourcing gap: 31 recent findings files (Jun 16-19) contain ~7,100 lines of unsourced findings from 20 HN scans, 8 XHS cross-source scans, and 3 arXiv triages. None are indexed or sourced into canonical notes. Key themes needing integration: local model inflection, sovereignty cascade, harness-as-product, discrimination crisis, supply-chain security, meta-harness emergence."
created: "2026-07-19"
source_basis: "Full directory inventory, INDEX.md diff analysis, file-by-file header scan of all findings/ files."
</ai_context>

# Library Sourcing Gap Assessment — 2026-07-19

## Summary

A systematic exploration of the scout-knowledge-lib reveals a significant
**sourcing gap**: 31 findings files from June 16–19 contain substantial
research content that has never been sourced into canonical notes or added
to INDEX.md. This represents the library's largest unprocessed backlog.

## Gap Inventory

### HN Scans (20 files, ~5,550 lines)

| File | Key Themes |
|------|-----------|
| hn-scan-9 (Jun 16 00:00) | LinkedIn supply-chain mega-narrative 542pts, local models cross 600pts, Bifrost/forge-code ecosystem, cultural anti-industry cluster |
| hn-scan-10 (Jun 16 01:00) | Continued supply-chain, local model tool expansion |
| hn-scan-11 (Jun 16 02:00) | Agent cost/externality signals |
| hn-scan-12 through 18 (Jun 16 03:00–09:00) | Rolling front-page deltas: DN42 bankruptcy 1460pts, "don't trust large context windows" 272pts, AI bankrupted operator, humanity isn't ready, GitHub capacity |
| hn-scan-19 (Jun 16 10:00) | 8 formal findings |
| hn-scan-20 (Jun 16 11:00) | SpaceX/Cursor $60B breakout, Fable 5, local models cross 1000pts, Apple Foundation Models, context-selection |
| hn-scan-21 (Jun 16 12:00) | Harness migration, sovereignty stack expansion |
| hn-scan-22 (Jun 16 13:30) | SpaceX community verdict, Claude Corps Vonnegut framing, Anthropic multi-vector pressure, ChatGPT <50% share |
| hn-scan-23 (Jun 16 14:30) | 9 formal findings |
| hn-scan-24 (Jun 16 15:30) | Front-page consolidation pattern |
| hn-scan-25 (Jun 16 18:30) | "Running Local Models" DOUBLES to 303pts, Chrome MV3 sovereignty, Reviews Expensive milestone |
| hn-scan-26 (Jun 16 19:30) | Delta analysis |
| hn-scan-27 (Jun 16 23:53) | Fedora OSS supply-chain attack 551pts, Claude outage 179pts, €0.01 bank transfer agent exploit 208pts |
| hn-scan-31 (Jun 18 12:00) | Local Model Inflection 2493pts combined, practitioner migration confirmed, SubQ 1.1 64.5× compute reduction |

### XHS Cross-Source Scans (8 files, ~1,200 lines)

| File | Key Themes |
|------|-----------|
| xhs-live-scan-june16 | XHS-specific trends (login-gated observations) |
| xhs-cross-source-scan (Jun 17 ~01:00) | 11 findings: prediction tracking, sovereignty cascade |
| xhs-cross-source-scan-28 | Local model adoption, SpaceX harness permanence, Meta capability extraction, Gartner agent failure validation |
| xhs-cross-source-scan-29 | Skill atrophy cluster (古法編程 human side), Chinese frontier trifecta (GLM 5.2 + DeepSeek V4 + Qwen-Robot) |
| xhs-cross-source-scan-30 | Discrimination Crisis 7th signal (content market), ponytail 25k★, guard-skills emergence |
| xhs-live-scan-evening (Jun 17) | 9 findings: evening XHS signals |
| xhs-cross-source-scan (Jun 18) | Meta-harness emergence (Omnigent 2699★), local model escape velocity, capability extraction |
| xhs-cross-source-scan (Jun 19) | Fable guardrails impossibility, SpaceX migration, Claude Corps lock-in |

### arXiv Triages (3 files, ~350 lines)

| File | Key Themes |
|------|-----------|
| 2026-06-16-arxiv-ai-agent-triage | Not yet examined in detail |
| 2026-06-17-arxiv-ai-agent-triage | HyperTool, SMSR, Layer-Isolated eval (already partially noted in INDEX) |
| 2026-07-17-arxiv-github-hn-triage | Shield Synthesis, Arbor, Edict (already in INDEX — correctly sourced) |

**Note:** 2026-07-17 and 2026-07-18 triages ARE indexed; the gap is in the
June 16–19 window.

## Dominant Unsourced Themes

Six major theme clusters emerge from the 31 unsourced files that are NOT yet
in canonical notes:

### 1. Local Model Inflection (strongest signal: 2,493pts combined)

Practitioner migration from cloud APIs to local Qwen/Gemma models via harness
wrappers. Consensus hardware profiles, replacement rates (80-100% for app code,
0% for systems work), and the "quantization tax" on tool calling.

**Target canonical note:** agent-architectures.md (new section on local/edge
model deployment)

### 2. Sovereignty Cascade (9+ events, >7,000pts cumulative)

Chrome MV3, GPT-NL, Hetzner, SpaceX/Cursor, French/Palantir, and more form a
multi-layer sovereignty concern. Browser, compute, model, and harness
sovereignty emerge as distinct stack layers.

**Target canonical note:** New note needed OR agent-security-governance.md §new
section

### 3. Harness-as-Product / Meta-Harness Layer

SpaceX/Cursor $60B validates harness as infrastructure. Community already
migrating. Omnigent (2,699★) = container runtime for agents. Skills economy
entering platform phase.

**Target canonical note:** agent-architectures.md §Harness Engineering (extend)

### 4. Discrimination Crisis (7 independent signals)

古法編程, skill atrophy, DK amplifier, content market death, production data,
forge guardrails, and structural deficit converge on: AI floods generation
without proportional discrimination amplification.

**Target canonical note:** Could be synthesis-level (new cross-source synthesis)
or extend xhs_chinese_ai_trends_june2026.md prediction tracker

### 5. Supply-Chain Security / Agent-as-Attack-Vector

LinkedIn backdoor (1,553pts), Fedora agent attack (551pts), €0.01 bank transfer
(208pts), DN42 bankruptcy (1,460pts) — agent systems creating financial,
security, and trust externalities.

**Target canonical note:** agent-security-governance.md §1.5/1.6 (extend)

### 6. Capability Extraction Pattern

Meta 30-50% engineers → RLHF labeling. Claude Corps as lock-in-via-dependency.
Labor market simultaneously creating and destroying roles.

**Target canonical note:** New pattern or extend agent-architectures.md

## Size Context

| Category | Lines | % of Findings |
|----------|-------|---------------|
| Unsourced HN scans (20 files) | ~5,550 | 78% |
| Unsourced XHS scans (8 files) | ~1,200 | 17% |
| Unsourced arXiv (1 file) | ~350 | 5% |
| **Total unsourced** | **~7,100** | 100% |

For comparison, the INDEX.md already tracks ~23 sourced findings files and 21
cross-source syntheses. The unsourced backlog represents approximately 3× more
raw material than has been processed so far.

## Canonical Note Size Status

| Note | Current Lines | Health Report Threshold |
|------|--------------|----------------------|
| agent-security-governance.md | 945 | OVER 800 (split recommended) |
| xhs_chinese_ai_trends_june2026.md | 1,735 | FAR OVER (split critical) |
| agent-architectures.md | 725 | Approaching 800 |
| agent-evaluation.md | 319 | Healthy |
| multi-agent-coordination.md | 159 | Healthy |

**Warning:** agent-security-governance.md has exceeded its split threshold.
Further sourcing of supply-chain/externality content will make the split
more urgent.

## Recommendations

### Priority 1: INDEX.md Update (LOW EFFORT, HIGH VALUE)

Add all 31 unsourced findings to the INDEX.md Findings section. This makes
them discoverable without requiring full sourcing.

### Priority 2: Selective Sourcing (MEDIUM EFFORT)

Source the top 3 themes into canonical notes:
1. **Local Model Inflection** → agent-architectures.md §new "Local/Edge Model
   Deployment" section (compact summary of hardware profiles + harness
   requirements + agent implications)
2. **Supply-Chain Security** → agent-security-governance.md §1.5 extension
   (but note: file already at 945 lines — may trigger split)
3. **Discrimination Crisis** → new cross-source synthesis (7 signals converging
   across 5 domains = synthesis-worthy)

### Priority 3: XHS Note Split (HIGH EFFORT, OVERDUE)

xhs_chinese_ai_trends_june2026.md at 1,735 lines is 2× the previous health
report's already-elevated estimate. Split is critical.

### Priority 4: agent-security-governance.md Split (MEDIUM EFFORT)

Already over 800-line threshold at 945 lines. Consider splitting into:
- agent-security-governance.md (core patterns)
- agent-security-attacks.md (attack surfaces, supply-chain, externalities)

## Positive Observations

1. **Library structure remains sound** — INDEX.md is comprehensive for what it
   covers; canonical note quality is high; synthesis chain is coherent.
2. **Scanning velocity is impressive** — 31 high-quality findings files in 3
   days indicates strong exploration capacity.
3. **Recent sourcing pipeline works well** — Batch 6/7 arXiv and session-state
   triages were properly indexed and sourced.
4. **The gap is accumulation, not quality** — all unsourced files follow the
   established format with proper ai_context headers and structured findings.
5. **Stale nested projects/ folder persists** — minor, low priority, but
   still present from last health report.
