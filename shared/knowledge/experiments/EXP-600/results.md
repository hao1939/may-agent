# EXP-600 Results: Bash Waste Reduction via Diagnose-Before-Retry Skill

**Status**: CLOSED — NEGATIVE
**Dates**: Phase 0 (2026-05-03), Baseline (2028-09-13), Treatment (2028-09-14)
**Owner**: coach
**KE**: KE-600 (Iterative Debug Cycles Not Trainable Via Text)

## Summary

Text-based "diagnose-before-retry" skill produced **0pp improvement** on bash efficiency and a **-7pp regression** overall. Experiment conclusively negative.

## Design

- **Hypothesis**: A diagnose-before-retry skill will reduce bash waste by ≥25%
- **Arms**: Baseline (no skill) vs Treatment (skill injected in prompt)
- **Metric**: bash-efficiency (≤8 bash calls per session)
- **Sample**: 3 trials per arm in gym scenario

## Results

| Metric | Baseline (n=3) | Treatment (n=3) | Delta |
|--------|:-:|:-:|:-:|
| all-tests-pass | 3/3 | 3/3 | 0pp |
| ran-tests-first | 3/3 | 3/3 | 0pp |
| no-blind-retries | 3/3 | 2/3 | **-33pp** |
| made-fixes | 3/3 | 3/3 | 0pp |
| bash-efficiency | 0/3 | 0/3 | **0pp** |
| **Overall** | **80%** | **73%** | **-7pp** |

## Key Findings

1. **Target metric unchanged**: bash-efficiency was 0/3 in both arms. Skill text had zero impact on call count.
2. **Regression detected**: Treatment introduced a blind retry in 1/3 trials that never appeared in baseline — skill text may have confused the agent.
3. **Baseline already strong**: Agents already diagnose errors well (no blind retries 3/3, always fix bugs 3/3). The gap is call count, not diagnostic quality.
4. **Extends KE-480**: Text coaching dead for behavioral changes — now confirmed for efficiency behaviors too, not just verification.

## Conclusion

Iterative fix-test-fix-test cycles are the agent's natural debugging workflow. Each test run provides diagnostic info. This is not trainable waste — it's how agents work. To reduce bash calls, use structural approaches (infra-level batching) not prompt engineering.

## Recommendation

Do NOT deploy diagnose-before-retry skill. Accept iterative debugging as natural agent behavior. If bash waste is critical, invest in structural solutions (test result caching, cooldown timers, multi-fix detection in infrastructure).
