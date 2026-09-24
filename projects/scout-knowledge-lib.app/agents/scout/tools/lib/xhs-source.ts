import { spawnSync } from "node:child_process";
import { join } from "node:path";

export type XhsSearchItem = {
  id: string;
  title: string;
  author: string;
  likes: string;
  link: string;
};

export type XhsSearchResult =
  | {
      state: "success";
      query: string;
      items: XhsSearchItem[];
      evidence: string[];
    }
  | {
      state: "failed";
      query: string;
      reason: string;
      evidence: string[];
    };

type XhsSearchOutput = {
  status?: unknown;
  data?: unknown;
  error?: unknown;
};

function compactItem(value: unknown): XhsSearchItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const link = typeof item.link === "string" ? item.link.trim() : "";
  if (!id || !title || !link) return null;
  return {
    id,
    title,
    author: String(item.author ?? "").trim(),
    likes: String(item.likes ?? "").trim(),
    link,
  };
}

export function parseXhsSearchOutput(
  query: string,
  stdout: string,
  stderr = "",
  exitCode = 0,
): XhsSearchResult {
  const raw = stdout.trim() || stderr.trim();
  let parsed: XhsSearchOutput;
  try {
    parsed = JSON.parse(raw) as XhsSearchOutput;
  } catch {
    return {
      state: "failed",
      query,
      reason: "XHS search returned invalid JSON",
      evidence: [
        `exit:${exitCode}`,
        raw ? "output:invalid-json" : "output:empty",
      ],
    };
  }

  if (
    exitCode !== 0 ||
    !parsed ||
    parsed.status !== "success" ||
    !Array.isArray(parsed.data)
  ) {
    return {
      state: "failed",
      query,
      reason: String(parsed?.error ?? "XHS search failed"),
      evidence: [`exit:${exitCode}`],
    };
  }

  const items = parsed.data
    .map(compactItem)
    .filter((item): item is XhsSearchItem => item !== null);
  const discarded = parsed.data.length - items.length;
  if (parsed.data.length > 0 && items.length === 0) {
    return {
      state: "failed",
      query,
      reason:
        "XHS search returned records, but none had usable identity, title and link",
      evidence: [
        `source:xhs`,
        `query:${query}`,
        `discarded-items:${discarded}`,
      ],
    };
  }
  const ids = items.slice(0, 10).map((item) => item.id);
  return {
    state: "success",
    query,
    items,
    evidence: [
      `source:xhs`,
      `query:${query}`,
      `items:${items.length}`,
      ...(ids.length > 0 ? [`source-ids:${ids.join(",")}`] : []),
      ...(discarded > 0
        ? [`discarded-items:${discarded}`, "observation:partial"]
        : []),
    ],
  };
}

export function searchXhs(appDir: string, query: string): XhsSearchResult {
  const toolPath = join(appDir, "agents", "scout", "tools", "xhs-browse.mjs");
  const result = spawnSync("node", [toolPath, "search", query], {
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.error) {
    return {
      state: "failed",
      query,
      reason: `XHS search could not run: ${result.error.message}`,
      evidence: [],
    };
  }
  return parseXhsSearchOutput(
    query,
    result.stdout ?? "",
    result.stderr ?? "",
    result.status ?? 1,
  );
}
