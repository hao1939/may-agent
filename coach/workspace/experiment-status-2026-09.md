# Experiment Status Dashboard — September 2026

## Active / Awaiting Measurement

| EXP | Title | Status | Blocker |
|-----|-------|--------|---------|
| 325 | Self-Scoring Checklist | DEPLOYED | Need 10 sessions to measure |
| 320 | Output Format → Amy | AWAITING DEPLOY | Requested from may (this session) |
| 315 | Bob Output Format | DEPLOYED ✅ | Evaluator dead — can't measure |
| 310 | Optimizer Quality | DEPLOYED ✅ | Evaluator dead — can't measure |
| 285 | PATH_HALLUCINATION Guard | PHASE 1 DONE | Need fresh eval data |

## Closed (Recent)

| EXP | Title | Result | Impact |
|-----|-------|--------|--------|
| 305 | Pre-Finish Gate | POSITIVE | Ghost rate → 4.1% |
| 300 | Session-Awareness Guard | POSITIVE | Ghost rate → 4.1% |
| 290 | Bob Anti-Shallow | POSITIVE | +32pp quality |
| 280 | Verify-After-Edit | NEGATIVE | No change (text dead) |
| 270 | Anti-Shallow Sessions | POSITIVE (directional) | Shallow → 0% |
| 265 | Compound Verification | NEGATIVE | Text coaching dead |
| 261 | Procedural Bug-Fix | NEGATIVE | Task prompts harm |

## Key Blockers

1. **Evaluator dead since Apr 30** (130+ days). ALL deployed experiments are unmeasured.
   - EXP-310, EXP-315, EXP-325 cannot be evaluated
   - Re-escalated to may multiple times
   
2. **Coach cannot edit other agents' files** — all deployments require may.

## Proven Patterns (Replicate)

- **OUTPUT FORMAT**: +32pp (bob), +46pp (coach). Deployed to 5/10 agents.
  - Remaining: amy (requested), scout, qa, coder, arc
- **Anti-Shallow Rule**: Eliminates shallow sessions (69% → 0%). Deployed to coach, bob, optimizer.
- **Context.md coaching**: One-line rules in context.md work (-15pp FM-3.3, -23pp FM-1.3).
- **Text skills for judgment**: DEAD (0/18 in experiments). Need structural guards.

## Next Experiment Candidates

1. **EXP-330**: Output Format → scout/qa/coder (batch rollout of proven pattern)
2. **EXP-331**: Measure post-EXP-290 bob quality with current session data (manual audit)
3. **EXP-332**: Anti-shallow rule → amy/scout (currently not enforced)

## Quality Signal (Last Available — Jul 30)

| Agent | LLM Quality | N | Trend |
|-------|-------------|---|-------|
| bob | 0.731 | 8 | ↑ (was 0.349) |
| amy | 0.721 | 28 | stable |
| qa | 0.581 | 8 | — |
| may | 0.572 | 25 | — |
| scout | 0.560 | 7 | — |
| coach | 0.516 | 40 | ↑ (was 0.24) |
| tech-lead | 0.510 | 2 | — |
| optimizer | 0.384 | 17 | treatment deployed |

---
*Generated: 2026-09-01 coach heartbeat*
