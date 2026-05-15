# Finding: Tool Gap Analysis — 6h Scan (2026-04-18 16:00)

**Mode**: B (Tool Gap Analysis)
**Sessions sampled**: s_1776304922444_0, s_1776305908253_0, s_1776299910150_0, s_1776302371589_0, s_1776336175530_25
**Method**: Extracted bash commands from session transcripts, identified repeated multi-step patterns

## Pattern 1: Gym Scenario Iteration (HIGH frequency)

**Observed in**: s_1776304922444_0, s_1776305908253_0

Agents repeatedly iterate over gym scenarios with near-identical for-loops:
```bash
for d in /app/agents/gym/scenarios/cascading-fix-trap*/environment; do
  echo "=== $d ==="
  cd "$d" && node test/test.js 2>&1 | tail -1
done
```

This pattern appears 3-4 times per session as agents search for the right scenario variant, run tests across variants, or check which scenarios have failing tests. Each iteration is 1-3 bash calls.

**Tool opportunity**: `gym-scenario-status.sh [pattern]` — lists matching scenarios with test pass/fail status in one call.

## Pattern 2: bun:sqlite Boilerplate (VERY HIGH frequency)

**Observed in**: Every optimizer session, most heartbeats

The DB query pattern requires ~80 characters of boilerplate before the actual query:
```bash
bun -e "import{Database}from'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); ..."
```

Agents repeat this verbatim dozens of times per session. The import + Database constructor + readonly flag is pure ceremony.

**Tool opportunity**: A `dbq` alias or script: `dbq "SELECT * FROM sessions WHERE ..."` that wraps the boilerplate. Would save ~80 chars per query and reduce quoting errors (a known FM-2.2 failure source).

## Pattern 3: Path Discovery / Structure Guessing (MEDIUM frequency)

**Observed in**: s_1776304922444_0, s_1776299910150_0

Agents spend 3-5 calls discovering file structure:
```bash
ls /app/src/ 2>/dev/null && ls /app/test/ 2>/dev/null
find /app -name "test.js" -path "*/test/*" | head -5
ls /app/agents/gym/scenarios/ | grep -i cascad
```

This is especially bad when agents are dropped into gym scenarios — they don't know the layout and spend turns exploring.

**Tool opportunity**: Already partially addressed by scenario.yaml files, but agents still guess. A `scenario-info <name>` tool that prints structure + test status would help.

## Pattern 4: Multi-Agent Fork Dispatch (LOW frequency, HIGH cost)

**Observed in**: s_1776336175530_25

May forked 5 agents with near-identical task descriptions (system-gaps). Each fork call required ~200 tokens of duplicated task text. Not a bash pattern per se, but a tool gap — batch fork with template.

**Tool opportunity**: Low priority. Rare pattern.

## Recommendations (Priority Order)

1. **`dbq` script** (HIGH impact, EASY) — Wrap bun:sqlite boilerplate. Every agent benefits every session. Could save 5-10 calls per optimizer session alone from reduced quoting errors.
2. **`gym-scenario-status` script** (MEDIUM impact, EASY) — One-liner scenario test status. Coach and gym-related sessions benefit most.
3. **Path discovery** — Already addressed by existing conventions. No new tool needed; agents just need to read scenario manifests first.

## Evidence Quality

- Transcript-based analysis from 5 sessions with on-disk transcripts
- Limited by transcript availability (many recent sessions lack on-disk transcripts)
- DB query boilerplate pattern is also confirmed by this very session's tool calls (meta-evidence)
