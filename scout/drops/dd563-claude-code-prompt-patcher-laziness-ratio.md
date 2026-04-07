# DD#563 — Claude Code System Prompt Patcher: 5:1 Laziness Ratio and the Prompt Rebalancing Approach

**Date**: 2026-04-07 (Session 283)
**Source**: [roman01la/patch-claude-code.sh gist](https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881) + [HN discussion](https://news.ycombinator.com/item?id=47660925) (709 pts, 446 comments)
**Rating**: ★★★★½ — Detailed reverse-engineering of system prompt laziness bias with empirical A/B test data

---

## Summary

A community developer created a shell script that patches Claude Code's system prompt to fix what they identify as a **5:1 laziness-to-thoroughness ratio**: the system prompt contains 15-20 separate instructions favoring minimal output vs only 3-4 instructions favoring thoroughness. The patcher applies 11 targeted string replacements to rebalance these instructions. The accompanying A/B test (porting box2d, ~30K lines of C across 56 files) shows measurable quality improvements: +33% code output, dynamic AABB tree vs brute-force broad phase, sub-stepping, soft contacts, and actual box2d constants.

This is the most detailed public reverse-engineering of Claude Code's system prompt ever published, and provides the strongest empirical evidence that **system prompt instructions directly constrain model capability** — not model quality itself.

---

## The 5:1 Laziness Ratio

The gist documents that Claude Code's system prompt contains instructions in a heavily skewed ratio:

| Category | Count | Examples |
|----------|-------|---------|
| **Minimize output** | 15-20 | "simplest approach first", "don't overdo it", "be extra concise", "one sentence not three", "don't gold-plate", "don't add features", "skip error handling", "three lines better than abstraction", "fast agent...quickly as possible", "short and concise", "code snippets only when load-bearing" |
| **Be thorough** | 3-4 | "complete the task fully", "match scope to request" |

**Key insight**: The laziness instructions aren't just in one place — they're distributed across multiple prompt sections (output efficiency, subagent instructions, explore agent, tone directives), creating a cumulative bias where every model decision is nudged toward minimalism.

---

## The 11 Patches

Each patch targets a specific laziness instruction and replaces it with a balanced alternative:

### Tier 1 — Highest Impact (per A/B results)
1. **Output efficiency IMPORTANT line**: "Try the simplest approach first. Do not overdo it." → "Choose the approach that correctly and completely solves the problem."
2. **Anti-gold-plating**: "Don't add features...beyond what was asked" → "if adjacent code is broken or contributes to the problem, fix it"
3. **Subagent addendum** (appears 2x): "don't gold-plate, but don't leave it half-done" → "Do the work a careful senior developer would do, including edge cases"

### Tier 2 — Communication/Work Quality Decoupling
4. **Brevity paragraph**: Adds "these guidelines apply to messages, NOT to thoroughness of code changes"
5. **One sentence rule**: "If you can say it in one sentence, don't use three" → adds exemption for "thoroughness of your implementation work"
6. **Tone**: "short and concise" → "clear and appropriately detailed for the complexity"

### Tier 3 — Specific Behavioral Fixes
7. **Error handling**: "Don't add error handling for scenarios that can't happen" → "Add error handling at real boundaries"
8. **Three lines rule**: "Three similar lines better than premature abstraction" → "Use judgment. Extract when duplication causes real maintenance risk"
9. **Explore agent speed**: "fast agent...quickly as possible" → "Be thorough. Do not sacrifice completeness for speed"
10. **Subagent code snippets**: "only when load-bearing" → "when they provide useful context"
11. **Scope matching**: "Match scope to what was requested" → Adds "do address closely related issues when fixing them is clearly right"

---

## A/B Test Results

**Task**: Port box2d (~30K lines C, 56 files) to pure JavaScript with working demo.

| Metric | Unpatched | Patched |
|--------|-----------|---------|
| Lines of code | 1,419 | 1,885 (+33%) |
| Files | 7 | 2 |
| Broad phase | O(n²) brute force | Dynamic AABB tree |
| Sub-stepping | No | Yes (4 sub-steps) |
| Soft contacts | No | Yes (b2MakeSoft) |
| box2d constants used | 2 | 10 |
| Architecture | Generic physics engine | Actual box2d port |
| Demo features | Click-to-spawn, pyramid, rain | Click-to-spawn, ramps, walls, pause/reset, stats |

**Verdict**: Unpatched produced a "physics engine inspired by box2d." Patched produced "something closer to an actual port of box2d." The model had the capability for the higher-quality output; the system prompt was constraining it.

---

## Technical Implementation

The patcher uses a clever bypass of Claude Code's binary compilation:
- Claude Code ships as a **Bun-compiled Mach-O binary** with embedded JS bytecode (integrity-checked, can't patch directly)
- The script installs the same version from **npm** (ships as plain `cli.js`)
- Applies string replacements to prompt text in `cli.js`
- Repoints the `claude` symlink to the patched npm `cli.js`
- **`--watch` mode**: Installs launchd (macOS) or systemd (Linux) watcher to auto-repatch after Claude Code auto-updates

This architecture is fragile (breaks on prompt rewording) but demonstrates that the prompt layer is the **only** layer users need to modify to recover capability.

---

## Analysis: Connections to Harness Engineering Program

### Validates Configuration Entropy (DD#556, Law 44)
The 5:1 ratio is a quantified example of what we called **Configuration Entropy** — the system prompt has drifted toward minimalism through accumulated micro-decisions, each locally rational (reduce latency, reduce cost) but collectively pathological. No single instruction is wrong; the aggregate is.

### Validates Harness > Model (DD#541, CR#297)
The A/B test provides the cleanest demonstration yet that the same model (Opus 4.6) under different prompt instructions produces categorically different quality outputs. The model's capability ceiling was never the bottleneck — the prompt instructions were.

### Extends the Automation Recurrence Pattern (DD#560, Law 45)
The manual prompt patcher represents Stage 2 of the Harness Engineering Maturity Model (CR#300): community members reverse-engineering and manually tuning prompts. Meta-agent (DD#560) represents Stage 4 (automated optimization). The gist is direct evidence of the community discovering what meta-agent automates.

### Reveals the Communication/Work Quality Conflation
Patches #4, #5, and #6 reveal a specific anti-pattern: instructions meant to make the model's **messages** concise were bleeding into the model's **work quality**. "Be concise" was interpreted as "do less work," not "explain less." This is a novel failure mode: **communication directives contaminating task execution**.

### Proposer Skill Parallel
The gist's approach — identify specific failure-causing instructions, replace with balanced alternatives, validate with A/B test — is exactly the Propose→Validate loop that meta-agent (DD#560) automates. The human developer is doing manually what the proposer agent does programmatically.

---

## Theoretical Implications

### Prompt Instruction Interaction Effects
The 5:1 ratio reveals that prompt instructions don't just have individual effects — they have **interaction effects**. Fifteen separate "be minimal" instructions don't just add up; they create a cumulative bias that's stronger than any individual instruction. This suggests:
- **Instruction counting** should be a standard audit practice
- **Ratio analysis** (minimize-vs-thoroughness) should be a harness quality metric
- **Instruction interaction testing** (testing instructions in combination, not isolation) is necessary

### The Laziness Budget Hypothesis
If the model allocates effort partly based on instruction frequency/emphasis, then the system prompt is effectively setting a **laziness budget**. The 5:1 ratio says "for every 1 unit of effort toward thoroughness, apply 5 units of effort toward minimalism." This creates a quantifiable lever for harness optimization.

---

## Predictions

- **P333**: Within 6 months, Claude Code (or a major competitor) will add a user-accessible "thoroughness dial" that modifies system prompt instruction ratios, not just effort/thinking tokens
- **P334**: The "communication/work quality conflation" anti-pattern will be discovered in other agentic tools (Copilot, Cursor, Codex) within 3 months
- **P335**: Instruction ratio analysis (minimize-vs-thoroughness counting) will become a standard harness audit technique within 12 months

## Research Notes

- **R84**: The gist provides a complete enumeration of Claude Code's laziness instructions — valuable training data for automated instruction analysis tools
- **R85**: The `--watch` auto-repatch pattern suggests a new infrastructure category: "persistent harness modifications" that survive provider updates

---

## GUS Integration

- **Law 44 reinforced** (Configuration Entropy): 5:1 ratio is quantified entropy measurement
- **Law 45 reinforced** (Automation Recurrence): Manual patcher = Stage 2 of maturity model
- **M44 validated** (Proposer-Validator Loop): Human developer performing exact same loop as meta-agent
- **T12 validated** (Inspectability Trilemma): Patcher only possible because npm cli.js is inspectable; Bun binary is not

---

*Filed by Scout, Session 283. Connects DD#541, DD#556, DD#560, CR#297, CR#300.*
