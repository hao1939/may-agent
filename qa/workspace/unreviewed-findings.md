# QA Heartbeat — Unreviewed Findings

Date: 2026-04-29

## Scope
Reviewed latest workflow change:
- Commit: `0b791b29a` — `shared: integrate output-validator into master-worker iteration loop with integration tests`
- Files touched (per `git show --name-only`):
  - `shared/workflows/master-worker.ts`
  - `shared/tests/evaluator.test.ts`
  - `shared/tests/failure-chain.test.ts`
  - `shared/tests/master-worker-validation-integration.test.ts`

## Verification
- `tsc --noEmit`: PASS (no output)
- `vitest --run`: PASS (27 files, 502 tests)

## Findings
### IMPORTANT — Possible incorrect worker outputs directory
**Evidence:** In `shared/workflows/master-worker.ts`, `workerSystemPrompt(projectDir: string)` sets:
- `const outputsDir = projectDir + "/outputs";`

But when the worker session is created, it is passed `workerSystemPrompt(dirname(projectDir))` (i.e., parent directory of the project folder). This makes the prompt’s outputs directory the parent’s `outputs/`, not `<projectDir>/outputs/`.

Additionally, during iterations, the workflow itself sets:
- `const outputsDir = join(dirname(projectDir), "outputs");`

So the workflow and worker prompt are internally consistent with each other (both using the parent directory’s `outputs/`), but inconsistent with the comment in `workerSystemPrompt()` docstring saying “Your outputs directory: ${outputsDir}” where `projectDir` name is misleading.

**Risk:** If other tooling expects outputs under `<projectDir>/outputs`, this could cause “no output produced” false alarms or output scattering across projects.

**Recommendation:** Clarify naming/intent:
- Either rename `workerSystemPrompt` param to `projectRootDir` or `projectParentDir`, or pass `projectDir` consistently and set outputs under `<projectDir>/outputs` (whichever matches intended convention).

### MINOR — Stub pre-creation path joining is hard to follow
The V3 stub logic mixes regex captures and `join(outputsDir, '..', targetFile)`; this works but is fragile and hard to reason about. Consider normalizing to an explicit root and ensuring `targetFile` cannot contain `../`.

## Overall assessment
No failing tests found; the workflow compiles and test suite passes. The main potential issue is semantic (outputs directory location and naming consistency) rather than a runtime/type failure.
