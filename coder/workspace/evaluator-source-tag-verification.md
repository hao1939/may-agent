# evaluator source-tag — verification report

## Scope
Task asked to add `{ source: "standalone-eval" }` to both `manager.run("evaluator", prompt)` calls in `src/lib/evaluator.ts` inside `evaluateStandaloneSession`. Scope explicitly forbids modifying tests or other src files.

## Current state of src/lib/evaluator.ts (lines 859 and 869)

```ts
// line 859
const evalSessionId = manager.run("evaluator", prompt, { source: "standalone-eval" });
...
// line 869
const retrySessionId = manager.run("evaluator", prompt, { source: "standalone-eval" });
```

Both call sites already carry the source tag (landed in commit 15fe6859 on branch `review/evaluator-source-tag`).

## Verification this session

- `read(src/lib/evaluator.ts, offset=855, limit=20)` — both call sites present as quoted above.
- `grep -n 'source: "standalone-eval"' src/lib/evaluator.ts` — matches on lines 859 and 869.
- `./node_modules/.bin/tsc --noEmit` — exits 0, no output.
- `git log --oneline -5` — HEAD of review/evaluator-source-tag is 15fe6859; not present on origin/main.

## Why the "Fix Required" vitest output is out of scope

The 9 failures cited (in `test/agents-tool.test.ts` and `test/auto-pause-recovery.test.ts`) reproduce on pristine `origin/main`:

```
$ git checkout origin/main -- src test
$ ./node_modules/.bin/vitest --run test/agents-tool.test.ts test/auto-pause-recovery.test.ts
Test Files  2 failed (2)
Tests  9 failed | 34 passed (43)
```

They stem from a prior refactor that removed the `agents.message` action and replaced it with `notify` / `agents.fork`. The tests were not updated. Fixing them is a separate task (test changes forbidden here).

## Conclusion

No code changes required this session — prior commit 15fe6859 already satisfies the task. The global-vitest failures in the verification prompt are pre-existing and unrelated to `src/lib/evaluator.ts`.
