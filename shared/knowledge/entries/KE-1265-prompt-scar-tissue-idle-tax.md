# KE-1265: Prompt Scar Tissue as Compounding Idle Tax

**Status**: observed
**Discovered**: 2026-05-16
**Confidence**: high (directly measured)
**Tags**: efficiency, prompt-engineering, heartbeat, system-cost

## Claim

Agent instruction prompts accumulate prohibitive rules ("do not X", "never Y", "avoid Z") from past failure postmortems. These rules compound into large prompts that consume tokens even when sessions are idle — creating a fixed cost per heartbeat that dominates total system spend for agents with no work to do.

## Evidence

### Quantitative (from DB, recent ~26h window)

| Agent | Sessions | Avg task prompt | Avg opCount | Idle rate (≤14 ops) | Prompt bytes burned |
|-------|----------|----------------|-------------|---------------------|---------------------|
| dev | 37 | 10,849 bytes | 11.1 | 92% (34/37) | ~401KB total |
| evaluator | 174 | 10,941 bytes | 14.5 | ~50% est. | ~952KB total |
| arc | 38 | 14,897 bytes | 6.5 | ~95% est. | ~566KB total |
| tech-lead | 36 | 13,320 bytes | 6.8 | ~90% est. | ~480KB total |
| scout | 53 | 2,528 bytes | 7.6 | varies | ~134KB total |

**Dev's heartbeat.md** contains 132 lines. 9 lines are explicit prohibitions ("Do not create", "Do not include", "Avoid ad hoc", "Do not use rg", "Do not attempt"). The file has accreted sections like "Low-Signal Heartbeat Discipline", "Low-Signal Closeout Checklist", "DB and Shell Query Discipline" — each added after a specific past failure. These are scar tissue: patches applied to the instruction prompt instead of to system architecture.

### The mechanism

1. Agent makes a mistake (e.g., uses `rg` which doesn't exist)
2. Postmortem adds "Do not use rg" to the prompt
3. This rule persists forever, consuming tokens in every future session
4. Over time, the prompt becomes a museum of past errors rather than a guide for current work
5. The agent's actual task context (inbox events, project status) is dwarfed by scar tissue

### Contrast with scout

Scout's prompt averages 2,528 bytes — 4x smaller than dev's. Scout's creative sessions are the ones producing novel synthesis. Smaller prompts leave more context window for actual thinking.

## Why this is distinct from KE-1259 (Memory Curse)

KE-1259 diagnosed KB context poisoning — diagnostic KEs loading into sessions and biasing toward more diagnosis. This is a different layer: **instruction-level bloat**, where the agent's own standing orders grow monotonically from postmortem accretion. The KB is shared context; the prompt is per-agent instructions. Both poison, but through different channels.

## The compounding dynamic

Each prohibitive rule is individually rational — it prevented a real past error. But collectively:
- They consume fixed tokens per session regardless of whether work exists
- They bias the agent toward caution (doing nothing) rather than action
- They never get pruned because nobody reviews "did this rule still help?"
- New rules are added faster than old ones become irrelevant

This is **instruction debt** — the prompt equivalent of tech debt. Like tech debt, each piece was justified at the time; the cost is in the accumulation.

## Testable prediction

If dev's heartbeat.md were refactored from 132 lines of prohibitions to ~30 lines of positive guidance ("do X in this order, stop when done"), average opCount would decrease (less wasted verification) and session duration would drop, with no increase in error rate. The prohibitions can be enforced structurally (guard rules, linters) rather than via prompt text.

## Intervention

1. **Prompt hygiene review**: For each agent, audit the instruction prompt. Remove rules that duplicate guard enforcement or that address one-time errors.
2. **Rule sunset**: Add a "last triggered" date to each prohibition. Prune rules that haven't prevented an error in >2 weeks.
3. **Positive framing**: Rewrite "do not X" as "do Y instead" where possible. Positive instructions consume fewer tokens and bias toward action.
4. **Structural enforcement**: Move prohibitions into code (guard rules, pre-commit hooks, workflow constraints) rather than natural language instructions.

## Related KEs

- KE-1259: Memory curse / context poisoning (KB layer)
- KE-1255: Diagnostic overproduction (action-space layer)
- KE-1264: Model homogeneity blocking F→E (capability layer)
- KE-1260: Exploration hacking / creative session no-op convergence
