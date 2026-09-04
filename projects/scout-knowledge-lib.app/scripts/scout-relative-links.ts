import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export type MarkdownDocument = {
  path: string;
  contents: string;
};

export type RelativeLinkResult = {
  ok: boolean;
  checked: number;
  errors: string[];
};

function localTarget(rawTarget: string): string | null {
  const target = rawTarget.trim().replace(/^<|>$/g, "");
  if (/^(?:https?:|mailto:|#)/i.test(target)) return null;
  const withoutFragment = target.split("#", 1)[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

function markdownWithoutCode(contents: string): string {
  const lines = contents.split("\n");
  let fence: { marker: "`" | "~"; length: number } | null = null;

  const withoutFences = lines.map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/u)?.[1];
    if (fence) {
      if (
        marker?.[0] === fence.marker &&
        marker.length >= fence.length &&
        new RegExp(`^ {0,3}${fence.marker}{${fence.length},}\\s*$`, "u").test(
          line,
        )
      ) {
        fence = null;
      }
      return "";
    }
    if (marker) {
      fence = { marker: marker[0] as "`" | "~", length: marker.length };
      return "";
    }
    return line;
  });

  return withoutFences.join("\n").replace(/(`+)(?:(?!\1)[\s\S])*?\1/gu, "");
}

export function inspectRelativeLinks(
  documents: MarkdownDocument[],
  pathExists: (path: string) => boolean = existsSync,
): RelativeLinkResult {
  let checked = 0;
  const errors: string[] = [];

  for (const document of documents) {
    const prose = markdownWithoutCode(document.contents);
    for (const match of prose.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = localTarget(match[1]);
      if (!target) continue;
      checked += 1;
      if (isAbsolute(target)) {
        errors.push(`${document.path}: absolute local link ${target}`);
        continue;
      }
      if (!pathExists(resolve(dirname(document.path), target))) {
        errors.push(`${document.path}: missing relative link ${target}`);
      }
    }
  }

  return { ok: errors.length === 0, checked, errors };
}

if (import.meta.main) {
  const projectDir = resolve(import.meta.dir, "../../scout-knowledge-lib");
  const paths = [
    resolve(projectDir, "README.md"),
    resolve(projectDir, "knowledge/README.md"),
    resolve(projectDir, "knowledge/xhs-seed-ledger.md"),
    resolve(projectDir, "knowledge/xhs-topic-map.md"),
    resolve(
      projectDir,
      "reports/research/xhs-seed-first-memory-lanes-2026-09-01.md",
    ),
  ];
  const result = inspectRelativeLinks(
    paths.map((path) => ({ path, contents: readFileSync(path, "utf8") })),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}
