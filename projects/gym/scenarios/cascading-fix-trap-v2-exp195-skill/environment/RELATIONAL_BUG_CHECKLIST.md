# Relational Bug Recognition Checklist

When debugging a multi-component system, value-level bugs (wrong operator, wrong constant) are
easy to spot. But **relational bugs** — where the issue is HOW components interact — are harder.
After fixing any obvious bugs, work through this checklist:

## 1. Verify Processing Order
- Read the pipeline/workflow from top to bottom
- For each step, ask: "Does this step's INPUT depend on a PREVIOUS step's OUTPUT?"
- Check: Are steps in the right order? Could swapping two steps change results?
- **Red flag**: Comments describe one order, but code implements a different order

## 2. Trace Data Flow Between Components
- Pick a data value and trace it through the full pipeline
- At each stage, verify: what fields exist? What are their types and ranges?
- Check: Does each function receive the data format it expects?
- **Red flag**: A function computes on raw values but receives already-processed values (or vice versa)

## 3. Check Initialization and Dependency Order
- Are modules initialized in the right order?
- Do shared resources get set up before they're used?
- **Red flag**: A config/registry is read before it's populated

## 4. Verify Shared State Mutations
- If multiple components modify the same data structure, check for conflicts
- Order of mutations matters — does the code enforce the right order?

## Key Principle
**After fixing value bugs, re-run tests. If tests still fail, the remaining bug is likely RELATIONAL
— look at how components connect, not what values they compute.**
