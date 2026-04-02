# Structured Logging for Multi-Agent Systems

## Research Report — Actionable Recommendations for TypeScript Agent Architectures

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Logging Format Recommendation](#2-logging-format-recommendation)
3. [Correlation Strategy: Trace IDs & Session IDs](#3-correlation-strategy)
4. [Canonical Log Schema for Multi-Agent Systems](#4-canonical-log-schema)
5. [Library Recommendations](#5-library-recommendations)
6. [Debugging Agent Failures & Performance Monitoring](#6-debugging-and-monitoring)
7. [Implementation Blueprint](#7-implementation-blueprint)
8. [Trade-off Summary](#8-trade-off-summary)

---

## 1. Executive Summary

Multi-agent systems—where a supervisor agent delegates to sub-agents that may further delegate—create **distributed, tree-shaped execution flows**. Traditional logging (flat text, single-process mindset) fails here because:

- A single user request can fan out into 5–20 agent sessions
- Failures in leaf agents surface as opaque errors at the root
- Performance bottlenecks hide inside nested delegation chains
- Without correlation IDs, logs from concurrent agent runs interleave into noise

**Our recommendation:** Use **JSON Lines (NDJSON) via Pino** as the primary logging format, with **OpenTelemetry-compatible trace/span IDs** for correlation, and optional OTLP export for production observability. This gives you fast local development, grep-friendly logs, and a clear upgrade path to distributed tracing without over-engineering.

---

## 2. Logging Format Recommendation

### JSON Lines (NDJSON) — Primary Format

**Verdict: Use JSON Lines as the wire format for all structured logs.**

```
{"level":30,"time":1709234567890,"traceId":"abc123","agentId":"coder","msg":"Starting code generation","taskId":"fix-overflow"}
{"level":30,"time":1709234567950,"traceId":"abc123","agentId":"coder","spanId":"s1","msg":"Reading file","file":"src/overflow.ts"}
{"level":50,"time":1709234568100,"traceId":"abc123","agentId":"coder","spanId":"s1","msg":"File not found","err":{"message":"ENOENT","code":"ENOENT"}}
```

**Why JSON Lines over alternatives:**

| Format | Pros | Cons | Verdict |
|--------|------|------|---------|
| **JSON Lines (NDJSON)** | Universal parsing, grep-friendly, streamable, every tool supports it | Verbose on screen without pretty-printing | ✅ **Recommended** |
| **OpenTelemetry OTLP** | Industry standard for distributed tracing, rich semantic conventions | Heavy setup, overkill for dev, requires collector infrastructure | ✅ Use as **export target**, not primary format |
| **logfmt** | Human-readable, compact | No nested structures, weak tooling for complex agent metadata | ❌ Too limited |
| **Plain text** | Easy to read | Impossible to parse programmatically, no correlation | ❌ Non-starter |
| **MessagePack/Protobuf** | Compact, fast | Not human-readable, complex tooling | ❌ Premature optimization |

### The Hybrid Approach (Recommended)

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Pino JSON   │───▶│  stdout/file  │───▶│  grep / jq /    │
│  Lines logs  │    │  (NDJSON)     │    │  pino-pretty    │
└─────────────┘    └──────────────┘    └─────────────────┘
       │
       ▼
┌──────────────────┐    ┌─────────────────────┐
│  pino-otel       │───▶│  OTLP Collector     │
│  transport       │    │  (Jaeger/Grafana/    │
│  (optional)      │    │   Datadog/etc.)      │
└──────────────────┘    └─────────────────────┘
```

Log JSON Lines locally. Export to OpenTelemetry when you need production-grade tracing. This avoids the cold-start complexity of OTLP while preserving full compatibility.

---

## 3. Correlation Strategy

### The Problem

In a multi-agent delegation tree like:

```
may (supervisor)
├── master
│   ├── claude_code (tool call)
│   └── gemini_cli (tool call)
└── qa (review)
```

A single user task generates logs across 4+ agents. Without correlation, these logs are a shuffled mess.

### Three-Level ID Hierarchy

Every log entry must carry **three correlation identifiers**:

```typescript
interface CorrelationContext {
  /** Unique ID for the entire user-facing task. Propagates across ALL agents.
   *  Format: W3C Trace Context compatible (32-char hex).
   *  Example: "4bf92f3577b34da6a3ce929d0e0e4736" */
  traceId: string;

  /** Unique ID for THIS agent's execution within the trace.
   *  Each agent session gets its own spanId.
   *  Format: 16-char hex, compatible with W3C Trace Context.
   *  Example: "00f067aa0ba902b7" */
  spanId: string;

  /** The spanId of the PARENT agent that delegated to this one.
   *  Root agent (may) has parentSpanId = undefined.
   *  Example: "a1b2c3d4e5f67890" */
  parentSpanId?: string;
}
```

### How IDs Flow Through Delegation

```
User Request arrives
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ MAY (supervisor)                                              │
│ traceId: "4bf92f3577b34da6a3ce929d0e0e4736"                  │
│ spanId:  "a000000000000001"                                   │
│ parentSpanId: undefined (root)                                │
│                                                               │
│  delegates to master with:                                    │
│    traceId: "4bf92f3577b34da6a3ce929d0e0e4736" (same!)       │
│    parentSpanId: "a000000000000001" (may's spanId)            │
│    spanId: "b000000000000002" (new, unique to master)         │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│ MASTER                                                        │
│ traceId: "4bf92f3577b34da6a3ce929d0e0e4736"                  │
│ spanId:  "b000000000000002"                                   │
│ parentSpanId: "a000000000000001"                              │
│                                                               │
│  calls claude_code tool with:                                 │
│    traceId: "4bf92f3577b34da6a3ce929d0e0e4736" (same!)       │
│    parentSpanId: "b000000000000002" (master's spanId)         │
│    spanId: "c000000000000003" (new, unique to tool call)      │
└──────────────────────────────────────────────────────────────┘
```

### Implementation: AsyncLocalStorage for Automatic Propagation

Node.js 16.4+ (we're on 22.x) has `AsyncLocalStorage` built in. This is the gold standard for propagating context without passing IDs through every function:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

interface AgentContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  agentId: string;
  taskId?: string;
}

const agentContextStore = new AsyncLocalStorage<AgentContext>();

/** Generate a W3C-compatible trace ID (32 hex chars) */
function generateTraceId(): string {
  return randomBytes(16).toString('hex');
}

/** Generate a W3C-compatible span ID (16 hex chars) */
function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

/** 
 * Run an agent session with full context propagation.
 * Called at delegation boundaries.
 */
function runAgentSession<T>(
  agentId: string,
  parentContext: Partial<AgentContext> | undefined,
  taskId: string,
  fn: () => T
): T {
  const context: AgentContext = {
    traceId: parentContext?.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parentContext?.spanId,
    agentId,
    taskId,
  };
  return agentContextStore.run(context, fn);
}

/** Get current context (for the logger to pick up automatically) */
function currentContext(): AgentContext | undefined {
  return agentContextStore.getStore();
}

// Usage at delegation boundary:
runAgentSession('master', mayContext, 'fix-overflow-bug', async () => {
  logger.info('Starting task');  // automatically includes traceId, spanId, etc.
  
  // Delegate further
  runAgentSession('claude_code', currentContext(), 'implement-fix', async () => {
    logger.info('Running code generation');  // same traceId, new spanId
  });
});
```

### Alternative: Explicit Context Passing

If `AsyncLocalStorage` feels too magical, you can pass context explicitly:

```typescript
interface AgentLogger {
  info(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): AgentLogger;
}

function createAgentLogger(context: AgentContext): AgentLogger {
  return pino.child({
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
    agentId: context.agentId,
    taskId: context.taskId,
  });
}
```

**Recommendation:** Use `AsyncLocalStorage`. It's the same mechanism OpenTelemetry uses under the hood (`@opentelemetry/context-async-hooks`). It's stable, fast, and eliminates the risk of forgetting to pass context.

---

## 4. Canonical Log Schema for Multi-Agent Systems

### Required Fields (Every Log Entry)

```typescript
interface AgentLogEntry {
  // === Standard fields ===
  level: number;           // Numeric: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
  time: number;            // Unix epoch milliseconds
  msg: string;             // Human-readable message

  // === Correlation fields ===
  traceId: string;         // Links all logs for one user task
  spanId: string;          // This agent's unique execution ID
  parentSpanId?: string;   // Who delegated to us

  // === Agent identity fields ===
  agentId: string;         // "may", "master", "coder", "qa", "evaluator", "optimizer"
  agentRole: string;       // "supervisor", "implementer", "reviewer", "evaluator"

  // === Task context ===
  taskId?: string;         // Semantic task name: "fix-overflow-bug"
  taskType?: string;       // "delegation", "tool-call", "review", "evaluation"
}
```

### Recommended Fields (Contextual, add when relevant)

```typescript
interface AgentLogEntryExtended extends AgentLogEntry {
  // === Delegation tracking ===
  delegationDepth?: number;    // 0 = root agent, 1 = first delegate, etc.
  delegatedTo?: string;        // agentId of the child we're delegating to
  delegatedFrom?: string;      // agentId of whoever delegated to us

  // === Tool usage ===
  toolName?: string;           // "claude_code", "gemini_cli", "read", "write", "exec"
  toolInput?: string;          // Truncated prompt or command (for debugging)
  toolDurationMs?: number;     // How long the tool call took
  toolResult?: 'success' | 'error' | 'timeout';

  // === LLM interaction ===
  llmModel?: string;           // "opus", "gpt-5.2", "gemini"
  llmTokensIn?: number;        // Input tokens consumed
  llmTokensOut?: number;       // Output tokens generated
  llmDurationMs?: number;      // Time waiting for LLM response
  llmRequestId?: string;       // Provider request ID for support tickets

  // === Error context ===
  err?: {
    message: string;
    code?: string;
    stack?: string;
    type?: string;             // "TimeoutError", "ToolError", "LLMError"
    retriable?: boolean;
  };

  // === Performance ===
  durationMs?: number;         // Total duration of this operation
  memoryMb?: number;           // Memory usage at log time
}
```

### Example Log Entries for a Complete Delegation Flow

```jsonl
{"level":30,"time":1709234560000,"traceId":"4bf9...4736","spanId":"a001","agentId":"may","agentRole":"supervisor","msg":"Task received","taskId":"fix-overflow","taskType":"delegation"}
{"level":30,"time":1709234560050,"traceId":"4bf9...4736","spanId":"a001","agentId":"may","agentRole":"supervisor","msg":"Delegating to master","delegatedTo":"master","taskId":"fix-overflow"}
{"level":30,"time":1709234560100,"traceId":"4bf9...4736","spanId":"b002","parentSpanId":"a001","agentId":"master","agentRole":"implementer","msg":"Starting task","taskId":"fix-overflow","delegationDepth":1}
{"level":30,"time":1709234560200,"traceId":"4bf9...4736","spanId":"c003","parentSpanId":"b002","agentId":"master","agentRole":"implementer","msg":"Tool call started","toolName":"claude_code","delegationDepth":2}
{"level":30,"time":1709234590200,"traceId":"4bf9...4736","spanId":"c003","parentSpanId":"b002","agentId":"master","agentRole":"implementer","msg":"Tool call completed","toolName":"claude_code","toolDurationMs":30000,"toolResult":"success","delegationDepth":2}
{"level":50,"time":1709234590300,"traceId":"4bf9...4736","spanId":"b002","parentSpanId":"a001","agentId":"master","agentRole":"implementer","msg":"TypeScript compilation failed","err":{"message":"TS2345: Argument of type...","type":"CompilationError","retriable":true},"taskId":"fix-overflow"}
{"level":30,"time":1709234590400,"traceId":"4bf9...4736","spanId":"b002","parentSpanId":"a001","agentId":"master","agentRole":"implementer","msg":"Retrying with additional context","toolName":"claude_code","delegationDepth":2}
{"level":30,"time":1709234620500,"traceId":"4bf9...4736","spanId":"a001","agentId":"may","agentRole":"supervisor","msg":"Task completed","taskId":"fix-overflow","durationMs":60500,"toolResult":"success"}
```

### Querying These Logs

```bash
# All logs for a single task trace
cat agent.log | jq 'select(.traceId == "4bf9...4736")'

# All errors across all agents
cat agent.log | jq 'select(.level >= 50)'

# All tool calls with duration (find slow tools)
cat agent.log | jq 'select(.toolDurationMs != null) | {agentId, toolName, toolDurationMs, toolResult}'

# Delegation tree reconstruction
cat agent.log | jq 'select(.msg | test("Delegat")) | {agentId, delegatedTo, traceId}'

# LLM cost analysis
cat agent.log | jq 'select(.llmTokensIn != null) | {agentId, llmModel, llmTokensIn, llmTokensOut}'
```

---

## 5. Library Recommendations

### Primary Recommendation: Pino

| Aspect | Details |
|--------|---------|
| **Package** | `pino` (v10.3.x) |
| **Why** | Fastest Node.js JSON logger (5–10x faster than winston), native child loggers for context propagation, first-class TypeScript support, built-in NDJSON output |
| **Install** | `npm install pino pino-pretty` |
| **Dev install** | `npm install -D @types/pino` (types are bundled in v10) |

#### Pino Setup for Multi-Agent System

```typescript
import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';

// === 1. Create base logger ===
const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  
  // Add timestamp as epoch ms (fast, sortable)
  timestamp: pino.stdTimeFunctions.epochTime,
  
  // Custom serializers for agent-specific types
  serializers: {
    err: pino.stdSerializers.err,
    toolInput: (input: string) => 
      input.length > 500 ? input.slice(0, 500) + '...[truncated]' : input,
  },
  
  // Redact sensitive fields
  redaction: {
    paths: ['apiKey', 'toolInput.*.password', 'llmRequestBody'],
    censor: '[REDACTED]',
  },
  
  // Add base fields to every log
  base: {
    service: 'may-agent',
    version: process.env.npm_package_version,
  },
  
  // Pretty print in development
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
    : undefined,
});

// === 2. AsyncLocalStorage integration ===
const contextStore = new AsyncLocalStorage<pino.Logger>();

/** Get context-aware logger (auto-includes traceId, agentId, etc.) */
export function getLogger(): pino.Logger {
  return contextStore.getStore() ?? baseLogger;
}

/** Create a child logger scoped to an agent session */
export function withAgentContext<T>(
  bindings: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    agentId: string;
    agentRole: string;
    taskId?: string;
    delegationDepth?: number;
  },
  fn: () => T
): T {
  const childLogger = baseLogger.child(bindings);
  return contextStore.run(childLogger, fn);
}

// === 3. Usage in agent code ===
// In supervisor (may):
withAgentContext(
  {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    agentId: 'may',
    agentRole: 'supervisor',
    taskId: 'fix-overflow',
    delegationDepth: 0,
  },
  async () => {
    const log = getLogger();
    log.info('Task received from user');
    
    // When delegating, create child context
    withAgentContext(
      {
        traceId: '...same...', // propagate!
        spanId: generateSpanId(),
        parentSpanId: '...may-span...',
        agentId: 'master',
        agentRole: 'implementer',
        taskId: 'fix-overflow',
        delegationDepth: 1,
      },
      async () => {
        const childLog = getLogger();
        childLog.info('Master agent starting');
        // traceId, agentId, etc. are all automatic
      }
    );
  }
);
```

#### Pino Strengths for Agent Systems

1. **Child loggers are zero-copy**: `logger.child({agentId: 'coder'})` doesn't clone — it chains. Creating hundreds of child loggers per trace is cheap.
2. **Async-safe**: Pino uses `sonic-boom` for non-blocking writes. Agent tool calls won't block on I/O.
3. **Transport pipeline**: Logs go to stdout. Processing (pretty-print, file rotation, OTLP export) happens in a worker thread or separate process.

### Alternative: Winston (When Pino Doesn't Fit)

| Aspect | Details |
|--------|---------|
| **Package** | `winston` (v3.19.x) |
| **When to use** | If you need multiple simultaneous outputs (file + console + HTTP) configured declaratively, or if the team is already familiar with winston |
| **Trade-off** | 5–10x slower than Pino, more memory allocation, but more flexible transport configuration |

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'may-agent' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### Alternative: tslog (TypeScript-Native)

| Aspect | Details |
|--------|---------|
| **Package** | `tslog` (v4.10.x) |
| **When to use** | If you want stack-trace-aware logging with TypeScript source positions out of the box |
| **Trade-off** | Smaller ecosystem than Pino, fewer transports, but excellent DX |

### OpenTelemetry Integration (Production Upgrade Path)

When you need distributed tracing in production:

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/sdk-logs \
  @opentelemetry/exporter-logs-otlp-http \
  pino-opentelemetry-transport
```

```typescript
// Pino → OpenTelemetry bridge (zero code changes to your logging calls)
import pino from 'pino';

const logger = pino({
  transport: {
    targets: [
      // Pretty console in dev
      {
        target: 'pino-pretty',
        level: 'info',
        options: { colorize: true },
      },
      // OTLP export in production
      {
        target: 'pino-opentelemetry-transport',
        level: 'info',
        options: {
          resourceAttributes: {
            'service.name': 'may-agent',
            'deployment.environment': process.env.NODE_ENV,
          },
        },
      },
    ],
  },
});
```

This is the key advantage of the Pino + OTLP approach: **your logging code never changes**. You add OTLP as a transport target and your JSON Lines logs automatically appear in Jaeger, Grafana Tempo, Datadog, or any OTLP-compatible backend.

### Library Comparison Matrix

| Feature | Pino | Winston | tslog | Raw console |
|---------|------|---------|-------|-------------|
| JSON output | ✅ Native | ✅ Via format | ✅ Via config | ❌ |
| Performance (ops/sec) | ~180k | ~20k | ~50k | ~100k |
| Child loggers | ✅ Zero-copy | ✅ Copy-based | ✅ | ❌ |
| TypeScript types | ✅ Bundled | ✅ @types | ✅ Native | N/A |
| OTLP transport | ✅ pino-otel | ⚠️ Community | ❌ | ❌ |
| Redaction | ✅ Built-in | ⚠️ Manual | ⚠️ Manual | ❌ |
| Pretty printing | ✅ pino-pretty | ✅ Built-in | ✅ Built-in | ✅ |
| Async/non-blocking | ✅ sonic-boom | ⚠️ Depends | ❌ Sync | ❌ Sync |
| Ecosystem size | Large | Very large | Small | N/A |
| Learning curve | Medium | Low | Low | None |

---

## 6. Debugging Agent Failures & Performance Monitoring

### 6.1 Debugging Agent Failures

#### Problem: "The coder agent failed but I don't know why"

Without structured logging, you get:
```
Error: Task failed
```

With structured logging, you get:
```json
{
  "level": 50,
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "c003",
  "parentSpanId": "b002",
  "agentId": "coder",
  "agentRole": "implementer",
  "taskId": "fix-overflow",
  "delegationDepth": 2,
  "toolName": "claude_code",
  "toolDurationMs": 120000,
  "toolResult": "timeout",
  "err": {
    "message": "Tool execution exceeded 120s timeout",
    "type": "TimeoutError",
    "retriable": true
  },
  "msg": "Tool call failed"
}
```

Now you can instantly answer:
- **Which agent?** coder (delegationDepth: 2)
- **What tool?** claude_code
- **Why?** Timeout after 120s
- **Is it retriable?** Yes
- **What was the full trace?** Filter by traceId to see the entire delegation chain

#### Trace Reconstruction Script

```bash
#!/bin/bash
# reconstruct-trace.sh — Show the full story of a failed task
TRACE_ID=$1

echo "=== Full trace timeline ==="
cat agent.log | jq -r "
  select(.traceId == \"$TRACE_ID\") |
  \"\(.time | . / 1000 | strftime(\"%H:%M:%S\")) [\(.agentId // \"system\")] \(.msg) \(if .err then \"ERROR: \" + .err.message else \"\" end)\"
" | sort

echo ""
echo "=== Delegation tree ==="
cat agent.log | jq "
  select(.traceId == \"$TRACE_ID\" and .parentSpanId != null) |
  {agent: .agentId, parent: .parentSpanId, span: .spanId, task: .taskId}
"

echo ""
echo "=== Errors only ==="
cat agent.log | jq "select(.traceId == \"$TRACE_ID\" and .level >= 50)"
```

#### Failure Pattern Detection

Structured logs enable automated failure analysis:

```typescript
// Detect agents that repeatedly timeout
const timeoutsByAgent = logs
  .filter(l => l.err?.type === 'TimeoutError')
  .reduce((acc, l) => {
    acc[l.agentId] = (acc[l.agentId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

// Detect delegation chains that are too deep (possible infinite delegation)
const suspiciousTraces = logs
  .filter(l => (l.delegationDepth ?? 0) > 5)
  .map(l => l.traceId);

// Detect tool calls that always fail for a specific agent
const toolFailureRate = logs
  .filter(l => l.toolResult !== undefined)
  .reduce((acc, l) => {
    const key = `${l.agentId}:${l.toolName}`;
    if (!acc[key]) acc[key] = { total: 0, failures: 0 };
    acc[key].total++;
    if (l.toolResult !== 'success') acc[key].failures++;
    return acc;
  }, {} as Record<string, { total: number; failures: number }>);
```

### 6.2 Performance Monitoring

#### Key Metrics to Extract from Structured Logs

```typescript
interface AgentPerformanceMetrics {
  // Per-trace metrics
  totalTraceDurationMs: number;     // End-to-end task completion time
  totalDelegations: number;         // How many agent hops
  maxDelegationDepth: number;       // Deepest nesting level
  
  // Per-agent metrics
  agentDurationMs: number;          // Time spent in each agent
  toolCallCount: number;            // Number of tool invocations
  toolTotalDurationMs: number;      // Cumulative tool wait time
  retryCount: number;               // How many retries occurred
  
  // LLM metrics
  totalTokensConsumed: number;      // Token cost tracking
  llmLatencyP50Ms: number;          // LLM response time percentiles
  llmLatencyP99Ms: number;
}
```

#### Dashboard Queries (jq examples)

```bash
# Average task completion time by agent role
cat agent.log | jq -s '
  [.[] | select(.durationMs != null)] |
  group_by(.agentRole) |
  map({
    role: .[0].agentRole,
    avgDurationMs: (map(.durationMs) | add / length),
    count: length
  })
'

# Slowest tool calls (top 10)
cat agent.log | jq -s '
  [.[] | select(.toolDurationMs != null)] |
  sort_by(-.toolDurationMs) |
  .[0:10] |
  map({agentId, toolName, toolDurationMs, traceId})
'

# Token consumption by model
cat agent.log | jq -s '
  [.[] | select(.llmTokensIn != null)] |
  group_by(.llmModel) |
  map({
    model: .[0].llmModel,
    totalTokensIn: (map(.llmTokensIn) | add),
    totalTokensOut: (map(.llmTokensOut) | add),
    calls: length
  })
'
```

#### Waterfall Visualization from Logs

Structured logs with timing data can reconstruct a Gantt-chart-style waterfall of agent execution:

```
Trace: 4bf92f3577b34da6a3ce929d0e0e4736
Task:  fix-overflow-bug

00:00 ├─ may (supervisor) ─────────────────────────────────────────────┤ 62s
00:00 │  ├─ master (implementer) ─────────────────────────────────────┤ 58s  
00:01 │  │  ├─ claude_code [attempt 1] ──────────────────┤ 30s FAIL
00:31 │  │  ├─ claude_code [attempt 2] ──────────────────────┤ 25s OK
00:56 │  ├─ qa (reviewer) ────┤ 4s OK
01:02 │  done ✓
```

This is only possible because each log entry carries `traceId`, `spanId`, `parentSpanId`, and `durationMs`.

### 6.3 Alerting on Anomalies

With structured logs feeding into a system like Grafana Loki or Datadog:

```yaml
# Example: Alert if any agent delegation chain exceeds depth 4
alert: deep-delegation-chain
condition: max(delegationDepth) > 4
for: 5m
labels:
  severity: warning
annotation:
  summary: "Agent delegation chain exceeding expected depth"

# Example: Alert if tool timeout rate exceeds 10%
alert: high-tool-timeout-rate
condition: rate(toolResult="timeout") / rate(toolResult=~".+") > 0.10
for: 10m
labels:
  severity: critical
```

---

## 7. Implementation Blueprint

### Phase 1: Foundation (Day 1–2)

1. **Install Pino**
   ```bash
   npm install pino pino-pretty
   ```

2. **Create `src/logging.ts`** — centralized logger factory

3. **Add `AsyncLocalStorage`-based context** — automatic correlation

4. **Add structured fields to every delegation boundary** — traceId flows automatically

### Phase 2: Instrumentation (Day 3–5)

1. **Wrap tool calls** with timing and result logging:
   ```typescript
   async function instrumentedToolCall(
     toolName: string,
     input: string,
     fn: () => Promise<ToolResult>
   ): Promise<ToolResult> {
     const log = getLogger();
     const start = performance.now();
     log.info({ toolName, toolInput: input }, 'Tool call started');
     
     try {
       const result = await fn();
       const durationMs = Math.round(performance.now() - start);
       log.info({ toolName, toolDurationMs: durationMs, toolResult: 'success' }, 'Tool call completed');
       return result;
     } catch (err) {
       const durationMs = Math.round(performance.now() - start);
       log.error({ toolName, toolDurationMs: durationMs, toolResult: 'error', err }, 'Tool call failed');
       throw err;
     }
   }
   ```

2. **Log LLM interactions** with token counts and latency

3. **Log delegation start/end** with parent-child relationships

### Phase 3: Analysis & Observability (Day 6–10)

1. **Add `pino-opentelemetry-transport`** for OTLP export (optional)
2. **Build trace reconstruction CLI tool** (the jq scripts above)
3. **Set up log aggregation** (Grafana Loki, ELK, or even just structured log files with rotation)
4. **Create performance baseline dashboards**

### Minimal `src/logging.ts` Starter

```typescript
import pino, { Logger } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

// --- ID Generation ---
export const generateTraceId = () => randomBytes(16).toString('hex');
export const generateSpanId = () => randomBytes(8).toString('hex');

// --- Base Logger ---
export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.epochTime,
  base: { service: 'may-agent' },
  serializers: {
    err: pino.stdSerializers.err,
  },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
    },
  }),
});

// --- Context Store ---
const store = new AsyncLocalStorage<Logger>();

export function getLogger(): Logger {
  return store.getStore() ?? rootLogger;
}

export interface AgentSessionOptions {
  traceId?: string;
  parentSpanId?: string;
  agentId: string;
  agentRole: string;
  taskId?: string;
  delegationDepth?: number;
}

export function runWithAgentContext<T>(opts: AgentSessionOptions, fn: () => T): T {
  const child = rootLogger.child({
    traceId: opts.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: opts.parentSpanId,
    agentId: opts.agentId,
    agentRole: opts.agentRole,
    taskId: opts.taskId,
    delegationDepth: opts.delegationDepth ?? 0,
  });
  return store.run(child, fn);
}
```

---

## 8. Trade-off Summary

### Format Decisions

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Wire format | JSON Lines | logfmt, MessagePack | Universal tooling, human-debuggable with jq/pino-pretty |
| ID format | W3C Trace Context hex | UUID v4, nanoid | Compatible with OpenTelemetry, Jaeger, Zipkin if we upgrade later |
| Context propagation | AsyncLocalStorage | Explicit param passing | Less boilerplate, can't forget to pass context, OTel-compatible |
| Primary logger | Pino | Winston, tslog, Bunyan | Fastest, best child logger support, native OTLP transport |

### Architecture Decisions

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| OTLP from day 1? | No — add later | Yes — full OTel stack | Avoid complexity tax; JSON Lines + jq is sufficient for early development |
| Log destination | stdout | Direct file/HTTP | Let the deployment infra (Docker, systemd, etc.) handle routing |
| Sensitive data | Pino redaction paths | Manual scrubbing | Declarative, hard to forget, auditable |
| Log level in prod | `info` | `debug` | Debug is too noisy for multi-agent; use per-agent level overrides if needed |
| Timestamp format | Epoch milliseconds | ISO 8601 strings | Faster to generate, faster to sort, smaller payload; pino-pretty converts for humans |

### Cost/Benefit of Structured Logging in Agent Systems

| Investment | Benefit |
|------------|---------|
| ~2 days setup | Every future debugging session is 10x faster |
| ~200 bytes per log line (JSON overhead) | Full trace reconstruction from any single traceId |
| AsyncLocalStorage complexity | Zero-effort context propagation across async boundaries |
| Pino learning curve (if new) | 5–10x faster logging than winston, no event loop blocking |
| Discipline of logging at delegation boundaries | Automatic Gantt chart of agent execution, failure attribution |

---

## Appendix A: Quick Reference — What to Log Where

| Event | Level | Key Fields |
|-------|-------|------------|
| Agent session starts | `info` | agentId, agentRole, taskId, delegationDepth |
| Agent session ends | `info` | agentId, durationMs, result (success/fail) |
| Delegation to child agent | `info` | delegatedTo, taskId, traceId |
| Tool call starts | `info` | toolName, toolInput (truncated) |
| Tool call completes | `info` | toolName, toolDurationMs, toolResult |
| Tool call fails | `error` | toolName, toolDurationMs, err |
| LLM request sent | `debug` | llmModel, llmTokensIn |
| LLM response received | `debug` | llmModel, llmTokensOut, llmDurationMs |
| LLM error / rate limit | `warn` | llmModel, err, retriable |
| Task retry | `warn` | retryAttempt, retryReason |
| Unhandled error | `fatal` | err (full stack) |
| Performance threshold exceeded | `warn` | metric, threshold, actual |

## Appendix B: Useful CLI One-Liners

```bash
# Follow logs for a specific agent in real-time
tail -f agent.log | jq 'select(.agentId == "coder")'

# Count errors by agent in last 1000 lines
tail -1000 agent.log | jq -s '[.[] | select(.level >= 50)] | group_by(.agentId) | map({agent: .[0].agentId, errors: length})'

# Find the slowest traces (by total duration)
cat agent.log | jq -s '[.[] | select(.delegationDepth == 0 and .durationMs != null)] | sort_by(-.durationMs) | .[0:5] | map({traceId, taskId, durationMs})'

# Pretty-print a specific trace as a timeline
TRACE="4bf92f3577b34da6a3ce929d0e0e4736"
cat agent.log | jq -r "select(.traceId == \"$TRACE\") | \"\(.time) [\(.agentId)] \(.msg)\"" | sort

# Export agent performance stats as CSV
cat agent.log | jq -r 'select(.toolDurationMs != null) | [.agentId, .toolName, .toolDurationMs, .toolResult] | @csv'
```
