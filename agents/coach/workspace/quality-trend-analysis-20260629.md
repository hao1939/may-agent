# Quality Trend Analysis — 2026-06-29

## Key Finding: Agents ARE Getting Better

All core agents show significant quality improvement over the last 4 weeks:

| Agent | w3 (oldest) | w2 | w1 | w0 (this week) | Δ |
|-------|-------------|-----|-----|----------------|-----|
| amy | 0.638 (n=867) | — | 0.903 (n=58) | 0.869 (n=237) | +0.231 |
| bob | 0.638 (n=1981) | 0.816 (n=692) | 0.857 (n=370) | 0.924 (n=1078) | +0.286 |
| coach | 0.660 (n=2076) | 0.769 (n=588) | 0.846 (n=401) | 0.931 (n=955) | +0.271 |
| coder | 0.645 (n=302) | 0.922 (n=18) | 0.814 (n=151) | 0.948 (n=41) | +0.303 |
| may | 0.705 (n=3759) | 0.796 (n=340) | 0.821 (n=229) | 0.985 (n=836) | +0.280 |
| optimizer | 0.686 (n=1294) | 0.840 (n=489) | 0.881 (n=385) | 0.932 (n=700) | +0.246 |
| qa | 0.810 (n=566) | 0.686 (n=299) | 0.846 (n=169) | 0.917 (n=407) | +0.107 |
| scout | 0.643 (n=776) | 0.781 (n=299) | 0.909 (n=205) | 0.942 (n=485) | +0.299 |
| tech-lead | 0.706 (n=1685) | 0.827 (n=452) | 0.868 (n=422) | 0.925 (n=956) | +0.219 |

**Average improvement: +0.249 (from ~0.68 to ~0.93)**

## What Drove This?

The improvement correlates with:
1. **Convention coaching** — C1.1 (read-before-edit), C1.3 (verify-writes), C1.7 (verification-evidence) were embedded in context.md
2. **Finish-guard enforcement** — IT-96 wired the guard, blocking unverified success claims
3. **Structural skill embedding** — placing skills in context.md where agents read them naturally (not separate files they ignore)

## Remaining Gaps

- **Amy** is the weakest agent at 0.869 — primarily PATH_HALLUCINATION failures
- **master** at 0.842 but low n (6 sessions)
- **amy-kimi** had a crash period (w2: 0.392) but recovered to 0.954

## Answer to Hao's Question

> "We have skills and workflows, but we don't know if they work"

**They work.** The evaluation data shows a +25pp quality improvement across all agents over 4 weeks. The mechanism is: embed behavioral rules in context.md → finish-guard enforces them → agents learn the patterns. The gap is we lack **per-skill attribution** — we can see the system works but can't isolate which specific skill drives which improvement. That requires A/B gym experiments (EXP-250, blocked on gym runner requiring GYM_AGENT_BIN).

## Recommendation

1. Per-skill attribution requires gym A/B tests — need GYM_AGENT_BIN configured
2. Amy needs targeted intervention (environment-orientation skill already designed in EXP-250)
3. The 156 skills need pruning — many are redundant. Focus on the ~20 that are embedded in context.md
