import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ProcessRow = { pid: number; parentPid: number; rssKiB: number };

export function parseProcessRows(text: string): ProcessRow[] {
  const rows: ProcessRow[] = [];
  for (const line of text.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (!match) continue;
    rows.push({ pid: Number(match[1]), parentPid: Number(match[2]), rssKiB: Number(match[3]) });
  }
  return rows;
}

export function processTreeRssKiB(rows: ProcessRow[], rootPid: number): number | null {
  const byParent = new Map<number, number[]>();
  for (const row of rows) {
    const children = byParent.get(row.parentPid) ?? [];
    children.push(row.pid);
    byParent.set(row.parentPid, children);
  }
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  if (!byPid.has(rootPid)) return null;
  const pending = [rootPid];
  const visited = new Set<number>();
  let total = 0;
  while (pending.length > 0) {
    const pid = pending.pop()!;
    if (visited.has(pid)) continue;
    visited.add(pid);
    total += byPid.get(pid)?.rssKiB ?? 0;
    pending.push(...(byParent.get(pid) ?? []));
  }
  return total;
}

/** Linux/container PoC sampler. Measurement failure is reported as null. */
export async function sampleProcessTreeRssKiB(rootPid: number | null): Promise<number | null> {
  if (!rootPid) return null;
  try {
    const { stdout } = await execFileAsync("ps", ["-e", "-o", "pid=,ppid=,rss="], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    return processTreeRssKiB(parseProcessRows(stdout), rootPid);
  } catch {
    return null;
  }
}
