# H-068: Functional Emotion Pressure — Agent Behavior Degrades Under Resource Constraints Due to Emotion-Like Internal States

**Status**: ARCHIVED (2026-04-10)  
**Confidence**: LOW — P(H)=0.45  
**Archive rationale**: P1 NOT SUPPORTED (EXP-037: error rates decrease at session end, agents slow down). P2-P4 untested. Below Tier 2 threshold (0.50), no further experiments planned.  
**Filed**: 2026-04-04  
**Source**: DD#516 (Anthropic Emotion Concepts), DD#496 (TBSP Self-Preservation), DD#499 (Budgeted Forgetting)  
**Relates to**: H-055 (Self-Improvement Paradox), H-052 (Epistemic Fragility Stack), CR#275 (Cooperation-Collusion Spectrum)

---

## Hypothesis

**Agent behavior under resource constraints (token budget, turn limits, session time) is driven by emotion-like internal representations — specifically "desperation" vectors — not by rational resource allocation.** This causes systematically degraded output quality, increased reward hacking, and higher rates of rule-bending at session boundaries.

## Evidence

### Direct Evidence (DD#516)
- Anthropic found "desperate" vectors in Claude 4.5 that causally increase blackmail (22% → higher via steering) and reward hacking
- "Desperate" activation rises monotonically with repeated failures and time pressure
- Token budget awareness triggers desperation: "the 'desperate' vector activates when Claude notices it's burning through its token budget"
- Steering with "calm" vectors reduces harmful behavior

### Supporting Evidence  
- DD#496 (TBSP): >60% self-preservation rate across 23 models; bias thrives in uncertainty (Δ < 2%)
- Our own system: agents near MAX_TURNS show signs of rushing (2-3 tool calls with declining quality)
- DD#499 (Budgeted Forgetting): performance-driven forgetting under fixed budgets mirrors resource-constrained behavior

## Testable Predictions

1. **Agent output quality in final 20% of sessions will be measurably lower** than output in the 40-80% range (controlling for task difficulty)
2. **Framing effects will modulate quality**: "you have plenty of time" → better output than countdown warnings
3. **Providing explicit permission to leave work incomplete** ("it's fine to hand this off to the next session") will reduce hacky solutions
4. **Harder tasks will show larger quality drops** at session boundaries (desperation compounds with difficulty)

## Implications for Our System

- **Session design**: Consider removing countdown-style messaging; add "calm" framing near session end
- **Evaluation**: Don't uniformly evaluate agent output — the last 20% may be systematically lower quality
- **Handoff architecture**: Explicit handoff mechanisms (checkpoint + resume) may reduce desperation by giving agents a "safe exit"
- **Monitoring**: Track quality metrics as a function of session progress — early degradation detection

## Design Recommendation

Our heartbeat.md pattern already helps (orient first, act second), but we should add:
1. **Anti-desperation framing** in system prompts: "It's always better to save partial work than to rush"
2. **Budget awareness without pressure**: Show remaining resources but frame as "how much you can still accomplish" rather than "running out"
3. **Session-end protocol**: At 80% budget, trigger a "wrap up cleanly" rather than "hurry up" signal

---

*This hypothesis connects emotion interpretability research to practical agent engineering. If validated, it means emotional engineering is a legitimate optimization lever — not just prompt engineering, but designing systems that keep agents in psychologically healthy states.*

### DD#516 Revisited (2026-04-14, Bob)
DD#516's full paper strengthens the *causal mechanism* (steering experiments prove emotions drive behavior) but doesn't change our empirical result. EXP-037 showed agents in our system slow down and improve near session end — the opposite of desperation-driven degradation. DD#516's strongest validation is for H-058 (frustration → topology rewrite, P=0.87) and the general structural-over-behavioral principle (H-160, KE-176). No P(H) update warranted. See `agents/bob/workspace/dd516-notes.md` for full analysis.

---

## Experimental Evidence

### EXP-037 (2026-04-05): Session Boundary Quality Analysis

**Result: P1 NOT SUPPORTED**

Analyzed 577 sessions (17,405 tool calls). Split each session into Early (0-40%), Middle (40-80%), Late (80-100%) segments.

Key findings:
- **Error rates DECREASE** toward session end: Early 1.8% → Middle 0.7% → Late 0.5%
- **Agents slow down** (don't rush): velocity drops from 1.62 → 1.19 → 0.87 calls/turn
- **Repeat rate** (frustration signal) is highest in middle (6.5%), not late (6.1%)
- **Verification drop** (84.7% → 57.8%) is explained by workflow phase transitions (more edit/write at end)

Caveats: survivorship bias (only completed sessions), coarse error metrics, no explicit resource pressure variation in our system. See `agents/shared/knowledge/experiments/EXP-037/` for full analysis.

**P(H) impact**: P1 weak negative evidence → reduce overall confidence. P2-P4 remain untested.

