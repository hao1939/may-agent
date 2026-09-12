import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type CodexGoalProtocolSnapshot = {
  codexVersion: string;
  generator: string;
  schemas: Record<string, string>;
};

export function parseCodexCliVersion(output: string): string | null {
  return output.trim().match(/^codex-cli\s+(\S+)$/)?.[1] ?? null;
}

export function hashCodexGoalProtocolSchemas(
  generatedDir: string,
  schemaPaths: Iterable<string>,
): Record<string, string> {
  return Object.fromEntries(
    [...schemaPaths].map((relativePath) => [
      relativePath,
      createHash("sha256").update(readFileSync(join(generatedDir, relativePath))).digest("hex"),
    ]),
  );
}

export function codexGoalProtocolDrift(input: {
  snapshot: CodexGoalProtocolSnapshot;
  installedVersion: string | null;
  generatedHashes: Record<string, string>;
}): string[] {
  const findings: string[] = [];
  if (!input.installedVersion) {
    findings.push("could not parse `codex --version`");
  } else if (input.installedVersion !== input.snapshot.codexVersion) {
    findings.push(`Codex CLI version changed: expected ${input.snapshot.codexVersion}, got ${input.installedVersion}`);
  }
  for (const [schemaPath, expectedHash] of Object.entries(input.snapshot.schemas)) {
    const actualHash = input.generatedHashes[schemaPath];
    if (!actualHash) findings.push(`generated schema is missing: ${schemaPath}`);
    else if (actualHash !== expectedHash) findings.push(`generated schema changed: ${schemaPath}`);
  }
  for (const schemaPath of Object.keys(input.generatedHashes)) {
    if (!(schemaPath in input.snapshot.schemas)) findings.push(`unexpected generated schema fingerprint: ${schemaPath}`);
  }
  return findings;
}
