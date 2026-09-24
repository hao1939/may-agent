#!/usr/bin/env node
/**
 * XHS (小红书) Browser Tool
 * Uses Chrome DevTools Protocol to browse xiaohongshu.com
 * Chrome must be running visible (non-headless) on DISPLAY=:99 with --remote-debugging-port=9222
 * Override endpoint wiring with SCOUT_XHS_CDP_HOST and SCOUT_XHS_CDP_PORT.
 *
 * Commands:
 *   status                - Check whether the browser session can read XHS
 *   prepare               - Open an absent XHS tab, then check access
 *   saved-status          - Inspect saved-profile availability without navigation
 *   feed                  - Get explore feed items
 *   search <keyword>      - Search for notes
 *   read <url>            - Read a specific note (must include xsec_token)
 *   scroll                - Scroll feed and get more items
 */

import { createHash } from "node:crypto";
import http from "node:http";
import {
  resolveXhsCdpEndpoint,
  selectXhsCdpTab,
  selectXhsProfileHistoryTarget,
  summarizeXhsPageStatus,
} from "./xhs-cdp-config.mjs";

let CDP_HOST;
let CDP_PORT;

// --- CDP helpers ---

function cdpGet(path) {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: CDP_HOST, port: CDP_PORT, path }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`Bad JSON from ${path}: ${d.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

function cdpPut(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: CDP_HOST, port: CDP_PORT, path, method: "PUT" },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(new Error(`Bad JSON from PUT ${path}: ${d.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function getXHSTab(openIfMissing = false) {
  const tabs = await cdpGet("/json/list");
  const xhsTab = selectXhsCdpTab(tabs);
  if (xhsTab) return xhsTab;
  if (openIfMissing) {
    const tab = await cdpPut(
      "/json/new?" + encodeURIComponent("https://www.xiaohongshu.com/explore"),
    );
    if (!tab.webSocketDebuggerUrl)
      throw new Error("Chrome did not return a usable XHS tab");
    // Give the newly opened page the same bounded load time as navigation.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    return tab;
  }
  throw new Error(
    "No XHS tab found. Chrome must be running with xiaohongshu.com open.",
  );
}

// Simple CDP client using pending callbacks map
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map(); // id -> {resolve, reject}
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.ws.onmessage = (evt) => {
          const raw =
            typeof evt.data === "string" ? evt.data : evt.data.toString();
          let msg;
          try {
            msg = JSON.parse(raw);
          } catch {
            return;
          }
          if (msg.id != null && this.pending.has(msg.id)) {
            const cb = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) cb.reject(new Error(`CDP: ${msg.error.message}`));
            else cb.resolve(msg.result);
          }
        };
        resolve();
      };
      this.ws.onerror = (e) => reject(new Error("WebSocket failed"));
      setTimeout(() => reject(new Error("WebSocket connect timeout")), 5000);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout: ${method}`));
        }
      }, 20000);
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `JS: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result.value;
  }

  async navigate(url) {
    await this.send("Page.enable");
    await this.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 4000));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

// --- Commands ---

// Extract feed/search items with full links (including xsec_token)
const EXTRACT_ITEMS_JS = `
  (function() {
    const items = [];
    const sections = document.querySelectorAll('section.note-item, section');
    sections.forEach(sec => {
      // Prefer anchor with xsec_token (the visible cover link), fall back to any explore link
      const anchor = sec.querySelector('a[href*="xsec_token"]') || sec.querySelector('a[href*="/explore/"]') || sec.querySelector('a[href*="/search_result/"]');
      if (!anchor) return;
      const titleEl = sec.querySelector('.title span') || sec.querySelector('.title') || sec.querySelector('h3');
      const authorEl = sec.querySelector('.author .name') || sec.querySelector('.author-wrapper .name') || sec.querySelector('.name');
      const likeEl = sec.querySelector('.like-wrapper .count') || sec.querySelector('.count');
      const imgEl = sec.querySelector('img');
      const href = anchor.getAttribute('href') || '';
      const id = href.split('/').pop().split('?')[0];
      const fullUrl = anchor.href;  // absolute URL with query params including xsec_token
      items.push({
        id,
        title: titleEl ? titleEl.innerText.trim() : '',
        author: authorEl ? authorEl.innerText.trim() : '',
        likes: likeEl ? likeEl.innerText.trim() : '0',
        cover: imgEl ? imgEl.src : '',
        link: fullUrl
      });
    });
    return items.filter(i => i.title);
  })()
`;

async function handleFeed(cdp) {
  const currentUrl = await cdp.evaluate("window.location.href");
  if (!currentUrl.includes("/explore")) {
    await cdp.navigate("https://www.xiaohongshu.com/explore");
  }
  return await cdp.evaluate(EXTRACT_ITEMS_JS);
}

async function handleStatus(cdp) {
  const result = await cdp.evaluate(`
    (function() {
      const body = document.body?.innerText || '';
      const hrefs = Array.from(document.querySelectorAll(
        'a[href*="xsec_token"], a[href*="/explore/"], a[href*="/search_result/"], a[href*="/discovery/item/"]'
      ), anchor => anchor.href);
      const summarize = ${summarizeXhsPageStatus.toString()};
      return {
        url: window.location.href,
        ...summarize({
          body,
          hrefs,
          sectionCount: document.querySelectorAll('section.note-item').length
        })
      };
    })()
  `);
  return result;
}

function savedProfileFetchExpression(requestUrl) {
  return `
    (async function() {
      const response = await fetch(${JSON.stringify(requestUrl)}, {
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow'
      });
      const text = await response.text();
      const bytes = new TextEncoder().encode(text);
      const digest = async (value) => Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', value)),
        byte => byte.toString(16).padStart(2, '0')
      ).join('');
      const documentCopy = new DOMParser().parseFromString(text, 'text/html');
      const ids = [...new Set(
        Array.from(documentCopy.querySelectorAll('a[href]'), anchor => anchor.href)
          .map(href => href.match(/\\\/(?:explore|search_result|discovery\\\/item)\\\/([0-9a-f]{24})(?:[/?#]|$)/i)?.[1]?.toLowerCase())
          .filter(Boolean)
      )].sort();
      const finalUrl = new URL(response.url);
      const xhsHost = finalUrl.hostname === 'xiaohongshu.com' ||
        finalUrl.hostname.endsWith('.xiaohongshu.com');
      const finalLocation = !xhsHost
        ? 'external'
        : finalUrl.pathname === '/login'
          ? 'login'
          : /^\\\/user\\\/profile\\\/[0-9a-f]{24}\\\/?$/i.test(finalUrl.pathname)
            ? 'profile'
            : 'other-xhs';
      return {
        httpStatus: response.status,
        contentType: response.headers.get('content-type') || '',
        finalLocation,
        byteLength: bytes.byteLength,
        bodySha256: await digest(bytes),
        attributableItemCount: ids.length,
        idFingerprint: await digest(new TextEncoder().encode(ids.join('\\n'))),
        loginWall: finalLocation === 'login' || /登录|扫码登录|手机号登录/.test(text)
      };
    })()
  `;
}

function safeSavedProfileSummary(value) {
  const sha256 = /^[0-9a-f]{64}$/;
  const locations = new Set(["external", "login", "profile", "other-xhs"]);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Number.isInteger(value.httpStatus) ||
    value.httpStatus < 100 ||
    value.httpStatus > 599 ||
    typeof value.contentType !== "string" ||
    !locations.has(value.finalLocation) ||
    !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 0 ||
    typeof value.bodySha256 !== "string" ||
    !sha256.test(value.bodySha256) ||
    !Number.isSafeInteger(value.attributableItemCount) ||
    value.attributableItemCount < 0 ||
    typeof value.idFingerprint !== "string" ||
    !sha256.test(value.idFingerprint) ||
    typeof value.loginWall !== "boolean"
  ) {
    throw new Error("Saved-profile status returned an invalid summary");
  }

  return {
    httpStatus: value.httpStatus,
    contentType: value.contentType.slice(0, 120),
    finalLocation: value.finalLocation,
    byteLength: value.byteLength,
    bodySha256: value.bodySha256,
    attributableItemCount: value.attributableItemCount,
    idFingerprint: value.idFingerprint,
    loginWall: value.loginWall,
  };
}

/**
 * Fingerprint only the supported semantic access boundary. Exact response byte
 * length and body hash remain separate provenance and cannot perturb this value.
 */
export const XHS_SAVED_PROFILE_ACCESS_FINGERPRINT_VERSION = 2;

export function fingerprintXhsSavedProfileAccess(value) {
  const sha256 = /^[0-9a-f]{64}$/;
  const allowedKeys = new Set(["tab", "subTab"]);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.targetEvidenceSha256 !== "string" ||
    !sha256.test(value.targetEvidenceSha256) ||
    !Array.isArray(value.targetQueryKeys) ||
    value.targetQueryKeys.some(
      (key) => typeof key !== "string" || !allowedKeys.has(key),
    ) ||
    new Set(value.targetQueryKeys).size !== value.targetQueryKeys.length ||
    JSON.stringify(value.targetQueryKeys) !==
      JSON.stringify([...value.targetQueryKeys].sort())
  ) {
    throw new Error("Saved-profile access evidence is invalid");
  }

  const summary = safeSavedProfileSummary({
    ...value,
    bodySha256: "0".repeat(64),
  });
  return createHash("sha256")
    .update(
      JSON.stringify([
        `xhs-saved-profile-access/v${XHS_SAVED_PROFILE_ACCESS_FINGERPRINT_VERSION}`,
        value.targetEvidenceSha256,
        value.targetQueryKeys,
        summary.httpStatus,
        summary.contentType,
        summary.finalLocation,
        summary.attributableItemCount,
        summary.idFingerprint,
        summary.loginWall,
      ]),
    )
    .digest("hex");
}

const XHS_SAVED_PROFILE_ACCESS_FIELDS = [
  "targetEvidenceSha256",
  "targetQueryKeys",
  "httpStatus",
  "contentType",
  "finalLocation",
  "attributableItemCount",
  "idFingerprint",
  "loginWall",
];

function comparableXhsSavedProfileAccess(value) {
  fingerprintXhsSavedProfileAccess(value);
  const summary = safeSavedProfileSummary(value);
  return {
    targetEvidenceSha256: value.targetEvidenceSha256,
    targetQueryKeys: value.targetQueryKeys,
    httpStatus: summary.httpStatus,
    contentType: summary.contentType,
    finalLocation: summary.finalLocation,
    byteLength: summary.byteLength,
    attributableItemCount: summary.attributableItemCount,
    idFingerprint: summary.idFingerprint,
    loginWall: summary.loginWall,
    bodySha256: summary.bodySha256,
  };
}

/**
 * Compare raw observations under the current semantic access contract without
 * returning any evidence value. Persisted fingerprint values and versions are
 * deliberately not treated as input identity. Exact byte-length and body drift
 * remain separate provenance signals.
 */
export function compareXhsSavedProfileAccess(previous, current) {
  const before = comparableXhsSavedProfileAccess(previous);
  const after = comparableXhsSavedProfileAccess(current);
  const changedAccessFields = XHS_SAVED_PROFILE_ACCESS_FIELDS.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
  return {
    equivalent: changedAccessFields.length === 0,
    changedAccessFields,
    byteLengthChanged: before.byteLength !== after.byteLength,
    bodyChanged: before.bodySha256 !== after.bodySha256,
  };
}

function historyTabRank(tab) {
  try {
    return new URL(tab.url).pathname === "/login" ? 0 : 1;
  } catch {
    return 2;
  }
}

/**
 * Inspect one credential-safe saved-profile history target without navigating
 * any tab. The injectable client factory keeps the access contract executable
 * in tests without a browser or simulated source data.
 */
export async function inspectXhsSavedProfileStatus(
  tabs,
  clientFactory = (wsUrl) => new CDPClient(wsUrl),
) {
  if (!Array.isArray(tabs)) {
    throw new Error("DevTools page targets must be an array");
  }

  const candidates = tabs
    .filter(
      (tab) =>
        selectXhsCdpTab([tab]) &&
        typeof tab.webSocketDebuggerUrl === "string" &&
        tab.webSocketDebuggerUrl,
    )
    .sort((left, right) => historyTabRank(left) - historyTabRank(right));

  for (const tab of candidates) {
    const cdp = clientFactory(tab.webSocketDebuggerUrl);
    try {
      await cdp.connect();
      await cdp.send("Runtime.enable");
      const history = await cdp.send("Page.getNavigationHistory");
      const target = selectXhsProfileHistoryTarget(history?.entries);
      if (!target) continue;

      const observed = safeSavedProfileSummary(
        await cdp.evaluate(savedProfileFetchExpression(target.requestUrl)),
      );
      const targetEvidenceSha256 = createHash("sha256")
        .update(target.evidenceUrl)
        .digest("hex");
      const accessFingerprint = fingerprintXhsSavedProfileAccess({
        targetEvidenceSha256,
        targetQueryKeys: target.queryKeys,
        ...observed,
      });
      return {
        ready:
          observed.finalLocation === "profile" &&
          !observed.loginWall &&
          observed.attributableItemCount > 0,
        targetEvidenceSha256,
        targetQueryKeys: target.queryKeys,
        accessFingerprintVersion: XHS_SAVED_PROFILE_ACCESS_FINGERPRINT_VERSION,
        accessFingerprint,
        ...observed,
      };
    } finally {
      cdp.close();
    }
  }

  return {
    ready: false,
    reason: "no credential-safe saved profile found in XHS page history",
  };
}

async function handleScroll(cdp) {
  await cdp.evaluate("window.scrollBy(0, 800)");
  await new Promise((r) => setTimeout(r, 2000));
  return await handleFeed(cdp);
}

async function handleSearch(cdp, keyword) {
  if (!keyword) throw new Error("Search keyword required");
  const encoded = encodeURIComponent(keyword);
  const url =
    "https://www.xiaohongshu.com/search_result?keyword=" +
    encoded +
    "&source=web_search_result_notes";
  await cdp.navigate(url);
  await new Promise((r) => setTimeout(r, 2000));
  return await cdp.evaluate(EXTRACT_ITEMS_JS);
}

async function handleRead(cdp, urlOrId) {
  if (!urlOrId)
    throw new Error(
      "URL required. Use the full link from feed/search (includes xsec_token).",
    );

  let url = urlOrId;
  // If just an ID without token, warn but try anyway
  if (!url.startsWith("http")) {
    url = "https://www.xiaohongshu.com/explore/" + url;
  }

  // Open a new tab for the note — XHS renders note detail only on direct page load with xsec_token
  const newTab = await cdpPut("/json/new?" + url);
  const tabCdp = new CDPClient(newTab.webSocketDebuggerUrl);
  await tabCdp.connect();
  await tabCdp.send("Runtime.enable");

  // Wait for page to fully load
  await new Promise((r) => setTimeout(r, 6000));

  const result = await tabCdp.evaluate(`
    (function() {
      const body = document.body.innerText;
      const container = document.querySelector('#noteContainer');
      const noteType = container?.getAttribute('data-type') || 'unknown'; // 'video' or 'normal'

      // Title
      const titleEl = document.querySelector('#detail-title') || document.querySelector('.title');
      
      // Description (hashtags and text below title)
      const descEl = document.querySelector('#detail-desc');
      
      // Author - use .username span inside .author-wrapper
      const authorEl = document.querySelector('.username') || document.querySelector('.name');
      
      // Date - in .bottom-container
      const dateEl = document.querySelector('.bottom-container') || document.querySelector('.date');
      
      // Engagement — extract numbers from the engagement bar
      function getCount(selector) {
        const el = document.querySelector(selector);
        if (!el) return '';
        const text = el.innerText.trim();
        // If it's a number (possibly with 万/k suffix), use it
        if (/^[\d.]+[万kK]?$/.test(text)) return text;
        // Otherwise try .count child
        const countEl = el.querySelector('.count');
        if (countEl) {
          const ct = countEl.innerText.trim();
          if (/^[\d.]+[万kK]?$/.test(ct)) return ct;
        }
        // Return the text anyway (e.g. '赞' means liked)
        return text;
      }
      const likes = getCount('.like-wrapper');
      const collects = getCount('.collect-wrapper');
      const commentCount = getCount('.chat-wrapper');

      // Tags from description links
      const tagEls = document.querySelectorAll('#detail-desc a');
      const tags = Array.from(tagEls).map(el => el.innerText.trim()).filter(t => t.startsWith('#'));

      // Comments — use .parent-comment to avoid duplicates
      const comments = [];
      const seen = new Set();
      document.querySelectorAll('.parent-comment').forEach(parent => {
        // Main comment
        const mainItem = parent.querySelector('.comment-item');
        if (mainItem) {
          const content = mainItem.querySelector('.content');
          const author = mainItem.querySelector('.name');
          const key = (author?.innerText || '') + ':' + (content?.innerText || '');
          if (content && !seen.has(key)) {
            seen.add(key);
            comments.push({
              author: author ? author.innerText.trim() : '',
              text: content.innerText.trim().slice(0, 300)
            });
          }
        }
        // Sub-comments
        parent.querySelectorAll('.comment-item-sub').forEach(sub => {
          const content = sub.querySelector('.content');
          const author = sub.querySelector('.name');
          const key = (author?.innerText || '') + ':' + (content?.innerText || '');
          if (content && !seen.has(key)) {
            seen.add(key);
            comments.push({
              author: author ? author.innerText.trim() : '',
              text: content.innerText.trim().slice(0, 300),
              isReply: true
            });
          }
        });
      });

      // Images — deduplicate by URL path (ignore CDN signing params)
      const imgSet = new Set();
      const imgs = [];
      document.querySelectorAll('img[src*="xhscdn"]').forEach(img => {
        if (img.src && !img.src.includes('avatar')) {
          // Normalize URL for dedup (remove CDN signing prefix)
          const path = img.src.replace(/https?:\\/\\/[^/]+\\/[^/]+\\/[^/]+\\//, '');
          if (!imgSet.has(path)) {
            imgSet.add(path);
            imgs.push(img.src);
          }
        }
      });

      return {
        noteType,
        title: titleEl ? titleEl.innerText.trim() : '',
        description: descEl ? descEl.innerText.trim() : '',
        author: authorEl ? authorEl.innerText.trim() : '',
        date: dateEl ? dateEl.innerText.trim() : '',
        likes,
        collects,
        commentCount,
        tags,
        comments: comments.slice(0, 20),
        images: imgs.slice(0, 10),
        url: window.location.href,
        // Fallback: raw text if structured extraction missed things
        rawText: body.slice(0, 3000)
      };
    })()
  `);

  // Close the tab
  try {
    await tabCdp.send("Page.close");
  } catch (e) {
    /* ignore */
  }
  tabCdp.close();

  return result;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args.slice(1).join(" ");

  if (!command) {
    console.log(
      JSON.stringify({
        status: "help",
        commands: [
          "status",
          "prepare",
          "saved-status",
          "feed",
          "search <keyword>",
          "read <full_url_from_feed>",
          "scroll",
        ],
      }),
    );
    process.exit(0);
  }

  let cdp;
  try {
    const endpoint = resolveXhsCdpEndpoint();
    CDP_HOST = endpoint.host;
    CDP_PORT = endpoint.port;

    if (command === "saved-status") {
      const tabs = await cdpGet("/json/list");
      const result = await inspectXhsSavedProfileStatus(tabs);
      console.log(JSON.stringify({ status: "success", data: result }, null, 2));
      process.exit(0);
    }

    const tab = await getXHSTab(
      ["prepare", "feed", "search", "read", "scroll"].includes(command),
    );
    cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable");

    let result;
    switch (command) {
      case "prepare":
      case "status":
        result = await handleStatus(cdp);
        break;
      case "feed":
        result = await handleFeed(cdp);
        break;
      case "search":
        result = await handleSearch(cdp, param);
        break;
      case "read":
        result = await handleRead(cdp, param);
        break;
      case "scroll":
        result = await handleScroll(cdp);
        break;
      default:
        throw new Error(
          "Unknown command: " +
            command +
            ". Use: status, prepare, saved-status, feed, search, read, scroll",
        );
    }

    console.log(JSON.stringify({ status: "success", data: result }, null, 2));
    cdp.close();
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({ status: "error", error: err.message }));
    if (cdp) cdp.close();
    process.exit(1);
  }
}

if (import.meta.main) main();
