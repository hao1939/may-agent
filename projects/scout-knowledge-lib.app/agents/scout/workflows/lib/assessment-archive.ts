import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { sourceIdentity } from "./assessment-source.js";

export type AssessmentRecord = { path: string; previous: string };

export function assessmentRecord(
  projectRoot: string,
  source: string,
): AssessmentRecord {
  const root = join(realpathSync(projectRoot), "knowledge", "findings");
  mkdirSync(root, { recursive: true });
  if (realpathSync(root) !== root)
    throw new Error("Assessment root must not redirect outside the library");
  const identity = sourceIdentity(source);
  const matches = readdirSync(root)
    .filter((name) => name.endsWith(".md"))
    .filter((name) => {
      const path = join(root, name);
      if (realpathSync(path) !== path) return false;
      const text = readFileSync(path, "utf8");
      if (text.includes(`Source identity: ${identity}\n`)) return true;
      // Preserve pre-procedure source findings as the same record when unambiguous.
      return text
        .split(/\r?\n/)
        .filter((line) => /^(?:\*\*)?(?:Source|Paper)(?:\*\*)?:/i.test(line))
        .some((line) =>
          (line.match(/https?:\/\/[^\s)>]+/g) ?? []).some((url) => {
            try {
              return sourceIdentity(url) === identity;
            } catch {
              return false;
            }
          }),
        );
    });
  if (matches.length > 1)
    throw new Error(
      "Several source assessments match; the owner must resolve which record fits",
    );
  const key = createHash("sha256").update(identity).digest("hex").slice(0, 12);
  const path = join(
    root,
    matches[0] ??
      `${new Date().toISOString().slice(0, 10)}-source-assessment-${key}.md`,
  );
  return { path, previous: existsSync(path) ? readFileSync(path, "utf8") : "" };
}

// Short filesystem commit only; the existing Task owns retries and continuation.
// Preserve earlier assessments and reject edits observed since analysis began.
// This synchronous compare-and-replace runs in the Host process; it does not
// claim cross-process transactions with independent external filesystem writers.
export function saveAssessment(
  record: AssessmentRecord,
  source: string,
  title: string,
  entry: string,
): string {
  const temporary = `${record.path}.${randomUUID()}.tmp`;
  try {
    if (existsSync(record.path) && realpathSync(record.path) !== record.path)
      throw new Error("Assessment path became a symlink");
    const current = existsSync(record.path)
      ? readFileSync(record.path, "utf8")
      : "";
    if (current !== record.previous)
      throw new Error(
        "Assessment changed during research; retry from current evidence",
      );
    const header = `# ${title.replace(/[\r\n]/g, " ")}\n\nSource identity: ${sourceIdentity(source)}\n`;
    const history = current
      ? `\n<details>\n<summary>Earlier assessments</summary>\n\n${current.trim()}\n\n</details>\n`
      : "";
    const next = `${header}\n${entry.trim()}\n${history}`;
    writeFileSync(temporary, next, { flag: "wx" });
    renameSync(temporary, record.path);
    if (readFileSync(record.path, "utf8") !== next)
      throw new Error("Assessment read-back differs from saved content");
    return record.path;
  } finally {
    rmSync(temporary, { force: true });
  }
}
