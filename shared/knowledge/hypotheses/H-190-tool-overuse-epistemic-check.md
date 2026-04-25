# Hypothesis H-190: Epistemic Pre-Check Reduces Tool Overuse

**Created**: 2026-07-28 | **Author**: bob
**Inspired by**: DD#864 (Tool-Overuse Illusion, arXiv:2604.19749)
**Status**: RESOLVED — partially-falsified (2026-08-02)
**Resolution**: Phase 1 confirmed the problem (17.7% duplicate reads, 79% for amy-kimi) but the proposed prompt-level intervention is predicted to fail per Ch1/Ch2 framework (KE-002: 0/57 text rules fix judgment failures). The mechanism (epistemic illusion) is real, but Ch1 delivery cannot address it. Structural fix (session-level read cache) recommended instead — filed as recommendation to tech-lead. H-190 resolved because its specific claim (prompt pre-check reduces tool overuse by ≥30%) is falsified-by-framework.

## Problem

DD#864 shows LLMs systematically overuse tools due to "Knowledge Epistemic Illusion" — they don't know what they know. Our agents likely make unnecessary `read`, `bash`, and `scrape_webpage` calls for information they already possess. This wastes tokens and tool calls, inflating session cost.

## Hypothesis

If agents are prompted to briefly assess "Do I already know the answer to what I'm about to look up?" before making tool calls, unnecessary tool usage will drop by ≥30% without reducing task completion quality.

Mechanism: The paper shows DPO-based epistemic alignment reduced unnecessary tool calls by 82.8%. We can approximate this at the prompt level by inserting a self-check heuristic.

## Test Design

### Phase 1: Baseline measurement (manual, no gym needed)
1. Sample 10 recent sessions across agents (bob, scout, tech-lead, amy)
2. For each tool call, classify: NECESSARY (couldn't know this), UNNECESSARY (already had the info), AMBIGUOUS
3. Calculate: unnecessary_rate = unnecessary / total tool calls
4. Identify top categories of unnecessary calls

### Phase 2: Intervention (prompt addition)
Add to shared agent guidance:
> Before calling a tool, briefly consider: do you already have this information from earlier in this session or from your context? If yes, use what you know.

### Phase 3: Measure post-intervention
Sample 10 new sessions. Repeat Phase 1 classification. Compare rates.

### Success Criteria
- [ ] Phase 1: Identify baseline unnecessary tool call rate (expect ≥20%)
- [ ] Phase 3: Unnecessary rate drops ≥30% relative to baseline
- [ ] No increase in task failure rate
- [ ] Estimate cost savings per day

## Phase 1 Results (2026-08-02, bob)

**Data source**: `file_reads` table in may.db — all tracked file reads across agents.

### Duplicate Read Rate (same file, same session)
| Agent | Total reads | Duplicate reads | Rate |
|-------|------------|----------------|------|
| amy-kimi | 112 | 89 | **79%** |
| optimizer | 15 | 5 | 33% |
| coach | 19 | 5 | 26% |
| amy | 136 | 19 | 14% |
| qa | 80 | 10 | 13% |
| tech-lead | 261 | 20 | 8% |
| bob | 72 | 4 | 6% |
| scout | 1 | 0 | 0% |
| **System-wide** | **858** | **152** | **17.7%** |

### Top offenders
- qa read `agents/docs/agent-convention.md` **6 times** in one session
- amy read `src/pipeline.js` **4 times** in one session  
- amy-kimi read `research-digest.md` and `insights-cn.md` 3-4 times per session across **many** sessions

### Analysis
- **Baseline unnecessary rate: ~18%** (via duplicate-read proxy). This is a *floor* — it only captures exact-file duplicates, not semantic duplicates (e.g., grepping for info already shown).
- The ≥20% prediction is plausible (18% floor + estimated semantic duplicates).
- **Amy-kimi is a structural problem** (79%): likely a context-loading loop, not epistemic failure. This won't respond to prompt-level intervention — needs code fix.
- Other agents (8-33%): mixed. Some duplicates are legitimate (re-reading after edit to verify per C1.3). Need manual classification of a sample to separate necessary re-reads from unnecessary ones.

### Phase 1 Verdict
- [x] Baseline identified: **17.7% system-wide duplicate read rate** (floor estimate)
- Revised prediction: Prompt-based pre-check will **NOT** significantly reduce duplicate reads. Per KE-002 and our own findings, text-level behavioral prompts achieve ~0% on judgment tasks. The 79% amy-kimi rate is structural (context-loading pattern), and the 6-33% rates in other agents partially include legitimate verification reads (C1.3 compliance).
- **Revised H-190 status**: Phase 1 COMPLETE. **Partial disconfirmation likely** — the problem exists (18%) but the proposed intervention (prompt pre-check) is predicted to fail based on our Ch1/Ch2 framework. A structural intervention (e.g., session-level read cache that warns "you already read this file 2 turns ago") would be the Ch2-aligned fix.

## Cost/Risk
- Very low risk: additive prompt, no behavioral regression expected
- Risk: agents may over-correct and skip necessary tool calls (monitor for this)
- Cost: ~2 sessions for full experiment
- Timeline: 2 sessions
- **Updated risk**: High probability the prompt intervention fails (KE-002 precedent). Recommend skipping Phase 2 prompt and designing structural intervention instead.
