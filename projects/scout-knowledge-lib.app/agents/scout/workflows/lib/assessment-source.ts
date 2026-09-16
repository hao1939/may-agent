import { createHash } from "node:crypto";
import { execFile } from "node:child_process";

export type SourcePacket = {
  requestedUrl: string;
  identity: string;
  retrievedUrl: string;
  retrievedAt: string;
  sha256: string;
  format: "pdf" | "text";
  totalCharacters: number;
  totalPages: number;
  excerpts: { page: number; start: number; end: number; text: string }[];
};

export function sourceIdentity(value: string): string {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Source must be an HTTP(S) URL without credentials");
  const arxiv = /^(?:export\.)?arxiv\.org$/i.test(url.hostname)
    ? /^\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/.exec(
        url.pathname,
      )
    : null;
  if (arxiv) return `https://arxiv.org/abs/${arxiv[1]}`;
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (key.startsWith("utm_") || ["_hsenc", "_hsmi"].includes(key))
      url.searchParams.delete(key);
  return url.href;
}

// One bounded extractor; PDF support is an explicit installation prerequisite
// (python3 + pypdf), never an agent-driven package installation during research.
const extractScript = `
import sys, json, io
from html.parser import HTMLParser
data = sys.stdin.buffer.read()
if data.startswith(b'%PDF-'):
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    if len(reader.pages) > 1000: raise ValueError('PDF exceeds 1000 pages')
    pages = [page.extract_text() or '' for page in reader.pages]
else:
    class Text(HTMLParser):
        def __init__(self):
            super().__init__(); self.parts = []; self.hidden = 0
        def handle_starttag(self, tag, attrs):
            if tag in ('script', 'style', 'noscript'): self.hidden += 1
        def handle_endtag(self, tag):
            if tag in ('script', 'style', 'noscript'): self.hidden = max(0, self.hidden - 1)
        def handle_data(self, text):
            if not self.hidden and text.strip(): self.parts.append(text.strip())
    text = data.decode('utf-8', errors='replace')
    parser = Text(); parser.feed(text)
    pages = ['\\n'.join(parser.parts)]
print(json.dumps(pages))
`;

export function extractSource(bytes: Uint8Array): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python3",
      ["-c", extractScript],
      { timeout: 30_000, maxBuffer: 12 * 1024 * 1024 },
      (error, stdout) => {
        if (error)
          return reject(
            new Error(`Source extraction failed: ${error.message}`),
          );
        try {
          resolve(JSON.parse(stdout) as string[]);
        } catch (error) {
          reject(error);
        }
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(bytes);
  });
}

export function selectExcerpts(
  pages: string[],
  budget = 60_000,
): SourcePacket["excerpts"] {
  const total = pages.reduce((sum, page) => sum + page.length, 0);
  const head = total <= budget ? total : Math.floor(budget * 0.75);
  const tailStart = total <= budget ? total : total - (budget - head);
  let offset = 0;
  return pages.flatMap((text, index) => {
    const spans: [number, number][] = [];
    if (offset < head) spans.push([0, Math.min(text.length, head - offset)]);
    if (offset + text.length > tailStart)
      spans.push([Math.max(0, tailStart - offset), text.length]);
    offset += text.length;
    return spans
      .filter(([start, end]) => end > start)
      .map(([start, end]) => ({
        page: index + 1,
        start,
        end,
        text: text.slice(start, end),
      }));
  });
}

export async function readSource(requestedUrl: string): Promise<SourcePacket> {
  const identity = sourceIdentity(requestedUrl);
  const url = new URL(requestedUrl);
  // Resolve arXiv's abstract/HTML view to this paper's PDF, retaining its version.
  if (identity.startsWith("https://arxiv.org/abs/")) {
    url.hostname = "arxiv.org";
    url.pathname = url.pathname.replace(/^\/(abs|html)\//, "/pdf/");
    url.search = "";
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(45_000),
    headers: { "User-Agent": "Scout-source-assessment/1.0" },
  });
  if (!response.ok)
    throw new Error(`Source retrieval returned HTTP ${response.status}`);
  if (!response.body) throw new Error("Source response has no body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error("Source exceeds 25 MiB");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const pages = await extractSource(bytes);
  if (!pages.some((page) => page.trim()))
    throw new Error("Source has no extractable text (OCR may be needed)");
  return {
    requestedUrl,
    identity,
    retrievedUrl: response.url,
    retrievedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    format: bytes.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "text",
    totalCharacters: pages.reduce((sum, page) => sum + page.length, 0),
    totalPages: pages.length,
    excerpts: selectExcerpts(pages),
  };
}

export function coverageEvidence(packet: SourcePacket) {
  return {
    ...packet,
    excerpts: packet.excerpts.map(({ text, ...span }) => ({
      ...span,
      sha256: createHash("sha256").update(text).digest("hex"),
    })),
  };
}

export function coverageSummary(packet: SourcePacket): string {
  const supplied = packet.excerpts.reduce(
    (sum, span) => sum + span.text.length,
    0,
  );
  return `Supplied ${supplied} of ${packet.totalCharacters} extracted characters from ${new Set(packet.excerpts.map((span) => span.page)).size} of ${packet.totalPages} ${packet.format === "pdf" ? "PDF pages" : "text documents"}. This records material supplied, not complete reading or proof verification.`;
}
