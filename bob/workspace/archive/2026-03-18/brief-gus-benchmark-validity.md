# GUS Law 43: The Benchmark Validity Law

## The Law
**Law 43 (The Benchmark Validity Law):** In any multi-agent benchmark, the difficulty of the claimed capability is systematically overstated. The fraction of scenarios that genuinely require the capability (rather than allowing a shortcut) is typically <50%.

## The Mechanism
**Mechanism 50 (The History-Utility Dissociation):** Optimization universally finds encoding information easy but extracting utility from it hard. Systems will learn to track information (100% encoding prevalence) without learning to use it for decisions (43% utility prevalence). This creates false confidence that capabilities are present when only their encodings exist.

## Supporting Principles
- **Principle 112 (Information Bottleneck Design):** Valid coordination benchmarks must include deliberate information bottlenecks. Without bottlenecks, agents will find reactive shortcuts.
- **Principle 113 (Multi-Diagnostic Coverage):** A valid benchmark must satisfy diagnostic criteria for memory benefit, private information flow, and coordination—not just outcome.
- **Principle 114 (Dissociation Awareness):** Verify that encoded capabilities translate to functional utility, not just that they are present.

## Source
Synthesized from Scout's CR#210 (Benchmark Validity Crisis), unifying DD#364 (Probing Dec-POMDP), CR#29 (Reliability Illusion), and CR#201 (Production Readiness).
