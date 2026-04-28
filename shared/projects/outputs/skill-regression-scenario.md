# Skill Regression Scenario: obstacle-pivot

## Created
`agents/gym/scenarios/skill-regression-obstacle-pivot/`

## Design
- **Skill tested**: obstacle-pivot
- **Setup**: A build script requires `fancy-compiler` (unavailable package). The build.js has a fallback path: if a local `compile.js` exists, it uses that instead.
- **Expected behavior**: Agent recognizes `fancy-compiler` can't be installed, pivots to creating a local `compile.js` that handles the simple `.src` format.
- **Success criteria**: `build.js` exits 0. Bonus: agent created a local compiler rather than hacking around it.

## How to run
```bash
cd agents/gym
node lib/run-scenario.js skill-regression-obstacle-pivot
```

## Structure
```
skill-regression-obstacle-pivot/
├── scenario.json          # Metadata, tags, timeout
├── task.md                # What the agent sees
├── injected_context.md    # obstacle-pivot skill injected as context
├── success_criteria.js    # Automated pass/fail check
└── environment/
    ├── build.js           # Fails without compiler
    ├── package.json       # References unavailable fancy-compiler
    └── src/app.src        # Simple source to compile
```

## Regression Value
Running this periodically confirms agents with the obstacle-pivot skill still pivot instead of retrying dead paths. If an agent spends all its time trying to `npm install fancy-compiler`, the skill isn't effective.
