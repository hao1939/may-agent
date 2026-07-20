#!/usr/bin/env node
/**
 * XHS (小红书) Browser Tool
 * Uses Chrome DevTools Protocol to browse xiaohongshu.com
 * Chrome must be running visible (non-headless) on DISPLAY=:99 with --remote-debugging-port=9222
 *
 * Commands:
 *   status                - Check whether the browser session can read XHS
 *   feed                  - Get explore feed items
 *   search <keyword>      - Search for notes
 *   read <url>            - Read a specific note (must include xsec_token)
 *   scroll                - Scroll feed and get more items
 */

import http from "node:http";

const CDP_PORT = 9222;
const CDP_HOST = "localhost";

// --- CDP helpers ---

function cdpGet(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://${CDP_HOST}:${CDP_PORT}${path}`, (res) => {
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
      `http://${CDP_HOST}:${CDP_PORT}${path}`,
      { method: "PUT" },
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

async function getXHSTab() {
  const tabs = await cdpGet("/json/list");
  const xhsTab = tabs.find(
    (t) => t.url.includes("xiaohongshu.com") && t.type === "page",
  );
  if (xhsTab) return xhsTab;
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
      const noteCount = document.querySelectorAll(
        'section.note-item, a[href*="xsec_token"], a[href*="/explore/"]'
      ).length;
      const loginWall = /扫码登录|手机号登录|登录后查看更多|请先登录/.test(body);
      const ready = noteCount > 0 && !loginWall;
      return {
        ready,
        url: window.location.href,
        noteCount,
        loginWall,
        reason: ready
          ? 'source content is readable'
          : (loginWall ? 'XHS browser login is required' : 'no readable XHS source content found')
      };
    })()
  `);
  return result;
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
    const tab = await getXHSTab();
    cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send("Runtime.enable");

    let result;
    switch (command) {
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
            ". Use: status, feed, search, read, scroll",
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

main();
