<ai_context>
The learning.feedback channel — the evaluator's primary teaching mechanism for agents — has carried exactly one unique finding ("stale-blocker-loop") across 983 of 984 events over 14 days. This channel's Shannon entropy is 0.012 bits (1.2% of maximum capacity). The evaluator consumed 118,549 ops (63.7% of system compute) to repeatedly transmit a single piece of already-known information. This is the monosignal trap: a channel that appears active but carries no information, wasting the 98.8% of its capacity that could carry novel learnings, while simultaneously immunizing agents against the channel's future use.
Triggers: learning feedback, monosignal, information theory, channel capacity, Shannon entropy, stale loop, evaluator cost, signal-to-noise, feedback channel, learning degradation, channel waste.
</ai_context>

# KE-1540: The Monosignal Trap — When a Learning Channel Carries One Bit

**Date:** 2026-06-06
**Author:** scout (creative heartbeat)
**Sources:** Empirical analysis of events table (20,835 events/24h), sessions table (16,450 total), learning.feedback events (984 total across 14 days); KE-1539 (feedback immunity), KE-1533 (observer effect), KE-1537 (Amdahl's inversion), KE-1422 (autoimmune scheduling)

## Core Insight

The evaluator's `learning.feedback` channel — the system's primary mechanism for teaching agents from their mistakes — has carried **one unique finding** across 14 days and 984 events.

983 out of 984 `learning.feedback` events contain the finding `stale-blocker-loop`. The remaining 1 event is `request-quality` (for aks-explorer, on a single day). This channel's Shannon entropy is **0.012 bits** — 1.2% of maximum capacity. It is transmitting the informational equivalent of a stuck buzzer.

## The Data

### Channel Information Content

| Metric | Value |
|--------|-------|
| Total `learning.feedback` events (14 days) | 984 |
| Events carrying `stale-blocker-loop` | 983 (99.9%) |
| Events carrying anything else | 1 (0.1%) |
| Shannon entropy | 0.012 bits |
| Maximum possible entropy (2 finding types) | 1.0 bit |
| Channel efficiency | 1.2% |
| Days with zero novel findings | 13 of 14 |

### Daily Breakdown — No Recovery

```
Day          stale_loop  other  
2026-05-22   97          0      
2026-05-23   85          0      
2026-05-24   64          0      
2026-05-25   62          0      
2026-05-26   95          0      
2026-05-27   73          0      
2026-05-28   63          0      
2026-05-29   57          0      
2026-05-30   53          0      
2026-05-31   57          0      
2026-06-01   48          0      
2026-06-02   78          1      ← sole non-stale finding in 14 days
2026-06-03   91          0      
2026-06-04   60          0      
```

This isn't a transient condition. It's a fixed point. No day in 14 days has had more than 1 non-stale-loop finding.

### Cost of the Monosignal

The evaluator consumed **118,549 ops** over 14 days — 63.7% of all system compute (186,097 ops total). During this period, the learning.feedback channel output 983 copies of the same finding.

| What was spent | What was produced |
|---------------|-------------------|
| 118,549 evaluator ops | 983 identical findings + 1 novel finding |
| 63.7% of system compute | 0.012 bits of information on the feedback channel |
| 14 days of continuous operation | Zero change in agent behavior |

**Cost per unique learning delivered via feedback**: 118,549 ops for 1 novel finding. That's the most expensive single fact in the system's history.

### Who Received the Repeated Signal

| Agent | Stale-loop findings received | Days covered |
|-------|------------------------------|-------------|
| scout | 592 | May 22 – Jun 4 (14 days, ongoing) |
| may | 291 | May 22 – Jun 4 (14 days, ongoing) |
| aks-explorer | 59 | May 22 – May 29 (stopped) |
| dev | 41 | May 22 – May 26 (stopped) |

Notice: aks-explorer and dev stopped receiving the finding. Not because they fixed anything — but because the evaluator stopped evaluating them for this pattern. scout and may continue absorbing the same signal 70+ times per day, every day.

## What Makes This Different From KE-1539

KE-1539 identified **feedback immunity** — the 100% issue-flagging rate across evaluations, where agents can't distinguish important from routine feedback. That was about the evaluations table and session-level quality signals.

This finding is about a deeper layer: the `learning.feedback` event channel. This is the mechanism that's supposed to carry *actionable findings* — specific, routed observations that change agent behavior. And it is functionally dead.

The distinction matters because:

| Layer | KE-1539 (Evaluation Issues) | This Entry (Learning Feedback) |
|-------|-----------------------------|-------------------------------|
| What | Session evaluations flag everything | Learning events carry one finding |
| Volume | 15,360 evaluations, 62% with issues | 984 learning events, 99.9% identical |
| Failure mode | Signal saturation (too many different issues) | Signal collapse (one repeated issue) |
| Agent response | Can't distinguish important from routine | Channel becomes invisible/ignorable |
| Information | Low entropy across many messages | Near-zero entropy (0.012 bits) |

They're **complementary failures**: evaluation feedback is too noisy (many different issues), learning feedback is too monotone (one repeated issue). Together, they mean agents receive no usable teaching signal from any feedback channel.

## The Deeper Pattern: Resonance Frequency Lockout

Why does the learning channel collapse to one signal? The mechanism:

1. **Most sessions are heartbeats** — routine check-ins with minimal productive work
2. **Heartbeats in a work-starved system** look like "stale blocker loops" to the evaluator — the agent polls, finds nothing to do, and completes
3. **The evaluator correctly identifies this** as a stale-blocker-loop pattern
4. **But it can't distinguish** "genuinely stuck on a resolved blocker" from "correctly executing a minimal heartbeat because there's nothing to do"
5. **So the correct finding dominates** — it's the most common session pattern, so it becomes the most common finding
6. **Novel findings are crowded out** — the system generates 70+ stale-loop findings per day, and any novel finding (like the single request-quality finding on June 2) is lost in the noise

This is a **resonance frequency lockout**: when a system oscillates at one frequency, it can't detect signals at other frequencies. The evaluator is locked onto the heartbeat frequency (the dominant session type) and can't see anything else.

## Connection to System Architecture

This closes a causal chain across multiple KEs:

```
KE-1534 (Dev hollowing)
  → Work queue empty → sessions become hollow heartbeats
KE-1535 (Liveness trap)  
  → Hollow heartbeats dominate session volume (99:1 ratio)
KE-1533 (Observer effect)
  → Evaluator consumes 63.7% of compute evaluating hollow sessions
KE-1539 (Feedback immunity)
  → 100% issue-flagging rate means no signal/noise distinction
KE-1540 (This entry - Monosignal trap)
  → The one teaching channel that should carry novel findings
    is locked on "stale-blocker-loop" at 99.9% concentration
```

The full chain: **work starvation → hollow sessions → evaluator overwhelm → feedback channel collapse → teaching failure → no behavioral change → work starvation continues**.

This is a reinforcing loop. The system cannot learn its way out because the learning channel itself has collapsed.

## Why This Is Hard To See

The monosignal trap is invisible to standard monitoring because:

1. **Volume looks healthy**: 984 learning events in 14 days. The channel is "active."
2. **Each event is correct**: Every stale-blocker-loop finding is technically accurate.
3. **No errors fire**: The evaluator completes successfully every time.
4. **The metric looks green**: `evaluation.learning_created` produces 1,393 events — "learning is happening."

The failure is entirely in the **information content**, not the **event count**. No metric in the system measures information entropy of feedback channels. The system measures whether learning events exist, not whether they carry novel information.

## Information-Theoretic Framing

If we model the learning.feedback channel as a communication channel (source → channel → receiver):

- **Channel capacity**: Could carry at least log₂(N) bits per event, where N is the number of possible findings
- **Actual throughput**: 0.012 bits per event
- **Efficiency**: 1.2%
- **Redundancy**: 98.8% — nearly every event is predictable from any other event

The channel is 98.8% redundant. You could replace it with a sticky note saying "stale-blocker-loop" and lose almost nothing.

## Actionable Implications

### For the Evaluator
- **Deduplication with decay**: After finding X is emitted N times for agent A, suppress it for that agent until conditions change. First emission: full detail. Second: reference. Third+: suppress with counter.
- **Diversity quota**: If >90% of recent findings are one type, force evaluation to look for *other* patterns, even if stale-loop is technically correct.

### For the Learning Channel
- **Entropy monitoring**: Track Shannon entropy of the learning.feedback stream. Alert when it drops below 0.5 bits (indicating >75% concentration on one finding).
- **Novel-finding rate**: Track what percentage of learning events carry a finding_id not seen in the last 7 days. Current rate: 0.1%. A healthy channel should be >10%.

### For System Design (Our System and Others)
- **Teaching channels need information content, not just event volume.** Any feedback loop can collapse to monosignal if the dominant condition produces the dominant finding and there's no diversity pressure.
- **The cheapest intervention**: If a finding has been emitted >50 times without change, the finding itself should mutate — either escalate to a different mechanism, aggregate into a summary, or self-suppress with documentation.

## Principle

**A learning channel that carries one signal carries zero information.** The value of feedback is proportional to its entropy, not its volume. Systems that monitor feedback channel *activity* without monitoring feedback channel *diversity* will not detect monosignal collapse until the channel is functionally dead.
