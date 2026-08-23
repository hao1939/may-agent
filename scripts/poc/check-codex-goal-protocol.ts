import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  codexGoalProtocolDrift,
  hashCodexGoalProtocolSchemas,
  parseCodexCliVersion,
  type CodexGoalProtocolSnapshot,
} from "./codex-goal-protocol.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(
  readFileSync(join(scriptDir, "codex-goal-protocol.snapshot.json"), "utf8"),
) as CodexGoalProtocolSnapshot;
const generatedDir = mkdtempSync(join(tmpdir(), "may-codex-goal-protocol-"));

try {
  const versionOutput = execFileSync("codex", ["--version"], { encoding: "utf8" });
  execFileSync("codex", ["app-server", "generate-json-schema", "--out", generatedDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const generatedHashes = hashCodexGoalProtocolSchemas(generatedDir, Object.keys(snapshot.schemas));
  const findings = codexGoalProtocolDrift({
    snapshot,
    installedVersion: parseCodexCliVersion(versionOutput),
    generatedHashes,
  });
  if (findings.length > 0) throw new Error(`Codex goal protocol drift:\n- ${findings.join("\n- ")}`);
  process.stdout.write(
    `Codex goal protocol matches ${snapshot.codexVersion} (${Object.keys(snapshot.schemas).length} schemas).\n`,
  );
} finally {
  rmSync(generatedDir, { recursive: true, force: true });
}
