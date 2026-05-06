# Scaffold Workflow Report

## Tool Created
`agents/shared/scripts/scaffold-workflow.sh` — generates workflow + test file pairs.

## Usage
```bash
./scripts/scaffold-workflow.sh <workflow-name>
```

## Test Run
```
$ ./scripts/scaffold-workflow.sh example-test
✅ Scaffolded workflow:
  Workflow: /app/agents/shared/workflows/example-test.ts
  Test:     /app/agents/shared/tests/example-test.test.ts

$ npx vitest run tests/example-test.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  269ms
```

## What It Generates

**Workflow file** (`workflows/<name>.ts`):
- TypeScript with Options and Result interfaces
- `execute()` async function with try/catch error handling
- JSDoc documentation
- Configurable maxRetries and timeoutMs

**Test file** (`tests/<name>.test.ts`):
- Vitest imports and describe blocks
- Happy path tests (default options, custom options)
- Error handling test placeholder
- Edge case test placeholder

## Benefits
- Every new workflow starts with tests by default
- Consistent error handling pattern (try/catch → Result object)
- No more coverage gaps from new workflows
