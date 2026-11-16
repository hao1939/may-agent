#!/usr/bin/env bun
// Deprecated command entry: archived scenario validation, never active ownership.
if (!process.argv.includes("--legacy")) process.argv.push("--legacy");
await import("../cases/validate-cli");
export {};
