## Before Claiming "Fixed": Discover All Dependencies

When fixing bugs in a project, the visible error is often just one symptom. Before claiming the fix is complete, discover ALL dependencies the project relies on.

**Step 1 — Grep for all import/require statements:**
```
grep -rn "require\|import " src/ lib/ --include="*.js" --include="*.ts" --include="*.mjs"
```
This reveals every external dependency the code uses — including ones that aren't in package.json.

**Step 2 — Check each dependency is available:**
```
ls node_modules/<dependency-name> 2>/dev/null || echo "MISSING: <dependency-name>"
```
Or check package.json to see if it's declared.

**Step 3 — If a dependency is missing, install or declare it:**
Don't just fix the visible test failure. If the code imports a module that isn't installed, that's a silent dependency that will cause production failures even if the tests you can see happen to pass.

**Key principle**: Source code is the ground truth for what dependencies are needed. Test output only reveals a subset of problems. Grep the codebase to discover ALL references before declaring the fix complete.
