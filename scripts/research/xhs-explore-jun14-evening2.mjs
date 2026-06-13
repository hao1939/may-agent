import puppeteer from 'puppeteer-core';

// Second pass — shorter queries, longer delays
const SEARCHES = [
  "Claude Code 最新",
  "AI agent 2026 热门",
  "一人公司 AI 超级个体",
  "Loop Engineering 循环",
  "Kimi K2 code",
  "AI 副业 赚钱 2026",
  "WWDC 2026 AI 苹果",
  "字节跳动 豆包 AI agent",
];

const WS = 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109';

async function run() {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

  for (let qi = 0; qi < SEARCHES.length; qi++) {
    const query = SEARCHES[qi];
    console.log(`\n[${qi+1}/${SEARCHES.length}] ========== ${query} ==========`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general&type=51`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));

      const pageTitle = await page.title();
      if (pageTitle.includes('Security') || pageTitle.includes('Verification') || pageTitle.includes('Login')) {
        console.log(`⚠️ BLOCKED. Skipping.`);
        await new Promise(r => setTimeout(r, 20000 + Math.random() * 15000));
        continue;
      }

      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 500));
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      }

      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        document.querySelectorAll('section.note-item, section, div[class*="note"], a[class*="cover"]').forEach(el => {
          const titleEl = el.querySelector('.title span, .title, h3, [class*="title"]');
          const likesEl = el.querySelector('.like-wrapper .count, .count, [class*="like"] .count, [class*="count"]');
          const authorEl = el.querySelector('.author .name, .name, [class*="author"] .name');
          const title = titleEl?.textContent?.trim();
          const likes = likesEl?.textContent?.trim();
          const author = authorEl?.textContent?.trim();
          if (title && title.length > 5 && !seen.has(title)) {
            seen.add(title);
            items.push({ title: title.substring(0, 300), likes: likes || '?', author: author || '?' });
          }
        });
        return items;
      });

      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — @${p.author}`));
      } else {
        const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 5000) || 'empty');
        const lines = pageText.split('\n').filter(l => l.trim().length > 3);
        console.log('Text excerpt:');
        console.log(lines.slice(0, 30).join('\n'));
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }

    if (qi < SEARCHES.length - 1) {
      const delay = 15000 + Math.random() * 10000;
      console.log(`  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  await page.close();
}

run().catch(e => console.error(e));
