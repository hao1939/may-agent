/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

function platformUiContentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function servePlatformUiFile(req: Request, path: string): Response {
  const stat = statSync(path);
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": platformUiContentTypeFor(path),
    "Cache-Control": "public, no-cache",
    ETag: etag,
  };
  if (
    req.headers
      .get("if-none-match")
      ?.split(",")
      .map((value) => value.trim())
      .includes(etag)
  ) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(readFileSync(path), {
    headers,
  });
}

function isPlatformUiAppRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/index.html") return true;
  if (/^\/(events|agents|metrics|knowledge|terminal|sessions)(?:\/.*)?$/.test(pathname)) return true;
  if (pathname === "/projects") return true;
  if (!pathname.startsWith("/projects/")) return false;
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const last = parts[parts.length - 1];
  const hasSurface = last === "tasks" || last === "functions";
  const idParts = hasSurface ? parts.slice(0, -1) : parts;
  if (!hasSurface && idParts.length === 2) {
    if (["ui", "kanban"].includes(idParts[1])) return false;
    if (/\.[a-z0-9]+$/i.test(idParts[1])) return false;
  }
  return idParts.length === 1 || idParts.length === 2;
}

export function servePlatformUiRequest(req: Request, platformUiDir: string): Response | null {
  const url = new URL(req.url);
  if (req.method !== "GET") return null;

  if (isPlatformUiAppRoute(url.pathname)) {
    const indexPath = resolve(platformUiDir, "index.html");
    return existsSync(indexPath) && statSync(indexPath).isFile() ? servePlatformUiFile(req, indexPath) : null;
  }

  // Top-level platform UI assets: index.html uses relative paths like
  // `styles.css`, `app.js`, `pages/projects.js`. Map those to
  // the selected UI directory. Restricted to known static
  // extensions so /api/foo never falls through to this branch.
  if (!/^\/([\w\-.]+\/)*[\w\-.]+\.(css|js|map|svg|png|jpg|jpeg|gif|webp|ico)$/.test(url.pathname)) {
    return null;
  }

  const assetPath = resolve(platformUiDir, url.pathname.replace(/^\//, ""));
  const rel = relative(platformUiDir, assetPath);
  const inside = rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  if (inside && existsSync(assetPath) && statSync(assetPath).isFile()) return servePlatformUiFile(req, assetPath);
  return null;
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function createStaticAndKnowledgeHandlers(options: {
  sharedRoot: string;
  projectsRoot: string;
  platformUiDir: string;
  appDirForName: (name: string) => string | null;
  json: (data: unknown, status?: number) => Response;
}) {
  const { sharedRoot, projectsRoot, platformUiDir, appDirForName, json } = options;

  function handleBrowse(url: URL): Response {
    const relPath = url.searchParams.get("path") ?? "";
    const absPath = join(sharedRoot, relPath);
    if (!absPath.startsWith(sharedRoot)) return json({ error: "Access denied" }, 403);
    if (!existsSync(absPath)) return json({ error: "Not found" }, 404);

    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      const entries: Array<{ name: string; type: "dir" | "file"; size?: number }> = [];
      for (const name of readdirSync(absPath).sort()) {
        const childPath = join(absPath, name);
        try {
          const childStat = statSync(childPath);
          if (childStat.isDirectory()) {
            entries.push({ name, type: "dir" });
          } else if (name.endsWith(".md") || name.endsWith(".ts") || name.endsWith(".json")) {
            entries.push({ name, type: "file", size: childStat.size });
          }
        } catch {
          /* skip unreadable */
        }
      }
      return json({ path: relPath, type: "dir", entries });
    }
    const content = readFileSync(absPath, "utf-8");
    return json({ path: relPath, type: "file", content });
  }

  function handleKnowledgeSearch(url: URL): Response {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(80, Number(url.searchParams.get("limit") || 40)));
    if (q.length < 2) return json({ query: q, results: [] });

    const roots: Array<{ label: string; dir: string }> = [];
    const sharedKnowledge = resolve(sharedRoot, "knowledge");
    if (existsSync(sharedKnowledge)) roots.push({ label: "shared/knowledge", dir: sharedKnowledge });
    try {
      for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const knowledgeDir = resolve(projectsRoot, entry.name, "knowledge");
        if (existsSync(knowledgeDir)) roots.push({ label: `projects/${entry.name}/knowledge`, dir: knowledgeDir });
      }
    } catch {
      // Keep search available even if projects root is missing.
    }

    const results: Array<Record<string, unknown>> = [];
    const visit = (root: { label: string; dir: string }, dir: string, depth: number) => {
      if (results.length >= limit || depth > 5) return;
      let entries: any[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        if (entry.name.startsWith(".")) continue;
        const abs = resolve(dir, entry.name);
        const rel = relative(root.dir, abs);
        if (rel.startsWith("..") || rel.startsWith("/")) continue;
        if (entry.isDirectory()) {
          visit(root, abs, depth + 1);
          continue;
        }
        if (!/\.(md|json|txt)$/i.test(entry.name)) continue;
        let stat: { size: number } | null = null;
        try {
          stat = statSync(abs);
          if (stat.size > 200_000) continue;
        } catch {
          continue;
        }
        const displayPath = `${root.label}/${rel.replace(/\\/g, "/")}`;
        let content = "";
        try {
          content = readFileSync(abs, "utf-8");
        } catch {
          continue;
        }
        const lowerPath = displayPath.toLowerCase();
        const lowerContent = content.toLowerCase();
        const pathHit = lowerPath.includes(q);
        const contentIdx = lowerContent.indexOf(q);
        if (!pathHit && contentIdx === -1) continue;
        const start = contentIdx === -1 ? 0 : Math.max(0, contentIdx - 90);
        const snippet = content
          .slice(start, Math.min(content.length, start + 240))
          .replace(/\s+/g, " ")
          .trim();
        results.push({
          path: displayPath,
          browsePath: root.label === "shared/knowledge" ? `knowledge/${rel.replace(/\\/g, "/")}` : null,
          source: root.label,
          size: stat.size,
          match: pathHit ? "path" : "content",
          snippet,
        });
      }
    };
    for (const root of roots) visit(root, root.dir, 0);
    return json({ query: q, results });
  }

  function isInsideProjectsRoot(path: string): boolean {
    const rel = relative(projectsRoot, path);
    return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  }

  function projectStaticPathFromUrl(pathname: string): string | null {
    const raw = pathname === "/projects" ? "" : pathname.replace(/^\/projects\/?/, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  function serveFile(path: string): Response {
    return new Response(readFileSync(path), {
      headers: {
        "Content-Type": contentTypeFor(path),
        "Cache-Control": "no-cache",
      },
    });
  }

  function serveProjectDirectory(path: string, urlPath: string): Response {
    const indexPath = join(path, "index.html");
    if (existsSync(indexPath) && statSync(indexPath).isFile()) return serveFile(indexPath);

    const normalizedUrlPath = urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
    const rel = relative(projectsRoot, path);
    const title = rel ? `/projects/${rel}` : "/projects";
    const parent = rel ? `<li><a href="${htmlEscape(normalizedUrlPath)}../">../</a></li>` : "";
    const entries = readdirSync(path)
      .map((name) => {
        const fullPath = join(path, name);
        const stat = statSync(fullPath);
        return { name, isDir: stat.isDirectory(), size: stat.size };
      })
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    const rows = entries
      .map((entry) => {
        const href = `${normalizedUrlPath}${encodeURIComponent(entry.name)}${entry.isDir ? "/" : ""}`;
        const label = `${entry.name}${entry.isDir ? "/" : ""}`;
        const meta = entry.isDir ? "dir" : `${entry.size} bytes`;
        return `<li><a href="${htmlEscape(href)}">${htmlEscape(label)}</a> <span>${htmlEscape(meta)}</span></li>`;
      })
      .join("\n");
    return new Response(
      `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;line-height:1.5}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}ul{list-style:none;padding:0}li{padding:4px 0;border-bottom:1px solid #eee}span{color:#666;margin-left:12px;font-size:12px}</style>
</head><body><h1>${htmlEscape(title)}</h1><ul>${parent}${rows}</ul></body></html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      },
    );
  }

  function serveProjectStatic(pathname: string): Response {
    const relPath = projectStaticPathFromUrl(pathname);
    if (relPath === null) return new Response("Bad path", { status: 400 });
    let absPath = resolve(projectsRoot, relPath);
    if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    if (!existsSync(absPath)) {
      const parts = relPath.split("/").filter(Boolean);
      const [name, area, ...rest] = parts;
      const appDir = appDirForName(name);
      if (appDir && area === "ui") {
        absPath = resolve(appDir, "ui", ...rest);
      } else if (appDir && area === "kanban") {
        absPath = resolve(appDir, "ui", "kanban", ...rest);
      }
      if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    }
    if (!existsSync(absPath)) return new Response("Not found", { status: 404 });
    const stat = statSync(absPath);
    if (stat.isDirectory()) return serveProjectDirectory(absPath, pathname);
    if (stat.isFile()) return serveFile(absPath);
    return new Response("Not found", { status: 404 });
  }

  function serveIndex(): Response {
    const platformUi = resolve(platformUiDir, "index.html");
    if (existsSync(platformUi)) return serveFile(platformUi);
    return serveProjectStatic("/projects");
  }

  return {
    handleBrowse,
    handleKnowledgeSearch,
    serveProjectStatic,
    serveIndex,
  };
}
