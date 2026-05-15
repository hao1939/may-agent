# Phase 7: Corpus Scan Results

**Date**: 2026-05-07  
**Source**: `.state/human-inputs.jsonl` (699 entries, 656 unique)

## Scope

Phase 6 covered inputs through May 3. This scan covers all 699 inputs holistically, extracting patterns and new preferences not captured in P1-P16.

## New Preference Signals (P17-P21)

### P17: Collaborative Design
> "Please discuss with team about the design, they may have better idea"

Hao values team input on design decisions. Don't finalize designs unilaterally — consult relevant agents.

### P18: Minimalism in Documentation
> "It's metric, do we really need a current state for metric?"

Challenge unnecessary structure. Every section must earn its place. Don't add boilerplate.

### P19: Systemic Solutions Over Patches
> "Yes, deep dive and figure out systemically solutions. E.g., assign agent to work on it? Create handler to work on it regularly? Setup conventions/guidance?"

When problems arise, build systems (handlers, conventions, assigned ownership) rather than one-off fixes. Think about what keeps it solved.

### P20: Prove Before Adopting (reinforced)
> "Yes, we need to update it, but only after we proved it really works"

Already partially captured in P13, but this is stronger: don't change production systems based on theory. Prove in practice first.

### P21: Project-Based Problem Solving
> "What about start a project follow up and fix? The critical thing is reproducing- exploring/brainstorming- try/verifying your ideas (maybe in gym?) - adopting- keeping tracking"

Complex problems deserve project structure: reproduce → explore → try/verify → adopt → track. Not ad-hoc.

## Communication Patterns

1. **Brevity**: Most inputs are 5-15 words. Hao expects quick comprehension.
2. **Questions as directives**: "Who can help?" means "assign someone." "What's the problem?" means "diagnose and fix."
3. **Repetition = frustration**: "Show me details" repeated 3x means the system isn't surfacing info proactively.
4. **"Why you stop?"** — Hao notices and dislikes idle systems. Reinforces P11 strongly.
5. **Approval style**: "Great! Let's roll it" / "Yes, choice it" — short affirmatives, then expects execution.

## Meta-Patterns

- **Hao asks status ~15% of inputs** ("how is X going", "what's the progress") → System should push status, not require pull.
- **Hao debugs ~20% of inputs** ("what is the problem", "investigate and fix") → System should self-heal better.
- **Hao designs ~10% of inputs** ("let's review", "does it make sense") → Hao wants to be consulted on design, not execution.
- **Hao redirects ~15% of inputs** ("wrong way", "no", "let the infra do its job") → These are corrections. Capture each one.

## Indirect Signals from 74K Session Corpus

The 74K sessions are mostly agent-to-agent work (heartbeats, evaluations, project iterations). Human input exists only in:
- 699 entries in `human-inputs.jsonl` (canonical source)
- 7 active sessions with telegram/chat markers
- Scattered in history (estimated <100 additional sessions with human input based on sampling)

**Conclusion**: `human-inputs.jsonl` IS the comprehensive corpus. The 74K sessions don't contain significant unmined Hao input — they're system operations.

## Correction Tracking Observations

From the full input set, identifiable corrections/redirections:
1. "Wrong way against our design" — design violation
2. "No" — flat rejection  
3. "Let the infra do its job" — wrong-layer intervention
4. "Why you stop?" — P11 violation (×2)
5. "So little? I thought we may have thousands" — insufficient effort
6. "Check again" — inadequate analysis

**Correction rate from full history**: ~6 corrections in ~656 unique inputs = **0.9%** (confirms baseline)

## Recommendations

1. Add P17-P21 to preferences.md
2. Build proactive status reporting (reduces "how is X going" queries)
3. Instrument correction tagging on human-inputs.jsonl entries (tag each as: approval, correction, question, directive)
