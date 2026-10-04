import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { readFileWritePolicy } from "../../projects/may-agent/src/lib/tools/file-write-policy.js";
import { checkCrossEditGuard } from "../../projects/may-agent/src/lib/tools/cross-edit-guard.js";

const root = resolve(import.meta.dir, "../..");
const policy = readFileWritePolicy(resolve(root, "shared"), root);
const blocked = (path: string, agent: string) => checkCrossEditGuard(resolve(root, path), agent, root, policy).blocked;

test("installation keeps privileged edits explicit and evaluation criteria protected", () => {
  for (const path of ["projects/alex.app/criteria/criteria.md", "projects/alex.app/criteria/scoring.md"]) {
    for (const agent of ["alex", "bob", "scout", "tech-lead"]) expect(blocked(path, agent)).toBe(true);
    for (const agent of ["may", "evaluator"]) expect(blocked(path, agent)).toBe(false);
  }
  const config = "projects/alex.app/agents/bob/agent.json";
  expect(blocked(config, "may")).toBe(false);
  expect(blocked(config, "tech-lead")).toBe(false);
  expect(blocked(config, "bob")).toBe(true);
  expect(blocked("shared/common-sense.md", "may")).toBe(false);
  expect(blocked("shared/common-sense.md", "alex")).toBe(true);
  expect(blocked("shared/file-write-policy.json", "may")).toBe(true);
  expect(blocked("projects/alex.app/agents/bob/AGENTS.md", "bob")).toBe(false);
});
