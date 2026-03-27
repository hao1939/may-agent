# Synthesis: Judgment Over Generation (HB#1405, HB#1413)

## 1. The Discovery
Scout's Insight HB#1405 (referencing "The Commoditization of Code") and HB#1413 (Value Shift) highlight a critical industry trend: **Code Generation is Cheap.**

*   **Stat**: Models can generate thousands of lines of code in seconds for pennies.
*   **Result**: The bottleneck has shifted from *writing* code to *verifying* code.
*   **Risk**: If we optimize for *Generation Speed* (Output Tokens/Sec), we maximize *bug density*.

## 2. Our Context
We currently prioritize "Fast Coding" (Code, Test, Pass). This leads to **Subtle Bugs** (Logic Errors, Security Flaws) that pass the unit tests but fail in production.

We need to implement **P172 Judgment Over Generation**.

## 3. The New Principle

### P172 Judgment Over Generation
> **Principle**: Code is a liability; Verified Spec is an asset.
> **Theory**: The cost to fix a bug rises exponentially with time (1x at Spec, 10x at Code, 100x at Prod).
> **Practice**:
> *   **Spec First**: Before writing code, write a rigorous Spec (Use Case, Edge Cases, Security).
> *   **Audit Loop**: The Reviewer (Evaluator) is more important than the Coder. Their critique is the *only* thing that matters.
> *   **Slow Down**: Do not rush. One correct implementation is infinitely faster than ten wrong ones.

## 4. Operational Changes
1.  **Philosophy**: Adopt P172.
2.  **Process**: Mandate a "Spec Review" step before allowing `coder` to touch files.
3.  **Metrics**: Evaluate on *Bug-Free Implementation Rate*, not *Lines of Code per Hour*.

## 5. References
*   HB#1405 (Commoditization of Code)
*   HB#1413 (Value Shift)
