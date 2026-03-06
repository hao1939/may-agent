import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { findParentsWithUnevaluatedChildren } from "../run/handlers/evaluate-sessions.js";

describe("evaluate-sessions (LLM-to-JS #4)", () => {
  let dir: string;
  let persistDir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "eval-sessions-"));
    persistDir = join(dir, ".state");
    mkdirSync(join(persistDir, "sessions"), { recursive: true });
    mkdirSync(join(persistDir, "evaluations"), { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty when no sessions exist", () => {
    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("returns empty when all sessions are evaluated", () => {
    // Create a session with an evaluation
    const sid = "s_1_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "test",
        status: "done",
        startedAt: Date.now() - 3600_000,
        parentSessionId: "s_parent_0",
      }),
    );
    writeFileSync(
      join(persistDir, "sessions", sid, "session.jsonl"),
      '{"role":"user"}\n',
    );
    // Already evaluated
    writeFileSync(
      join(persistDir, "evaluations", `${sid}.json`),
      JSON.stringify({ scores: {} }),
    );

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("finds parent with unevaluated child session", () => {
    const sid = "s_child_0";
    const parentSid = "s_parent_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "test",
        status: "done",
        startedAt: Date.now() - 3600_000,
        parentSessionId: parentSid,
      }),
    );
    writeFileSync(
      join(persistDir, "sessions", sid, "session.jsonl"),
      '{"role":"user"}\n',
    );

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([parentSid]);
  });

  it("skips meta-agent sessions (evaluator, optimizer, may)", () => {
    for (const agent of ["evaluator", "optimizer", "may"]) {
      const sid = `s_${agent}_0`;
      mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
      writeFileSync(
        join(persistDir, "sessions", sid, "meta.json"),
        JSON.stringify({
          agent,
          task: "meta task",
          status: "done",
          startedAt: Date.now() - 3600_000,
          parentSessionId: "s_parent_0",
        }),
      );
      writeFileSync(
        join(persistDir, "sessions", sid, "session.jsonl"),
        '{"role":"user"}\n',
      );
    }

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("skips running/idle sessions", () => {
    const sid = "s_running_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "still running",
        status: "running",
        startedAt: Date.now() - 3600_000,
        parentSessionId: "s_parent_0",
      }),
    );
    writeFileSync(
      join(persistDir, "sessions", sid, "session.jsonl"),
      '{"role":"user"}\n',
    );

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("skips sessions without transcript", () => {
    const sid = "s_notranscript_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "aborted",
        status: "done",
        startedAt: Date.now() - 3600_000,
        parentSessionId: "s_parent_0",
      }),
    );
    // No session.jsonl

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("skips sessions without parentSessionId", () => {
    const sid = "s_orphan_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "orphan",
        status: "done",
        startedAt: Date.now() - 3600_000,
        // no parentSessionId
      }),
    );
    writeFileSync(
      join(persistDir, "sessions", sid, "session.jsonl"),
      '{"role":"user"}\n',
    );

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([]);
  });

  it("deduplicates parents with multiple unevaluated children", () => {
    const parentSid = "s_parent_0";

    for (let i = 0; i < 3; i++) {
      const sid = `s_child_${i}`;
      mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
      writeFileSync(
        join(persistDir, "sessions", sid, "meta.json"),
        JSON.stringify({
          agent: "coder",
          task: `task ${i}`,
          status: "done",
          startedAt: Date.now() - 3600_000,
          parentSessionId: parentSid,
        }),
      );
      writeFileSync(
        join(persistDir, "sessions", sid, "session.jsonl"),
        '{"role":"user"}\n',
      );
    }

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([parentSid]);
  });

  it("finds archived sessions (in history/)", () => {
    const sid = "s_archived_0";
    const parentSid = "s_parent_0";
    mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
    mkdirSync(join(persistDir, "sessions", "history", sid), {
      recursive: true,
    });
    writeFileSync(
      join(persistDir, "sessions", sid, "meta.json"),
      JSON.stringify({
        agent: "coder",
        task: "archived task",
        status: "done",
        startedAt: Date.now() - 86400_000,
        parentSessionId: parentSid,
      }),
    );
    // Transcript is in history (archived)
    writeFileSync(
      join(persistDir, "sessions", "history", sid, "session.jsonl"),
      '{"role":"user"}\n',
    );

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toEqual([parentSid]);
  });

  it("returns multiple parents when different parents have unevaluated children", () => {
    for (const parentSid of ["s_parent_a", "s_parent_b"]) {
      const sid = `s_child_of_${parentSid}`;
      mkdirSync(join(persistDir, "sessions", sid), { recursive: true });
      writeFileSync(
        join(persistDir, "sessions", sid, "meta.json"),
        JSON.stringify({
          agent: "coder",
          task: "task",
          status: "done",
          startedAt: Date.now() - 3600_000,
          parentSessionId: parentSid,
        }),
      );
      writeFileSync(
        join(persistDir, "sessions", sid, "session.jsonl"),
        '{"role":"user"}\n',
      );
    }

    const parents = findParentsWithUnevaluatedChildren(persistDir);
    expect(parents).toHaveLength(2);
    expect(parents).toContain("s_parent_a");
    expect(parents).toContain("s_parent_b");
  });
});
