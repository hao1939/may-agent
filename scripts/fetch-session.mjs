// Fetch a session viewer page and extract the rendered turn content.
import puppeteer from "/app/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { writeFileSync } from "node:fs";

const URL = "http://localhost:8080/#/sessions/s_1778916277917_374";
const OUT = "/app/.state/session-dump.json";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-setuid-sandbox"],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (/error/i.test(m.type()) || /404|500/.test(t)) console.log("[console]", m.type(), t);
  });

  await page.goto(URL, { waitUntil: "networkidle0", timeout: 15000 });
  // Wait for some session content to render
  await new Promise(r => setTimeout(r, 2500));

  const dump = await page.evaluate(() => {
    function snip(s, n = 4000) { return (s || "").length > n ? s.slice(0, n) + " …[truncated " + (s.length - n) + " chars]" : s; }
    const out = {
      hash: location.hash,
      title: document.title,
      mainText: snip(document.body.innerText, 400),
    };
    // Common session-viewer containers — try a few selector patterns
    const candidates = [
      "#sessions-content",
      "#session-content",
      "#chat-history",
      ".session-turns",
      ".turn",
      "[data-turn]",
    ];
    out.containers = candidates.map(sel => ({
      sel,
      count: document.querySelectorAll(sel).length,
    }));
    // Grab the largest text-bearing block under the main content area
    const main =
      document.querySelector("#sessions-content") ||
      document.querySelector("#session-content") ||
      document.querySelector("main") ||
      document.body;
    out.mainHtmlSnippet = snip(main?.innerHTML || "", 12000);
    out.mainTextSnippet = snip(main?.innerText || "", 30000);
    // Look for anything that resembles per-turn structure
    out.h2s = [...document.querySelectorAll("h2,h3,h4")].map(h => h.textContent.trim()).slice(0, 40);
    return out;
  });

  writeFileSync(OUT, JSON.stringify(dump, null, 2));
  console.log("Saved dump to", OUT);
  console.log("hash:", dump.hash);
  console.log("h2/h3/h4 found:", dump.h2s.length);
  console.log("containers:", dump.containers.filter(c => c.count > 0));
  console.log("\n--- mainText (preview) ---\n" + dump.mainTextSnippet.slice(0, 4000));
} finally {
  await browser.close();
}
