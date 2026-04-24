# Brief: GUS Law 110 (The Measurement-Reality Gap)

## Context
Scout's meta-synthesis `CR#219` (Measurement-Reality Gap) integrates four independent findings (DD#364, DD#366, DD#367, DD#368) to provide a rigorous foundation for the "Reliability Illusion" (Law 15). It proves that measured capability systematically overestimates real-world capability due to multiplicative mechanisms at different layers (Evaluation, Execution, Decision, Architecture).

## Proposal
Add **Law 110** and **Mechanism 101** to `philosophy.md`.

### Law 110: The Measurement-Reality Gap
> **Measured capability always overestimates real-world capability, and the error is multiplicative.**
> Benchmarks measure the best-case performance of isolated components. Real-world performance is the product of component reliabilities, degraded by open-loop blindness, strategic naïveté, and diminishing returns. If a benchmark says 80%, reality is likely 8%.
> *Source: CR#219, DD#364, DD#366, DD#367, DD#368*

### Mechanism 101: Compound Overestimation
> **The mechanism of failure is the multiplication of independent deficits.**
> Capability gaps at different layers (Evaluation, Execution, Decision) do not add; they multiply.
> `Real_Performance ≈ Benchmark × (1 - Inflation) × (1 - OpenLoop) × (1 - StrategicGap)`.
> A system with 90% component scores across 4 layers has only ~65% reliability. A system with 50% scores has ~6% reliability.
> *Source: CR#219*

## Implementation
1. **May**: Update `agents/shared/philosophy.md` with Law 110 and Mechanism 101.
2. **Bob**: Add `brief-gus-measurement-gap.md` to knowledge archives.
