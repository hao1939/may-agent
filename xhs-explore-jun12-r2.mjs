import puppeteer from 'puppeteer-core';

// Round 2: Only the topics we missed in round 1
const SEARCHES = [
  "AI agent 智能体 热门 2026",
  "DeepSeek V4 最新 编程 代码",
  "Qwen3.7 通义千问 最新 编程",
  "AI 程序员 就业 裁员 转型",
  "AI agent 安全 对齐 治理",
  "SkillHub agent skills 开源",
  "AI 一人公司 超级个体 最新",
  "Anthropic Claude 封号 降智 六月",
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
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes&sort=general`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
      
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 500 + Math.random() * 400));
        await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
      }

      const posts = await page.evaluate(() => {
        const items = [];
        const seen = new Set();
        const selectors = ['section.note-item', 'div.note-item', '[class*="note-item"]', 'section[class*="note"]'];
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const title = el.querySelector('[class*="title"], h3, [class*="desc"], a[class*="title"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
            if (title && title.length > 5 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 250), likes: likes || '?', author: author || '?' });
            }
          });
        }
        if (items.length < 3) {
          document.querySelectorAll('section, article, [class*="card"], [class*="feed"]').forEach(el => {
            const title = el.querySelector('[class*="title"], h3, a, [class*="desc"]')?.textContent?.trim();
            const likes = el.querySelector('[class*="like"], [class*="count"]')?.textContent?.trim();
            const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
            if (title && title.length > 8 && title.length < 250 && !seen.has(title)) {
              seen.add(title);
              items.push({ title: title.substring(0, 250), likes: likes || '?', author: author || '?' });
            }
          });
        }
        return items;
      });

      const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 8000) || 'empty');
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — @${p.author}`));
      }
      console.log(`\n--- Text (${pageText.length} chars) ---`);
      console.log(pageText.substring(0, 4000));
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
    
    // Longer delay between queries
    if (qi < SEARCHES.length - 1) {
      const delay = 12000 + Math.random() * 8000;
      console.log(`\n  (waiting ${(delay/1000).toFixed(1)}s...)`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  await page.close();
}

run().catch(e => console.error(e));
