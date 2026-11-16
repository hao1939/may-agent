# Gym Scenarios

Each runnable scenario has a stable directory ID and normally contains:

```text
<scenario-id>/
├── scenario.json
├── task.md
├── environment/
└── success_criteria.js
```

`scenario.json` carries suite/category/tier metadata. Keep scenario IDs stable;
organize benchmark suites through metadata and files under `benchmarks/`, not by
moving cases whenever their classification changes. The only nested collection
currently supported by the runner is `multi-session/`.

Run `bun run scenario:validate` before review. A directory with only some of
the required entries is not silently treated as runnable; it appears in the
validation warning inventory for deliberate completion, experiment migration,
or archival.

New shared scorers should be written in TypeScript under `src/scoring/`. Legacy
scenario scorers may remain CommonJS, but new CommonJS files should use `.cjs`.
Fixture source may use any language required by the behavior being tested.

Scorers import shared code through `require("@may-agent/gym/scoring")`. The
package builds that export into ignored `dist/`; scenarios must not depend on a
checked-in generated library directory.

Do not commit generated run output, dependency caches, or build products here.
Use small deterministic fixtures; when dependencies are essential, describe
their setup explicitly and pin them with a lockfile.
