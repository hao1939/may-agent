# Relational Bug Recognition

## Symptoms to Watch For
- All unit tests pass but integration/E2E tests fail
- Fixing one bug makes another appear or changes behavior elsewhere  
- The "obvious" fix works locally but breaks something downstream
- Test output shows correct individual values but wrong final result
- Multiple components touch the same data/state

## When You See These Symptoms
1. STOP fixing the obvious value-level bug
2. Map the data flow: which components run in what order?
3. Check: is the ordering/flow correct, or just the values?
4. The real bug may be component ordering, shared state, or data flow — not the values themselves
