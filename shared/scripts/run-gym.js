#!/usr/bin/env node
/**
 * Agent Gym Runner
 *
 * Runs adversarial scenario tests from test/gym/.
 * Usage: node agents/shared/scripts/run-gym.js [scenario]
 *
 * Examples:
 *   node agents/shared/scripts/run-gym.js              # Run all scenarios
 *   node agents/shared/scripts/run-gym.js circular      # Run matching scenarios
 */

import { execSync } from "node:child_process";

const filter = process.argv[2] || "";
const filterArg = filter ? `-t "${filter}"` : "";

try {
  execSync(`npx vitest --run test/gym/gym.test.ts ${filterArg}`, {
    cwd: process.env.PROJECT_ROOT || "/app",
    stdio: "inherit",
  });
} catch {
  process.exit(1);
}
