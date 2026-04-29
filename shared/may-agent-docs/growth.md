# Agent Growth (Fork/Promote/Discard)

## Overview

The growth system lets you experiment with agent configurations safely. Fork an agent into a `.lab/` sandbox, test changes, then promote or discard.

## API

Exported from `agents/shared/agent-sdk.ts`:

```typescript
import { forkAgent, promoteAgent, discardAgent, listLabAgents } from "../shared/agent-sdk.ts";

const config = { agentsRoot: "/path/to/agents" };
```

### forkAgent(config, agentName, forkName?)

Copies an agent directory into `agents/.lab/<forkName>`:

```typescript
const result = forkAgent(config, "coder", "coder-experimental");
// result: { forkName: "coder-experimental", copiedFrom: "coder", files: [...] }
```

If no `forkName`, generates one: `coder-fork-<timestamp>`.

### promoteAgent(config, forkName, targetName)

Copies a lab agent to the main agents directory:

```typescript
promoteAgent(config, "coder-experimental", "coder");
// Overwrites agents/coder/ with agents/.lab/coder-experimental/
```

### discardAgent(config, forkName)

Deletes a lab agent:

```typescript
discardAgent(config, "coder-experimental");
```

### listLabAgents(config)

Lists agents in `.lab/` that have a `SOUL.md` or `heartbeat.md`:

```typescript
const labs = listLabAgents(config); // ["coder-experimental", "qa-v2"]
```

## Workflow

```
1. Fork:    forkAgent(config, "coder", "coder-v2")
2. Edit:    Modify agents/.lab/coder-v2/SOUL.md, DOMAIN.md, etc.
3. Test:    Run gym scenarios against the fork
4. Decide:  promoteAgent(config, "coder-v2", "coder")  OR  discardAgent(config, "coder-v2")
```

## Use Cases

- **Coach training**: Fork agent → inject lessons → verify via gym → promote if improved
- **A/B testing**: Fork with different prompts, run same scenarios, compare scores
- **Safe experimentation**: Try radical SOUL.md changes without affecting production
