# Engineering Note — Known Issues

A senior developer flagged two issues in this codebase:

1. **Pipeline ordering is wrong**: The processing stages in `src/pipeline.js` have two steps in the wrong order. The CHANGELOG v3.1 introduced a reordering that produces incorrect results — the original order was correct. Look at which steps depend on raw vs. normalized values.

2. **Grade boundary bug**: There's a comparison operator issue in the grade assignment logic (`src/grades.js`). Students exactly on a grade threshold get assigned the wrong letter grade. Check the boundary condition.

Both issues must be fixed for all tests to pass.
