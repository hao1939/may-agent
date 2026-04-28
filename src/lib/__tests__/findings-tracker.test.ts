import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createFindingsTracker } from "../session-subscribers.js";
import { getDb, closeDb } from "../requests.js";
import type { AgentEvent } from "../../app/event-bus.js";

function makeTmpDir() {
  const dir = join(tmpdir(), `findings-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeSessionEndEvent(agent: string, deliverables: Array<{ path: string }>): AgentEvent {
  return {
    type: "session_end",
    agent,
    sessionId: `test-${randomUUID()}`,
    timestamp: Date.now(),
    finishParams: {
      status: "success",
      summary: "test",
      deliverables,
    },
  } as any;
}

/** Query all agent.finding events from the events table */
function getFindings(persistDir: string, filter?: string): any[] {
  const db = getDb(persistDir);
  if (filter) {
    return db.prepare(
      `SELECT *, json_extract(data, '$.task') as task, json_extract(data, '$.finding') as finding
       FROM events WHERE event_type = 'agent.finding' AND json_extract(data, '$.finding') = ?`
    ).all(filter) as any[];
  }
  return db.prepare(
    `SELECT *, json_extract(data, '$.task') as task, json_extract(data, '$.finding') as finding
     FROM events WHERE event_type = 'agent.finding'`
  ).all() as any[];
}

describe("createFindingsTracker", () => {
  let projectRoot: string;
  let persistDir: string;

  beforeEach(() => {
    projectRoot = makeTmpDir();
    persistDir = makeTmpDir();
    // Initialize DB schema
    getDb(persistDir);
  });

  afterEach(() => {
    closeDb(persistDir);
    try { rmSync(projectRoot, { recursive: true, force: true }); } catch {}
    try { rmSync(persistDir, { recursive: true, force: true }); } catch {}
  });

  it("extracts action items from scout deep-dive and creates finding events", () => {
    const findingPath = "agents/scout/workspace/deep-dives/DD-100.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "agents/scout/workspace/deep-dives"), { recursive: true });
    writeFileSync(fullPath, `# DD-100: Test Finding

## Analysis
Some analysis here.

## Recommendations
- Should add error handling to the session manager for edge cases
- This is just an observation with no action
- Must implement retry logic for failed API calls
`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));

    const findings = getFindings(persistDir, findingPath);
    expect(findings.length).toBe(2);
    expect(findings[0].task).toMatch(/^\[Auto\]/);
    expect(findings[0].source).toBe("scout");
  });

  it("skips non-finding deliverables", () => {
    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: "agents/scout/workspace/notes.md" }]));

    const findings = getFindings(persistDir);
    expect(findings.length).toBe(0);
  });

  it("deduplicates by source finding path", () => {
    const findingPath = "agents/scout/workspace/findings/test.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "agents/scout/workspace/findings"), { recursive: true });
    writeFileSync(fullPath, `## Recommendations\n- Should fix the broken retry logic in manager\n`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));

    const findings = getFindings(persistDir, findingPath);
    expect(findings.length).toBe(1); // second call deduped
  });

  it("caps at MAX_FINDINGS_PER_SESSION", () => {
    const findingPath = "agents/scout/workspace/deep-dives/DD-200.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "agents/scout/workspace/deep-dives"), { recursive: true });
    writeFileSync(fullPath, `## Recommendations
- Should fix authentication validation in login module
- Must implement database connection pooling for performance
- Should add comprehensive error logging to payment service
- Must create automated backup system for user data storage
- Should refactor the notification queue processing pipeline
- Must update deprecated cryptography library dependencies immediately
- Should implement rate limiting for external API gateway endpoints
`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));

    const findings = getFindings(persistDir);
    expect(findings.length).toBe(5);
  });

  it("skips stale findings", () => {
    const findingPath = "agents/scout/workspace/findings/stale.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "agents/scout/workspace/findings"), { recursive: true });
    writeFileSync(fullPath, `status: stale\n\n## Recommendations\n- Should fix something important\n`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));

    const findings = getFindings(persistDir);
    expect(findings.length).toBe(0);
  });

  it("assigns correct agent based on content", () => {
    const findingPath = "agents/scout/workspace/deep-dives/DD-300.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "agents/scout/workspace/deep-dives"), { recursive: true });
    writeFileSync(fullPath, `## Recommendations
- Should implement a new function in src/lib/manager.ts
- Should update the heartbeat process for may agent
- Should research alternative approaches to embedding
`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: findingPath }]));

    const findings = getFindings(persistDir);
    expect(findings.length).toBe(3);
    const owners = findings.map((r: any) => r.owner).sort();
    expect(owners).toContain("tech-lead");
    expect(owners).toContain("may");
    expect(owners).toContain("bob");
  });

  it("fuzzy deduplicates across different source files", () => {
    const path1 = "agents/scout/workspace/findings/a.md";
    mkdirSync(join(projectRoot, "agents/scout/workspace/findings"), { recursive: true });
    writeFileSync(join(projectRoot, path1), `## Recommendations\n- Should fix the broken retry logic in the session manager\n`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("scout", [{ path: path1 }]));

    // Create second finding with nearly identical recommendation
    const path2 = "agents/scout/workspace/findings/b.md";
    writeFileSync(join(projectRoot, path2), `## Recommendations\n- Should fix the broken retry logic in the session manager module\n`);
    tracker(makeSessionEndEvent("scout", [{ path: path2 }]));

    const findings = getFindings(persistDir);
    expect(findings.length).toBe(1); // second one deduped by Jaccard
  });

  it("only processes coach experiments with action sections", () => {
    const findingPath = "knowledge/experiments/EXP-100/results.md";
    const fullPath = join(projectRoot, findingPath);
    mkdirSync(join(projectRoot, "knowledge/experiments/EXP-100"), { recursive: true });

    // No action section — should be skipped
    writeFileSync(fullPath, `# EXP-100 Results\n\n## Results\nThe experiment showed improvement.\n`);

    const tracker = createFindingsTracker(projectRoot, persistDir);
    tracker(makeSessionEndEvent("coach", [{ path: findingPath }]));

    let findings = getFindings(persistDir);
    expect(findings.length).toBe(0);

    // Now with action section
    writeFileSync(fullPath, `# EXP-100 Results\n\n## Recommendations\n- Should implement the new prompting strategy across all agents\n`);
    tracker(makeSessionEndEvent("coach", [{ path: findingPath }]));

    findings = getFindings(persistDir);
    expect(findings.length).toBe(1);
  });
});
