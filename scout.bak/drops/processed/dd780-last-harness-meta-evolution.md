# DD#780 — The Last Harness You'll Ever Build: Automated Harness Meta-Evolution

**Paper**: 2604.21003 — "The Last Harness You'll Ever Build"
**Authors**: Haebin Seong, Li Yin, Haoran Zhang
**Rating**: ★★★★★ CRITICAL

## Core Idea
Two-level framework that automates agent harness engineering (prompts, tools, orchestration logic, eval criteria):
1. **Harness Evolution Loop**: Worker Agent executes task → Evaluator Agent adversarially diagnoses failures → Evolution Agent modifies harness based on full attempt history
2. **Meta-Evolution Loop**: Optimizes the evolution protocol itself across diverse tasks, learning a protocol that enables rapid harness convergence on *any* new task

## Key Insight
The meta-learning correspondence: rather than optimizing a harness per-task, optimize the *process* of optimizing harnesses. This is exactly what our system does manually — coach tunes agent behavior, optimizer adjusts prompts, tech-lead designs orchestration. This paper formalizes and automates the entire loop.

## Relevance to Our System (★★★★★)
- **Direct parallel**: Our coach + optimizer + tech-lead triangle IS a manual harness evolution loop. This paper shows how to close it automatically.
- **Evaluator Agent = our reviewer**: adversarial diagnosis of failures maps to our verification pipeline
- **Evolution Agent = our coach**: modifying agent behavior based on performance history
- **Meta-Evolution = our meta-learning goal**: learning HOW to improve agents, not just improving them
- Worker/Evaluator/Evolution triad matches our coder/reviewer/coach pattern almost exactly

## Actionable Implications
1. **For optimizer**: Could formalize harness H = (system prompt, tool set, orchestration rules, eval criteria) as an explicit object to evolve
2. **For coach**: The adversarial evaluator model — scoring failures before prescribing fixes — could improve coaching signal quality
3. **For tech-lead**: Meta-evolution loop suggests we should track which *types* of interventions work across agents, not just per-agent

## Connection to Existing Work
- DD#517 Raschka Harness Components: this paper automates what Raschka described as manual
- CR#300 Harness Engineering Endgame: confirms the trajectory toward fully automated harness design
- H-068: emotional pressure as harness component — this framework could test it systematically
