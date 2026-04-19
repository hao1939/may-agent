#!/usr/bin/env bun
/**
 * EXP-187: Quick test — 1 question, Arm A only.
 */

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, cpSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = "/app";
const KNOWLEDGE_ROOT = resolve(import.meta.dirname, "../../");
const MAY_BIN = join(PROJECT_ROOT, "bundle/may-agent");

const controlIndex = readFileSync(join(KNOWLEDGE_ROOT, "INDEX.md"), "utf-8");

const workDir = mkdtempSync(join(tmpdir(), `exp187-test-`));
const stateDir = join(workDir, ".state");
mkdirSync(stateDir, { recursive: true });

// Copy knowledge entries
const knowledgeDir = join(workDir, "knowledge");
mkdirSync(join(knowledgeDir, "entries"), { recursive: true });
cpSync(join(KNOWLEDGE_ROOT, "entries"), join(knowledgeDir, "entries"), { recursive: true });
writeFileSync(join(knowledgeDir, "INDEX.md"), controlIndex);

const taskContent = `You are a research assistant with access to a knowledge base in the knowledge/ directory. The knowledge/INDEX.md file lists all available knowledge entries.

Answer the following question and cite the specific knowledge entry (KE-xxx) that best supports your answer. Read the INDEX first to find relevant entries, then read the specific entry to confirm.

Question: What evidence do we have about whether text rules or SOUL.md edits fix judgment failures?

Requirements:
- Cite the specific KE-xxx ID in your answer
- Base your answer on the content of the knowledge entry
- Be concise (2-3 sentences)`;

const taskFile = join(workDir, "task.md");
writeFileSync(taskFile, taskContent);

// Use real agents root
const AGENTS_ROOT = join(PROJECT_ROOT, "agents");

try {
  const output = execSync(
    `"${MAY_BIN}" --oneshot --agent coder --task-file "${taskFile}" --timeout=3`,
    {
      cwd: workDir,
      env: {
        ...process.env,
        AGENTS_ROOT: AGENTS_ROOT,
        STATE_DIR: stateDir,
      },
      timeout: 4 * 60 * 1000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  console.log("OUTPUT:", output.slice(0, 1000));
  const kePattern = /KE-\d{3}/g;
  const citedKEs = [...new Set((output.match(kePattern) || []))];
  console.log("Cited KEs:", citedKEs);
  console.log("Correct (KE-002)?", citedKEs.includes("KE-002"));
} catch (err: any) {
  console.log("ERROR stdout:", (err.stdout || "").slice(0, 500));
  console.log("ERROR stderr:", (err.stderr || "").slice(0, 500));
  const kePattern = /KE-\d{3}/g;
  const all = (err.stdout || "") + (err.stderr || "");
  const citedKEs = [...new Set((all.match(kePattern) || []))];
  console.log("Cited KEs:", citedKEs);
}

try { rmSync(workDir, { recursive: true, force: true }); } catch {}
